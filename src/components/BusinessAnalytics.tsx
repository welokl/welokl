'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Period = 'today' | 'week' | 'month'

interface SaleRow {
  created_at: string; total_amount: number; subtotal: number; platform_fee: number; status: string; type: string
  items: { product_name: string; quantity: number; price: number }[]
}
interface Stats {
  grossRevenue: number; commission: number; netEarnings: number
  orders: number; avgEarning: number; delivered: number; cancelled: number
}

function getRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  const to = new Date(now)
  to.setHours(23, 59, 59, 999)
  const from = new Date(now)
  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }
  return { from, to }
}

function getPrevRange(period: Period): { from: Date; to: Date } {
  const now = new Date()
  if (period === 'today') {
    const from = new Date(now); from.setDate(from.getDate() - 1); from.setHours(0, 0, 0, 0)
    const to   = new Date(now); to.setDate(to.getDate()     - 1); to.setHours(23, 59, 59, 999)
    return { from, to }
  } else if (period === 'week') {
    const from = new Date(now); from.setDate(from.getDate() - 13); from.setHours(0, 0, 0, 0)
    const to   = new Date(now); to.setDate(to.getDate()    - 7);   to.setHours(23, 59, 59, 999)
    return { from, to }
  } else {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { from, to }
  }
}

function calcStats(orders: SaleRow[], commissionPercent: number): Stats {
  const delivered = orders.filter(o => o.status === 'delivered')
  const cancelled = orders.filter(o => ['cancelled','rejected'].includes(o.status)).length
  const grossRevenue = delivered.reduce((s, o) => s + (o.subtotal ?? o.total_amount), 0)
  const commission   = Math.round(grossRevenue * (commissionPercent / 100))
  const netEarnings  = grossRevenue - commission
  return {
    grossRevenue, commission, netEarnings,
    orders: orders.length,
    avgEarning: delivered.length ? Math.round(netEarnings / delivered.length) : 0,
    delivered: delivered.length,
    cancelled,
  }
}

function groupByDay(orders: SaleRow[], period: Period, commissionPercent: number) {
  const map: Record<string, number> = {}
  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    map[key] = 0
  }
  orders.filter(o => o.status === 'delivered').forEach(o => {
    const key = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    if (key in map) {
      const gross = o.subtotal ?? o.total_amount
      map[key] += Math.round(gross * (1 - commissionPercent / 100))
    }
  })
  return Object.entries(map)
}

function groupByHour(orders: SaleRow[]) {
  const map: Record<number, number> = {}
  for (let h = 0; h < 24; h++) map[h] = 0
  orders.filter(o => o.status === 'delivered').forEach(o => {
    const h = new Date(o.created_at).getHours()
    map[h]++
  })
  return Object.entries(map)
    .filter(([h]) => Number(h) >= 6 && Number(h) <= 23)
    .map(([h, c]) => [Number(h), c] as [number, number])
}

function topProducts(orders: SaleRow[]) {
  const map: Record<string, { qty: number; rev: number }> = {}
  orders.filter(o => o.status === 'delivered').forEach(o => {
    o.items?.forEach(item => {
      if (!map[item.product_name]) map[item.product_name] = { qty: 0, rev: 0 }
      map[item.product_name].qty += item.quantity
      map[item.product_name].rev += item.price * item.quantity
    })
  })
  return Object.entries(map).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5)
}

