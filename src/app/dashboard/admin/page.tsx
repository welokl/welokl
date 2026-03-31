'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WelklLogo } from '@/components/WelklLogo'
 
type Tab = 'overview' | 'orders' | 'shops' | 'users' | 'verify' | 'pricing' | 'delivery' | 'categories' | 'wallets' | 'boosts' | 'promos'
 
interface Config  { key: string; value: string; label: string }
interface Order   { id: string; order_number: string; status: string; total_amount: number; subtotal: number; payment_method: string; created_at: string; type: string; delivery_partner_id: string | null; shop: { name: string; commission_percent: number } | null; customer: { name: string; phone: string } | null; partner: { name: string; phone: string } | null }
interface Shop    { id: string; name: string; category_name: string; is_active: boolean; commission_percent: number; rating: number; area: string; city: string; image_url: string | null; verification_status: string; verification_note: string | null; owner: { name: string; email: string; phone: string | null } | null }
interface User    { id: string; name: string; email: string; phone: string | null; role: string; created_at: string }
interface PendingDelivery { user_id: string; name: string; email: string; phone: string | null; vehicle_type: string | null; verification_status: string; verification_note: string | null; created_at: string }
interface WalletRow { id: string; user_id: string; balance: number; total_earned: number; total_spent: number; user: { name: string; email: string; phone: string | null } | null }
 
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
 
// SVG icon components — no emoji
const IcoChart    = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><rect x="1" y="8" width="3" height="7" rx="1" fill="currentColor" opacity=".4"/><rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity=".6"/><rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor"/></svg>
const IcoBox      = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="currentColor" strokeWidth="1.4"/><path d="M2 4.5L8 8M8 8L14 4.5M8 8V15" stroke="currentColor" strokeWidth="1.4"/></svg>
const IcoShop     = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><path d="M2 6L4 2H12L14 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><rect x="2" y="6" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M6 14V10H10V14" stroke="currentColor" strokeWidth="1.4"/></svg>
const IcoUsers    = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><circle cx="6" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M1 14C1 11.239 3.239 9 6 9S11 11.239 11 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M12 7C13.657 7 15 8.343 15 10V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="12" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
const IcoVerify   = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><path d="M8 1L10 3H13V6L15 8L13 10V13H10L8 15L6 13H3V10L1 8L3 6V3H6L8 1Z" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8L7 10L11 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
const IcoPrice    = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M8 4V5M8 11V12M10 6C10 5 9.1 4.5 8 4.5S6 5 6 6S7.2 7 8 7S10 7.8 10 9 9 11.5 8 11.5 6 11 6 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IcoBike     = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><circle cx="3.5" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><circle cx="12.5" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3.5 11.5L6 7L9 9L10 6H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
const IcoTag      = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><path d="M9 1H14V6L8 12L4 8L9 1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><circle cx="12" cy="4" r="1" fill="currentColor"/></svg>
const IcoWallet   = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.4"/><circle cx="12" cy="10" r="1" fill="currentColor"/></svg>
const IcoBoost    = () => <svg viewBox="0 0 16 16" fill="none" width={15} height={15}><path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-1L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
 
