'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Period = '1d' | '7d' | '30d'

interface ActivityEntry {
  id: string
  time: string
  kind: 'shop' | 'order'
  type: string       // e.g. 'shop_opened', 'order_accepted'
  source: string | null
  shop_id: string
  shop_name: string
  note: string | null
  order_number?: string
  order_amount?: number
}

const TYPE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  shop_opened:       { label: 'Opened',               icon: '🟢', color: '#16a34a', bg: 'rgba(22,163,74,.1)'  },
  shop_closed:       { label: 'Closed',                icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,.1)' },
  order_placed:      { label: 'Order received',        icon: '📥', color: '#2563eb', bg: 'rgba(37,99,235,.1)'  },
  order_accepted:    { label: 'Order accepted',        icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,.1)'  },
  order_rejected:    { label: 'Order rejected',        icon: '❌', color: '#ef4444', bg: 'rgba(239,68,68,.1)'  },
  order_preparing:   { label: 'Started preparing',     icon: '👨‍🍳', color: '#d97706', bg: 'rgba(217,119,6,.1)' },
  order_ready:       { label: 'Order ready',           icon: '📦', color: '#7c3aed', bg: 'rgba(124,58,237,.1)' },
  order_picked_up:   { label: 'Picked up by rider',    icon: '🏍️', color: '#0891b2', bg: 'rgba(8,145,178,.1)'  },
  order_delivered:   { label: 'Order delivered',       icon: '🎉', color: '#15803d', bg: 'rgba(21,128,61,.1)'  },
  order_cancelled:   { label: 'Order cancelled',       icon: '🚫', color: '#9ca3af', bg: 'rgba(156,163,175,.1)'},
}

