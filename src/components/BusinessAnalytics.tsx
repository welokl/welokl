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

// Group delivered orders by day for chart — uses net earnings (subtotal minus commission)
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

// Top products
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

export default function BusinessAnalytics({ shopId, commissionPercent = 15 }: { shopId: string; commissionPercent?: number }) {
  const [period, setPeriod] = useState<Period>('week')
  const [orders, setOrders] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [period, shopId])

  async function load() {
    setLoading(true)
    const { from, to } = getRange(period)
    const sb = createClient()
    const { data } = await sb.from('orders')
      .select('created_at, total_amount, subtotal, platform_fee, status, type, items:order_items(product_name, quantity, price)')
      .eq('shop_id', shopId)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: true })
    setOrders((data || []) as SaleRow[])
    setLoading(false)
  }

  const stats = calcStats(orders, commissionPercent)
  const chartData = groupByDay(orders, period, commissionPercent)
  const maxRev = Math.max(...chartData.map(d => d[1]), 1)
  const tops = topProducts(orders)

  const statCards = [
    { label: 'Your earnings', value: `₹${stats.netEarnings.toLocaleString('en-IN')}`, icon: '💰', color: '#16a34a' },
    { label: 'Total orders',  value: stats.orders,                                     icon: '📦', color: '#2563eb' },
    { label: 'Delivered',     value: stats.delivered,                                  icon: '✅', color: '#16a34a' },
    { label: 'Avg earning',   value: `₹${stats.avgEarning}`,                           icon: '📊', color: '#d97706' },
    { label: 'Cancelled',     value: stats.cancelled,                                  icon: '❌', color: '#ef4444' },
  ]

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
          <div className="sk" style={{ height: 80 }} />
          <div className="sk" style={{ height: 180 }} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {statCards.map(s => (
              <div key={s.label} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <p style={{ fontWeight: 900, fontSize: 20, color: s.color, marginBottom: 2 }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Earnings breakdown */}
          {stats.delivered > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Earnings breakdown</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>Orders value (items)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>₹{stats.grossRevenue.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-2)' }}>Welokl commission ({commissionPercent}%)</span>
                  <span style={{ fontWeight: 700, color: '#ef4444' }}>− ₹{stats.commission.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ borderTop: '1.5px dashed var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>Your earnings</span>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#16a34a' }}>₹{stats.netEarnings.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 10 }}>
                Delivery fee goes directly to the rider and is not included above.
              </p>
            </div>
          )}

          {/* Earnings chart */}
          {chartData.length > 1 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>Your earnings</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: period === 'month' ? 3 : 6, height: 120 }}>
                {chartData.map(([label, val]) => (
                  <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: '100%', background: val > 0 ? '#0891B2' : 'var(--bg-3)', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (val / maxRev) * 100)}px`, transition: 'height .3s' }} />
                    {period !== 'month' && <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top products */}
          {tops.length > 0 && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 16px' }}>
              <h3 style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Top products</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tops.map(([name, d], i) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, background: i === 0 ? '#0891B2' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: i === 0 ? '#fff' : 'var(--text-3)' }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{d.qty} sold</p>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>&#8377;{d.rev.toLocaleString('en-IN')}</span>
                  </div>
                ))}
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