function pctTrend(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

export default function BusinessAnalytics({ shopId, commissionPercent = 15 }: { shopId: string; commissionPercent?: number }) {
  const [period, setPeriod]       = useState<Period>('week')
  const [orders, setOrders]       = useState<SaleRow[]>([])
  const [prevOrders, setPrevOrders] = useState<SaleRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { load() }, [period, shopId])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { from, to }         = getRange(period)
    const { from: pf, to: pt } = getPrevRange(period)
    const [{ data }, { data: prevData }] = await Promise.all([
      sb.from('orders')
        .select('created_at, total_amount, subtotal, platform_fee, status, type, items:order_items(product_name, quantity, price)')
        .eq('shop_id', shopId).gte('created_at', from.toISOString()).lte('created_at', to.toISOString())
        .order('created_at', { ascending: true }),
      sb.from('orders')
        .select('created_at, total_amount, subtotal, platform_fee, status, type')
        .eq('shop_id', shopId).gte('created_at', pf.toISOString()).lte('created_at', pt.toISOString()),
    ])
    setOrders((data || []) as SaleRow[])
    setPrevOrders((prevData || []) as SaleRow[])
    setLoading(false)
  }

  const stats      = calcStats(orders, commissionPercent)
  const prevStats  = calcStats(prevOrders, commissionPercent)
  const chartData  = groupByDay(orders, period, commissionPercent)
  const maxRev     = Math.max(...chartData.map(d => d[1]), 1)
  const tops       = topProducts(orders)
  const hourData   = groupByHour(orders)
  const maxHour    = Math.max(...hourData.map(h => h[1]), 1)

  const successRate    = stats.orders > 0 ? Math.round((stats.delivered / stats.orders) * 100) : 0
  const earningsTrend  = pctTrend(stats.netEarnings, prevStats.netEarnings)
  const ordersTrend    = pctTrend(stats.orders, prevStats.orders)

  const r = 28
  const circumference = 2 * Math.PI * r
  const dashOffset    = circumference - (successRate / 100) * circumference

  const periodLabel = period === 'today' ? 'yesterday' : period === 'week' ? 'prev week' : 'prev month'

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['today','week','month'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            style={{ padding: '8px 20px', borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: period === p ? '#0891B2' : 'var(--bg-3)',
              color: period === p ? '#fff' : 'var(--text-2)' }}>
            {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 days' : 'This month'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:12px;}`}</style>
          <div className="sk" style={{ height: 100 }} />
          <div className="sk" style={{ height: 80 }} />
          <div className="sk" style={{ height: 180 }} />
        </div>
      ) : (
        <>
          {/* Hero: earnings + success rate ring */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #0c4a6e 0%, #0891B2 100%)', borderRadius: 20, padding: '20px 20px', color: '#fff' }}>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: .7, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Net earnings</p>
              <p style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, marginBottom: 6 }}>₹{stats.netEarnings.toLocaleString('en-IN')}</p>
              {earningsTrend !== 0 ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: earningsTrend > 0 ? 'rgba(74,222,128,.18)' : 'rgba(248,113,113,.18)', borderRadius: 6, padding: '3px 8px' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: earningsTrend > 0 ? '#86efac' : '#fca5a5' }}>
                    {earningsTrend > 0 ? '▲' : '▼'} {Math.abs(earningsTrend)}% vs {periodLabel}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.1)', borderRadius: 6, padding: '3px 8px' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>No change vs {periodLabel}</span>
                </div>
              )}
            </div>

            {/* Success rate ring */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 88 }}>
              <div style={{ position: 'relative', width: 64, height: 64 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="6" />
                  <circle cx="32" cy="32" r={r} fill="none"
                    stroke={successRate >= 80 ? '#16a34a' : successRate >= 50 ? '#d97706' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset .5s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--text)' }}>{successRate}%</span>
                </div>
              </div>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', marginTop: 6 }}>Success<br/>rate</p>
            </div>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total orders',  value: stats.orders,    trend: ordersTrend, color: '#2563eb', bg: 'rgba(37,99,235,.07)' },
              { label: 'Delivered',     value: stats.delivered, color: '#16a34a',   bg: 'rgba(22,163,74,.07)' },
              { label: 'Avg per order', value: `₹${stats.avgEarning}`, color: '#d97706', bg: 'rgba(217,119,6,.07)' },
              { label: 'Cancelled',     value: stats.cancelled, color: '#ef4444',   bg: 'rgba(239,68,68,.07)' },
              { label: 'Gross sales',   value: `₹${stats.grossRevenue.toLocaleString('en-IN')}`, color: '#7c3aed', bg: 'rgba(124,58,237,.07)' },
              { label: 'Commission',    value: `₹${stats.commission.toLocaleString('en-IN')}`,   color: '#9ca3af', bg: 'rgba(156,163,175,.07)' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 14, padding: '12px 14px' }}>
                <p style={{ fontWeight: 900, fontSize: 16, color: s.color, marginBottom: 2, lineHeight: 1.2 }}>
                  {s.value}
                  {'trend' in s && (s.trend as number) !== 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: (s.trend as number) > 0 ? '#16a34a' : '#ef4444', marginLeft: 4 }}>
                      {(s.trend as number) > 0 ? '▲' : '▼'}{Math.abs(s.trend as number)}%
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings breakdown */}
          {stats.delivered > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>How your earnings work</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-2)' }}>Gross sales (items)</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>₹{stats.grossRevenue.toLocaleString('en-IN')}</span>
                </div>
                {/* Split bar */}
                {stats.grossRevenue > 0 && (
                  <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ flex: stats.netEarnings, background: '#16a34a', transition: 'flex .4s' }} />
                      <div style={{ flex: stats.commission,  background: '#ef4444', transition: 'flex .4s' }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-2)' }}>Welokl commission ({commissionPercent}%)</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>− ₹{stats.commission.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: '#16a34a', flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Your net earnings</span>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 16, color: '#16a34a' }}>₹{stats.netEarnings.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
                Delivery fee goes directly to the rider and is not included above.
              </p>
            </div>
          )}

          {/* Daily earnings chart */}
          {chartData.length > 1 && stats.netEarnings > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>
                  {period === 'today' ? "Today's earnings" : period === 'week' ? 'Daily earnings' : 'Monthly earnings'}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
                  Peak: ₹{maxRev.toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'month' ? 3 : 8, height: 120 }}>
                {chartData.map(([label, val]) => {
                  const h = Math.max(4, (val / maxRev) * 110)
                  const isPeak = val === maxRev && maxRev > 0
                  return (
                    <div key={label} title={`${label}: ₹${val}`}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: '100%', borderRadius: '4px 4px 0 0', height: `${h}px`,
                        background: isPeak
                          ? 'linear-gradient(180deg, #FF3008, #e02d07)'
                          : val > 0
                            ? 'linear-gradient(180deg, #0891B2, #0e7490)'
                            : 'var(--bg-3)',
                        transition: 'height .3s',
                        boxShadow: isPeak ? '0 2px 8px rgba(255,48,8,.3)' : 'none',
                      }} />
                      {period !== 'month' && (
                        <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Peak hours */}
          {orders.filter(o => o.status === 'delivered').length >= 3 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Peak hours</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
                {hourData.map(([h, c]) => {
                  const barH = c > 0 ? Math.max(8, (c / maxHour) * 50) : 3
                  const isPeak = c === maxHour && maxHour > 0
                  return (
                    <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', borderRadius: '3px 3px 0 0', height: `${barH}px`,
                        background: isPeak ? '#FF3008' : c > 0 ? '#0891B2' : 'var(--bg-3)',
                        transition: 'height .3s',
                      }} />
                      {h % 4 === 0 && (
                        <span style={{ fontSize: 8, color: 'var(--text-3)', fontWeight: 600 }}>
                          {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              {maxHour > 0 && (() => {
                const peakH = hourData.find(x => x[1] === maxHour)?.[0] ?? 0
                const label = peakH === 0 ? '12:00 AM' : peakH < 12 ? `${peakH}:00 AM` : peakH === 12 ? '12:00 PM' : `${peakH - 12}:00 PM`
                return (
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
                    Busiest hour: <strong style={{ color: 'var(--text)' }}>{label}</strong> — {maxHour} order{maxHour > 1 ? 's' : ''}
                  </p>
                )
              })()}
            </div>
          )}

          {/* Top products */}
          {tops.length > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px' }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Top products</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tops.map(([name, d], i) => {
                  const maxTopRev = tops[0][1].rev
                  return (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: i === 0 ? 'linear-gradient(135deg, #0891B2, #0e7490)' : 'var(--bg-3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: i === 0 ? '0 2px 8px rgba(8,145,178,.3)' : 'none',
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: i === 0 ? '#fff' : 'var(--text-3)' }}>{i + 1}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{name}</p>
                        <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2, transition: 'width .4s',
                            width: `${(d.rev / maxTopRev) * 100}%`,
                            background: i === 0 ? '#0891B2' : '#94a3b8',
                          }} />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{d.qty} sold</p>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>₹{d.rev.toLocaleString('en-IN')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>No data yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Sales will appear here once orders come in</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
