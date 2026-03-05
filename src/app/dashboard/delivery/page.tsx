'use client'
import { useEffect, useState, useCallback } from 'react'
import { useDeliveryPartnerAlerts, requestNotificationPermission } from '@/hooks/useOrderAlerts'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; type: string; delivery_address: string | null
  delivery_lat: number | null; delivery_lng: number | null
  delivery_partner_id: string | null; customer_id: string; created_at: string
  shop: { name: string; address: string; phone: string; latitude: number; longitude: number } | null
  items: { product_name: string; quantity: number; price: number }[]
  customer: { name: string; phone: string } | null
}
interface Partner { user_id: string; is_online: boolean; rating: number; total_deliveries: number; today_deliveries: number; vehicle_type: string; current_lat: number | null; current_lng: number | null }
interface Wallet { balance: number; total_earned: number }

export default function DeliveryDashboard() {
  const [userId, setUserId]               = useState<string | null>(null)
  const [partner, setPartner]             = useState<Partner | null>(null)
  const [wallet, setWallet]               = useState<Wallet | null>(null)
  const [userName, setUserName]           = useState('')
  const [availableOrders, setAvailable]   = useState<Order[]>([])
  const [activeOrder, setActiveOrder]     = useState<Order | null>(null)
  const [completedToday, setCompleted]    = useState(0)
  const [loading, setLoading]             = useState(true)
  const [toggling, setToggling]           = useState(false)
  const [accepting, setAccepting]         = useState<string | null>(null)
  const [alertsOn, setAlertsOn]           = useState(false)

  // 🔔 Sound alert
  useDeliveryPartnerAlerts(userId, partner?.is_online ?? false)

  const loadData = useCallback(async () => {
    const sb = createClient()
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }
    setUserId(authUser.id)

    const [{ data: profile }, { data: partnerData }, { data: walletData }] = await Promise.all([
      sb.from('users').select('name').eq('id', authUser.id).single(),
      sb.from('delivery_partners').select('*').eq('user_id', authUser.id).single(),
      sb.from('wallets').select('balance, total_earned').eq('user_id', authUser.id).single(),
    ])
    setUserName(profile?.name || ''); setPartner(partnerData); setWallet(walletData)

    const { data: myActive } = await sb.from('orders')
      .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
      .eq('delivery_partner_id', authUser.id).in('status', ['ready','picked_up'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setActiveOrder(myActive)

    if (partnerData?.is_online) {
      const { data: avail } = await sb.from('orders')
        .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
        .eq('status', 'ready').is('delivery_partner_id', null).eq('type', 'delivery')
        .order('created_at', { ascending: true })
      setAvailable(avail || [])
    } else { setAvailable([]) }

    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await sb.from('orders').select('id', { count: 'exact' })
      .eq('delivery_partner_id', authUser.id).eq('status', 'delivered').gte('created_at', today.toISOString())
    setCompleted(count || 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const sb = createClient()
    const ch = sb.channel('delivery-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [loadData])

  async function toggleOnline() {
    if (!partner || !userId) return
    setToggling(true)
    const sb = createClient()
    const going = !partner.is_online
    let lat = partner.current_lat, lng = partner.current_lng
    if (going && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }))
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } catch {}
    }
    await sb.from('delivery_partners').update({ is_online: going, current_lat: lat, current_lng: lng }).eq('user_id', userId)
    setToggling(false); loadData()
  }

  async function acceptOrder(orderId: string) {
    if (!userId || accepting) return
    setAccepting(orderId)
    const sb = createClient()
    const { data, error } = await sb.from('orders')
      .update({ delivery_partner_id: userId, status: 'picked_up' })
      .eq('id', orderId).is('delivery_partner_id', null).eq('status', 'ready')
      .select().single()
    if (error || !data) { setAccepting(null); loadData(); return }
    await sb.from('order_status_log').insert({ order_id: orderId, status: 'picked_up', message: 'Partner accepted and picked up' })
    fetch('/api/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status: 'picked_up', customerId: data.customer_id }) }).catch(() => {})
    setAccepting(null); loadData()
  }

  async function markDelivered() {
    if (!activeOrder || !userId) return
    const sb = createClient()
    await sb.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', activeOrder.id)
    await sb.from('order_status_log').insert({ order_id: activeOrder.id, status: 'delivered', message: 'Delivered by partner' })
    const { data: cfg } = await sb.from('platform_config').select('value').eq('key', 'partner_payout').single()
    const payout = Number(cfg?.value || 20)
    const { data: w } = await sb.from('wallets').select('id, balance, total_earned').eq('user_id', userId).single()
    if (w) {
      await sb.from('wallets').update({ balance: w.balance + payout, total_earned: w.total_earned + payout }).eq('user_id', userId)
      await sb.from('transactions').insert({ wallet_id: w.id, order_id: activeOrder.id, amount: payout, type: 'credit', description: 'Delivery earnings' })
    }
    // Fix: wrap rpc in try/catch instead of .catch() which TS doesn't allow on this type
    try { await sb.rpc('increment_deliveries', { partner_user_id: userId }) } catch {}
    fetch('/api/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: activeOrder.id, status: 'delivered', customerId: activeOrder.customer_id }) }).catch(() => {})
    loadData()
  }

  const earningsToday = completedToday * 20
  const isOnline = partner?.is_online

  // ── Luxury dark header colour palette ──────────────────────────────────────
  const headerBg   = isOnline ? 'linear-gradient(135deg, #0f4c2a 0%, #166534 100%)' : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
  const accentClr  = isOnline ? '#4ade80' : '#94a3b8'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ background: headerBg, padding: '20px 16px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', marginBottom: 2 }}>DELIVERY PARTNER</p>
              <h1 style={{ fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>{userName || 'Partner'} 🛵</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!alertsOn && (
                <button onClick={() => { try { const A=window.AudioContext||(window as any).webkitAudioContext; if(A){const c=new A();c.resume();c.close()} } catch{} requestNotificationPermission(); setAlertsOn(true) }}
                  style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔔 Alerts
                </button>
              )}
              <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Today',   value: completedToday,            suffix: ' orders' },
              { label: 'Earned',  value: `₹${earningsToday}`,       suffix: '' },
              { label: 'Wallet',  value: `₹${wallet?.balance || 0}`, suffix: '' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', lineHeight: 1 }}>{s.value}{s.suffix}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Online toggle */}
          <button onClick={toggleOnline} disabled={toggling}
            style={{ width: '100%', padding: '14px', borderRadius: 16, fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              background: isOnline ? 'rgba(74,222,128,0.2)' : 'var(--brand)',
              color: isOnline ? '#4ade80' : '#fff',
              border: isOnline ? '2px solid rgba(74,222,128,0.4)' : '2px solid transparent',
            } as any}>
            {toggling ? '…' : isOnline ? '🟢 ONLINE — tap to go offline' : '⚫ OFFLINE — tap to go online'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Active order */}
        {activeOrder && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>Active Delivery</span>
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '2px solid var(--brand)', padding: 18, boxShadow: '0 0 0 3px var(--brand-glow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>#{activeOrder.order_number}</p>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{activeOrder.shop?.name}</p>
                </div>
                <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--brand)' }}>₹{activeOrder.total_amount}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📦 Pickup from</p>
                  <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{activeOrder.shop?.address}</p>
                  {activeOrder.shop?.phone && <a href={`tel:${activeOrder.shop.phone}`} style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}>📞 Call shop</a>}
                </div>
                {activeOrder.delivery_address && (
                  <div style={{ background: 'var(--brand-muted)', border: '1px solid rgba(255,90,31,0.2)', borderRadius: 12, padding: '10px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>📍 Deliver to</p>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{activeOrder.delivery_address}</p>
                    {activeOrder.customer?.phone && <a href={`tel:${activeOrder.customer.phone}`} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>📞 Call customer</a>}
                  </div>
                )}
              </div>

              <div style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--text-3)' }}>
                {activeOrder.items?.map(i => `${i.product_name} ×${i.quantity}`).join(' · ')}
              </div>

              {activeOrder.delivery_lat && activeOrder.delivery_lng && (
                <a href={`https://maps.google.com/?q=${activeOrder.delivery_lat},${activeOrder.delivery_lng}`} target="_blank" rel="noopener"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 700, fontSize: 13, textDecoration: 'none', marginBottom: 10 }}>
                  🗺️ Open in Maps
                </a>
              )}

              <button onClick={markDelivered}
                style={{ width: '100%', padding: '14px', borderRadius: 14, fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
                ✅ Mark as Delivered
              </button>
            </div>
          </div>
        )}

        {/* Available orders */}
        {!activeOrder && isOnline && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>Available Orders ({availableOrders.length})</span>
              </div>
              <button onClick={loadData} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Refresh</button>
            </div>
            {availableOrders.length === 0 ? (
              <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>No orders ready yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>You'll hear a sound when one arrives</p>
              </div>
            ) : availableOrders.map(order => (
              <div key={order.id} style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: 18, marginBottom: 12, boxShadow: 'var(--card-shadow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>#{order.order_number}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginTop: 2 }}>{order.shop?.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{order.shop?.address}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 900, fontSize: 20, color: 'var(--brand)' }}>₹{order.total_amount}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>Earn ₹20</p>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--text-3)' }}>
                  {order.items?.map(i => `${i.product_name} ×${i.quantity}`).join(' · ')}
                </div>
                {order.delivery_address && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>📍 {order.delivery_address}</p>
                )}
                <button onClick={() => acceptOrder(order.id)} disabled={accepting === order.id}
                  style={{ width: '100%', padding: '12px', borderRadius: 14, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--brand)', color: '#fff', boxShadow: '0 4px 14px var(--brand-glow)', opacity: accepting === order.id ? 0.7 : 1 }}>
                  {accepting === order.id ? 'Claiming…' : '🛵 Accept & Pick Up'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Offline state */}
        {!activeOrder && !isOnline && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '52px 20px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>😴</div>
            <p style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>You are offline</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, marginBottom: 20 }}>Go online to see and accept delivery orders</p>
            <button onClick={toggleOnline} style={{ padding: '12px 32px', borderRadius: 14, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--brand)', color: '#fff' }}>Go Online</button>
          </div>
        )}

        {/* Wallet card */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: 20, boxShadow: 'var(--card-shadow)' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Wallet</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 900, fontSize: 32, color: 'var(--brand)', lineHeight: 1 }}>₹{wallet?.balance || 0}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Available balance</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>₹{wallet?.total_earned || 0}</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Total earned</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}