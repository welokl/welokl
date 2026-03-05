'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Tab = 'overview' | 'orders' | 'shops' | 'users' | 'pricing' | 'delivery'

interface Config { key: string; value: string; label: string }
interface Order {
  id: string; order_number: string; status: string
  total_amount: number; subtotal: number; payment_method: string
  created_at: string; type: string; delivery_partner_id: string | null
  shop: { name: string; commission_percent: number } | null
  customer: { name: string; phone: string } | null
  partner: { name: string; phone: string } | null
}
interface Shop {
  id: string; name: string; category_name: string; is_active: boolean
  commission_percent: number; rating: number; area: string; city: string
  image_url: string | null; owner: { name: string; email: string } | null
}
interface User {
  id: string; name: string; email: string; phone: string | null
  role: string; created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  placed: '#1d4ed8', accepted: '#16a34a', preparing: '#d97706',
  ready: '#7c3aed', picked_up: '#c2410c', delivered: '#15803d',
  cancelled: '#dc2626', rejected: '#dc2626',
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('overview')
  const [orders, setOrders] = useState<Order[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [config, setConfig] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(async (userId?: string) => {
    const supabase = createClient()
    const uid = userId || (await supabase.auth.getUser()).data.user?.id
    if (!uid) { setLoading(false); return }
    const { data: profile, error: profileErr } = await supabase.from('users').select('role').eq('id', uid).single()
    if (profileErr) { console.error('Profile fetch error:', profileErr); setLoading(false); return }
    if (!profile) { setLoading(false); return }
    if (profile.role !== 'admin') { window.location.href = `/dashboard/${profile.role}`; return }

    const [
      { data: od, error: e1 },
      { data: sd, error: e2 },
      { data: ud, error: e3 },
      { data: cd, error: e4 }
    ] = await Promise.all([
      supabase.from('orders')
        .select('*, shop:shops(name,commission_percent), customer:users!customer_id(name,phone), partner:users!delivery_partner_id(name,phone)')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('shops').select('*, owner:users!owner_id(name,email)').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('platform_config').select('*').order('key'),
    ])

    if (e1) console.error('Orders error:', e1)
    if (e2) console.error('Shops error:', e2)
    if (e3) console.error('Users error:', e3)
    if (e4) console.error('Config error:', e4)

    setOrders((od as Order[]) || [])
    setShops((sd as Shop[]) || [])
    setUsers((ud as User[]) || [])
    setConfig((cd as Config[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Prevent back button going to wrong dashboard
    window.history.replaceState(null, '', '/dashboard/admin')
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { window.location.href = '/auth/login'; return }
      if (session?.user) load(session.user.id)
    })
    const ch = supabase.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => load())
      .subscribe()
    return () => { subscription.unsubscribe(); supabase.removeChannel(ch) }
  }, [load])

  // ── Revenue math ──
  const cfg = (key: string, fb = 0) => Number(config.find(c => c.key === key)?.value ?? fb)
  const delivered = orders.filter(o => o.status === 'delivered')
  const gmv = delivered.reduce((s, o) => s + (o.subtotal || 0), 0)
  const commissionEarned = delivered.reduce((s, o) => {
    const pct = o.shop?.commission_percent ?? cfg('default_commission', 15)
    return s + Math.round((o.subtotal || 0) * pct / 100)
  }, 0)
  const platformFees = delivered.length * cfg('platform_fee_flat', 5)
  const deliveryOrders = delivered.filter(o => o.type === 'delivery')
  const partnerPayouts = deliveryOrders.length * cfg('partner_payout', 20)
  const deliveryFees = deliveryOrders.reduce((s, o) => s + Math.max(0, (o.total_amount || 0) - (o.subtotal || 0) - cfg('platform_fee_flat', 5)), 0)
  const netRevenue = commissionEarned + platformFees + Math.max(0, deliveryFees - partnerPayouts)

  async function saveConfig() {
    if (!Object.keys(edits).length) return
    setSaving(true)
    const supabase = createClient()
    for (const [key, value] of Object.entries(edits)) {
      await supabase.from('platform_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
    }
    setEdits({}); setSaving(false); load()
  }

  async function overrideOrder(id: string, status: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', id)
    await supabase.from('order_status_log').insert({ order_id: id, status, message: 'Status overridden by admin' })
  }

  async function toggleShop(id: string, is_active: boolean) {
    await createClient().from('shops').update({ is_active }).eq('id', id); load()
  }

  async function setCommission(id: string, pct: number) {
    await createClient().from('shops').update({ commission_percent: pct }).eq('id', id); load()
  }

  async function setUserRole(id: string, role: string) {
    await createClient().from('users').update({ role }).eq('id', id); load()
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user? Cannot be undone.')) return
    await createClient().from('users').delete().eq('id', id); load()
  }

  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchSearch = !search || o.order_number?.includes(search) || o.shop?.name?.toLowerCase().includes(search.toLowerCase()) || o.customer?.name?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'orders', icon: '📦', label: `Orders (${orders.length})` },
    { id: 'shops', icon: '🏪', label: `Shops (${shops.length})` },
    { id: 'users', icon: '👥', label: `Users (${users.length})` },
    { id: 'pricing', icon: '💰', label: 'Pricing' },
    { id: 'delivery', icon: '🛵', label: 'Delivery' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#f8f7f4', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#0f0f0f' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: '#ff5a1f' }}>W</div>
            <div>
              <p className="text-white/40 text-xs font-semibold">Admin Console</p>
              <p className="text-white font-black text-base leading-none">Welokl Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
              <span className="text-white/40 text-xs font-semibold">Live</span>
            </div>
            <div className="hidden sm:flex gap-4 text-xs font-bold text-white/40">
              <span style={{ color: '#ff5a1f' }}>GMV ₹{gmv.toLocaleString('en-IN')}</span>
              <span className="text-green-400">Revenue ₹{netRevenue.toLocaleString('en-IN')}</span>
            </div>
            <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
              className="text-white/30 text-xs hover:text-white">Logout</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-bold border-b-2 whitespace-nowrap transition-all ${tab === t.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">{Array.from({length:8}).map((_,i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}</div>
        ) : <>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: 'Total Orders', v: orders.length, c: '#3b82f6', i: '📦', sub: `${todayOrders.length} today` },
                  { l: 'Delivered', v: delivered.length, c: '#16a34a', i: '✅', sub: `${deliveryOrders.length} with delivery` },
                  { l: 'GMV', v: `₹${gmv.toLocaleString('en-IN')}`, c: '#7c3aed', i: '💳', sub: 'Gross merchandise value' },
                  { l: 'Net Revenue', v: `₹${netRevenue.toLocaleString('en-IN')}`, c: '#ff5a1f', i: '🏦', sub: 'Platform earnings' },
                ].map(s => (
                  <div key={s.l} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="text-xl mb-2">{s.i}</div>
                    <div className="font-black text-2xl leading-none" style={{ color: s.c }}>{s.v}</div>
                    <div className="text-xs font-bold text-gray-600 mt-1">{s.l}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-black text-sm mb-4 uppercase tracking-wider text-gray-400">Revenue Breakdown</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { l: 'Gross Merchandise Value (GMV)', v: `₹${gmv.toLocaleString('en-IN')}`, color: '#0f0f0f' },
                    { l: `Shop commissions (avg ${cfg('default_commission',15)}%)`, v: `+₹${commissionEarned.toLocaleString('en-IN')}`, color: '#16a34a' },
                    { l: `Platform fees (₹${cfg('platform_fee_flat',5)} × ${delivered.length} orders)`, v: `+₹${platformFees.toLocaleString('en-IN')}`, color: '#16a34a' },
                    { l: 'Delivery fees collected', v: `+₹${deliveryFees.toLocaleString('en-IN')}`, color: '#16a34a' },
                    { l: `Partner payouts (₹${cfg('partner_payout',20)} × ${deliveryOrders.length})`, v: `-₹${partnerPayouts.toLocaleString('en-IN')}`, color: '#dc2626' },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between items-center">
                      <span className="text-gray-500">{r.l}</span>
                      <span className="font-bold" style={{ color: r.color }}>{r.v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
                    <span className="font-black">Net Platform Revenue</span>
                    <span className="font-black text-lg" style={{ color: '#ff5a1f' }}>₹{netRevenue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { l: 'Customers', v: users.filter(u=>u.role==='customer').length },
                  { l: 'Shop Owners', v: users.filter(u=>u.role==='business').length },
                  { l: 'Riders', v: users.filter(u=>u.role==='delivery').length },
                  { l: 'Active Shops', v: shops.filter(s=>s.is_active).length },
                ].map(s => (
                  <div key={s.l} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="font-black text-2xl">{s.v}</div>
                    <div className="text-xs text-gray-400 font-semibold mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-black text-sm">Live Order Feed</h3>
                  <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" /> Realtime
                  </span>
                </div>
                {orders.slice(0,12).map(o => (
                  <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="text-xs font-mono text-gray-400 w-24 truncate">#{o.order_number}</span>
                    <span className="flex-1 text-xs font-semibold truncate">{o.shop?.name}</span>
                    <span className="text-xs font-bold">₹{o.total_amount}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: (STATUS_COLOR[o.status]||'#888')+'20', color: STATUS_COLOR[o.status]||'#888' }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ORDERS ── */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <h2 className="font-black text-lg">Orders ({filteredOrders.length})</h2>
                <div className="flex gap-2 flex-wrap">
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search order, shop, customer..."
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-500 w-52" />
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-orange-500 bg-white font-semibold">
                    <option value="all">All statuses</option>
                    {['placed','accepted','preparing','ready','picked_up','delivered','cancelled','rejected'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Order #','Time','Shop','Customer','Rider','Amount','Payment','Status','Admin Override'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredOrders.map(o => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.order_number}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(o.created_at).toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'})}</td>
                          <td className="px-4 py-3 font-semibold text-xs max-w-[120px] truncate">{o.shop?.name}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{o.customer?.name || '—'}</td>
                          <td className="px-4 py-3 text-xs">
                            {o.delivery_partner_id
                              ? <span className="text-green-700 font-semibold">{o.partner?.name || 'Assigned'}</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 font-bold text-xs">₹{o.total_amount}</td>
                          <td className="px-4 py-3 text-xs capitalize">{o.payment_method}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background:(STATUS_COLOR[o.status]||'#888')+'20', color:STATUS_COLOR[o.status]||'#888' }}>{o.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <select value={o.status} onChange={e => overrideOrder(o.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-semibold outline-none focus:border-orange-400">
                              {['placed','accepted','preparing','ready','picked_up','delivered','cancelled','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SHOPS ── */}
          {tab === 'shops' && (
            <div className="space-y-4">
              <h2 className="font-black text-lg">Shops ({shops.length})</h2>
              <div className="space-y-3">
                {shops.map(shop => (
                  <div key={shop.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 items-center">
                    {/* Shop image */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: '#f8f7f4' }}>
                      {shop.image_url ? <img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" /> : '🏪'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-sm">{shop.name}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${shop.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{shop.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <p className="text-xs text-gray-400">{shop.category_name} · {shop.area}, {shop.city} · ★{shop.rating}</p>
                      <p className="text-xs text-gray-400">Owner: {shop.owner?.name} ({shop.owner?.email})</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-500">Comm %</span>
                        <input type="number" defaultValue={shop.commission_percent} min="0" max="50" step="0.5"
                          onBlur={e => setCommission(shop.id, parseFloat(e.target.value))}
                          className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-bold text-center outline-none focus:border-orange-400" />
                      </div>
                      <button onClick={() => toggleShop(shop.id, !shop.is_active)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl ${shop.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {shop.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-lg">Users ({users.length})</h2>
                <div className="flex gap-2 flex-wrap">
                  {['customer','business','delivery','admin'].map(r => (
                    <span key={r} className="text-xs font-bold bg-gray-100 px-2.5 py-1 rounded-xl">
                      {r}: {users.filter(u=>u.role===r).length}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['Name','Email','Phone','Role','Joined','Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-sm">{u.name}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{u.phone||'—'}</td>
                          <td className="px-4 py-3">
                            <select value={u.role} onChange={e => setUserRole(u.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white font-bold capitalize outline-none focus:border-orange-400">
                              {['customer','business','delivery','admin'].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => deleteUser(u.id)} className="text-xs text-red-400 hover:text-red-600 font-bold">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── PRICING ── */}
          {tab === 'pricing' && (
            <div className="max-w-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-lg">Platform Pricing</h2>
                <button onClick={saveConfig} disabled={saving || !Object.keys(edits).length}
                  className="btn-primary text-sm py-2 px-5 disabled:opacity-40">
                  {saving ? 'Saving...' : Object.keys(edits).length ? `Save (${Object.keys(edits).length})` : 'No changes'}
                </button>
              </div>

              {config.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                  <p className="font-black text-amber-800 text-base">Run clean-fix.sql first</p>
                  <p className="text-sm text-amber-600 mt-1">The platform_config table needs to be created in Supabase SQL Editor</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                  {config.map(c => (
                    <div key={c.key} className="flex items-center justify-between p-5">
                      <div>
                        <p className="font-bold text-sm">{c.label}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{c.key}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={c.value}
                          onChange={e => setEdits(p => ({ ...p, [c.key]: e.target.value }))}
                          className="w-24 text-right border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-orange-500 transition-colors" />
                        <span className="text-xs text-gray-400 w-6">
                          {c.key.includes('commission')||c.key.includes('percent') ? '%' : c.key.includes('km') ? 'km' : c.key.includes('min') ? 'min' : '₹'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-4 rounded-2xl border" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                <p className="font-bold text-sm" style={{ color: '#c2410c' }}>⚠️ Changes apply to next order only</p>
                <p className="text-xs mt-1" style={{ color: '#ea580c' }}>Existing orders in progress are not affected by pricing changes.</p>
              </div>
            </div>
          )}

          {/* ── DELIVERY ── */}
          {tab === 'delivery' && (
            <div className="space-y-5 max-w-2xl">
              <h2 className="font-black text-lg">Delivery Management</h2>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-black text-sm mb-4 uppercase tracking-wider text-gray-400">How It Works</h3>
                <div className="space-y-3">
                  {[
                    { n: '1', t: 'Shop marks order ready', d: 'After preparing, shop clicks "Mark Ready for Pickup"' },
                    { n: '2', t: 'Order appears in rider app', d: 'All online riders see available orders and can accept' },
                    { n: '3', t: 'Rider accepts & picks up', d: 'First rider to tap "Accept" claims the order atomically' },
                    { n: '4', t: 'Rider marks delivered', d: `Wallet credited ₹${cfg('partner_payout',20)} automatically` },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#f8f7f4' }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0" style={{ background: '#ff5a1f' }}>{s.n}</div>
                      <div>
                        <p className="font-bold text-sm">{s.t}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-black text-sm mb-4">Payout Structure</h3>
                <div className="space-y-2.5">
                  {[
                    { l: 'Customer pays (delivery fee)', v: `₹${cfg('delivery_fee_base',25)}`, bg: '#f8f7f4', c: '#6b7280' },
                    { l: 'Partner earns per delivery', v: `₹${cfg('partner_payout',20)}`, bg: '#fff3ef', c: '#ff5a1f' },
                    { l: 'Platform delivery margin', v: `₹${cfg('delivery_fee_base',25)-cfg('partner_payout',20)}`, bg: '#f0fdf4', c: '#16a34a' },
                  ].map(r => (
                    <div key={r.l} className="flex justify-between items-center p-3.5 rounded-xl" style={{ background: r.bg }}>
                      <span className="font-semibold text-sm" style={{ color: r.c }}>{r.l}</span>
                      <span className="font-black text-xl" style={{ color: r.c }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">Change these values in the Pricing tab.</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-black text-sm mb-3">Registered Riders ({users.filter(u=>u.role==='delivery').length})</h3>
                {users.filter(u => u.role === 'delivery').length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No delivery partners yet</p>
                ) : (
                  <div className="space-y-2">
                    {users.filter(u => u.role === 'delivery').map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f8f7f4' }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: '#ff5a1f' }}>
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                        <span className="text-xs text-gray-400">{u.phone||'—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>}
      </div>
    </div>
  )
}
