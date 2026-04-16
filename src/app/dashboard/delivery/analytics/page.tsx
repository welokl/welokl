'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface EarningPeriod { label: string; amount: number; count: number }
interface DeliveryRecord {
  id: string
  order_number: string
  created_at: string
  delivered_at: string | null
  total_amount: number
  subtotal: number
  delivery_fee: number
  shop: { name: string; commission_percent: number } | null
  delivery_address: string
  earned: number
}

function startOf(unit: 'day' | 'week' | 'month'): string {
  const d = new Date()
  if (unit === 'day')   { d.setHours(0, 0, 0, 0) }
  if (unit === 'week')  { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
  if (unit === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
  return d.toISOString()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function DeliveryAnalytics() {
  const router = useRouter()
  const [loading, setLoading]     = useState(true)
  const [periods, setPeriods]     = useState<EarningPeriod[]>([])
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([])
  const [totalDeliveries, setTotalDeliveries] = useState(0)
  const [activeTab, setActiveTab] = useState<'earnings' | 'history'>('earnings')
  const [partnerPayout, setPartnerPayout] = useState(20)
  const [deliveryFee, setDeliveryFee] = useState(25)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: roleRow } = await sb.from('users').select('role').eq('id', user.id).single()
    const role = roleRow?.role || ''
    if (role !== 'delivery_partner' && role !== 'delivery') {
      window.location.replace('/dashboard/customer'); return
    }

    const [{ data: dp }, { data: cfg }] = await Promise.all([
      sb.from('delivery_partners').select('total_deliveries').eq('user_id', user.id).single(),
      sb.from('platform_config').select('key,value').in('key', ['partner_payout', 'delivery_fee_base']),
    ])

    const payout  = cfg?.length ? Number(cfg.find((c: any) => c.key === 'partner_payout')?.value  ?? 20) : 20
    const defFee  = cfg?.length ? Number(cfg.find((c: any) => c.key === 'delivery_fee_base')?.value ?? 25) : 25
    setPartnerPayout(payout)
    setDeliveryFee(defFee)
    setTotalDeliveries(dp?.total_deliveries ?? 0)

    // Period delivery counts — earnings = count × payout (no wallet needed)
    const [todayRes, weekRes, monthRes] = await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_partner_id', user.id).eq('status', 'delivered').gte('delivered_at', startOf('day')),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_partner_id', user.id).eq('status', 'delivered').gte('delivered_at', startOf('week')),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('delivery_partner_id', user.id).eq('status', 'delivered').gte('delivered_at', startOf('month')),
    ])

    const todayCount = todayRes.count ?? 0
    const weekCount  = weekRes.count  ?? 0
    const monthCount = monthRes.count ?? 0
    const allCount   = dp?.total_deliveries ?? 0

    setPeriods([
      { label: 'Today',      amount: todayCount * payout, count: todayCount },
      { label: 'This week',  amount: weekCount  * payout, count: weekCount  },
      { label: 'This month', amount: monthCount * payout, count: monthCount },
      { label: 'All time',   amount: allCount   * payout, count: allCount   },
    ])

    // Delivery history — include subtotal + commission_percent so platform cut is accurate
    const { data: orders } = await sb
      .from('orders')
      .select('id, order_number, created_at, delivered_at, total_amount, subtotal, delivery_fee, delivery_address, shop:shops(name, commission_percent)')
      .eq('delivery_partner_id', user.id)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .limit(50)

    setDeliveries((orders ?? []).map((o: any) => ({ ...o, earned: payout })))

    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sb = createClient()
    const ch = sb.channel('dp-analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load])

  const PERIOD_COLORS = ['#f97316', '#8b5cf6', '#0ea5e9', '#16a34a']

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--divider)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--chip-bg)' }} />
          <div style={{ width: 140, height: 18, borderRadius: 6, background: 'var(--chip-bg)' }} />
        </div>
        <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[100, 220, 320, 420].map(h => (
            <div key={h} style={{ height: h, borderRadius: 20, background: 'var(--chip-bg)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  )

  const daysInMonth = new Date().getDate()
  const monthCount  = periods.find(p => p.label === 'This month')?.count ?? 0
  const avgPerDay   = daysInMonth > 0 ? (monthCount / daysInMonth).toFixed(1) : '0'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-white)', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--page-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <h1 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text-primary)', flex: 1 }}>My Earnings</h1>
        </div>

        {/* Tabs */}
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 0', display: 'flex', gap: 0 }}>
          {(['earnings', 'history'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, paddingBottom: 12, paddingTop: 4, border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              color: activeTab === tab ? '#FF3008' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2.5px solid #FF3008' : '2.5px solid transparent',
              transition: 'all .2s',
            }}>
              {tab === 'earnings' ? 'Earnings' : 'Delivery history'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 0' }}>

        {activeTab === 'earnings' && (
          <>
            {/* Hero — all-time earnings */}
            <div style={{ background: 'linear-gradient(135deg, #FF3008 0%, #ff6b35 100%)', borderRadius: 24, padding: '24px', marginBottom: 12, color: '#fff', boxShadow: '0 8px 32px rgba(255,48,8,.3)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.75, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>All time earnings</p>
              <p style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 2 }}>₹{(totalDeliveries * partnerPayout).toFixed(0)}</p>
              <p style={{ fontSize: 13, opacity: 0.8 }}>{totalDeliveries} deliveries · ₹{partnerPayout} each</p>
            </div>

            {/* Per-delivery earnings breakdown — the most important card */}
            <div style={{ background: 'var(--card-white)', borderRadius: 20, padding: '18px 20px', marginBottom: 12, border: '1.5px solid var(--divider)' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>💰 How you earn per delivery</p>

              {/* Flow: delivery fee → your cut → platform */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
                {/* Customer pays */}
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#f5f5f5', borderRadius: '12px 0 0 12px' }}>
                  <p style={{ fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Customer pays</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#111' }}>₹{deliveryFee}</p>
                  <p style={{ fontSize: 10, color: '#aaa' }}>delivery fee</p>
                </div>
                <div style={{ fontSize: 16, color: '#ccc', padding: '0 4px' }}>→</div>
                {/* Your earning */}
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#eefaf4', borderRadius: 0 }}>
                  <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>You receive</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>₹{partnerPayout}</p>
                  <p style={{ fontSize: 10, color: '#16a34a', opacity: 0.7 }}>per delivery</p>
                </div>
                <div style={{ fontSize: 16, color: '#ccc', padding: '0 4px' }}>+</div>
                {/* Platform */}
                <div style={{ flex: 1, textAlign: 'center', padding: '10px 8px', background: '#fff5f0', borderRadius: '0 12px 12px 0' }}>
                  <p style={{ fontSize: 10, color: '#FF3008', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Platform</p>
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#FF3008' }}>₹{deliveryFee - partnerPayout}</p>
                  <p style={{ fontSize: 10, color: '#FF3008', opacity: 0.7 }}>service fee</p>
                </div>
              </div>

              {/* Rules list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '✅', text: `You keep ₹${partnerPayout} flat for every delivery completed`, color: '#16a34a' },
                  { icon: '📦', text: `Orders ≥ ₹299 have free delivery — you still earn ₹${partnerPayout}`, color: '#2563eb' },
                  { icon: '🚫', text: `No other deductions — ₹${partnerPayout} goes straight to your wallet`, color: '#555' },
                ].map(({ icon, text, color }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: 'var(--page-bg)', borderRadius: 12 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <p style={{ fontSize: 13, color, fontWeight: 600, lineHeight: 1.4 }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Period breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {periods.map((p, i) => (
                <div key={p.label} style={{ background: 'var(--card-white)', borderRadius: 18, padding: '16px 18px', border: '1.5px solid var(--divider)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 900, color: PERIOD_COLORS[i], marginBottom: 2 }}>₹{p.amount.toFixed(0)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.count} {p.count === 1 ? 'delivery' : 'deliveries'}</p>
                  {p.count > 0 && <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>₹{partnerPayout} × {p.count}</p>}
                </div>
              ))}
            </div>

            {/* Performance stats */}
            <div style={{ background: 'var(--card-white)', borderRadius: 20, padding: '18px 20px', border: '1.5px solid var(--divider)' }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>📊 Performance</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                {[
                  { label: 'Total', value: String(totalDeliveries), sub: 'deliveries' },
                  { label: 'This month', value: String(monthCount), sub: 'deliveries' },
                  { label: 'Avg / day', value: avgPerDay, sub: 'this month' },
                ].map((s, i) => (
                  <div key={s.label} style={{ textAlign: 'center', borderRight: i < 2 ? '1px solid var(--divider)' : 'none', padding: '0 8px' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 2 }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-faint)' }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'history' && (
          <>
            {deliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card-white)', borderRadius: 24, border: '1.5px solid var(--divider)' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,48,8,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg viewBox="0 0 24 24" fill="none" width={32} height={32}><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)', marginBottom: 6 }}>No deliveries yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your completed deliveries will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, paddingLeft: 4 }}>
                  {deliveries.length} {deliveries.length === 1 ? 'delivery' : 'deliveries'} completed
                </p>
                {deliveries.map(d => {
                  const shop = Array.isArray(d.shop) ? d.shop[0] : d.shop
                  const commissionPct = shop?.commission_percent ?? 15
                  const commissionAmt = Math.round((d.subtotal ?? (d.total_amount - (d.delivery_fee ?? 0))) * commissionPct / 100)
                  const deliveryMargin = Math.max(0, (d.delivery_fee ?? deliveryFee) - partnerPayout)
                  const platformCut = commissionAmt + deliveryMargin
                  return (
                  <div key={d.id} style={{ background: 'var(--card-white)', borderRadius: 18, padding: '16px 18px', border: '1.5px solid var(--divider)' }}>
                    {/* Top row: shop + earned */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {shop?.name || 'Shop'}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          #{d.order_number} · {d.delivered_at ? fmtDate(d.delivered_at) : fmtDate(d.created_at)}
                          {d.delivered_at ? ` · ${fmtTime(d.delivered_at)}` : ''}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <p style={{ fontSize: 18, fontWeight: 900, color: '#16a34a' }}>+₹{d.earned}</p>
                        <p style={{ fontSize: 10, color: '#16a34a', opacity: 0.7 }}>your payout</p>
                      </div>
                    </div>

                    {/* Earnings breakdown */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 2 }}>Order value</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>₹{d.total_amount}</p>
                      </div>
                      <div style={{ flex: 1, background: '#eefaf4', borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginBottom: 2 }}>Your cut</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#16a34a' }}>₹{d.earned}</p>
                      </div>
                      <div style={{ flex: 1, background: '#fff5f0', borderRadius: 10, padding: '6px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: '#FF3008', fontWeight: 600, marginBottom: 2 }}>Platform</p>
                        <p style={{ fontSize: 13, fontWeight: 800, color: '#FF3008' }}>₹{platformCut}</p>
                        <p style={{ fontSize: 9, color: '#FF3008', opacity: 0.6 }}>comm+del</p>
                      </div>
                    </div>

                    {/* Address */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingTop: 8, borderTop: '1px solid var(--divider)' }}>
                      <svg viewBox="0 0 24 24" fill="none" width={13} height={13} style={{ marginTop: 2, flexShrink: 0 }}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#9ca3af"/>
                      </svg>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{d.delivery_address || '—'}</p>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
