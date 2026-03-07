'use client'
import { useEffect, useState, useCallback } from 'react'
import { useDeliveryPartnerAlerts, useVisibilityReconnect, requestNotificationPermission } from '@/hooks/useOrderAlerts'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string; total_amount: number
  subtotal: number; type: string; delivery_address: string | null
  delivery_lat: number | null; delivery_lng: number | null
  delivery_partner_id: string | null; customer_id: string; created_at: string
  pickup_code: string | null
  shop: { name: string; address: string; phone: string; latitude: number; longitude: number } | null
  items: { product_name: string; quantity: number; price: number }[]
  customer: { name: string; phone: string } | null
}
interface Partner {
  user_id: string; is_online: boolean; rating: number; total_deliveries: number
  today_deliveries: number; vehicle_type: string; current_lat: number | null
  current_lng: number | null; verification_status?: string; verification_note?: string
}
interface Wallet { balance: number; total_earned: number }

// Generate a random 4-digit code
function gen4() { return String(Math.floor(1000 + Math.random() * 9000)) }

export default function DeliveryDashboard() {
  const [userId, setUserId]           = useState<string | null>(null)
  const [partner, setPartner]         = useState<Partner | null>(null)
  const [wallet, setWallet]           = useState<Wallet | null>(null)
  const [userName, setUserName]       = useState('')
  const [availableOrders, setAvail]   = useState<Order[]>([])
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [completedToday, setDone]     = useState(0)
  const [loading, setLoading]         = useState(true)
  const [toggling, setToggling]       = useState(false)
  const [accepting, setAccepting]     = useState<string | null>(null)
  const [alertsOn, setAlertsOn]       = useState(false)

  // 🔔 Sounds + SW notifications
  useDeliveryPartnerAlerts(userId, partner?.is_online ?? false)

  const loadData = useCallback(async () => {
    const sb = createClient()
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }
    setUserId(authUser.id)

    const [{ data: profile }, { data: pd }, { data: wd }] = await Promise.all([
      sb.from('users').select('name, phone').eq('id', authUser.id).single(),
      sb.from('delivery_partners').select('*').eq('user_id', authUser.id).single(),
      sb.from('wallets').select('balance, total_earned').eq('user_id', authUser.id).single(),
    ])
    setUserName(profile?.name || ''); setPartner(pd); setWallet(wd)

    // Active order: assigned to me, not yet delivered
    // Includes 'ready' status with me as partner (code generated, waiting for shop to verify)
    const { data: myActive } = await sb.from('orders')
      .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
      .eq('delivery_partner_id', authUser.id)
      .in('status', ['ready', 'picked_up'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    setActiveOrder(myActive)

    // Available orders: ready, no partner yet, delivery type
    if (pd?.is_online && pd?.verification_status === 'approved') {
      const { data: avail } = await sb.from('orders')
        .select('*, shop:shops(name,address,phone,latitude,longitude), items:order_items(product_name,quantity,price), customer:users!customer_id(name,phone)')
        .eq('status', 'ready').is('delivery_partner_id', null).eq('type', 'delivery')
        .order('created_at', { ascending: true })
      setAvail(avail || [])
    } else { setAvail([]) }

    const today = new Date(); today.setHours(0,0,0,0)
    const { count } = await sb.from('orders').select('id', { count: 'exact' })
      .eq('delivery_partner_id', authUser.id).eq('status', 'delivered')
      .gte('created_at', today.toISOString())
    setDone(count || 0)
    setLoading(false)
  }, [])

  // Auto-refresh when phone brings app back from background
  useVisibilityReconnect(loadData)

  useEffect(() => {
    loadData()
    const sb = createClient()
    const ch = sb.channel('delivery-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, loadData)
      .subscribe()
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
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }))
        lat = pos.coords.latitude; lng = pos.coords.longitude
      } catch {}
    }
    await sb.from('delivery_partners').update({ is_online: going, current_lat: lat, current_lng: lng }).eq('user_id', userId)
    setToggling(false); loadData()
  }

  // ── ACCEPT: assign self + generate 4-digit code
  // Status stays 'ready' — shop must verify code to move to 'picked_up'
  async function acceptOrder(orderId: string) {
    if (!userId || accepting) return
    setAccepting(orderId)
    const sb = createClient()
    const code = gen4()

    const { data, error } = await sb.from('orders')
      .update({ delivery_partner_id: userId, pickup_code: code })
      .eq('id', orderId)
      .is('delivery_partner_id', null)   // atomic — only if still unclaimed
      .eq('status', 'ready')
      .select().single()

    if (error || !data) {
      // Another rider grabbed it first
      setAccepting(null); loadData(); return
    }

    await sb.from('order_status_log').insert({
      order_id: orderId, status: 'ready',
      message: 'Delivery partner accepted — waiting for shop to verify pickup code'
    })

    setAccepting(null); loadData()
  }

  async function markDelivered() {
    if (!activeOrder || !userId) return
    const sb = createClient()
    await sb.from('orders').update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      pickup_code: null, // clear code after delivery
    }).eq('id', activeOrder.id)
    await sb.from('order_status_log').insert({ order_id: activeOrder.id, status: 'delivered', message: 'Delivered by partner' })
    const { data: cfg } = await sb.from('platform_config').select('value').eq('key', 'partner_payout').single()
    const payout = Number(cfg?.value || 20)
    const { data: w } = await sb.from('wallets').select('id, balance, total_earned').eq('user_id', userId).single()
    if (w) {
      await sb.from('wallets').update({ balance: w.balance + payout, total_earned: w.total_earned + payout }).eq('user_id', userId)
      await sb.from('transactions').insert({ wallet_id: w.id, order_id: activeOrder.id, amount: payout, type: 'credit', description: 'Delivery earnings' })
    }
    try { await sb.rpc('increment_deliveries', { partner_user_id: userId }) } catch {}
    fetch('/api/notifications/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: activeOrder.id, status: 'delivered', customerId: activeOrder.customer_id }) }).catch(() => {})
    loadData()
  }

  const earningsToday = completedToday * 20
  const isOnline      = partner?.is_online
  const verStatus     = partner?.verification_status ?? 'approved'
  const verNote       = partner?.verification_note ?? null
  const headerBg      = isOnline ? 'linear-gradient(135deg,#0f4c2a,#166534)' : 'linear-gradient(135deg,#1a1a2e,#16213e)'

  // ── Loading
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--brand)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  )

  // ── Pending verification gate
  if (verStatus === 'pending') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 24, padding: '40px 28px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '3px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>⏳</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', marginBottom: 10 }}>Verification Pending</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          Welcome, <strong style={{ color: 'var(--text)' }}>{userName}</strong>!<br />
          Your account is under review. We'll approve you within <strong style={{ color: '#d97706' }}>24–48 hours</strong>.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>Questions? support@welokl.com</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  // ── Rejected gate
  if (verStatus === 'rejected') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 24, padding: '40px 28px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--red-bg)', border: '3px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>❌</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: '#ef4444', marginBottom: 10 }}>Application Not Approved</h2>
        {verNote && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>Reason:</p>
            <p style={{ fontSize: 13, color: '#ef4444' }}>{verNote}</p>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>Contact support@welokl.com</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  // ── Main dashboard (approved) ──────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

      {/* Header */}
      <div style={{ background: headerBg, padding: '20px 16px 24px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', marginBottom: 2 }}>DELIVERY PARTNER</p>
              <h1 style={{ fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>{userName || 'Partner'} 🛵</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!alertsOn && (
                <button onClick={() => {
                  try { const A = window.AudioContext || (window as any).webkitAudioContext; if (A) { const c = new A(); c.resume(); c.close() } } catch {}
                  requestNotificationPermission(); setAlertsOn(true)
                }} style={{ fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔔 Enable Alerts
                </button>
              )}
              {alertsOn && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>🔔 Alerts ON</span>}
              <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Today',  value: completedToday,              suffix: ' deliveries' },
              { label: 'Earned', value: `₹${earningsToday}`,         suffix: '' },
              { label: 'Wallet', value: `₹${wallet?.balance || 0}`,  suffix: '' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Online toggle */}
          <button onClick={toggleOnline} disabled={toggling}
            style={{ width: '100%', padding: '14px', borderRadius: 16, fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
              background: isOnline ? 'rgba(74,222,128,0.2)' : 'var(--brand)',
              color: isOnline ? '#4ade80' : '#fff',
              border: isOnline ? '2px solid rgba(74,222,128,0.4)' : '2px solid transparent' }}>
            {toggling ? '…' : isOnline ? '🟢 ONLINE — tap to go offline' : '⚫ OFFLINE — tap to go online'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* ── Active order card ── */}
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

              {/* ── PICKUP CODE — shown prominently when status is still 'ready' */}
              {activeOrder.status === 'ready' && activeOrder.pickup_code && (
                <div style={{ background: 'linear-gradient(135deg, rgba(255,80,10,0.15), rgba(255,80,10,0.08))', border: '2px solid rgba(255,80,10,0.4)', borderRadius: 16, padding: '18px', marginBottom: 14, textAlign: 'center' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    🔐 Show this code to the shop owner
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
                    {activeOrder.pickup_code.split('').map((d, i) => (
                      <div key={i} style={{ width: 52, height: 64, background: 'var(--card-bg)', border: '2px solid var(--brand)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: 'var(--brand)', fontFamily: 'monospace', boxShadow: '0 4px 12px var(--brand-glow)' }}>
                        {d}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    The shop owner will enter this code to confirm handover.<br />
                    <strong style={{ color: 'var(--text-2)' }}>Waiting for shop to verify…</strong>
                  </p>
                </div>
              )}

              {/* ── PICKED UP — go deliver! */}
              {activeOrder.status === 'picked_up' && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>✅ Pickup verified by shop — go deliver!</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>📦 Pickup from</p>
                  <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', lineHeight: 1.4 }}>{activeOrder.shop?.address}</p>
                  {activeOrder.shop?.phone && (
                    <a href={`tel:${activeOrder.shop.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 13, fontWeight: 800, color: '#fff', background: '#16a34a', padding: '5px 12px', borderRadius: 8, textDecoration: 'none' }}>
                      📞 Call shop
                    </a>
                  )}
                </div>
                {activeOrder.delivery_address && (
                  <div style={{ background: 'rgba(255,80,10,0.12)', border: '2px solid rgba(255,80,10,0.35)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: '#ff5a1f', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>📍 Drop location</p>
                    <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', lineHeight: 1.4 }}>{activeOrder.delivery_address}</p>
                    {activeOrder.customer?.phone && (
                      <a href={`tel:${activeOrder.customer.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 13, fontWeight: 800, color: '#fff', background: '#ff5a1f', padding: '5px 12px', borderRadius: 8, textDecoration: 'none' }}>
                        📞 Call customer
                      </a>
                    )}
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

              {/* Mark delivered only after shop verified pickup */}
              {activeOrder.status === 'picked_up' && (
                <button onClick={markDelivered}
                  style={{ width: '100%', padding: '14px', borderRadius: 14, fontWeight: 900, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
                  ✅ Mark as Delivered
                </button>
              )}

              {activeOrder.status === 'ready' && (
                <div style={{ padding: '12px', background: 'var(--bg-1)', borderRadius: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-3)' }}>⏳ Waiting for shop to enter the code above…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Available orders ── */}
        {!activeOrder && isOnline && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>Available ({availableOrders.length})</span>
              </div>
              <button onClick={loadData} style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Refresh</button>
            </div>
            {availableOrders.length === 0 ? (
              <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>No orders ready yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>You'll hear a sound alert when one arrives</p>
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
                {order.delivery_address && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>📍 {order.delivery_address}</p>}
                <button onClick={() => acceptOrder(order.id)} disabled={accepting === order.id}
                  style={{ width: '100%', padding: '12px', borderRadius: 14, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--brand)', color: '#fff', boxShadow: '0 4px 14px var(--brand-glow)', opacity: accepting === order.id ? 0.7 : 1 }}>
                  {accepting === order.id ? 'Claiming…' : '🛵 Accept Order'}
                </button>
              </div>
            ))}
          </div>
        )}

        {!activeOrder && !isOnline && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '52px 20px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>😴</div>
            <p style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>You are offline</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, marginBottom: 20 }}>Go online to see and accept delivery orders</p>
            <button onClick={toggleOnline} style={{ padding: '12px 32px', borderRadius: 14, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--brand)', color: '#fff' }}>Go Online</button>
          </div>
        )}

        {/* Wallet */}
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