'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, User, DeliveryPartner, Wallet } from '@/types'

export default function DeliveryDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [partner, setPartner] = useState<DeliveryPartner | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingOnline, setTogglingOnline] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/auth/login'); return }

    const [{ data: profile }, { data: partnerData }, { data: walletData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('delivery_partners').select('*').eq('user_id', authUser.id).single(),
      supabase.from('wallets').select('*').eq('user_id', authUser.id).single(),
    ])

    setUser(profile)
    setPartner(partnerData)
    setWallet(walletData)

    // Active order assigned to this partner
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, shop:shops(name, address, phone, latitude, longitude), items:order_items(*)')
      .eq('delivery_partner_id', authUser.id)
      .in('status', ['accepted', 'preparing', 'ready', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setActiveOrder(orderData)
    setLoading(false)
  }, [router])

  useEffect(() => {
    loadData()
    const supabase = createClient()
    const channel = supabase.channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  async function toggleOnline() {
    if (!partner || !user) return
    setTogglingOnline(true)

    const supabase = createClient()

    if (!partner.is_online) {
      // Get GPS location
      try {
        const position = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        await supabase.from('delivery_partners').update({
          is_online: true,
          current_lat: position.coords.latitude,
          current_lng: position.coords.longitude,
        }).eq('user_id', user.id)
      } catch {
        await supabase.from('delivery_partners').update({ is_online: true }).eq('user_id', user.id)
      }
    } else {
      await supabase.from('delivery_partners').update({ is_online: false }).eq('user_id', user.id)
    }

    await loadData()
    setTogglingOnline(false)
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const supabase = createClient()
    const updates: Record<string, unknown> = { status }
    if (status === 'picked_up') updates.picked_up_at = new Date().toISOString()
    if (status === 'delivered') updates.delivered_at = new Date().toISOString()

    await supabase.from('orders').update(updates).eq('id', orderId)
    await supabase.from('order_status_log').insert({ order_id: orderId, status, message: `Delivery partner: ${status}` })

    if (status === 'delivered') {
      await fetch('/api/orders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, partnerId: user?.id }),
      })
    }
    loadData()
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      {/* Header */}
      <div className={`px-4 py-5 text-white ${partner?.is_online ? 'bg-green-600' : 'bg-gray-700'}`}>
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm opacity-70">Delivery Partner</p>
            <h1 className="font-bold text-xl">{user?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={logout} className="text-white/60 text-sm hover:text-white">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Online toggle + wallet */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-5">
            <p className="text-sm text-gray-500 mb-3">Status</p>
            <button
              onClick={toggleOnline}
              disabled={togglingOnline}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${partner?.is_online ? 'bg-green-500 text-white hover:bg-red-500' : 'bg-gray-100 text-gray-700 hover:bg-green-500 hover:text-white'}`}
            >
              {togglingOnline ? 'Updating...' : partner?.is_online ? '● Online\n(tap to go offline)' : '○ Offline\n(tap to go online)'}
            </button>
          </div>
          <div className="card p-5">
            <p className="text-sm text-gray-500 mb-1">Wallet</p>
            <p className="font-bold text-2xl text-green-600">₹{wallet?.balance || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total earned: ₹{wallet?.total_earned || 0}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Today', value: partner?.today_deliveries || 0, sub: 'deliveries' },
            { label: 'Total', value: partner?.total_deliveries || 0, sub: 'deliveries' },
            { label: 'Rating', value: partner?.rating ? `${partner.rating}★` : '–', sub: 'avg rating' },
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <div className="font-bold text-xl">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label} {s.sub}</div>
            </div>
          ))}
        </div>

        {/* Active order */}
        {activeOrder ? (
          <div className="card border-2 border-brand-500 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
              <h2 className="font-bold">Active Order</h2>
              <span className="ml-auto text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">#{activeOrder.order_number}</span>
            </div>

            <div className="space-y-3 mb-5">
              <div className="bg-brand-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1 font-semibold">PICKUP FROM</p>
                <p className="font-bold text-sm">{(activeOrder as Order & { shop?: { name: string; address: string } }).shop?.name}</p>
                <p className="text-xs text-gray-500">{(activeOrder as Order & { shop?: { address: string } }).shop?.address}</p>
              </div>

              {activeOrder.delivery_address && (
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1 font-semibold">DROP TO</p>
                  <p className="font-bold text-sm">{activeOrder.delivery_address}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="text-xs text-gray-500 mb-4 space-y-1">
              {activeOrder.items?.map(i => (
                <div key={i.id}>{i.product_name} × {i.quantity}</div>
              ))}
            </div>

            <div className="flex gap-3">
              {(activeOrder as Order & { shop?: { phone?: string } }).shop?.phone && (
                <a href={`tel:${(activeOrder as Order & { shop?: { phone: string } }).shop!.phone}`} className="btn-secondary flex-1 text-center text-sm py-2.5">
                  📞 Call Shop
                </a>
              )}
              {activeOrder.status === 'ready' && (
                <button onClick={() => updateOrderStatus(activeOrder.id, 'picked_up')} className="btn-primary flex-1 text-sm py-2.5">
                  ✓ Picked Up
                </button>
              )}
              {activeOrder.status === 'picked_up' && (
                <button onClick={() => updateOrderStatus(activeOrder.id, 'delivered')} className="btn-primary flex-1 text-sm py-2.5 bg-green-500 hover:bg-green-600">
                  🎉 Delivered
                </button>
              )}
            </div>

            <div className="text-center text-xs text-green-600 font-semibold mt-3">
              Earn ₹20 on completion
            </div>
          </div>
        ) : (
          <div className="card p-10 text-center">
            {partner?.is_online ? (
              <>
                <div className="text-5xl mb-3 animate-pulse">📡</div>
                <p className="font-bold text-lg">Waiting for orders</p>
                <p className="text-gray-400 text-sm mt-1">You'll be notified when an order is assigned to you</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">😴</div>
                <p className="font-bold text-lg">You're offline</p>
                <p className="text-gray-400 text-sm mt-1">Go online to start receiving delivery assignments</p>
                <button onClick={toggleOnline} className="btn-primary mt-4 px-8">Go Online</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