export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>(() => {
  if (typeof window === 'undefined') return 'overview'
  const saved = localStorage.getItem('admin_tab')
  const valid: Tab[] = ['overview','orders','shops','users','verify','pricing','delivery','categories','wallets','boosts','promos']
  return (valid.includes(saved as Tab) ? saved : 'overview') as Tab
})
  const [orders, setOrders]       = useState<Order[]>([])
  const [shops, setShops]         = useState<Shop[]>([])
  const [users, setUsers]         = useState<User[]>([])
  const [config, setConfig]       = useState<Config[]>([])
  const [pendingDel, setPendingDel] = useState<PendingDelivery[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [wallets,    setWallets]    = useState<WalletRow[]>([])
  const [boostPlans,   setBoostPlans]   = useState<any[]>([])
  const [vendorBoosts, setVendorBoosts] = useState<any[]>([])
  const [boostMetrics, setBoostMetrics] = useState<any[]>([])
  const [boostForm, setBoostForm] = useState({ shopId:'', planId:'', weeks: 4 })
  const [boostSaving, setBoostSaving] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [adminManagingShop, setAdminManagingShop] = useState<Shop | null>(null)
  const [operatorsShop, setOperatorsShop] = useState<Shop | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ shop: Shop } | null>(null)
  const [edits, setEdits]         = useState<Record<string, string>>({})
  const [search, setSearch]       = useState('')
  const [shopSearch,  setShopSearch]  = useState('')
  const [userSearch,  setUserSearch]  = useState('')
  const [statusFilter, setFilter] = useState('all')
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [newCatName,  setNewCatName]  = useState('')
  const [creditUserId, setCreditUserId] = useState('')
  const [creditAmt,    setCreditAmt]    = useState('')
  const [creditDesc,   setCreditDesc]   = useState('')
  const [creditSaving, setCreditSaving] = useState(false)
  const [promoCodes,   setPromoCodes]   = useState<any[]>([])
  const [promoForm,    setPromoForm]    = useState({ code:'', description:'', discount_type:'flat', discount_value:'', min_order_amount:'', max_discount:'', usage_limit:'', expires_at:'' })
  const [promoSaving,  setPromoSaving]  = useState(false)
 
  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data: profile } = await sb.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      const roleHome: Record<string, string> = { customer: '/dashboard/customer', shopkeeper: '/dashboard/business', business: '/dashboard/business', delivery_partner: '/dashboard/delivery' }
      window.location.replace(roleHome[profile?.role || ''] || '/dashboard/customer')
      return
    }
 
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const [{ data: od }, { data: sd }, { data: ud }, { data: cd }, { data: dd }, { data: cats }, { data: wds }, { data: bplans }, { data: vboosts }, { data: bmetrics }, { data: promos }] = await Promise.all([
      sb.from('orders').select('*, shop:shops(name,commission_percent), customer:users!customer_id(name,phone), partner:users!delivery_partner_id(name,phone)').order('created_at', { ascending: false }).limit(200),
      sb.from('shops').select('*, owner:users!owner_id(name,email,phone)').order('created_at', { ascending: false }),
      sb.from('users').select('*').order('created_at', { ascending: false }).limit(300),
      sb.from('platform_config').select('*').order('key'),
      sb.from('delivery_partners').select('*, user:users!user_id(name,email,phone,created_at)').order('created_at', { ascending: false }),
      sb.from('categories').select('*').order('name'),
      sb.from('wallets').select('*, user:users(name,email,phone)').order('balance', { ascending: false }).limit(200),
      sb.from('boost_plans').select('*').order('boost_weight'),
      sb.from('vendor_boosts').select('*, shop:shops(name,area), plan:boost_plans(name,badge_label,boost_weight)').order('created_at', { ascending: false }),
      sb.from('vendor_boost_metrics').select('*').gte('date', sevenDaysAgo).order('date', { ascending: false }),
      sb.from('promo_codes').select('*').order('created_at', { ascending: false }),
    ])

    setOrders((od as Order[]) || [])
    setShops((sd as Shop[]) || [])
    setUsers((ud as User[]) || [])
    setConfig((cd as Config[]) || [])
    setCategories(cats || [])
    setWallets((wds as WalletRow[]) || [])
    setBoostPlans(bplans || [])
    setVendorBoosts(vboosts || [])
    setBoostMetrics(bmetrics || [])
    setPromoCodes(promos || [])
 
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
 
  const pendingShops  = shops.filter(s => !s.verification_status || s.verification_status === 'pending')
  const pendingRiders = pendingDel.filter(d => !d.verification_status || d.verification_status === 'pending')
  const totalPending  = pendingShops.length + pendingRiders.length
 
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
 
  async function verifyShop(shopId: string, decision: 'approved' | 'rejected') {
    const sb = createClient()
    const note = rejectNote[shopId] || null
    await sb.from('shops').update({ verification_status: decision, verification_note: decision === 'rejected' ? note : null, is_active: decision === 'approved' }).eq('id', shopId)
    setRejectNote(p => { const n = { ...p }; delete n[shopId]; return n })
    load()
  }
 
  async function verifyRider(userId: string, decision: 'approved' | 'rejected') {
    const sb = createClient()
    const note = rejectNote[userId] || null
    await sb.from('delivery_partners').update({ verification_status: decision, verification_note: decision === 'rejected' ? note : null }).eq('user_id', userId)
    setRejectNote(p => { const n = { ...p }; delete n[userId]; return n })
    load()
  }
 
  async function toggleCategory(id: string, current: boolean) {
    const { error } = await createClient().from('categories').update({ is_active: !current }).eq('id', id)
    if (error) { alert('Update failed: ' + error.message); return }
    setCategories(c => c.map(x => x.id === id ? { ...x, is_active: !current } : x))
  }
  async function addCategory(name: string) {
    if (!name.trim()) return
    const sb = createClient()
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
    const { data, error } = await sb.from('categories').insert({ name: name.trim(), slug, is_active: true }).select().single()
    if (error) { alert('Failed to add category: ' + error.message); return }
    if (data) { setCategories(c => [...c, data]); setNewCatName('') }
  }
  async function deleteCategory(id: string) {
    if (!confirm('Delete this category? Shops using it will keep their category_name text.')) return
    const { error } = await createClient().from('categories').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    setCategories(c => c.filter(x => x.id !== id))
  }

  async function creditWallet(userId: string, amount: number, description: string, type: 'credit' | 'debit') {
    if (!userId || !amount || !description) return
    setCreditSaving(true)
    const sb = createClient()
    // Always fetch fresh wallet from DB — never trust stale component state for financial ops
    const { data: wallet, error: fetchErr } = await sb.from('wallets').select('id, balance, total_earned, total_spent').eq('user_id', userId).single()
    if (fetchErr || !wallet) { alert('No wallet found for this user'); setCreditSaving(false); return }
    const newBalance = type === 'credit' ? wallet.balance + amount : wallet.balance - amount
    if (type === 'debit' && newBalance < 0) { alert('Insufficient balance'); setCreditSaving(false); return }
    const { error: updateErr } = await sb.from('wallets').update({
      balance:      newBalance,
      total_earned: type === 'credit' ? wallet.total_earned + amount : wallet.total_earned,
      total_spent:  type === 'debit'  ? wallet.total_spent  + amount : wallet.total_spent,
    }).eq('id', wallet.id)
    if (updateErr) { alert('Wallet update failed: ' + updateErr.message); setCreditSaving(false); return }
    await sb.from('transactions').insert({ wallet_id: wallet.id, amount, type, description })
    setCreditUserId(''); setCreditAmt(''); setCreditDesc('')
    load()
    setCreditSaving(false)
  }
 
  const today = new Date().toDateString()
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === today)
  const todayDelivered = todayOrders.filter(o => o.status === 'delivered')
  const todayGmv = todayDelivered.reduce((s, o) => s + (o.subtotal || 0), 0)
  const cancelledCount = orders.filter(o => ['cancelled', 'rejected'].includes(o.status)).length
  const cancelRate = orders.length ? Math.round(cancelledCount / orders.length * 100) : 0
  const avgOrderVal = delivered.length ? Math.round(gmv / delivered.length) : 0
  const upiCount = orders.filter(o => o.payment_method === 'upi' || o.payment_method === 'online').length
  const codCount = orders.filter(o => o.payment_method === 'cod' || o.payment_method === 'cash').length
  const filteredOrders = orders.filter(o => {
    const ms = statusFilter === 'all' || o.status === statusFilter
    const mq = !search || o.order_number?.includes(search) || o.shop?.name?.toLowerCase().includes(search.toLowerCase()) || o.customer?.name?.toLowerCase().includes(search.toLowerCase())
    return ms && mq
  })

  const filteredShops = shops.filter(s =>
    !shopSearch || s.name.toLowerCase().includes(shopSearch.toLowerCase()) || s.area?.toLowerCase().includes(shopSearch.toLowerCase()) || s.owner?.name?.toLowerCase().includes(shopSearch.toLowerCase())
  )
  const filteredUsers = users.filter(u =>
    !userSearch || u.name?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase()) || u.phone?.includes(userSearch)
  )
 
  // ── Boost admin actions ───────────────────────────────────────
  async function assignBoost() {
    const { shopId, planId, weeks } = boostForm
    if (!shopId || !planId) return
    setBoostSaving(true)
    const sb = createClient()
    const start = new Date().toISOString().slice(0, 10)
    const end   = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    // Cancel existing active boost for this shop first
    await sb.from('vendor_boosts').update({ status: 'cancelled' }).eq('shop_id', shopId).eq('status', 'active')
    await sb.from('vendor_boosts').insert({ shop_id: shopId, plan_id: planId, start_date: start, end_date: end, status: 'active' })
    setBoostForm({ shopId:'', planId:'', weeks:4 })
    setBoostSaving(false)
    load()
  }

  async function updateBoostStatus(boostId: string, status: 'active' | 'paused' | 'cancelled') {
    await createClient().from('vendor_boosts').update({ status }).eq('id', boostId)
    load()
  }

  async function updateBoostWeight(planId: string, weight: number) {
    await createClient().from('boost_plans').update({ boost_weight: weight }).eq('id', planId)
    load()
  }

  // 7-day aggregate metrics per shop
  const boostAnalytics = (() => {
    const map: Record<string, { impressions: number; clicks: number; orders: number }> = {}
    boostMetrics.forEach((m: any) => {
      if (!map[m.shop_id]) map[m.shop_id] = { impressions: 0, clicks: 0, orders: 0 }
      map[m.shop_id].impressions += m.impressions ?? 0
      map[m.shop_id].clicks     += m.clicks      ?? 0
      map[m.shop_id].orders     += m.orders       ?? 0
    })
    return map
  })()

  const TABS: { id: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: 'overview',    icon: <IcoChart />,  label: 'Overview' },
    { id: 'orders',      icon: <IcoBox />,    label: `Orders (${orders.length})` },
    { id: 'shops',       icon: <IcoShop />,   label: `Shops (${shops.length})` },
    { id: 'users',       icon: <IcoUsers />,  label: `Users (${users.length})` },
    { id: 'verify',      icon: <IcoVerify />, label: 'Verify', badge: totalPending },
    { id: 'pricing',     icon: <IcoPrice />,  label: 'Pricing & UPI' },
    { id: 'delivery',    icon: <IcoBike />,   label: 'Delivery' },
    { id: 'categories',  icon: <IcoTag />,    label: 'Categories' },
    { id: 'wallets',     icon: <IcoWallet />, label: 'Wallets' },
    { id: 'boosts',      icon: <IcoBoost />,  label: 'Boosts', badge: vendorBoosts.filter((b: any) => b.status === 'active').length || undefined },
    { id: 'promos',      icon: <IcoTag />,    label: 'Promos', badge: promoCodes.filter((p: any) => p.is_active).length || undefined },
  ]
 
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 600px) {
          .admin-stat-pill { display: none !important; }
          .admin-topbar-right { gap: 8px !important; }
          .admin-topbar-brand p:first-child { display: none; }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <WelklLogo height={28} dark={true} />
            <div className="admin-topbar-brand">
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>ADMIN CONSOLE</p>
            </div>
          </div>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {totalPending > 0 && (
              <button onClick={() => { setTab('verify'); localStorage.setItem('admin_tab','verify') }}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                {totalPending} pending
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Live</span>
            </div>
            <div className="admin-stat-pill" style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 700 }}>
              <span style={{ color: '#ff5a1f' }}>GMV Rs.{gmv.toLocaleString('en-IN')}</span>
              <span style={{ color: '#4ade80' }}>Rev Rs.{netRev.toLocaleString('en-IN')}</span>
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
            <button key={t.id} onClick={() => { setTab(t.id); localStorage.setItem('admin_tab', t.id) }}
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
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ height: 100, borderRadius: 16, background: 'var(--bg-3)' }} />)}
          </div>
        ) : <>
 
          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
                {[
                  { l: 'Total Orders',  v: orders.length,                        c: '#3b82f6', sub: `${todayOrders.length} today` },
                  { l: 'Delivered',     v: delivered.length,                      c: '#16a34a', sub: `${delivOrds.length} with delivery` },
                  { l: 'GMV',           v: `Rs.${gmv.toLocaleString('en-IN')}`,  c: '#7c3aed', sub: 'Gross merchandise value' },
                  { l: 'Net Revenue',   v: `Rs.${netRev.toLocaleString('en-IN')}`, c: '#ff5a1f', sub: 'Platform earnings' },
                ].map(s => (
                  <div key={s.l} style={{ ...card }}>
                    <div style={{ fontWeight: 900, fontSize: 26, color: s.c, lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginTop: 5 }}>{s.l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
 
              {/* Today's Activity */}
              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 14 }}>Today's Activity</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
                  {[
                    { l: 'Orders today',    v: todayOrders.length,                               c: '#3b82f6' },
                    { l: 'Delivered today', v: todayDelivered.length,                            c: '#16a34a' },
                    { l: 'Today GMV',       v: `Rs.${todayGmv.toLocaleString('en-IN')}`,        c: '#7c3aed' },
                    { l: 'Avg order value', v: `Rs.${avgOrderVal.toLocaleString('en-IN')}`,     c: '#0891b2' },
                    { l: 'Cancel rate',     v: `${cancelRate}%`,                                 c: cancelRate > 20 ? '#ef4444' : '#d97706' },
                    { l: 'UPI / COD split', v: `${upiCount} / ${codCount}`,                     c: 'var(--text)' },
                  ].map(s => (
                    <div key={s.l} style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 12 }}>
                      <div style={{ fontWeight: 900, fontSize: 20, color: s.c, lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, marginTop: 5 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {totalPending > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '2px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 900, fontSize: 15, color: '#d97706' }}>{totalPending} pending verification{totalPending > 1 ? 's' : ''}</p>
                    <p style={{ fontSize: 13, color: '#d97706', opacity: 0.8, marginTop: 2 }}>
                      {pendingShops.length > 0 && `${pendingShops.length} shop${pendingShops.length > 1 ? 's' : ''}`}
                      {pendingShops.length > 0 && pendingRiders.length > 0 && ' · '}
                      {pendingRiders.length > 0 && `${pendingRiders.length} delivery partner${pendingRiders.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <button onClick={() => { setTab('verify'); localStorage.setItem('admin_tab','verify') }}
                    style={{ padding: '10px 20px', borderRadius: 12, background: '#f59e0b', color: '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Review now
                  </button>
                </div>
              )}
 
              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 16 }}>Revenue Breakdown</p>
                {[
                  { l: 'Gross Merchandise Value (GMV)',                                         v: `Rs.${gmv.toLocaleString('en-IN')}`,          c: 'var(--text)' },
                  { l: `Shop commissions (avg ${cfg('default_commission',15)}%)`,               v: `+Rs.${commEarned.toLocaleString('en-IN')}`,   c: '#16a34a' },
                  { l: `Platform fees (Rs.${cfg('platform_fee_flat',5)} x ${delivered.length})`, v: `+Rs.${platFees.toLocaleString('en-IN')}`,    c: '#16a34a' },
                  { l: 'Delivery fees collected',                                               v: `+Rs.${delivFees.toLocaleString('en-IN')}`,    c: '#16a34a' },
                  { l: `Partner payouts (Rs.${cfg('partner_payout',20)} x ${delivOrds.length})`, v: `-Rs.${partPay.toLocaleString('en-IN')}`,    c: '#ef4444' },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{r.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: r.c }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 0', borderTop: '2px solid var(--border)', marginTop: 4 }}>
                  <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>Net Platform Revenue</span>
                  <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--brand)' }}>Rs.{netRev.toLocaleString('en-IN')}</span>
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12 }}>
                {[
                  { l: 'Customers',       v: users.filter(u => u.role === 'customer').length },
                  { l: 'Shop Owners',     v: users.filter(u => u.role === 'business').length },
                  { l: 'Riders',          v: users.filter(u => u.role === 'delivery_partner').length },
                  { l: 'Active Shops',    v: shops.filter(s => s.is_active).length },
                  { l: 'Pending Verify',  v: totalPending },
                ].map(s => (
                  <div key={s.l} style={{ ...card, textAlign: 'center', padding: 18 }}>
                    <div style={{ fontWeight: 900, fontSize: 28, color: s.l === 'Pending Verify' && s.v > 0 ? '#f59e0b' : 'var(--text)', lineHeight: 1 }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, marginTop: 5 }}>{s.l}</div>
                  </div>
                ))}
              </div>
 
              {/* Top shops by GMV */}
              {delivered.length > 0 && (() => {
                const shopGmv: Record<string, { name: string; gmv: number; orders: number }> = {}
                delivered.forEach(o => {
                  const sn = o.shop?.name || 'Unknown'
                  if (!shopGmv[sn]) shopGmv[sn] = { name: sn, gmv: 0, orders: 0 }
                  shopGmv[sn].gmv    += o.subtotal || 0
                  shopGmv[sn].orders += 1
                })
                const top = Object.values(shopGmv).sort((a, b) => b.gmv - a.gmv).slice(0, 5)
                return (
                  <div style={{ ...card }}>
                    <p style={{ ...lbl, marginBottom: 14 }}>Top Shops by GMV</p>
                    {top.map((s, i) => (
                      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? '#0891b2' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: i === 0 ? '#fff' : 'var(--text-3)', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{s.orders} orders</span>
                        <span style={{ fontWeight: 900, fontSize: 13, color: 'var(--text)', flexShrink: 0 }}>Rs.{s.gmv.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}

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
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>Rs.{o.total_amount}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, flexShrink: 0, background: STATUS_COLOR[o.status]?.bg || 'var(--bg-3)', color: STATUS_COLOR[o.status]?.text || 'var(--text-3)' }}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
 
          {/* ORDERS */}
          {tab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Orders ({filteredOrders.length})</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order, shop, customer..."
                    style={{ width: 220, maxWidth: '100%', minWidth: 0, fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
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
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toDateString() === new Date().toDateString() ? new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.shop?.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)' }}>{o.customer?.name || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12 }}>{o.delivery_partner_id ? <span style={{ color: '#16a34a', fontWeight: 700 }}>{o.partner?.name || 'Assigned'}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>Rs.{o.total_amount}</td>
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
 
          {/* SHOPS */}
          {tab === 'shops' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Shops ({filteredShops.length})</h2>
                  <a href="/dashboard/admin/activity"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(8,145,178,.1)', color: '#0891b2', fontWeight: 800, fontSize: 12, textDecoration: 'none', border: '1px solid rgba(8,145,178,.2)' }}>
                    <svg viewBox="0 0 16 16" fill="none" width={13} height={13}><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Activity log
                  </a>
                </div>
                <input value={shopSearch} onChange={e => setShopSearch(e.target.value)} placeholder="Search name, area, owner..."
                  style={{ width: 220, maxWidth: '100%', minWidth: 0, fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
              </div>
              {filteredShops.map(shop => (
                <div key={shop.id} style={{ ...card, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, overflow: 'hidden' }}>
                    {shop.image_url ? <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <IcoShop />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <p style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>{shop.name}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: shop.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: shop.is_active ? '#16a34a' : '#ef4444' }}>
                        {shop.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: shop.verification_status === 'approved' ? 'rgba(34,197,94,0.12)' : shop.verification_status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)', color: shop.verification_status === 'approved' ? '#16a34a' : shop.verification_status === 'pending' ? '#d97706' : '#ef4444' }}>
                        {shop.verification_status === 'approved' ? 'Verified' : shop.verification_status === 'pending' ? 'Pending' : 'Rejected'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{shop.category_name} · {shop.area}, {shop.city} · {shop.rating} stars</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Owner: {shop.owner?.name} · {shop.owner?.phone || shop.owner?.email}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
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
                    <button onClick={() => setOperatorsShop(shop)}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                      Operators
                    </button>
                    <button onClick={() => setAdminManagingShop(shop)}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                      Manage
                    </button>
                    <button onClick={() => setDeleteConfirm({ shop })}
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
 
          {/* USERS */}
          {tab === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Users ({filteredUsers.length})</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name, email, phone..."
                    style={{ width: 200, maxWidth: '100%', minWidth: 0, fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                  {['customer','business','delivery_partner','admin'].map(r => (
                    <span key={r} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--text-2)' }}>
                      {r === 'delivery_partner' ? 'riders' : r}: {users.filter(u => u.role === r).length}
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
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{u.name}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-2)' }}>{u.email}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)' }}>{u.phone || '—'}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <select value={u.role} onChange={e => createClient().from('users').update({ role: e.target.value }).eq('id', u.id).then(load)}
                            style={{ fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 8, padding: '5px 8px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', fontWeight: 700 }}>
                            {['customer','business','delivery_partner','admin','management'].map(r => <option key={r} value={r}>{r}</option>)}
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
 
          {/* VERIFY */}
          {tab === 'verify' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Verification Queue</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Review and approve new shops and delivery partners before they go live.</p>
              </div>
 
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Shops</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: pendingShops.length > 0 ? 'rgba(245,158,11,0.15)' : 'var(--bg-3)', color: pendingShops.length > 0 ? '#d97706' : 'var(--text-3)' }}>
                    {pendingShops.length} pending
                  </span>
                </div>
                {pendingShops.length === 0 ? (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)' }}>All shops reviewed</p>
                  </div>
                ) : pendingShops.map(shop => (
                  <div key={shop.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IcoShop /></div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{shop.name}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{shop.category_name} · {shop.area}, {shop.city}</p>
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                          {[{ l: 'Owner', v: shop.owner?.name }, { l: 'Phone', v: shop.owner?.phone || '—' }, { l: 'Email', v: shop.owner?.email }].map(f => (
                            <div key={f.l}>
                              <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{f.l}</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input value={rejectNote[shop.id] || ''} onChange={e => setRejectNote(p => ({ ...p, [shop.id]: e.target.value }))}
                      placeholder="Rejection reason (required only if rejecting)..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => verifyShop(shop.id, 'approved')}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff' }}>
                        Approve and Go Live
                      </button>
                      <button onClick={() => { if (!rejectNote[shop.id]?.trim()) { alert('Please enter a rejection reason.'); return } verifyShop(shop.id, 'rejected') }}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--red-bg)', color: '#ef4444' }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
 
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>Delivery Partners</h3>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: pendingRiders.length > 0 ? 'rgba(245,158,11,0.15)' : 'var(--bg-3)', color: pendingRiders.length > 0 ? '#d97706' : 'var(--text-3)' }}>
                    {pendingRiders.length} pending
                  </span>
                </div>
                {pendingRiders.length === 0 ? (
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-2)' }}>All riders reviewed</p>
                  </div>
                ) : pendingRiders.map(rider => (
                  <div key={rider.user_id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: 20, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                        {rider.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>{rider.name}</p>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {[{ l: 'Phone', v: rider.phone || '—' }, { l: 'Email', v: rider.email }, ...(rider.vehicle_type ? [{ l: 'Vehicle', v: rider.vehicle_type }] : []), { l: 'Registered', v: new Date(rider.created_at).toLocaleDateString('en-IN') }].map(f => (
                            <div key={f.l}>
                              <p style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{f.l}</p>
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>{f.v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input value={rejectNote[rider.user_id] || ''} onChange={e => setRejectNote(p => ({ ...p, [rider.user_id]: e.target.value }))}
                      placeholder="Rejection reason (required only if rejecting)..."
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-2)', background: 'var(--input-bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => verifyRider(rider.user_id, 'approved')}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#16a34a', color: '#fff' }}>
                        Approve Rider
                      </button>
                      <button onClick={() => { if (!rejectNote[rider.user_id]?.trim()) { alert('Please enter a rejection reason.'); return } verifyRider(rider.user_id, 'rejected') }}
                        style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: '2px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontFamily: 'inherit', background: 'var(--red-bg)', color: '#ef4444' }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
 
              {totalPending === 0 && (
                <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 18, padding: '40px 20px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 900, fontSize: 18, color: '#16a34a' }}>All caught up!</p>
                  <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6 }}>No pending verifications right now.</p>
                </div>
              )}
            </div>
          )}
 
          {/* PRICING & UPI */}
          {tab === 'pricing' && (
            <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Platform Pricing</h2>
                <button onClick={saveConfig} disabled={saving || !Object.keys(edits).length}
                  style={{ padding: '8px 20px', fontSize: 13, fontWeight: 800, borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: Object.keys(edits).length ? 'var(--brand)' : 'var(--bg-3)', color: Object.keys(edits).length ? '#fff' : 'var(--text-4)', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Saving...' : Object.keys(edits).length ? `Save (${Object.keys(edits).length})` : 'No changes'}
                </button>
              </div>
 
              {config.filter(c => !['upi_id','upi_name','welokl_upi_name'].includes(c.key)).length === 0 ? (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <p style={{ fontWeight: 900, fontSize: 15, color: '#d97706' }}>Run verification-migration.sql first</p>
                  <p style={{ fontSize: 13, color: '#d97706', marginTop: 6, opacity: 0.8 }}>The platform_config table needs to be set up in Supabase SQL Editor</p>
                </div>
              ) : (
                <div style={{ ...card2 }}>
                  {config.filter(c => !['upi_id','upi_name','welokl_upi_name'].includes(c.key)).map((c, i) => (
                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.label}</p>
                        <p style={{ ...mono, marginTop: 3 }}>{c.key}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.key === 'customer_care_phone' ? (
                          <input type="tel" defaultValue={c.value} onChange={e => setEdits(p => ({ ...p, [c.key]: e.target.value }))}
                            placeholder="e.g. 9999999999"
                            style={{ width: 150, textAlign: 'right', border: '2px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 800, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                        ) : (
                          <>
                            <input type="number" defaultValue={c.value} onChange={e => setEdits(p => ({ ...p, [c.key]: e.target.value }))}
                              style={{ width: 90, textAlign: 'right', border: '2px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', fontSize: 14, fontWeight: 800, background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                            <span style={{ fontSize: 12, color: 'var(--text-3)', width: 20 }}>
                              {c.key.includes('commission') || c.key.includes('percent') ? '%' : c.key.includes('km') ? 'km' : c.key.includes('min') ? 'min' : 'Rs.'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 14, padding: '14px 18px' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#d97706' }}>Changes apply to next order only</p>
                <p style={{ fontSize: 12, color: '#d97706', marginTop: 4, opacity: 0.8 }}>Existing orders in progress are not affected.</p>
              </div>
            </div>
          )}
 
          {/* DELIVERY */}
          {tab === 'delivery' && (
            <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Delivery Management</h2>
              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 16 }}>How It Works</p>
                {[
                  { n: '1', t: 'Shop marks order ready',    d: 'After preparing, shop clicks Mark Ready for Pickup' },
                  { n: '2', t: 'Order appears in rider app', d: 'All approved, online riders see available orders' },
                  { n: '3', t: 'Rider accepts and picks up', d: `First rider to tap Accept claims the order atomically` },
                  { n: '4', t: 'Rider marks delivered',      d: `Wallet credited Rs.${cfg('partner_payout',20)} automatically` },
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
                <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Registered Riders ({users.filter(u => u.role === 'delivery_partner').length})</p>
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
                      {d.verification_status === 'approved' ? 'Approved' : d.verification_status === 'pending' ? 'Pending' : 'Rejected'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{d.phone || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
 
          {/* CATEGORIES */}
          {tab === 'categories' && (
            <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Categories</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Enable or disable categories shown on the customer home screen.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category name..."
                    onKeyDown={e => { if (e.key === 'Enter') addCategory(newCatName) }}
                    style={{ fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', width: 180 }} />
                  <button onClick={() => addCategory(newCatName)} disabled={!newCatName.trim()}
                    style={{ padding: '8px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: newCatName.trim() ? '#16a34a' : 'var(--bg-3)', color: newCatName.trim() ? '#fff' : 'var(--text-4)' }}>
                    + Add
                  </button>
                </div>
              </div>
              {categories.length === 0 ? (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <p style={{ fontWeight: 800, fontSize: 14, color: '#d97706', marginBottom: 6 }}>No categories yet</p>
                  <p style={{ fontSize: 13, color: '#d97706', opacity: 0.8 }}>Run seed-categories.sql in Supabase SQL Editor to add categories.</p>
                </div>
              ) : (
                <div style={{ ...card2 }}>
                  {categories.map((cat: any, i: number) => (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{cat.name}</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: cat.is_active ? 'rgba(34,197,94,0.12)' : 'var(--bg-3)', color: cat.is_active ? '#16a34a' : 'var(--text-3)', marginRight: 8 }}>
                        {cat.is_active ? 'Shown' : 'Hidden'}
                      </span>
                      <button onClick={() => toggleCategory(cat.id, cat.is_active)}
                        style={{ padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: cat.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: cat.is_active ? '#ef4444' : '#16a34a' }}>
                        {cat.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => deleteCategory(cat.id)}
                        style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', background: 'none', color: 'var(--text-3)' }}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 

          {/* WALLETS */}
          {tab === 'wallets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 4 }}>Customer Wallets</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Credit or debit balances for refunds, bonuses, and compensation.</p>
                </div>
                <span style={{ padding: '4px 14px', borderRadius: 999, background: 'var(--bg-3)', fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                  Total in wallets: Rs.{wallets.reduce((s,w) => s + (w.balance||0), 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div style={{ ...card, maxWidth: 560 }}>
                <p style={{ ...lbl, marginBottom: 16 }}>Manual Credit / Debit</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select value={creditUserId} onChange={e => setCreditUserId(e.target.value)}
                    style={{ fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}>
                    <option value="">— Select customer —</option>
                    {wallets.map(w => (
                      <option key={w.user_id} value={w.user_id}>
                        {w.user?.name || w.user?.email || w.user_id} — Rs.{(w.balance||0).toFixed(0)} balance
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input type="number" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} placeholder="Amount (Rs.)"
                      style={{ fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                    <input value={creditDesc} onChange={e => setCreditDesc(e.target.value)} placeholder="Reason / description"
                      style={{ fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => creditWallet(creditUserId, parseFloat(creditAmt), creditDesc, 'credit')}
                      disabled={creditSaving || !creditUserId || !creditAmt || !creditDesc}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: (creditUserId && creditAmt && creditDesc) ? '#16a34a' : 'var(--bg-3)', color: (creditUserId && creditAmt && creditDesc) ? '#fff' : 'var(--text-4)' }}>
                      {creditSaving ? '...' : '+ Credit (add money)'}
                    </button>
                    <button onClick={() => creditWallet(creditUserId, parseFloat(creditAmt), creditDesc, 'debit')}
                      disabled={creditSaving || !creditUserId || !creditAmt || !creditDesc}
                      style={{ flex: 1, padding: '11px', borderRadius: 12, border: '2px solid rgba(239,68,68,0.3)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.06)', color: '#ef4444' }}>
                      {creditSaving ? '...' : '- Debit (remove money)'}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ ...card2, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Customer','Email','Phone','Balance','Earned','Spent'].map(h => (
                        <th key={h} style={{ ...lbl, padding: '12px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w, i) => (
                      <tr key={w.id} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text)' }}>{w.user?.name || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)' }}>{w.user?.email || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--text-3)' }}>{w.user?.phone || '—'}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 900, color: (w.balance||0) > 0 ? '#FF3008' : 'var(--text-3)' }}>Rs.{(w.balance||0).toFixed(0)}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: '#16a34a' }}>Rs.{(w.total_earned||0).toFixed(0)}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 700, color: 'var(--text-2)' }}>Rs.{(w.total_spent||0).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {wallets.length === 0 && (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
                    <p style={{ fontWeight: 700 }}>No wallets yet</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Wallets are created when customers open their wallet page.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BOOSTS ─────────────────────────────────────────────── */}
          {tab === 'boosts' && (
            <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

              {/* Plans */}
              <div style={card}>
                <h2 style={{ fontWeight:900, fontSize:16, color:'var(--text)', marginBottom:4 }}>Boost Plans</h2>
                <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>Adjust boost_weight to change how much each plan affects ranking. Higher = more visibility.</p>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {boostPlans.map((p: any) => (
                    <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--bg)', borderRadius:12, border:'1px solid var(--border)' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background: p.badge_color, flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:800, fontSize:13, color:'var(--text)' }}>{p.name} <span style={{ fontWeight:500, color:'var(--text-3)', fontSize:11 }}>"{p.badge_label}"</span></p>
                        <p style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>₹{p.price_weekly}/wk · ₹{p.price_monthly}/mo</p>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <label style={{ fontSize:11, color:'var(--text-3)' }}>Weight</label>
                        <input type="number" defaultValue={p.boost_weight} min={1} max={200}
                          onBlur={e => { const v = parseInt(e.target.value); if (v > 0) updateBoostWeight(p.id, v) }}
                          style={{ width:60, padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', fontSize:12, fontFamily:'inherit', textAlign:'center' }} />
                      </div>
                      <div style={{ padding:'3px 10px', borderRadius:6, background: p.badge_color + '22', color: p.badge_color, fontSize:11, fontWeight:800 }}>
                        +{p.boost_weight} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assign boost */}
              <div style={card}>
                <h2 style={{ fontWeight:900, fontSize:16, color:'var(--text)', marginBottom:4 }}>Assign Boost to Vendor</h2>
                <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>Select a shop, choose plan and duration. Existing active boost is replaced.</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'flex-end' }}>
                  <div style={{ flex:'1 1 180px' }}>
                    <label style={{ ...lbl, marginBottom:6, display:'block' }}>Shop</label>
                    <select value={boostForm.shopId} onChange={e => setBoostForm(f => ({ ...f, shopId: e.target.value }))}
                      style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
                      <option value="">Select shop…</option>
                      {shops.filter(s => s.is_active).map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.area}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex:'1 1 140px' }}>
                    <label style={{ ...lbl, marginBottom:6, display:'block' }}>Plan</label>
                    <select value={boostForm.planId} onChange={e => setBoostForm(f => ({ ...f, planId: e.target.value }))}
                      style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
                      <option value="">Select plan…</option>
                      {boostPlans.map((p: any) => <option key={p.id} value={p.id}>{p.name} (+{p.boost_weight} pts)</option>)}
                    </select>
                  </div>
                  <div style={{ flex:'0 0 120px' }}>
                    <label style={{ ...lbl, marginBottom:6, display:'block' }}>Duration</label>
                    <select value={boostForm.weeks} onChange={e => setBoostForm(f => ({ ...f, weeks: parseInt(e.target.value) }))}
                      style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card-bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit' }}>
                      <option value={1}>1 week</option>
                      <option value={2}>2 weeks</option>
                      <option value={4}>4 weeks (1 mo)</option>
                      <option value={8}>8 weeks (2 mo)</option>
                      <option value={12}>12 weeks (3 mo)</option>
                    </select>
                  </div>
                  <button onClick={assignBoost} disabled={boostSaving || !boostForm.shopId || !boostForm.planId}
                    style={{ padding:'9px 20px', borderRadius:10, background:'#ff3008', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit', opacity: boostSaving ? .6 : 1 }}>
                    {boostSaving ? 'Saving…' : 'Assign Boost'}
                  </button>
                </div>
              </div>

              {/* Active boosts */}
              <div style={card2}>
                <div style={{ padding:'16px 20px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <h2 style={{ fontWeight:900, fontSize:16, color:'var(--text)' }}>Active Boosts ({vendorBoosts.filter((b:any) => b.status === 'active').length})</h2>
                </div>
                {vendorBoosts.length === 0 ? (
                  <div style={{ padding:'32px 20px', textAlign:'center', color:'var(--text-3)' }}>
                    <p style={{ fontWeight:700 }}>No boosts yet</p>
                    <p style={{ fontSize:12, marginTop:4 }}>Assign a boost above to get started.</p>
                  </div>
                ) : (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'var(--bg)' }}>
                          {['Shop','Plan','Period','Status','7-day Impr.','7-day Clicks','7-day Orders','Actions'].map(h => (
                            <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vendorBoosts.map((b: any) => {
                          const m = boostAnalytics[b.shop_id] || { impressions:0, clicks:0, orders:0 }
                          const isActive  = b.status === 'active'
                          const isExpired = new Date(b.end_date) < new Date()
                          const ctr = m.impressions > 0 ? ((m.clicks / m.impressions) * 100).toFixed(1) : '0.0'
                          return (
                            <tr key={b.id} style={{ borderTop:'1px solid var(--border)', opacity: isActive ? 1 : .55 }}>
                              <td style={{ padding:'12px 14px' }}>
                                <p style={{ fontWeight:700, color:'var(--text)' }}>{b.shop?.name || '—'}</p>
                                <p style={{ fontSize:11, color:'var(--text-3)' }}>{b.shop?.area}</p>
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ padding:'3px 8px', borderRadius:6, background:'rgba(139,92,246,.15)', color:'#8b5cf6', fontWeight:700, fontSize:11 }}>
                                  {b.plan?.name} +{b.plan?.boost_weight}pts
                                </span>
                              </td>
                              <td style={{ padding:'12px 14px', ...mono }}>
                                {b.start_date} → {b.end_date}
                                {isExpired && isActive && <span style={{ marginLeft:6, color:'#ef4444', fontSize:10, fontWeight:700 }}>EXPIRED</span>}
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                <span style={{ padding:'3px 8px', borderRadius:6, fontWeight:700, fontSize:11,
                                  background: isActive ? 'rgba(22,163,74,.15)' : 'rgba(100,100,100,.15)',
                                  color:       isActive ? '#16a34a'            : 'var(--text-3)' }}>
                                  {b.status}
                                </span>
                              </td>
                              <td style={{ padding:'12px 14px', fontWeight:700, color:'var(--text)' }}>
                                {m.impressions.toLocaleString()}
                              </td>
                              <td style={{ padding:'12px 14px', color:'var(--text)' }}>
                                {m.clicks} <span style={{ fontSize:10, color:'var(--text-3)' }}>({ctr}% CTR)</span>
                              </td>
                              <td style={{ padding:'12px 14px', fontWeight:700, color:'#16a34a' }}>
                                {m.orders}
                              </td>
                              <td style={{ padding:'12px 14px' }}>
                                <div style={{ display:'flex', gap:6 }}>
                                  {isActive && (
                                    <button onClick={() => updateBoostStatus(b.id, 'paused')}
                                      style={{ padding:'4px 10px', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                      Pause
                                    </button>
                                  )}
                                  {b.status === 'paused' && (
                                    <button onClick={() => updateBoostStatus(b.id, 'active')}
                                      style={{ padding:'4px 10px', borderRadius:7, border:'none', background:'#16a34a', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                      Resume
                                    </button>
                                  )}
                                  {b.status !== 'cancelled' && (
                                    <button onClick={() => { if (confirm('Cancel this boost?')) updateBoostStatus(b.id, 'cancelled') }}
                                      style={{ padding:'4px 10px', borderRadius:7, border:'none', background:'rgba(220,38,38,.12)', color:'#dc2626', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── PROMO CODES ─────────────────────────────────────────── */}
          {tab === 'promos' && (
            <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Promo Codes</h2>

              {/* Create form */}
              <div style={{ ...card }}>
                <p style={{ ...lbl, marginBottom: 16 }}>Create New Code</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>CODE</p>
                    <input value={promoForm.code} onChange={e => setPromoForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                      placeholder="e.g. WELCOME50"
                      style={{ width: '100%', fontSize: 13, fontWeight: 800, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>DESCRIPTION</p>
                    <input value={promoForm.description} onChange={e => setPromoForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Welcome offer"
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>TYPE</p>
                    <select value={promoForm.discount_type} onChange={e => setPromoForm(p => ({ ...p, discount_type: e.target.value }))}
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="flat">Flat ₹</option>
                      <option value="percent">Percent %</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>VALUE</p>
                    <input type="number" value={promoForm.discount_value} onChange={e => setPromoForm(p => ({ ...p, discount_value: e.target.value }))}
                      placeholder={promoForm.discount_type === 'percent' ? '20' : '50'}
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>MIN ORDER ₹</p>
                    <input type="number" value={promoForm.min_order_amount} onChange={e => setPromoForm(p => ({ ...p, min_order_amount: e.target.value }))}
                      placeholder="0"
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>MAX DISCOUNT ₹</p>
                    <input type="number" value={promoForm.max_discount} onChange={e => setPromoForm(p => ({ ...p, max_discount: e.target.value }))}
                      placeholder="∞"
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>USAGE LIMIT (blank = unlimited)</p>
                    <input type="number" value={promoForm.usage_limit} onChange={e => setPromoForm(p => ({ ...p, usage_limit: e.target.value }))}
                      placeholder="Unlimited"
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4 }}>EXPIRES AT (blank = never)</p>
                    <input type="datetime-local" value={promoForm.expires_at} onChange={e => setPromoForm(p => ({ ...p, expires_at: e.target.value }))}
                      style={{ width: '100%', fontSize: 13, border: '1px solid var(--border-2)', borderRadius: 10, padding: '9px 12px', background: 'var(--input-bg)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button disabled={promoSaving || !promoForm.code || !promoForm.discount_value} onClick={async () => {
                  if (!promoForm.code || !promoForm.discount_value) return
                  setPromoSaving(true)
                  const sb = createClient()
                  await sb.from('promo_codes').insert({
                    code:              promoForm.code.trim().toUpperCase(),
                    description:       promoForm.description || null,
                    discount_type:     promoForm.discount_type,
                    discount_value:    Number(promoForm.discount_value),
                    min_order_amount:  promoForm.min_order_amount ? Number(promoForm.min_order_amount) : 0,
                    max_discount:      promoForm.max_discount ? Number(promoForm.max_discount) : null,
                    usage_limit:       promoForm.usage_limit ? Number(promoForm.usage_limit) : null,
                    expires_at:        promoForm.expires_at || null,
                    is_active:         true,
                  })
                  setPromoForm({ code:'', description:'', discount_type:'flat', discount_value:'', min_order_amount:'', max_discount:'', usage_limit:'', expires_at:'' })
                  setPromoSaving(false)
                  load()
                }}
                  style={{ padding: '10px 28px', borderRadius: 12, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: promoSaving ? 0.6 : 1 }}>
                  {promoSaving ? 'Creating…' : 'Create Code'}
                </button>
              </div>

              {/* Existing codes */}
              <div style={{ ...card2 }}>
                {promoCodes.length === 0 ? (
                  <p style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No promo codes yet</p>
                ) : promoCodes.map((p: any, i: number) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)', fontFamily: 'monospace' }}>{p.code}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.is_active ? 'rgba(22,163,74,.12)' : 'rgba(100,100,100,.12)', color: p.is_active ? '#16a34a' : 'var(--text-3)' }}>
                          {p.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                        {p.discount_type === 'percent' ? `${p.discount_value}% off` : `₹${p.discount_value} off`}
                        {p.min_order_amount > 0 ? ` · Min ₹${p.min_order_amount}` : ''}
                        {p.max_discount ? ` · Max ₹${p.max_discount}` : ''}
                        {p.usage_limit ? ` · ${p.used_count}/${p.usage_limit} used` : ` · ${p.used_count} used`}
                        {p.expires_at ? ` · Expires ${new Date(p.expires_at).toLocaleDateString('en-IN')}` : ''}
                      </p>
                      {p.description && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{p.description}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={async () => {
                        const sb = createClient()
                        await sb.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id)
                        load()
                      }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {p.is_active ? 'Pause' : 'Activate'}
                      </button>
                      <button onClick={async () => {
                        if (!confirm(`Delete code "${p.code}"?`)) return
                        const sb = createClient()
                        await sb.from('promo_codes').delete().eq('id', p.id)
                        load()
                      }} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </>}
      </div>

      {adminManagingShop && (
        <AdminShopManageModal
          shop={adminManagingShop}
          onClose={() => setAdminManagingShop(null)}
          onRefresh={() => { load(); setAdminManagingShop(s => s ? { ...s } : s) }}
        />
      )}

      {operatorsShop && (
        <ShopOperatorsModal
          shop={operatorsShop}
          onClose={() => setOperatorsShop(null)}
        />
      )}

      {deleteConfirm && (
        <DeleteShopConfirm
          confirm={deleteConfirm}
          onCancel={() => setDeleteConfirm(null)}
          onDeleted={() => { setDeleteConfirm(null); load() }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Admin: manage shop products + images
// ─────────────────────────────────────────────────────────────
function AdminShopManageModal({ shop, onClose, onRefresh }: { shop: any; onClose: () => void; onRefresh: () => void }) {
  const [products, setProducts]     = useState<any[]>([])
  const [loadingProds, setLoadingProds] = useState(true)
  const [activeTab, setActiveTab]   = useState<'products' | 'images'>('products')
  const [showAdd, setShowAdd]       = useState(false)
  const [addForm, setAddForm]       = useState({ name: '', description: '', price: '', original_price: '', category: '', is_veg: '' })
  const [addImg, setAddImg]         = useState<File | null>(null)
  const [addImgPreview, setAddImgPreview] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError]     = useState('')
  const [logoProg, setLogoProg]     = useState(0)
  const [bannerProg, setBannerProg] = useState(0)
  const [imgError, setImgError]     = useState('')
  const [shopData, setShopData]     = useState(shop)
  const [uploadingImgId, setUploadingImgId] = useState<string | null>(null)

  const sb = createClient()

  const loadProducts = useCallback(async () => {
    setLoadingProds(true)
    const { data } = await sb.from('products').select('*').eq('shop_id', shop.id).order('name')
    setProducts(data || [])
    setLoadingProds(false)
  }, [shop.id]) // eslint-disable-line

  useEffect(() => { loadProducts() }, [loadProducts])

  async function deleteProduct(productId: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    const { error } = await sb.from('products').delete().eq('id', productId)
    if (error) { setAddError(`Delete failed: ${error.message}`); return }
    loadProducts()
  }

  async function addProduct() {
    if (!addForm.name.trim() || !addForm.price) { setAddError('Name and price required'); return }
    setAddLoading(true); setAddError('')
    const { data: product, error } = await sb.from('products').insert({
      shop_id: shop.id,
      name: addForm.name.trim(),
      description: addForm.description.trim() || null,
      price: parseInt(addForm.price),
      original_price: addForm.original_price ? parseInt(addForm.original_price) : null,
      category: addForm.category.trim() || null,
      is_veg: addForm.is_veg === 'veg' ? true : addForm.is_veg === 'nonveg' ? false : null,
      is_available: true,
    }).select().single()
    if (error) { setAddError(error.message); setAddLoading(false); return }
    if (addImg && product) {
      try {
        const { uploadProductImage } = await import('@/lib/imageService')
        const { url } = await uploadProductImage(addImg, shop.owner_id, product.id, 1, () => {})
        await sb.from('products').update({ image_url: url }).eq('id', product.id)
      } catch (e: any) { setAddError(`Product saved but image failed: ${e.message}`) }
    }
    setAddLoading(false)
    setShowAdd(false)
    setAddForm({ name: '', description: '', price: '', original_price: '', category: '', is_veg: '' })
    setAddImg(null); setAddImgPreview(null)
    loadProducts()
  }

  async function uploadShopImg(file: File, type: 'logo' | 'banner') {
    setImgError('')
    try {
      const { uploadShopImage } = await import('@/lib/imageService')
      const { url } = await uploadShopImage(file, shop.owner_id, type, type === 'logo' ? setLogoProg : setBannerProg)
      await sb.from('shops').update(type === 'logo' ? { image_url: url } : { banner_url: url }).eq('id', shop.id)
      setShopData((p: any) => ({ ...p, ...(type === 'logo' ? { image_url: url } : { banner_url: url }) }))
      onRefresh()
    } catch (e: any) { setImgError(`Upload failed: ${e.message}`) }
  }

  async function uploadProductImg(file: File, productId: string) {
    setUploadingImgId(productId)
    try {
      const { uploadProductImage } = await import('@/lib/imageService')
      const { url } = await uploadProductImage(file, shop.owner_id, productId, 1, () => {})
      const { error } = await sb.from('products').update({ image_url: url }).eq('id', productId)
      if (error) { setAddError(`Image saved but link failed: ${error.message}`) }
      else { setProducts(prev => prev.map(p => p.id === productId ? { ...p, image_url: url } : p)) }
    } catch (e: any) { setAddError(`Image upload failed: ${e.message}`) }
    setUploadingImgId(null)
  }

  const inp = { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text)', width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)' }}>{shop.name}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Owner: {shop.owner?.name} · {shop.owner?.phone || shop.owner?.email}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '16px 20px 0', borderBottom: '1px solid var(--border)', marginTop: 12 }}>
          {(['products', 'images'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ padding: '8px 18px', borderRadius: '10px 10px 0 0', fontSize: 13, fontWeight: 700, background: activeTab === t ? 'var(--bg-3)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: activeTab === t ? 'var(--text)' : 'var(--text-3)' }}>
              {t === 'products' ? `Products (${products.length})` : 'Shop Images'}
            </button>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* PRODUCTS TAB */}
          {activeTab === 'products' && (
            <>
              <button onClick={() => { setShowAdd(v => !v); setAddError('') }}
                style={{ padding: '9px 18px', borderRadius: 11, background: showAdd ? 'var(--bg-3)' : '#ff3008', color: showAdd ? 'var(--text-2)' : '#fff', fontWeight: 800, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>
                {showAdd ? 'Cancel' : '+ Add Product'}
              </button>

              {showAdd && (
                <div style={{ background: 'var(--bg-3)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {addError && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{addError}</p>}
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ height: 100, borderRadius: 10, border: '2px dashed var(--border)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {addImgPreview
                        ? <img src={addImgPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Tap to add product image (optional)</span>}
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return
                      setAddImg(f); setAddImgPreview(URL.createObjectURL(f))
                    }} />
                  </label>
                  <input placeholder="Product name *" value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} style={inp} />
                  <input placeholder="Description" value={addForm.description} onChange={e => setAddForm(p => ({ ...p, description: e.target.value }))} style={inp} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input placeholder="Price ₹ *" type="number" value={addForm.price} onChange={e => setAddForm(p => ({ ...p, price: e.target.value }))} style={inp} />
                    <input placeholder="Original ₹" type="number" value={addForm.original_price} onChange={e => setAddForm(p => ({ ...p, original_price: e.target.value }))} style={inp} />
                  </div>
                  <input placeholder="Category (e.g. Snacks)" value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))} style={inp} />
                  <select value={addForm.is_veg} onChange={e => setAddForm(p => ({ ...p, is_veg: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                    <option value="">Veg / Non-veg (optional)</option>
                    <option value="veg">Veg</option>
                    <option value="nonveg">Non-veg</option>
                  </select>
                  <button onClick={addProduct} disabled={addLoading}
                    style={{ padding: 12, borderRadius: 12, background: addLoading ? 'var(--bg-4)' : '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: addLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                    {addLoading ? 'Saving…' : 'Save Product'}
                  </button>
                </div>
              )}

              {loadingProds
                ? <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading products…</p>
                : products.length === 0
                  ? <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No products yet.</p>
                  : products.map(p => (
                    <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 12 }}>
                      <label style={{ cursor: 'pointer', flexShrink: 0, position: 'relative', display: 'block', width: 44, height: 44 }} title="Tap to upload image">
                        {uploadingImgId === p.id
                          ? <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>…</div>
                          : p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                            : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-2)', border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📷</div>}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                          const f = e.target.files?.[0]; if (f) uploadProductImg(f, p.id)
                        }} />
                      </label>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>₹{p.price}{p.original_price ? ` · was ₹${p.original_price}` : ''} · {p.is_available ? 'Available' : 'Unavailable'}</p>
                        {!p.image_url && <p style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>Tap photo to add image</p>}
                      </div>
                      <button onClick={() => deleteProduct(p.id)}
                        style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                        Delete
                      </button>
                    </div>
                  ))
              }
            </>
          )}

          {/* IMAGES TAB */}
          {activeTab === 'images' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {imgError && <p style={{ color: '#ef4444', fontSize: 13, fontWeight: 600 }}>{imgError}</p>}
              {(['logo', 'banner'] as const).map(type => (
                <div key={type}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase' as const }}>{type === 'logo' ? 'Shop Logo' : 'Banner Image'}</p>
                  <label style={{ cursor: 'pointer', display: 'block' }}>
                    <div style={{ height: type === 'banner' ? 130 : 90, borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                      {(type === 'logo' ? shopData.image_url : shopData.banner_url)
                        ? <img src={type === 'logo' ? shopData.image_url : shopData.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Tap to upload {type}</p>}
                      {(type === 'logo' ? logoProg : bannerProg) > 0 && (type === 'logo' ? logoProg : bannerProg) < 100 && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <p style={{ color: '#fff', fontWeight: 800 }}>{type === 'logo' ? logoProg : bannerProg}%</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const f = e.target.files?.[0]; if (f) uploadShopImg(f, type)
                    }} />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Admin: delete shop — type shop name to confirm
// ─────────────────────────────────────────────────────────────
function DeleteShopConfirm({ confirm, onCancel, onDeleted }: {
  confirm: { shop: any };
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped]       = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const match = typed.trim() === confirm.shop.name.trim()

  async function handleDelete() {
    if (!match) return
    setDeleting(true)
    setDeleteErr('')

    try {
      const { data: { session } } = await createClient().auth.getSession()
      const res = await fetch('/api/admin/delete-shop', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ shopId: confirm.shop.id }),
      })
      const data = await res.json()
      setDeleting(false)
      if (!res.ok) {
        setDeleteErr(`Delete failed: ${data.error || 'Unknown error'}`)
        return
      }
      onDeleted()
    } catch (e: any) {
      setDeleting(false)
      setDeleteErr(`Delete failed: ${e?.message || 'Unknown error'}`)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>🗑️</div>
        <p style={{ fontWeight: 900, fontSize: 18, color: '#ef4444', marginBottom: 8 }}>Delete Shop</p>
        <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
          This will permanently delete <strong style={{ color: 'var(--text)' }}>{confirm.shop.name}</strong> and all its products, orders, and images. This <strong>cannot be undone</strong>.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
            Type <strong style={{ color: '#ef4444' }}>{confirm.shop.name}</strong> to confirm
          </label>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onPaste={e => e.preventDefault()}
            placeholder={confirm.shop.name}
            autoFocus
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 12, boxSizing: 'border-box',
              border: `1.5px solid ${typed.length > 0 ? (match ? '#16a34a' : '#ef4444') : 'var(--border)'}`,
              background: 'var(--bg-2)', color: 'var(--text)', fontSize: 14,
              fontFamily: 'inherit', outline: 'none', transition: 'border .15s',
            }}
          />
          {typed.length > 0 && !match && (
            <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginTop: 5 }}>Name doesn't match</p>
          )}
        </div>

        {deleteErr && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#ef4444', fontWeight: 600 }}>
            ⚠ {deleteErr}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: 13, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!match || deleting}
            style={{ flex: 1, padding: 13, borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 14, fontFamily: 'inherit', transition: 'all .15s',
              background: match ? '#ef4444' : 'var(--bg-3)',
              color: match ? '#fff' : 'var(--text-3)',
              cursor: match ? 'pointer' : 'not-allowed',
              boxShadow: match ? '0 4px 14px rgba(239,68,68,.3)' : 'none',
            }}>
            {deleting ? 'Removing files & deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Shop Operators Modal — add/remove staff access per shop
// ─────────────────────────────────────────────────────────────
function ShopOperatorsModal({ shop, onClose }: { shop: any; onClose: () => void }) {
  const [operators, setOperators] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [email, setEmail]         = useState('')
  const [role, setRole]           = useState<'manager' | 'staff'>('manager')
  const [searching, setSearching] = useState(false)
  const [err, setErr]             = useState('')
  const [success, setSuccess]     = useState('')
  const sb = createClient()

  async function loadOperators() {
    setLoading(true)
    const { data } = await sb
      .from('shop_staff')
      .select('id, role, is_active, created_at, user:users(id, name, phone, email)')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    setOperators(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadOperators() }, [])

  async function addOperator() {
    setErr(''); setSuccess('')
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setErr('Enter an email address'); return }
    setSearching(true)
    // Find the user by email
    const { data: found } = await sb
      .from('users')
      .select('id, name, email')
      .eq('email', trimmed)
      .maybeSingle()
    if (!found) { setErr('No Welokl account found with that email'); setSearching(false); return }
    // Check not already added
    if (operators.find(o => (o.user as any)?.id === found.id)) {
      setErr('This user is already an operator for this shop'); setSearching(false); return
    }
    const { data: { user: admin } } = await sb.auth.getUser()
    const { error } = await sb.from('shop_staff').insert({
      shop_id: shop.id, user_id: found.id,
      role, added_by: admin!.id, is_active: true,
    })
    if (error) { setErr(error.message); setSearching(false); return }
    setSuccess(`${found.name} added as ${role}`)
    setEmail('')
    setSearching(false)
    loadOperators()
  }

  async function toggleActive(op: any) {
    await sb.from('shop_staff').update({ is_active: !op.is_active }).eq('id', op.id)
    loadOperators()
  }

  async function removeOperator(opId: string) {
    await sb.from('shop_staff').delete().eq('id', opId)
    loadOperators()
  }

  const overlay: React.CSSProperties = { position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }
  const modal: React.CSSProperties  = { background:'var(--card-bg)', borderRadius:24, padding:28, width:'100%', maxWidth:500, maxHeight:'88vh', overflowY:'auto', fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:'0 24px 80px rgba(0,0,0,.35)' }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modal}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ fontWeight:900, fontSize:18, color:'var(--text)', marginBottom:4 }}>Shop Operators</h2>
            <p style={{ fontSize:13, color:'var(--text-3)' }}>{shop.name}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--text-3)', lineHeight:1, padding:4 }}>×</button>
        </div>

        {/* Add operator */}
        <div style={{ background:'var(--bg-2)', borderRadius:16, padding:16, marginBottom:20 }}>
          <p style={{ fontSize:12, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Add operator by email</p>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input
              type="email"
              value={email} onChange={e => { setEmail(e.target.value); setErr(''); setSuccess('') }}
              placeholder="Operator's email address"
              onKeyDown={e => e.key === 'Enter' && addOperator()}
              style={{ flex:1, padding:'10px 13px', borderRadius:12, border:'1.5px solid var(--border-2)', background:'var(--input-bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none' }}
            />
            <select value={role} onChange={e => setRole(e.target.value as any)}
              style={{ padding:'10px 12px', borderRadius:12, border:'1.5px solid var(--border-2)', background:'var(--input-bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit', outline:'none', fontWeight:700, cursor:'pointer' }}>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <button onClick={addOperator} disabled={searching || !email.trim()}
            style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background: email.trim() ? '#7c3aed' : 'var(--bg-3)', color: email.trim() ? '#fff' : 'var(--text-3)', fontWeight:800, fontSize:14, cursor: email.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit', transition:'background .15s' }}>
            {searching ? 'Adding…' : 'Add Operator'}
          </button>
          {err     && <p style={{ fontSize:12, color:'#ef4444', fontWeight:600, marginTop:8 }}>{err}</p>}
          {success && <p style={{ fontSize:12, color:'#16a34a', fontWeight:700, marginTop:8 }}>✓ {success}</p>}
        </div>

        {/* Role legend */}
        <div style={{ display:'flex', gap:12, marginBottom:16, fontSize:11, color:'var(--text-3)' }}>
          <span><strong style={{ color:'#7c3aed' }}>Manager</strong> — full dashboard access</span>
          <span><strong style={{ color:'#6b7280' }}>Staff</strong> — orders + products only</span>
        </div>

        {/* Current operators */}
        <p style={{ fontSize:12, fontWeight:800, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>
          Current operators ({operators.length})
        </p>

        {loading && <p style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', padding:'20px 0' }}>Loading…</p>}

        {!loading && operators.length === 0 && (
          <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-3)', fontSize:13 }}>
            No operators yet. Add one above.
          </div>
        )}

        {operators.map(op => {
          const u = op.user as any
          return (
            <div key={op.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, border:'1px solid var(--border)', background:'var(--card-bg)', marginBottom:8 }}>
              {/* Avatar */}
              <div style={{ width:38, height:38, borderRadius:'50%', background: op.role === 'manager' ? 'rgba(124,58,237,.15)' : 'rgba(107,114,128,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={op.role === 'manager' ? '#7c3aed' : '#6b7280'} strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke={op.role === 'manager' ? '#7c3aed' : '#6b7280'} strokeWidth="2"/></svg>
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:800, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u?.name || 'Unknown'}</p>
                <p style={{ fontSize:12, color:'var(--text-3)' }}>{u?.phone || u?.email}</p>
              </div>
              {/* Role badge */}
              <span style={{ fontSize:11, fontWeight:800, padding:'3px 10px', borderRadius:999, background: op.role === 'manager' ? 'rgba(124,58,237,.12)' : 'rgba(107,114,128,.12)', color: op.role === 'manager' ? '#7c3aed' : '#6b7280', flexShrink:0 }}>
                {op.role}
              </span>
              {/* Active toggle */}
              <button onClick={() => toggleActive(op)}
                style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'inherit', background: op.is_active ? 'rgba(22,163,74,.12)' : 'rgba(239,68,68,.1)', color: op.is_active ? '#16a34a' : '#ef4444' }}>
                {op.is_active ? 'Active' : 'Paused'}
              </button>
              {/* Remove */}
              <button onClick={() => removeOperator(op.id)}
                style={{ width:30, height:30, borderRadius:8, border:'none', cursor:'pointer', background:'rgba(239,68,68,.1)', color:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}