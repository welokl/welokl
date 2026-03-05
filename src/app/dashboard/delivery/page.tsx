'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; type: string; delivery_address: string | null
  delivery_lat: number | null; delivery_lng: number | null
  delivery_partner_id: string | null; customer_id: string
  created_at: string
  shop: { name: string; address: string; phone: string; latitude: number; longitude: number } | null
  items: { product_name: string; quantity: number; price: number }[]
  customer: { name: string; phone: string } | null
}
interface Partner { user_id: string; is_online: boolean; rating: number; total_deliveries: number; today_deliveries: number; vehicle_type: string; current_lat: number | null; current_lng: number | null }
interface Wallet { balance: number; total_earned: number }

export default function DeliveryDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [userName, setUserName] = useState('')
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [completedToday, setCompletedToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [accepting, setAccepting] = useState<string | null>(null)

  const loadData = useCallback(async (userId?: string) => {
    const supabase = createClient()
    const uid = userId || (await supabase.auth.getUser()).data.user?.id
    if (!uid) return
    const authUser = { id: uid }
    setUserId(authUser.id)

    const [{ data: profile }, { data: partnerData }, { data: walletData }] = await Promise.all([
      supabase.from('users').select('name').eq('id', authUser.id).single(),
      supabase.from('delivery_partners').select('*').eq('user_id', authUser.id).single(),
      supabase.from('wallets').select('balance, total_earned').eq('user_id', authUser.id).single(),
    ])

    setUserName(profile?.name || '')
    setPartner(partnerData)
    setWallet(walletData)

    // My active order (one I accepted and am delivering)
    const { data: myActive } = await supabase
      .from('orders')
      .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
      .eq('delivery_partner_id', authUser.id)
      .in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveOrder(myActive)

    // Available orders to accept (ready for pickup, no partner yet)
    if (partnerData?.is_online) {
      const { data: available } = await supabase
        .from('orders')
        .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
        .eq('status', 'ready')
        .is('delivery_partner_id', null)
        .eq('type', 'delivery')
        .order('created_at', { ascending: true })
      setAvailableOrders(available || [])
    } else {
      setAvailableOrders([])
    }

    // Today's completed
    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('delivery_partner_id', authUser.id)
      .eq('status', 'delivered')
      .gte('created_at', today.toISOString())
    setCompletedToday(count || 0)

    setLoading(false)
  }, [])

  useEffect(() => {
    // Prevent back button going to wrong dashboard
    window.history.replaceState(null, '', '/dashboard/delivery')
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { window.location.href = '/auth/login'; return }
      if (session?.user) loadData(session.user.id)
    })
    const ch = supabase.channel('delivery-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
      .subscribe()
    return () => { subscription.unsubscribe(); supabase.removeChannel(ch) }
  }, [loadData])

  async function toggleOnline() {
    if (!partner || !userId) return
    setToggling(true)
    const supabase = createClient()
    const goingOnline = !partner.is_online

    // Get location if going online
    let lat = partner.current_lat, lng = partner.current_lng
    if (goingOnline && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }))
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } catch {}
    }

    await supabase.from('delivery_partners').update({
      is_online: goingOnline,
      current_lat: lat, current_lng: lng,
    }).eq('user_id', userId)

    setToggling(false)
    loadData()
  }

  async function acceptOrder(orderId: string) {
    if (!userId || accepting) return
    setAccepting(orderId)
    const supabase = createClient()

    // Atomic claim — only succeeds if still unclaimed
    const { data, error } = await supabase
      .from('orders')
      .update({ delivery_partner_id: userId, status: 'picked_up' })
      .eq('id', orderId)
      .is('delivery_partner_id', null)
      .eq('status', 'ready')
      .select()
      .single()

    if (error || !data) {
      // Another partner grabbed it first
      setAccepting(null)
      loadData()
      return
    }

    await supabase.from('order_status_log').insert({
      order_id: orderId, status: 'picked_up',
      message: 'Delivery partner accepted and picked up order'
    })

    // Notify customer
    fetch('/api/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: 'picked_up', customerId: data.customer_id }),
    }).catch(() => {})

    setAccepting(null)
    loadData()
  }

  async function markDelivered() {
    if (!activeOrder || !userId) return
    const supabase = createClient()
    await supabase.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeOrder.id)
    await supabase.from('order_status_log').insert({ order_id: activeOrder.id, status: 'delivered', message: 'Delivered by partner' })

    // Get payout amount from config
    const { data: cfg } = await supabase.from('platform_config').select('value').eq('key', 'partner_payout').single()
    const payout = Number(cfg?.value || 20)

    // Credit wallet
    const { data: wallet } = await supabase.from('wallets').select('id, balance, total_earned').eq('user_id', userId).single()
    if (wallet) {
      await supabase.from('wallets').update({ balance: wallet.balance + payout, total_earned: wallet.total_earned + payout }).eq('user_id', userId)
      await supabase.from('transactions').insert({ wallet_id: wallet.id, order_id: activeOrder.id, amount: payout, type: 'credit', description: 'Delivery earnings' })
    }
    try { await supabase.rpc('increment_deliveries', { partner_user_id: userId }) } catch(_) {}

    // Notify customer
    fetch('/api/notifications/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: activeOrder.id, status: 'delivered', customerId: activeOrder.customer_id }),
    }).catch(() => {})

    loadData()
  }

  const earningsToday = completedToday * 20

  return (
    <div className="min-h-screen pb-6" style={{ background: '#f8f7f4' }}>
      {/* Header */}
      <div style={{ background: '#0f0f0f' }} className="px-4 py-5">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/40 text-xs font-semibold">Delivery Partner</p>
              <h1 className="font-black text-xl text-white">{userName || 'Partner'} 🛵</h1>
            </div>
            <button onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/' }} className="text-white/30 text-xs">Logout</button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Today', value: completedToday, suffix: ' orders' },
              { label: 'Earned', value: `₹${earningsToday}`, suffix: '' },
              { label: 'Total', value: `₹${wallet?.total_earned || 0}`, suffix: '' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14 }} className="p-3 text-center">
                <div className="font-black text-lg text-white">{s.value}{s.suffix}</div>
                <div className="text-white/40 text-xs font-semibold">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Online toggle */}
          <button onClick={toggleOnline} disabled={toggling}
            className="w-full py-3.5 rounded-2xl font-black text-base transition-all active:scale-95"
            style={{ background: partner?.is_online ? '#16a34a' : '#ff5a1f', color: 'white', boxShadow: partner?.is_online ? '0 4px 20px rgba(22,163,74,0.4)' : '0 4px 20px rgba(255,90,31,0.4)' }}>
            {toggling ? '...' : partner?.is_online ? '🟢 You are ONLINE — tap to go offline' : '⚫ You are OFFLINE — tap to go online'}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* Active order being delivered */}
        {activeOrder && (
          <div>
            <h2 className="font-black text-sm mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse inline-block" />
              Active Delivery
            </h2>
            <div className="bg-white rounded-2xl border-2 p-4 space-y-3" style={{ borderColor: '#ff5a1f' }}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black">#{activeOrder.order_number}</p>
                  <p className="text-sm text-gray-500">{activeOrder.shop?.name}</p>
                </div>
                <span className="font-black text-lg" style={{ color: '#ff5a1f' }}>₹{activeOrder.total_amount}</span>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: '#f0fdf4' }}>
                  <span>📦</span>
                  <div>
                    <p className="font-bold text-xs text-green-700">Pickup from</p>
                    <p className="text-green-800 font-semibold">{activeOrder.shop?.address}</p>
                    <a href={`tel:${activeOrder.shop?.phone}`} className="text-green-600 text-xs font-bold">📞 Call shop</a>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ background: '#fff3ef' }}>
                  <span>📍</span>
                  <div>
                    <p className="font-bold text-xs text-orange-700">Deliver to</p>
                    <p className="text-orange-800 font-semibold">{activeOrder.delivery_address}</p>
                    {activeOrder.customer?.phone && <a href={`tel:${activeOrder.customer.phone}`} className="text-orange-600 text-xs font-bold">📞 Call customer</a>}
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2">
                {activeOrder.items?.map(i => `${i.product_name} ×${i.quantity}`).join(' · ')}
              </div>

              {activeOrder.delivery_lat && activeOrder.delivery_lng && (
                <a href={`https://maps.google.com/?q=${activeOrder.delivery_lat},${activeOrder.delivery_lng}`}
                  target="_blank" rel="noopener"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  🗺️ Open in Maps
                </a>
              )}

              <button onClick={markDelivered}
                className="w-full py-3.5 rounded-2xl font-black text-base text-white active:scale-95 transition-all"
                style={{ background: '#16a34a', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
                ✅ Mark as Delivered
              </button>
            </div>
          </div>
        )}

        {/* Available orders to accept */}
        {!activeOrder && partner?.is_online && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                Available Orders ({availableOrders.length})
              </h2>
              <button onClick={loadData} className="text-xs font-bold" style={{ color: '#ff5a1f' }}>Refresh</button>
            </div>

            {availableOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <div className="text-4xl mb-3">⏳</div>
                <p className="font-bold text-gray-600">No orders ready for pickup</p>
                <p className="text-gray-400 text-sm mt-1">Orders appear here when shops mark them ready</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black">#{order.order_number}</p>
                        <p className="text-sm font-bold text-gray-700">{order.shop?.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{order.shop?.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg" style={{ color: '#ff5a1f' }}>₹{order.total_amount}</p>
                        <p className="text-xs text-green-600 font-bold">Earn ₹20</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-2">
                      {order.items?.map(i => `${i.product_name} ×${i.quantity}`).join(' · ')}
                    </div>
                    <div className="text-xs text-gray-500">
                      📍 Deliver to: {order.delivery_address || 'Address on acceptance'}
                    </div>
                    <button
                      onClick={() => acceptOrder(order.id)}
                      disabled={accepting === order.id}
                      className="w-full py-3 rounded-2xl font-black text-white text-sm active:scale-95 transition-all"
                      style={{ background: '#ff5a1f', boxShadow: '0 4px 14px rgba(255,90,31,0.35)' }}>
                      {accepting === order.id ? 'Claiming...' : '🛵 Accept & Pick Up'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!activeOrder && !partner?.is_online && (
          <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
            <div className="text-5xl mb-3">😴</div>
            <p className="font-black text-lg text-gray-700">You are offline</p>
            <p className="text-gray-400 text-sm mt-1">Go online to see and accept delivery orders</p>
          </div>
        )}

        {/* Wallet card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-black text-sm mb-3">Wallet</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-3xl" style={{ color: '#ff5a1f' }}>₹{wallet?.balance || 0}</p>
              <p className="text-xs text-gray-400 mt-0.5">Available balance</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">₹{wallet?.total_earned || 0}</p>
              <p className="text-xs text-gray-400">Total earned</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