const SOURCE_LABEL: Record<string, string> = {
  manual:        'Manual',
  auto_schedule: 'Auto (schedule)',
  order:         'Order',
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ShopActivityPage() {
  const [loading,      setLoading]      = useState(true)
  const [activities,   setActivities]   = useState<ActivityEntry[]>([])
  const [shops,        setShops]        = useState<{ id: string; name: string }[]>([])
  const [selectedShop, setSelectedShop] = useState<string>('all')
  const [period,       setPeriod]       = useState<Period>('7d')
  const [typeFilter,   setTypeFilter]   = useState<string>('all')
  const [authChecked,  setAuthChecked]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()

    const from = new Date()
    if (period === '1d')  from.setDate(from.getDate() - 1)
    if (period === '7d')  from.setDate(from.getDate() - 7)
    if (period === '30d') from.setDate(from.getDate() - 30)

    // Fetch shop list for filter
    const { data: shopList } = await sb
      .from('shops').select('id, name').order('name')
    setShops(shopList ?? [])

    // ── Shop open/close events ──────────────────────────────────
    let shopActQ = sb
      .from('shop_activity_log')
      .select('id, shop_id, type, source, note, created_at, shop:shops(name)')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
    if (selectedShop !== 'all') shopActQ = shopActQ.eq('shop_id', selectedShop)
    const { data: shopAct } = await shopActQ

    // ── Order status events ─────────────────────────────────────
    let orderActQ = sb
      .from('order_status_log')
      .select('id, order_id, status, message, created_at, order:orders(shop_id, order_number, total_amount, shop:shops(name))')
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
    const { data: orderAct } = await orderActQ

    // ── Merge and normalise ──────────────────────────────────────
    const merged: ActivityEntry[] = []

    for (const r of (shopAct ?? [])) {
      const shopName = (r.shop as any)?.name ?? 'Unknown shop'
      if (selectedShop !== 'all' && r.shop_id !== selectedShop) continue
      merged.push({
        id: `sa-${r.id}`,
        time: r.created_at,
        kind: 'shop',
        type: r.type,
        source: r.source,
        shop_id: r.shop_id,
        shop_name: shopName,
        note: r.note,
      })
    }

    for (const r of (orderAct ?? [])) {
      const ord = r.order as any
      if (!ord) continue
      const sId   = ord.shop_id
      const sName = ord.shop?.name ?? 'Unknown shop'
      if (selectedShop !== 'all' && sId !== selectedShop) continue
      merged.push({
        id: `os-${r.id}`,
        time: r.created_at,
        kind: 'order',
        type: `order_${r.status}`,
        source: 'order',
        shop_id: sId,
        shop_name: sName,
        note: r.message ?? null,
        order_number: ord.order_number,
        order_amount: ord.total_amount,
      })
    }

    merged.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setActivities(merged)
    setLoading(false)
  }, [period, selectedShop])

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/auth/login'; return }
      createClient().from('users').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role !== 'admin') { window.location.href = '/'; return }
          setAuthChecked(true)
        })
    })
  }, [])

  useEffect(() => { if (authChecked) load() }, [authChecked, load])

  const displayed = typeFilter === 'all'
    ? activities
    : activities.filter(a => {
        if (typeFilter === 'shop')  return a.kind === 'shop'
        if (typeFilter === 'order') return a.kind === 'order'
        return a.type === typeFilter
      })

  // Per-shop open rate stats (for selected period)
  const shopStats = shops.map(s => {
    const acts = activities.filter(a => a.shop_id === s.id)
    const opened   = acts.filter(a => a.type === 'shop_opened').length
    const closed   = acts.filter(a => a.type === 'shop_closed').length
    const accepted = acts.filter(a => a.type === 'order_accepted').length
    const rejected = acts.filter(a => a.type === 'order_rejected').length
    const total    = acts.filter(a => a.type.startsWith('order_') && ['order_accepted','order_rejected'].includes(a.type)).length
    return { ...s, opened, closed, accepted, rejected, total, acceptRate: total > 0 ? Math.round(accepted / total * 100) : null }
  }).filter(s => s.opened + s.closed + s.accepted + s.rejected > 0)

  if (!authChecked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <p style={{ color: 'var(--text-3)' }}>Checking access…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f9fafb)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link href="/dashboard/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontWeight: 700, fontSize: 13 }}>
            <svg viewBox="0 0 16 16" fill="none" width={16} height={16}><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Admin
          </Link>
          <span style={{ color: 'var(--border)', fontSize: 16 }}>/</span>
          <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', margin: 0 }}>Shop Activity</h1>
          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
              {displayed.length} events
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px' }}>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          {/* Shop selector */}
          <select value={selectedShop} onChange={e => setSelectedShop(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
            <option value="all">All shops</option>
            {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Period */}
          <div style={{ display: 'flex', gap: 6 }}>
            {([['1d', 'Today'], ['7d', '7 days'], ['30d', '30 days']] as [Period, string][]).map(([p, l]) => (
              <button key={p} onClick={() => setPeriod(p)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  background: period === p ? '#0891B2' : 'var(--card-bg)', color: period === p ? '#fff' : 'var(--text-2)',
                  boxShadow: period === p ? '0 2px 8px rgba(8,145,178,.2)' : 'none', border: period !== p ? '1px solid var(--border)' : 'none' as any }}>
                {l}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([['all', 'All'], ['shop', '🏪 Shop'], ['order', '📦 Orders']] as [string, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  background: typeFilter === t ? '#111' : 'var(--card-bg)', color: typeFilter === t ? '#fff' : 'var(--text-2)',
                  border: typeFilter !== t ? '1px solid var(--border)' : 'none' as any }}>
                {l}
              </button>
            ))}
          </div>

          <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Shop summary cards (only in "All shops" view) */}
        {selectedShop === 'all' && shopStats.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 24 }}>
            {shopStats.map(s => (
              <button key={s.id} onClick={() => setSelectedShop(s.id)}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'border .15s' }}
                onMouseEnter={e => (e.currentTarget.style.border = '1px solid #0891B2')}
                onMouseLeave={e => (e.currentTarget.style.border = '1px solid var(--border)')}>
                <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.opened > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>🟢 {s.opened} opens</span>}
                  {s.closed > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>🔴 {s.closed} closes</span>}
                  {s.accepted > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>✅ {s.accepted} orders</span>}
                  {s.acceptRate !== null && <span style={{ fontSize: 10, fontWeight: 700, color: s.acceptRate >= 80 ? '#16a34a' : '#d97706' }}>{s.acceptRate}% acc.</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk2{background:linear-gradient(90deg,var(--bg-3,#f3f4f6) 25%,var(--bg-2,#e5e7eb) 50%,var(--bg-3,#f3f4f6) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:12px;}`}</style>
            {[80, 64, 80, 64, 72].map((h, i) => <div key={i} className="sk2" style={{ height: h }} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>No activity found</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Try a different shop or date range</p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', left: 20, top: 0, bottom: 0, width: 2, background: 'var(--border)', borderRadius: 1 }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {displayed.map((a, idx) => {
                const meta = TYPE_META[a.type] ?? { label: a.type, icon: '•', color: 'var(--text-3)', bg: 'var(--bg-3)' }
                const showDateSep = idx === 0 || new Date(displayed[idx - 1].time).toDateString() !== new Date(a.time).toDateString()
                return (
                  <div key={a.id}>
                    {showDateSep && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 12px 44px' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                          {new Date(a.time).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 10, paddingLeft: 4 }}>
                      {/* Timeline dot */}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: meta.bg, border: `2px solid ${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1, background: 'var(--card-bg)' as any }}>
                        <span style={{ fontSize: 13 }}>{meta.icon}</span>
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '10px 14px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: meta.color }}>{meta.label}</span>
                              {a.source && a.source !== 'order' && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 6,
                                  background: a.source === 'manual' ? 'rgba(37,99,235,.1)' : 'rgba(8,145,178,.1)',
                                  color: a.source === 'manual' ? '#2563eb' : '#0891b2' }}>
                                  {SOURCE_LABEL[a.source] ?? a.source}
                                </span>
                              )}
                              {a.order_number && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', fontFamily: 'monospace' }}>#{a.order_number}</span>
                              )}
                            </div>
                            {selectedShop === 'all' && (
                              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontWeight: 600 }}>{a.shop_name}</p>
                            )}
                            {a.order_amount != null && (
                              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>₹{a.order_amount}</p>
                            )}
                            {a.note && a.kind === 'shop' && (
                              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{a.note}</p>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{timeAgo(a.time)}</p>
                            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{fmtTime(a.time)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
