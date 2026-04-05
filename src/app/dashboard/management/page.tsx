'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useManagementAlerts } from '@/hooks/useOrderAlerts'
import { useFCM } from '@/hooks/useFCM'
import InAppToast from '@/components/InAppToast'

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  placed:    { bg: 'rgba(59,130,246,0.12)',  text: '#2563eb' },
  accepted:  { bg: 'rgba(34,197,94,0.12)',   text: '#16a34a' },
  preparing: { bg: 'rgba(245,158,11,0.12)',  text: '#d97706' },
  ready:     { bg: 'rgba(124,58,237,0.12)',  text: '#7c3aed' },
  picked_up: { bg: 'rgba(234,88,12,0.12)',   text: '#c2410c' },
  delivered: { bg: 'rgba(21,128,61,0.12)',   text: '#15803d' },
  cancelled: { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626' },
  rejected:  { bg: 'rgba(220,38,38,0.12)',   text: '#dc2626' },
}

const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed', accepted: 'Accepted', preparing: 'Preparing',
  ready: 'Ready', picked_up: 'Picked up', delivered: 'Delivered',
  cancelled: 'Cancelled', rejected: 'Rejected',
}

const TABS = ['all', 'active', 'delivered', 'cancelled'] as const
type Tab = typeof TABS[number]

interface Person { name: string; phone: string | null }
interface OrderRow {
  id: string
  order_number: string
  status: string
  total_amount: number
  type: string
  created_at: string
  accepted_at: string | null
  picked_up_at: string | null
  delivered_at: string | null
  customer: Person | null
  shop: (Person & { id: string }) | null
  partner: Person | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + time
}

function diffMins(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
}

