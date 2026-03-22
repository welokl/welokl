'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useManagementAlerts } from '@/hooks/useOrderAlerts'
import { useFCM } from '@/hooks/useFCM'
import InAppToast from '@/components/InAppToast'

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  placed:    { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  accepted:  { bg: 'rgba(34,197,94,0.15)',   text: '#16a34a' },
  preparing: { bg: 'rgba(245,158,11,0.15)',  text: '#d97706' },
  ready:     { bg: 'rgba(124,58,237,0.15)',  text: '#7c3aed' },
  picked_up: { bg: 'rgba(234,88,12,0.15)',   text: '#c2410c' },
  delivered: { bg: 'rgba(21,128,61,0.15)',   text: '#15803d' },
  cancelled: { bg: 'rgba(220,38,38,0.15)',   text: '#dc2626' },
  rejected:  { bg: 'rgba(220,38,38,0.15)',   text: '#dc2626' },
}

const TABS = ['all', 'active', 'delivered', 'cancelled'] as const
type Tab = typeof TABS[number]

interface OrderRow {
  id: string
  order_number: string
  status: string
  total_amount: number
  type: string
  created_at: string
  customer: { name: string; phone: string } | null
  shop: { name: string } | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + time
}

export default function ManagementDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
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
      .select('id, order_number, status, total_amount, type, created_at, customer:users!customer_id(name, phone), shop:shops(name)')
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
          sb.from('shops').select('name').eq('id', o.shop_id).single(),
        ])
        setOrders(prev => [{ ...o, customer: customer || null, shop: shop || null }, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const n = payload.new as any
        setOrders(prev => prev.map(o => o.id === n.id ? { ...o, status: n.status } : o))
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
  const unresponded   = orders.filter(o => o.status === 'placed')

  // Filtered list
  const filtered = orders.filter(o => {
    if (tab === 'active')    return !['delivered', 'cancelled', 'rejected'].includes(o.status)
    if (tab === 'delivered') return o.status === 'delivered'
    if (tab === 'cancelled') return o.status === 'cancelled' || o.status === 'rejected'
    return true
  })

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f5f4' }}>
      <InAppToast />

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e8e5e2', padding: '14px 16px' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>Management</p>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#111', margin: 0, lineHeight: 1.2 }}>Operations Feed</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Live dot */}
            {!loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(21,128,61,0.1)', border: '1px solid rgba(21,128,61,0.25)', borderRadius: 999, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'block', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>Live</span>
              </div>
            )}
            <button
              onClick={logout}
              disabled={loggingOut}
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
            <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#3b82f6', margin: 0 }}>{totalOrders}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', margin: '2px 0 0', opacity: 0.8 }}>Total Orders</p>
            </div>
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#d97706', margin: 0 }}>{activeOrders}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#d97706', margin: '2px 0 0', opacity: 0.8 }}>Active Now</p>
            </div>
            <div style={{ background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.18)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#15803d', margin: 0 }}>₹{todayGMV.toLocaleString('en-IN')}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#15803d', margin: '2px 0 0', opacity: 0.8 }}>Today's GMV</p>
            </div>
          </div>
        )}

        {/* Unresponded alert */}
        {!loading && unresponded.length > 0 && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', margin: '0 0 10px' }}>
              {unresponded.length} order{unresponded.length > 1 ? 's' : ''} waiting — no shop response yet
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {unresponded.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>#{o.order_number}</span>
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{o.shop?.name || '—'}</span>
                  </div>
                  {o.customer?.phone && (
                    <a href={`tel:${o.customer.phone}`}
                      style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#dc2626', padding: '5px 12px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      Call {o.customer.phone}
                    </a>
                  )}
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
                  style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: active ? 'none' : '1px solid #e0ded9', background: active ? '#111' : '#fff', color: active ? '#fff' : '#555', cursor: 'pointer', transition: 'all .15s' }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                  <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 800, opacity: 0.7 }}>{count}</span>
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
                <div className="skel" style={{ height: 12, width: '60%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 11, width: '35%', borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, textAlign: 'center', padding: 48, color: '#aaa', fontSize: 14 }}>
            No {tab === 'all' ? '' : tab} orders
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(o => {
              const sc = STATUS_COLOR[o.status] || { bg: 'rgba(100,100,100,0.1)', text: '#888' }
              return (
                <div key={o.id} style={{ background: '#fff', borderRadius: 16, padding: '13px 15px', boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    {/* Left */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontWeight: 900, fontSize: 14, color: '#111' }}>#{o.order_number}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
                          {o.status.replace(/_/g, ' ')}
                        </span>
                        {o.type === 'delivery' && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>delivery</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: '#333', margin: '0 0 2px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {o.shop?.name || '—'}
                      </p>
                      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
                        {o.customer?.name || '—'}
                        {o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                      </p>
                    </div>
                    {/* Right */}
                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                      <p style={{ fontSize: 15, fontWeight: 900, color: '#111', margin: 0 }}>₹{o.total_amount}</p>
                      <p style={{ fontSize: 11, color: '#aaa', margin: 0 }}>{formatTime(o.created_at)}</p>
                      {o.customer?.phone && (
                        <a href={`tel:${o.customer.phone}`}
                          style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#16a34a', padding: '4px 11px', borderRadius: 8, textDecoration: 'none' }}>
                          Call
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
