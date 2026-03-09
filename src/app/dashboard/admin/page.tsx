'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'overview' | 'orders' | 'shops' | 'users' | 'verify' | 'pricing' | 'delivery'

interface Config  { key: string; value: string; label: string }
interface Order   { id: string; order_number: string; status: string; total_amount: number; subtotal: number; payment_method: string; created_at: string; type: string; delivery_partner_id: string | null; shop: { name: string; commission_percent: number } | null; customer: { name: string; phone: string } | null; partner: { name: string; phone: string } | null }
interface Shop    { id: string; name: string; category_name: string; is_active: boolean; commission_percent: number; rating: number; area: string; city: string; image_url: string | null; verification_status: string; verification_note: string | null; owner: { name: string; email: string; phone: string | null } | null }
interface User    { id: string; name: string; email: string; phone: string | null; role: string; created_at: string }
interface PendingDelivery { user_id: string; name: string; email: string; phone: string | null; vehicle_type: string | null; verification_status: string; verification_note: string | null; created_at: string }

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
const card  = { background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }
const card2 = { background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)' }
const lbl   = { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }
const mono  = { fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }

export default function AdminDashboard() {
  const [tab, setTab]             = useState<Tab>('overview')
  const [orders, setOrders]       = useState<Order[]>([])
  const [shops, setShops]         = useState<Shop[]>([])
  const [users, setUsers]         = useState<User[]>([])
  const [config, setConfig]       = useState<Config[]>([])
  const [pendingDel, setPendingDel] = useState<PendingDelivery[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [edits, setEdits]         = useState<Record<string, string>>({})
  const [search, setSearch]       = useState('')
  const [statusFilter, setFilter] = useState('all')
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await sb.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      const roleHome: Record<string, string> = { customer: '/dashboard/customer', shopkeeper: '/dashboard/business', business: '/dashboard/business', delivery: '/dashboard/delivery' }
      window.location.replace(roleHome[profile?.role || ''] || '/dashboard/customer')
      return
    }

    const [{ data: od }, { data: sd }, { data: ud }, { data: cd }, { data: dd }] = await Promise.all([
      sb.from('orders').select('*, shop:shops(name,commission_percent), customer:users!customer_id(name,phone), partner:users!delivery_partner_id(name,phone)').order('created_at', { ascending: false }).limit(200),
      sb.from('shops').select('*, owner:users!owner_id(name,email,phone)').order('created_at', { ascending: false }),
      sb.from('users').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('platform_config').select('*').order('key'),
      sb.from('delivery_partners').select('*, user:users!user_id(name,email,phone,created_at)').order('created_at', { ascending: false }),
    ])

    setOrders((od as Order[]) || [])
    setShops((sd as Shop[]) || [])
    setUsers((ud as User[]) || [])
    setConfig((cd as Config[]) || [])

    // Flatten delivery partners with user info for verification
    const flat: PendingDelivery[] = ((dd as any[]) || []).map((dp: any) => ({
      user_id: dp.user_id,
      name: dp.user?.name || '—',
      email: dp.user?.email || '—',
      phone: dp.user?.phone || null,
      vehicle_type: dp.vehicle_type || null,
      verification_status: dp.verification_status || 'pending',
      verification_note: dp.verification_note || null,
      created_at: dp.user?.created_at || dp.created_at,
    }))
    setPendingDel(flat)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const sb = createClient()
    const ch = sb.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_partners' }, load)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load])

  const cfg        = (key: string, fb = 0) => Number(config.find(c => c.key === key)?.value ?? fb)
  const cfgStr     = (key: string, fb = '') => config.find(c => c.key === key)?.value ?? fb
  const delivered  = orders.filter(o => o.status === 'delivered')
  const gmv        = delivered.reduce((s, o) => s + (o.subtotal || 0), 0)
  const commEarned = delivered.reduce((s, o) => s + Math.round((o.subtotal || 0) * (o.shop?.commission_percent ?? cfg('default_commission', 15)) / 100), 0)
  const platFees   = delivered.length * cfg('platform_fee_flat', 5)
  const delivOrds  = delivered.filter(o => o.type === 'delivery')
  const partPay    = delivOrds.length * cfg('partner_payout', 20)
  const delivFees  = delivOrds.reduce((s, o) => s + Math.max(0, (o.total_amount || 0) - (o.subtotal || 0) - cfg('platform_fee_flat', 5)), 0)
  const netRev     = commEarned + platFees + Math.max(0, delivFees - partPay)

  const pendingShops = shops.filter(s => s.verification_status === 'pending')
  const pendingRiders = pendingDel.filter(d => d.verification_status === 'pending')
  const totalPending = pendingShops.length + pendingRiders.length

  async function saveConfig() {
    if (!Object.keys(edits).length) return
    setSaving(true)
    const sb = createClient()
    for (const [key, value] of Object.entries(edits))
      await sb.from('platform_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
    setEdits({}); setSaving(false); load()
  }

  async function overrideOrder(id: string, status: string) {
    const sb = createClient()
    await sb.from('orders').update({ status }).eq('id', id)
    await sb.from('order_status_log').insert({ order_id: id, status, message: 'Status overridden by admin' })
  }

  // ── Verify a SHOP ──
  async function verifyShop(shopId: string, decision: 'approved' | 'rejected') {
    const sb = createClient()
    const note = rejectNote[shopId] || null
    await sb.from('shops').update({
      verification_status: decision,
      verification_note: decision === 'rejected' ? note : null,
      is_active: decision === 'approved',
    }).eq('id', shopId)
    setRejectNote(p => { const n = { ...p }; delete n[shopId]; return n })
    load()
  }

  // ── Verify a DELIVERY PARTNER ──
  async function verifyRider(userId: string, decision: 'approved' | 'rejected') {
    const sb = createClient()
    const note = rejectNote[userId] || null
    await sb.from('delivery_partners').update({
      verification_status: decision,
      verification_note: decision === 'rejected' ? note : null,
    }).eq('user_id', userId)
    setRejectNote(p => { const n = { ...p }; delete n[userId]; return n })
    load()
  }

  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const filteredOrders = orders.filter(o => {
    const ms = statusFilter === 'all' || o.status === statusFilter
    const mq = !search || o.order_number?.includes(search) || o.shop?.name?.toLowerCase().includes(search.toLowerCase()) || o.customer?.name?.toLowerCase().includes(search.toLowerCase())
    return ms && mq
  })

  const TABS: { id: Tab; icon: string; label: string; badge?: number }[] = [
    { id: 'overview',  icon: '📊', label: 'Overview' },
    { id: 'orders',    icon: '📦', label: `Orders (${orders.length})` },
    { id: 'shops',     icon: '🏪', label: `Shops (${shops.length})` },
    { id: 'users',     icon: '👥', label: `Users (${users.length})` },
    { id: 'verify',    icon: '✅', label: 'Verify', badge: totalPending },
    { id: 'pricing',   icon: '💰', label: 'Pricing & UPI' },
    { id: 'delivery',  icon: '🛵', label: 'Delivery' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* TOP BAR */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ff3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>W</div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>ADMIN CONSOLE</p>
              <p style={{ fontSize: 15, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Welokl Platform</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {totalPending > 0 && (
              <button onClick={() => setTab('verify')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer', fontFamily: 'inherit', animation: 'pulse 2s infinite' }}>
                ⚠️ {totalPending} pending verification{totalPending > 1 ? 's' : ''}
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Live</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#ff5a1f' }}>GMV ₹{gmv.toLocaleString('en-IN')}</span>
              <span style={{ color: '#4ade80' }}>Rev ₹{netRev.toLocaleString('en-IN')}</span>
            </div>
            <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
              style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 16px', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', position: 'relative',
                color: tab === t.id ? 'var(--brand)' : 'var(--text-3)',
                borderBottom: tab === t.id ? '2px solid var(--brand)' : '2px solid transparent' }}>
              {t.icon} {t.label}
              {t.badge && t.badge > 0 ? (
                <span style={{ marginLeft: 2, fontSize: 10, fontWeight: 900, padding: '1px 6px', borderRadius: 999, background: '#f59e0b', color: '#fff', minWidth: 18, textAlign: 'center' }}>{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 80px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ height: 100, borderRadius: 16 }} className="shimmer" />)}
          </div>
        ) : <>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                {[
                  { l: 'Total Orders',  v: orders.length,                         i: '📦', c: '#3b82f6', sub: `${todayOrders.length} today` },
                  { l: 'Delivered',     v: delivered.length,                       i: '✅', c: '#16a34a', sub: `${delivOrds.length} with delivery` },
                  { l: 'GMV',           v: `₹${gmv.toLocaleString('en-IN')}`,     i: '💳', c: '#7c3aed', sub: 'Gross merchandise value' },
                  { l: 'Net Revenue',   v: `₹${netRev.toLocaleString('en-IN')}`,  i: '🏦', c: '#ff5a1f', sub: 'Platform earnings' },
                ].map(s => (
                  <div key={s.l} style={{ ...card }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.i}</div>
                    <div style={{ fontWeight: 900, fontSize: 26, color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginTop: 5 }}>{s.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {totalPending > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>⚠️</span>
                    <div>
                      <p style={{ fontWeight: 900, fontSize: 15, color: '#d97706' }}>{totalPending} pending verification{totalPending > 1 ? 's' : ''}</p>
                      <p style={{ fontSize: 13, color: '#d97706', opacity: 0.8, marginTop: 2 }}>
                        {pendingShops.length > 0 && `${pendingShops.length} shop${pendingShops.length > 1 ? 's' : ''}`}
                        {pendingShops.length > 0 && pendingRiders.length > 0 && ' · '}
                        {pendingRiders.length > 0 && `${pendingRiders.length} delivery partner${pendingRiders.length > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setTab('verify')}
                    style={{ padding: '10px 20px', borderRadius: 12, background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Review now →
                  </button>
                </div>
              )}

              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 16 }}>Revenue Breakdown</p>
                {[
                  { l: 'Gross Merchandise Value (GMV)',                              v: `₹${gmv.toLocaleString('en-IN')}`,          c: 'var(--text)' },
                  { l: `Shop commissions (avg ${cfg('default_commission',15)}%)`,    v: `+₹${commEarned.toLocaleString('en-IN')}`,   c: '#16a34a' },
                  { l: `Platform fees (₹${cfg('platform_fee_flat',5)} × ${delivered.length})`, v: `+₹${platFees.toLocaleString('en-IN')}`, c: '#16a34a' },
                  { l: 'Delivery fees collected',                                    v: `+₹${delivFees.toLocaleString('en-IN')}`,    c: '#16a34a' },
                  { l: `Partner payouts (₹${cfg('partner_payout',20)} × ${delivOrds.length})`, v: `-₹${partPay.toLocaleString('en-IN')}`,  c: '#ef4444' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{r.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.c }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 0', borderTop: '2px solid var(--border)', marginTop: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>Net Platform Revenue</span>
                  <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--brand)' }}>₹{netRev.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                {[
                  { l: 'Customers',       v: users.filter(u => u.role === 'customer').length },
                  { l: 'Shop Owners',     v: users.filter(u => u.role === 'business').length },
                  { l: 'Riders',          v: users.filter(u => u.role === 'delivery').length },
                  { l: 'Active Shops',    v: shops.filter(s => s.is_active).length },
                  { l: 'Pending Verify',  v: totalPending },
                ].map(s => (
                  <div key={s.l} style={{ ...card, textAlign: 'center', padding: 18 }}>
                    <div style={{ fontWeight: 900, fontSize: 28, color: s.l === 'Pending Verify' && s.v > 0 ? '#f59e0b' : 'var(--text)', lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, marginTop: 5 }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...card }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <p style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>Live Order Feed</p>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> Realtime
                  </span>
                </div>
                {orders.slice(0, 12).map((o, i) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ ...mono, width: 90, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{o.order_number}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shop?.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>₹{o.total_amount}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, flexShrink: 0, background: STATUS_COLOR[o.status]?.bg || 'var(--bg-3)', color: STATUS_COLOR[o.status]?.text || 'var(--text-3)' }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ORDERS ── */}
          {tab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Orders ({filteredOrders.length})</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, shop, customer…"
                    style={{ width: 220, fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                  <select value={statusFilter} onChange={e => setFilter(e.target.value)}
                    style={{ fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontWeight: 600, fontFamily: 'inherit', outline: 'none' }}>
                    <option value="all">All statuses</option>
                    {['placed','accepted','preparing','ready','picked_up','delivered','cancelled','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ ...card2, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Order #','Time','Shop','Customer','Rider','Amount','Payment','Status','Override'].map(h => (
                        <th key={h} style={{ ...lbl, padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o, i) => (
                      <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ ...mono, padding: '11px 16px', whiteSpace: 'nowrap' }}>{o.order_number}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shop?.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)' }}>{o.customer?.name || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12 }}>{o.delivery_partner_id ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{o.partner?.name || 'Assigned'}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>₹{o.total_amount}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)', textTransform: 'capitalize' }}>{o.payment_method}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', background: STATUS_COLOR[o.status]?.bg || 'var(--bg-3)', color: STATUS_COLOR[o.status]?.text || 'var(--text-3)' }}>{o.status}</span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          <select value={o.status} onChange={e => overrideOrder(o.id, e.target.value)}
                            style={{ fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 8px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', fontWeight: 600 }}>
                            {['placed','accepted','preparing','ready','picked_up','delivered','cancelled','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SHOPS ── */}
          {tab === 'shops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Shops ({shops.length})</h2>
              {shops.map(shop => (
                <div key={shop.id} style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                    {shop.image_url ? <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🏪'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <p style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>{shop.name}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: shop.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: shop.is_active ? '#16a34a' : '#ef4444' }}>
                        {shop.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: shop.verification_status === 'approved' ? 'rgba(34,197,94,0.12)' : shop.verification_status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)', color: shop.verification_status === 'approved' ? '#16a34a' : shop.verification_status === 'pending' ? '#d97706' : '#ef4444' }}>
                        {shop.verification_status === 'approved' ? '✓ Verified' : shop.verification_status === 'pending' ? '⏳ Pending' : '✕ Rejected'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{shop.category_name} · {shop.area}, {shop.city} · ★{shop.rating}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Owner: {shop.owner?.name} · {shop.owner?.phone || shop.owner?.email}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)' }}>Comm %</span>
                      <input type="number" defaultValue={shop.commission_percent} min="0" max="50" step="0.5"
                        onBlur={e => createClient().from('shops').update({ commission_percent: parseFloat(e.target.value) }).eq('id', shop.id).then(load)}
                        style={{ width: 56, fontSize: 13, fontWeight: 800, textAlign: 'center', border: '1px solid var(--border-2)', borderRadius: 8, padding: '6px 4px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                    </div>
                    <button onClick={() => createClient().from('shops').update({ is_active: !shop.is_active }).eq('id', shop.id).then(load)}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: shop.is_active ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: shop.is_active ? '#ef4444' : '#16a34a' }}>
                      {shop.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Users ({users.length})</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['customer','business','delivery','admin'].map(r => (
                    <span key={r} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--text-2)' }}>
                      {r}: {users.filter(u => u.role === r).length}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ ...card2, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Name','Email','Phone','Role','Joined','Actions'].map(h => (
                        <th key={h} style={{ ...lbl, padding: '12px 16px', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{u.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)' }}>{u.email}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)' }}>{u.phone || '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <select value={u.role} onChange={e => createClient().from('users').update({ role: e.target.value }).eq('id', u.id).then(load)}
                            style={{ fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 8px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', fontWeight: 700 }}>
                            {['customer','business','delivery','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <button onClick={() => { if (!confirm('Delete user?')) return; createClient().from('users').delete().eq('id', u.id).then(load) }}
                            style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── VERIFY TAB ── */}
          {tab === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Verification Queue</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Review and approve new shops and delivery partners before they go live.</p>
              </div>

              {/* Pending Shops */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>🏪 Shops</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: pendingShops.length > 0 ? 'rgba(245,158,11,0.15)' : 'var(--bg-3)', color: pendingShops.length > 0 ? '#d97706' : 'var(--text-3)' }}>
                    {pendingShops.length} pending
                  </span>
                </div>
                {pendingShops.length === 0 ? (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)' }}>All shops reviewed</p>
                  </div>
                ) : pendingShops.map(shop => (
                  <div key={shop.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, marginBottom: 12, boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{shop.name}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{shop.category_name} · {shop.area}, {shop.city}</p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Owner</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{shop.owner?.name}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Phone</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{shop.owner?.phone || '—'}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Email</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{shop.owner?.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rejection note input */}
                    <input
                      value={rejectNote[shop.id] || ''}
                      onChange={e => setRejectNote(p => ({ ...p, [shop.id]: e.target.value }))}
                      placeholder="Rejection reason (required only if rejecting)…"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => verifyShop(shop.id, 'approved')}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                        ✅ Approve & Go Live
                      </button>
                      <button onClick={() => { if (!rejectNote[shop.id]?.trim()) { alert('Please enter a rejection reason.'); return } verifyShop(shop.id, 'rejected') }}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--red-bg)', color: '#ef4444' }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Delivery Partners */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>🛵 Delivery Partners</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: pendingRiders.length > 0 ? 'rgba(245,158,11,0.15)' : 'var(--bg-3)', color: pendingRiders.length > 0 ? '#d97706' : 'var(--text-3)' }}>
                    {pendingRiders.length} pending
                  </span>
                </div>
                {pendingRiders.length === 0 ? (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)' }}>All riders reviewed</p>
                  </div>
                ) : pendingRiders.map(rider => (
                  <div key={rider.user_id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, marginBottom: 12, boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                        {rider.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{rider.name}</p>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Phone</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{rider.phone || '—'}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Email</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{rider.email}</p>
                          </div>
                          {rider.vehicle_type && (
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Vehicle</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{rider.vehicle_type}</p>
                            </div>
                          )}
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Registered</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{new Date(rider.created_at).toLocaleDateString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <input
                      value={rejectNote[rider.user_id] || ''}
                      onChange={e => setRejectNote(p => ({ ...p, [rider.user_id]: e.target.value }))}
                      placeholder="Rejection reason (required only if rejecting)…"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 12 }} />

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => verifyRider(rider.user_id, 'approved')}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff', boxShadow: '0 4px 12px rgba(22,163,74,0.25)' }}>
                        ✅ Approve Rider
                      </button>
                      <button onClick={() => { if (!rejectNote[rider.user_id]?.trim()) { alert('Please enter a rejection reason.'); return } verifyRider(rider.user_id, 'rejected') }}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--red-bg)', color: '#ef4444' }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* All-verified state */}
              {totalPending === 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 18, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>🎉</div>
                  <p style={{ fontWeight: 900, fontSize: 18, color: '#16a34a' }}>All caught up!</p>
                  <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>No pending verifications right now.</p>
                </div>
              )}
            </div>
          )}

          {/* ── PRICING & UPI ── */}
          {tab === 'pricing' && (
            <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Platform Pricing & UPI</h2>
                <button onClick={saveConfig} disabled={saving || !Object.keys(edits).length}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 800, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: Object.keys(edits).length ? 'var(--brand)' : 'var(--bg-3)', color: Object.keys(edits).length ? '#fff' : 'var(--text-4)', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving…' : Object.keys(edits).length ? `Save (${Object.keys(edits).length})` : 'No changes'}
                </button>
              </div>

              {/* UPI ID — prominently shown first */}
              <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 18, padding: '20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 24 }}>📲</span>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 15, color: '#1d4ed8' }}>UPI Collection ID</p>
                    <p style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>This is shown to customers during checkout for UPI payment</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="text"
                    defaultValue={cfgStr('upi_id', 'welokl@upi')}
                    onChange={e => setEdits(p => ({ ...p, upi_id: e.target.value }))}
                    placeholder="yourname@upi"
                    style={{ flex: 1, padding: '11px 14px', borderRadius: 12, border: '2px solid rgba(59,130,246,0.3)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: 15, fontWeight: 800, fontFamily: 'monospace', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'rgba(59,130,246,0.3)'} />
                  <button onClick={saveConfig} disabled={saving || !edits['upi_id']}
                    style={{ padding: '11px 18px', borderRadius: 12, fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: edits['upi_id'] ? '#2563eb' : 'var(--bg-3)', color: edits['upi_id'] ? '#fff' : 'var(--text-4)' }}>
                    {saving ? '…' : 'Update'}
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#3b82f6', marginTop: 8 }}>Current: <strong style={{ fontFamily: 'monospace' }}>{cfgStr('upi_id', 'welokl@upi')}</strong></p>
              </div>

              {/* Numeric config fields */}
              {config.filter(c => c.key !== 'upi_id').length === 0 ? (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <p style={{ fontWeight: 900, fontSize: 15, color: '#d97706' }}>Run verification-migration.sql first</p>
                  <p style={{ fontSize: 13, color: '#d97706', marginTop: 6, opacity: 0.8 }}>The platform_config table needs to be set up in Supabase SQL Editor</p>
                </div>
              ) : (
                <div style={{ ...card2 }}>
                  {config.filter(c => c.key !== 'upi_id').map((c, i) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.label}</p>
                        <p style={{ ...mono, marginTop: 3 }}>{c.key}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="number" defaultValue={c.value}
                          onChange={e => setEdits(p => ({ ...p, [c.key]: e.target.value }))}
                          style={{ width: 90, textAlign: 'right', border: '2px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 800, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
                          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border-2)'} />
                        <span style={{ fontSize: 12, color: 'var(--text-3)', width: 20 }}>
                          {c.key.includes('commission') || c.key.includes('percent') ? '%' : c.key.includes('km') ? 'km' : c.key.includes('min') ? 'min' : '₹'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '14px 18px' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>⚠️ Changes apply to next order only</p>
                <p style={{ fontSize: 12, color: '#d97706', marginTop: 4, opacity: 0.8 }}>Existing orders in progress are not affected.</p>
              </div>
            </div>
          )}

          {/* ── DELIVERY ── */}
          {tab === 'delivery' && (
            <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Delivery Management</h2>
              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 16 }}>How It Works</p>
                {[
                  { n: '1', t: 'Shop marks order ready',    d: 'After preparing, shop clicks "Mark Ready for Pickup"' },
                  { n: '2', t: 'Order appears in rider app', d: 'All approved, online riders see available orders' },
                  { n: '3', t: 'Rider accepts & picks up',  d: 'First rider to tap Accept claims the order atomically' },
                  { n: '4', t: 'Rider marks delivered',     d: `Wallet credited ₹${cfg('partner_payout',20)} automatically` },
                ].map(s => (
                  <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', borderRadius: 12, marginBottom: 8, background: 'var(--bg-1)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{s.t}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ ...card }}>
                <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Registered Riders ({users.filter(u => u.role === 'delivery').length})</p>
                {pendingDel.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No delivery partners yet</p>
                ) : pendingDel.map(d => (
                  <div key={d.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, marginBottom: 8, background: 'var(--bg-1)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand)', color: '#fff', fontWeight: 900, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {d.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{d.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.email}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, flexShrink: 0, background: d.verification_status === 'approved' ? 'rgba(34,197,94,0.12)' : d.verification_status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)', color: d.verification_status === 'approved' ? '#16a34a' : d.verification_status === 'pending' ? '#d97706' : '#ef4444' }}>
                      {d.verification_status === 'approved' ? '✓ Approved' : d.verification_status === 'pending' ? '⏳ Pending' : '✕ Rejected'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{d.phone || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}