function fmtMins(mins: number | null): string {
  if (mins === null) return '—'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function CallBtn({ phone, label }: { phone: string; label?: string }) {
  return (
    <a href={`tel:${phone}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: '#fff', background: '#16a34a', padding: '4px 10px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
      <svg viewBox="0 0 20 20" fill="currentColor" width={11} height={11}>
        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
      </svg>
      {label ?? phone}
    </a>
  )
}

function InfoRow({ icon, label, name, phone }: { icon: string; label: string; name: string; phone: string | null }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f3f2f0' }}>
      <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#222', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
          {phone && <span style={{ fontWeight: 500, color: '#888', marginLeft: 6 }}>{phone}</span>}
        </p>
      </div>
      {phone && <CallBtn phone={phone} />}
    </div>
  )
}

function OrderCard({ o }: { o: OrderRow }) {
  const sc = STATUS_COLOR[o.status] || { bg: 'rgba(100,100,100,0.1)', text: '#888' }
  const isDelivery = o.type === 'delivery'
  const partnerPending = isDelivery && !o.partner && !['delivered', 'cancelled', 'rejected'].includes(o.status)
  const responseTime = diffMins(o.created_at, o.accepted_at)
  const deliveryTime = diffMins(o.picked_up_at, o.delivered_at)
  const totalTime    = diffMins(o.created_at, o.delivered_at)

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', border: '1px solid #eeece9' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 900, fontSize: 13, color: '#111', fontFamily: 'monospace' }}>#{o.order_number}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
            {STATUS_LABEL[o.status] ?? o.status}
          </span>
          {isDelivery && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>Delivery</span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 15, fontWeight: 900, color: '#111', margin: 0 }}>₹{o.total_amount.toLocaleString('en-IN')}</p>
          <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>{formatTime(o.created_at)}</p>
        </div>
      </div>

      {/* Customer */}
      <InfoRow
        icon="👤"
        label="Customer"
        name={o.customer?.name || 'Unknown'}
        phone={o.customer?.phone || null}
      />

      {/* Shop */}
      <InfoRow
        icon="🏪"
        label="Shop"
        name={o.shop?.name || 'Unknown shop'}
        phone={o.shop?.phone || null}
      />

      {/* Delivery partner */}
      {isDelivery && (
        o.partner
          ? <InfoRow icon="🚴" label="Rider" name={o.partner.name} phone={o.partner.phone} />
          : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f3f2f0' }}>
              <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>🚴</span>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rider</span>
                <p style={{ fontSize: 12, color: partnerPending ? '#d97706' : '#bbb', margin: 0, fontWeight: 600 }}>
                  {partnerPending ? 'Waiting for partner…' : '—'}
                </p>
              </div>
            </div>
          )
      )}

      {/* Timing row — only for delivered orders */}
      {o.status === 'delivered' && (responseTime !== null || deliveryTime !== null || totalTime !== null) && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 0 2px', borderTop: '1px solid #f3f2f0', flexWrap: 'wrap' }}>
          {responseTime !== null && (
            <div style={{ background: 'rgba(59,130,246,0.07)', borderRadius: 8, padding: '4px 10px' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Shop response</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#2563eb', margin: 0 }}>{fmtMins(responseTime)}</p>
            </div>
          )}
          {deliveryTime !== null && (
            <div style={{ background: 'rgba(234,88,12,0.07)', borderRadius: 8, padding: '4px 10px' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Delivery run</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#c2410c', margin: 0 }}>{fmtMins(deliveryTime)}</p>
            </div>
          )}
          {totalTime !== null && (
            <div style={{ background: 'rgba(21,128,61,0.07)', borderRadius: 8, padding: '4px 10px' }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Total time</p>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#15803d', margin: 0 }}>{fmtMins(totalTime)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ManagementDashboard() {
  const [userId, setUserId]   = useState<string | null>(null)
  const [orders, setOrders]   = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('all')
  const [loggingOut, setLoggingOut] = useState(false)

  useFCM(userId)
  useManagementAlerts(userId)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await sb.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'management') {
      const roleHome: Record<string, string> = {
        customer: '/dashboard/customer', business: '/dashboard/business',
        shopkeeper: '/dashboard/business', delivery_partner: '/dashboard/delivery',
        delivery: '/dashboard/delivery', admin: '/dashboard/admin',
      }
      window.location.replace(roleHome[profile?.role || ''] || '/dashboard/customer')
      return
    }

    setUserId(user.id)

    const { data } = await sb
      .from('orders')
      .select(`
        id, order_number, status, total_amount, type, created_at,
        accepted_at, picked_up_at, delivered_at,
        customer:users!customer_id(name, phone),
        shop:shops!shop_id(id, name, phone),
        partner:users!delivery_partner_id(name, phone)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    setOrders((data as any[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const ch = sb.channel('mgmt-orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async payload => {
        const o = payload.new as any
        const [{ data: customer }, { data: shop }] = await Promise.all([
          sb.from('users').select('name, phone').eq('id', o.customer_id).single(),
          sb.from('shops').select('id, name, phone').eq('id', o.shop_id).single(),
        ])
        setOrders(prev => [{ ...o, customer: customer || null, shop: shop || null, partner: null }, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async payload => {
        const n = payload.new as any
        // Fetch partner if one was just assigned
        let partner: Person | null = null
        if (n.delivery_partner_id) {
          const { data } = await sb.from('users').select('name, phone').eq('id', n.delivery_partner_id).single()
          partner = data || null
        }
        setOrders(prev => prev.map(o =>
          o.id === n.id ? { ...o, status: n.status, partner: partner ?? o.partner } : o
        ))
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [userId])

  async function logout() {
    setLoggingOut(true)
    const sb = createClient()
    await sb.auth.signOut()
    window.location.href = '/auth/login'
  }

  // Stats
  const totalOrders   = orders.length
  const distinctShops = new Set(orders.map(o => o.shop?.name).filter(Boolean)).size
  const activeOrders  = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status)).length
  const todayGMV      = orders
    .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + (o.total_amount || 0), 0)
  // Unresponded = placed (no shop response)
  const unresponded = orders.filter(o => o.status === 'placed')
  // Delivery orders with no partner yet
  const partnerless = orders.filter(o =>
    o.type === 'delivery' && !o.partner && ['accepted', 'preparing', 'ready'].includes(o.status)
  )

  // Efficiency metrics from delivered orders (today)
  const deliveredToday = orders.filter(o =>
    o.status === 'delivered' && new Date(o.created_at).toDateString() === new Date().toDateString()
  )
  function avgMins(arr: (number | null)[]): string {
    const valid = arr.filter((v): v is number => v !== null)
    if (!valid.length) return '—'
    return fmtMins(Math.round(valid.reduce((s, v) => s + v, 0) / valid.length))
  }
  const avgResponseTime = avgMins(deliveredToday.map(o => diffMins(o.created_at, o.accepted_at)))
  const avgDeliveryTime = avgMins(deliveredToday.map(o => diffMins(o.picked_up_at, o.delivered_at)))
  const avgTotalTime    = avgMins(deliveredToday.map(o => diffMins(o.created_at, o.delivered_at)))

  const filtered = orders.filter(o => {
    if (tab === 'active')    return !['delivered', 'cancelled', 'rejected'].includes(o.status)
    if (tab === 'delivered') return o.status === 'delivered'
    if (tab === 'cancelled') return o.status === 'cancelled' || o.status === 'rejected'
    return true
  })

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f4f2' }}>
      <InAppToast />

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e8e5e2', padding: '14px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Management</p>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#111', margin: 0, lineHeight: 1.2 }}>Operations Feed</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.25)', borderRadius: 999, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>Live</span>
              </div>
            )}
            <button onClick={logout} disabled={loggingOut}
              style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', padding: '7px 14px', borderRadius: 10, cursor: 'pointer', opacity: loggingOut ? 0.5 : 1 }}>
              {loggingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 16px 80px' }}>

        {/* Summary line */}
        {!loading && totalOrders > 0 && (
          <p style={{ fontSize: 13, color: '#888', marginBottom: 14, fontWeight: 500 }}>
            <span style={{ color: '#111', fontWeight: 800 }}>{totalOrders}</span> order{totalOrders !== 1 ? 's' : ''} from{' '}
            <span style={{ color: '#111', fontWeight: 800 }}>{distinctShops}</span> shop{distinctShops !== 1 ? 's' : ''}
          </p>
        )}

        {/* Stats row */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { val: totalOrders, label: 'Total Orders', col: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.18)' },
              { val: activeOrders, label: 'Active Now', col: '#d97706', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
              { val: `₹${todayGMV.toLocaleString('en-IN')}`, label: "Today's GMV", col: '#15803d', bg: 'rgba(21,128,61,0.08)', border: 'rgba(21,128,61,0.18)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: s.col, margin: 0 }}>{s.val}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: s.col, margin: '2px 0 0', opacity: 0.8 }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Efficiency metrics (today's delivered orders) ── */}
        {!loading && deliveredToday.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eeece9', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>
              ⚡ Today's efficiency · {deliveredToday.length} delivered
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { label: 'Avg shop response', val: avgResponseTime, col: '#2563eb', bg: 'rgba(59,130,246,0.07)' },
                { label: 'Avg delivery run', val: avgDeliveryTime, col: '#c2410c', bg: 'rgba(234,88,12,0.07)' },
                { label: 'Avg total time', val: avgTotalTime, col: '#15803d', bg: 'rgba(21,128,61,0.07)' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, borderRadius: 10, padding: '8px 10px' }}>
                  <p style={{ fontSize: 16, fontWeight: 900, color: m.col, margin: 0 }}>{m.val}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#888', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Alert: shop not responding ── */}
        {!loading && unresponded.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', margin: '0 0 10px' }}>
              🔔 {unresponded.length} order{unresponded.length > 1 ? 's' : ''} placed — shop hasn't responded
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unresponded.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#111', fontFamily: 'monospace' }}>#{o.order_number}</span>
                    <span style={{ fontSize: 12, color: '#555', marginLeft: 8, fontWeight: 600 }}>{o.shop?.name || '—'}</span>
                    <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{o.shop?.phone || ''}</span>
                  </div>
                  {/* Call SHOP — they haven't responded */}
                  {o.shop?.phone && <CallBtn phone={o.shop.phone} label={`Call shop`} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Alert: no rider assigned ── */}
        {!loading && partnerless.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.07)', border: '1.5px solid rgba(245,158,11,0.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#b45309', margin: '0 0 10px' }}>
              🚴 {partnerless.length} delivery order{partnerless.length > 1 ? 's' : ''} — no rider assigned yet
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {partnerless.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#111', fontFamily: 'monospace' }}>#{o.order_number}</span>
                    <span style={{ fontSize: 12, color: '#555', marginLeft: 8, fontWeight: 600 }}>{o.shop?.name || '—'}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#d97706' }}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter tabs */}
        {!loading && orders.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
            {TABS.map(t => {
              const count = t === 'all' ? orders.length
                : t === 'active' ? activeOrders
                : t === 'delivered' ? orders.filter(o => o.status === 'delivered').length
                : orders.filter(o => o.status === 'cancelled' || o.status === 'rejected').length
              const active = tab === t
              return (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: active ? 'none' : '1px solid #e0ded9', background: active ? '#111' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer' }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.7 }}>{count}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Orders list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="skel" style={{ height: 14, width: '45%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 12, width: '70%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 12, width: '60%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 12, width: '55%', borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, textAlign: 'center', padding: 48, color: '#aaa', fontSize: 14 }}>
            No {tab === 'all' ? '' : tab} orders
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(o => <OrderCard key={o.id} o={o} />)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .skel {
          background: linear-gradient(90deg, #f0efee 25%, #e8e6e4 50%, #f0efee 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
