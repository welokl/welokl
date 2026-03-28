'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useFCM, registerFCMToken } from '@/hooks/useFCM'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, Shop, Product, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import { useShopkeeperOrderAlerts, useVisibilityReconnect, unlockAudio } from '@/hooks/useOrderAlerts'
import ThemeToggle from '@/components/ThemeToggle'
import ImageUploader from '@/components/ImageUploader'
import { uploadShopImage, deleteProductImages, imgUrl } from '@/lib/imageService'
import BusinessAnalytics from '@/components/BusinessAnalytics'
import { PhoneGate } from '@/components/PhoneGate'

type Tab = 'orders' | 'products' | 'analytics' | 'subscriptions' | 'settings'

export default function BusinessDashboard() {
  const [user, setUser] = useState<User | null>(null)
  useFCM(user?.id ?? null)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('granted')
  const [shop, setShop] = useState<Shop | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tab, setTab] = useState<Tab>('orders')
  const [loading, setLoading] = useState(true)
  const lastAppliedRef = useRef<boolean | null>(null) // last is_open state we wrote to DB
  const shopRef = useRef<any>(null)                   // always-fresh shop snapshot for tick()
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [verStatus, setVerStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [verNote, setVerNote] = useState<string | null>(null)
  const [logoProgress, setLogoProgress]     = useState(0)
  const [bannerProgress, setBannerProgress] = useState(0)
  const [imgError, setImgError]             = useState('')
  const [showPhoneGate, setShowPhoneGate]   = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }

    const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
    const role = profile?.role || authUser.user_metadata?.role || ''

    // Delivery and admin always redirect
    if (role === 'delivery') { window.location.replace('/dashboard/delivery'); return }
    if (role === 'admin')    { window.location.replace('/dashboard/admin');    return }

    if (!profile?.phone) setShowPhoneGate(true)
    setUser(profile)

    let shopData: any = null

    if (role === 'customer') {
      // Customer — only way in is via shop_staff assignment
      // Fetch staff row + shop in one query (join)
      const { data: staffRow } = await supabase
        .from('shop_staff')
        .select('role, shop:shops(*)')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .maybeSingle()

      if (!staffRow || !(staffRow as any).shop) {
        window.location.replace('/dashboard/customer')
        return
      }
      shopData = { ...(staffRow as any).shop, _staff_role: staffRow.role }
    } else {
      // Business / shopkeeper owner
      const { data: ownedShop } = await supabase
        .from('shops')
        .select('*, active_boost:vendor_boosts(status, end_date, plan:boost_plans(name, badge_color, boost_weight))')
        .eq('owner_id', authUser.id)
        .eq('vendor_boosts.status', 'active')
        .maybeSingle()
      shopData = ownedShop ?? null
    }

    if (!shopData) { setLoading(false); return }
    setShop(shopData)
    // Staff accessing admin shops: default to 'approved' so they reach the dashboard
    const vStatus = (shopData as any).verification_status ?? (shopData._staff_role ? 'approved' : 'pending')
    setVerStatus(vStatus)
    setVerNote((shopData as any).verification_note ?? null)
    const [{ data: orderData }, { data: productData }] = await Promise.all([
      supabase.from('orders').select('*, delivery_partner_id, pickup_code, items:order_items(*), customer:users!customer_id(name, phone)').eq('shop_id', shopData.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('*').eq('shop_id', shopData.id).order('sort_order'),
    ])
    setOrders(orderData || [])
    setProducts(productData || [])
    setLoading(false)
  }, [])

  const [alertsOn, setAlertsOn] = useState(() => { try { return localStorage.getItem('welokl_alerts_on') === '1' } catch { return false } })
  useShopkeeperOrderAlerts(shop?.id)
  useVisibilityReconnect(loadData)

  // Check notification permission on mount — show banner if not granted
  // Also unlock AudioContext on first click so automated sounds work
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) { setNotifPerm('unsupported'); return }
    setNotifPerm(Notification.permission)
    unlockAudio()
  }, [])

  // Keep shopRef in sync so tick() never reads a stale closure
  useEffect(() => { shopRef.current = shop }, [shop])

  // ── Auto open/close — Swiggy/Zomato style ───────────────────
  // Schedule is always the authority. On every tick:
  //   • Within hours + not manually_closed → open
  //   • Within hours + manually_closed     → stay closed (owner override)
  //   • Outside hours                      → closed, reset manually_closed for next day
  // tick() reads from shopRef so it always sees the latest manually_closed value,
  // avoiding the stale-closure bug where a delayed tick overrides a manual toggle.
  useEffect(() => {
    const shopId       = (shop as any)?.id
    const openingTime  = (shop as any)?.opening_time
    const closingTime  = (shop as any)?.closing_time
    if (!shopId || !openingTime || !closingTime) return

    function shouldBeOpenNow(): boolean {
      const now = new Date()
      const cur = now.getHours() * 60 + now.getMinutes()
      const [oh, om] = (openingTime as string).split(':').map(Number)
      const [ch, cm] = (closingTime  as string).split(':').map(Number)
      const open  = oh * 60 + om
      const close = ch * 60 + cm
      // Handle overnight schedules (e.g. 20:00 – 03:00)
      if (close <= open) return cur >= open || cur < close
      return cur >= open && cur < close
    }

    async function tick() {
      const s = shopRef.current as any   // always fresh — no stale closure
      if (!s) return
      const withinHours   = shouldBeOpenNow()
      const manuallyClosed = !!(s.manually_closed)
      const targetOpen    = withinHours && !manuallyClosed

      // Skip DB write if shop is already in the correct state
      if (s.is_open === targetOpen && lastAppliedRef.current === targetOpen) return
      lastAppliedRef.current = targetOpen

      const update: Record<string, any> = { is_open: targetOpen }
      if (!withinHours) update.manually_closed = false // reset override at end of day

      const sb = createClient()
      await sb.from('shops').update(update).eq('id', shopId)
      setShop(prev => prev ? { ...prev, ...update } : prev)
      sb.from('shop_activity_log').insert({
        shop_id: shopId,
        type: targetOpen ? 'shop_opened' : 'shop_closed',
        source: 'auto_schedule',
      }).then(() => {})
    }

    lastAppliedRef.current = null
    tick()
    const t = setInterval(tick, 30_000) // check every 30s
    return () => clearInterval(t)
  // Only restart when shop identity or schedule changes — NOT on every state update.
  // manually_closed is read live from shopRef, so it doesn't need to be a dep here.
  }, [(shop as any)?.id, (shop as any)?.opening_time, (shop as any)?.closing_time])

  useEffect(() => {
    loadData()
    const supabase = createClient()
    const chShops = supabase
      .channel('biz-shops-rt')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(chShops) }
  }, [loadData])

  useEffect(() => {
    if (!shop?.id) return
    const supabase = createClient()
    const chOrders = supabase
      .channel(`biz-orders-${shop.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shop.id}` },
        () => loadData()
      )
      .subscribe()
    return () => { supabase.removeChannel(chOrders) }
  }, [shop?.id, loadData])

  async function updateOrderStatus(orderId: string, status: string) {
    // Optimistic update — move the order to the new status instantly so the
    // shop owner sees the change immediately without waiting for the round-trip
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: status as Order['status'] } : o))

    const notifyMap: Record<string, string> = {
      accepted: 'order_accepted',
      ready: 'order_ready',
    }
    const supabase = createClient()
    // Fire DB update + notification in parallel — don't await notification fetch
    await supabase.from('orders').update({ status }).eq('id', orderId)
    supabase.from('order_status_log').insert({ order_id: orderId, status, message: `Status: ${status}` }).then(() => {})
    // Log to shop activity for admin visibility
    if (shop?.id) {
      supabase.from('shop_activity_log').insert({
        shop_id: shop.id,
        type: `order_${status}`,
        source: 'order',
        note: `Order ${orderId.slice(-6).toUpperCase()}`,
      }).then(() => {})
    }
    if (notifyMap[status]) {
      supabase.from('orders').select('customer_id, shop_id').eq('id', orderId).single()
        .then(({ data: ord }) => {
          if (ord) fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
            body: JSON.stringify({ type: notifyMap[status], order_id: orderId, customer_id: ord.customer_id, shop_id: ord.shop_id })
          }).catch(() => {})
        })
    }
    if (status === 'preparing' && shop) {
      fetch('/api/orders/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, shopLat: shop.latitude, shopLng: shop.longitude }) }).catch(() => {})
    }
    // Sync with server in the background to catch any realtime deltas
    loadData()
  }

  async function toggleProduct(productId: string, is_available: boolean) {
    const supabase = createClient()
    await supabase.from('products').update({ is_available }).eq('id', productId)
    loadData()
  }

  async function deleteProduct(productId: string) {
    if (!confirm('Delete this product?')) return
    const supabase = createClient()
    if (user?.id) await deleteProductImages(user.id, productId)
    await supabase.from('products').delete().eq('id', productId)
    loadData()
  }

  async function handleShopImageUpload(file: File, type: 'logo' | 'banner') {
    if (!user?.id || !shop?.id) return
    setImgError('')
    try {
      const progress = type === 'logo' ? setLogoProgress : setBannerProgress
      const { url } = await uploadShopImage(file, user.id, type, progress)
      const field = type === 'logo' ? 'image_url' : 'banner_url'
      await createClient().from('shops').update({ [field]: url }).eq('id', shop.id)
      setShop(prev => prev ? { ...prev, [field]: url } : prev)
      setTimeout(() => progress(0), 1500)
    } catch (e: any) {
      setImgError(e.message || 'Upload failed')
    }
  }

  const newOrders = orders.filter(o => o.status === 'placed')
  const activeOrders = orders.filter(o => ['accepted','preparing','ready'].includes(o.status))
  const deliveredOrders = orders.filter(o => o.status === 'delivered')
  const totalRevenue = deliveredOrders.reduce((s, o) => s + o.subtotal, 0)
  const commission = Math.round(totalRevenue * ((shop?.commission_percent || 15) / 100))
  const netEarnings = totalRevenue - commission

  if (!loading && !shop) {
    return (
      <div style={{minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:24}}>
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="font-bold text-xl mb-2">Set up your shop first</h2>
          <p style={{fontSize:13, color:"var(--text-3)", marginBottom:24}}>Create your shop to start receiving orders.</p>
          <button onClick={() => window.location.href = '/shop/setup'} className="btn-primary w-full py-3">Set up my shop →</button>
        </div>
      </div>
    )
  }

  if (!loading && verStatus === 'pending') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 24, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '3px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>⏳</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', marginBottom: 10 }}>Verification Pending</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 28 }}>
          Your shop <strong style={{ color: 'var(--text)' }}>{shop?.name}</strong> has been submitted.<br />
          Our team will review and approve it within <strong style={{ color: '#d97706' }}>24–48 hours</strong>.
        </p>
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', marginBottom: 24, textAlign: 'left' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>What happens next</p>
          {[
            { n: '1', t: 'Admin reviews your shop details', d: 'Name, category, area and contact info' },
            { n: '2', t: 'Approval notification',           d: "You'll be able to go live and receive orders" },
            { n: '3', t: 'Start selling!',                  d: 'Accept orders and grow your business' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.18)', color: '#d97706', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.t}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>Questions? support@welokl.com</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  if (!loading && verStatus === 'rejected') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 24, padding: '40px 32px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--red-bg)', border: '3px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>❌</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: '#ef4444', marginBottom: 10 }}>Shop Not Approved</h2>
        <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: verNote ? 16 : 28 }}>
          Your shop <strong style={{ color: 'var(--text)' }}>{shop?.name}</strong> was not approved at this time.
        </p>
        {verNote && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>Reason from admin:</p>
            <p style={{ fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>{verNote}</p>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 16 }}>Contact support@welokl.com for assistance.</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  async function enableNotifications() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted' && user?.id) await registerFCMToken(user.id)
  }

  return (
    <>
    {showPhoneGate && user && <PhoneGate userId={user.id} onDone={() => { setShowPhoneGate(false); loadData() }} />}

    {/* Notification permission banner — critical for PWA installs */}
    {notifPerm === 'default' && (
      <div style={{ background: '#FF3008', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, color: '#fff', fontWeight: 700, margin: 0 }}>
          🔔 Enable notifications to get instant order alerts
        </p>
        <button onClick={enableNotifications}
          style={{ background: '#fff', color: '#FF3008', border: 'none', borderRadius: 10, padding: '7px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
          Enable now
        </button>
      </div>
    )}
    {notifPerm === 'denied' && (
      <div style={{ background: '#7f1d1d', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#fca5a5', margin: 0 }}>
          ⚠️ Notifications blocked — go to browser Settings → Site settings → Notifications → Allow for this site
        </p>
      </div>
    )}

    <div style={{minHeight:"100vh", background:"var(--bg)"}}>
      <div style={{background:"var(--card-bg)", borderBottom:"1px solid var(--border)", padding:"16px"}}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
            <div style={{ minWidth: 0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <p style={{fontSize:11,color:"var(--text-3)"}}>Business Dashboard</p>
                {(shop as any)?._staff_role && (
                  <span style={{ fontSize:10, fontWeight:800, padding:'2px 8px', borderRadius:999, background:'rgba(124,58,237,.12)', color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    {(shop as any)._staff_role}
                  </span>
                )}
              </div>
              <h1 className="font-bold text-lg">{shop?.name || 'My Shop'}</h1>
              <p style={{fontSize:11,color:"var(--text-3)"}}>{shop?.area}, {shop?.city}</p>
            </div>
            <div className="biz-header-actions flex items-center gap-2">
              {/* Open/Closed toggle — sets manually_closed so schedule respects manual override */}
              <button onClick={async () => {
                const newOpen = !shop?.is_open
                const update: Record<string, any> = {
                  is_open: newOpen,
                  manually_closed: !newOpen,
                }
                const sb = createClient()
                await sb.from('shops').update(update).eq('id', shop?.id || '')
                setShop(prev => prev ? { ...prev, ...update } : prev)
                // Log manual open/close for admin activity feed
                sb.from('shop_activity_log').insert({
                  shop_id: shop?.id,
                  type: newOpen ? 'shop_opened' : 'shop_closed',
                  source: 'manual',
                }).then(() => {})
              }}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border ${shop?.is_open ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {shop?.is_open ? '● Open' : '● Closed'}
              </button>
              {/* Schedule status hint */}
              {(shop as any)?.opening_time && (shop as any)?.closing_time && (() => {
                const s = shop as any
                const [oh, om] = (s.opening_time as string).split(':').map(Number)
                const [ch, cm] = (s.closing_time  as string).split(':').map(Number)
                const now  = new Date()
                const cur  = now.getHours() * 60 + now.getMinutes()
                const open = oh * 60 + om, close = ch * 60 + cm
                const withinHours = close <= open ? (cur >= open || cur < close) : (cur >= open && cur < close)
                const fmt = (h: number, m: number) => {
                  const ampm = h >= 12 ? 'PM' : 'AM'
                  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
                }
                if (shop?.is_open) {
                  return <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>Auto-closes {fmt(ch, cm)}</span>
                } else if (s.manually_closed) {
                  return <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, whiteSpace: 'nowrap' }}>Manually closed</span>
                } else if (!withinHours) {
                  return <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>Opens {fmt(oh, om)}</span>
                }
                return null
              })()}
              {!alertsOn ? (
                <button onClick={() => {
                  try { const A = window.AudioContext || (window as any).webkitAudioContext; if (A) { const c = new A(); c.resume(); c.close() } } catch {}
                  setAlertsOn(true); try { localStorage.setItem('welokl_alerts_on','1') } catch {}
                }} style={{ fontSize:11, fontWeight:700, padding:'5px 10px', borderRadius:8, background:'rgba(255,48,8,.1)', color:'#ff3008', border:'1px solid rgba(255,48,8,.2)', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  🔔 Enable Alerts
                </button>
              ) : (
                <span style={{ fontSize:11, fontWeight:700, color:'#16a34a' }}>🔔 Alerts ON</span>
              )}
              <ThemeToggle />
              <button onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/' }}
                style={{fontSize:12, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"0 8px"}}>Logout</button>
            </div>
          </div>
          <div className="biz-stats-grid grid grid-cols-4 gap-2">
            {[
              { label: 'New', value: newOrders.length, color: 'text-blue-600' },
              { label: 'Active', value: activeOrders.length, color: 'text-amber-600' },
              { label: 'Done', value: deliveredOrders.length, color: 'text-green-600' },
              { label: 'Earned', value: `₹${netEarnings}`, color: 'text-brand-500' },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <div className={`font-bold text-lg ${s.color}`}>{s.value}</div>
                <div style={{fontSize:11,color:"var(--text-3)"}}>{s.label}</div>
              </div>
            ))}
          </div>
          <Link href="/dashboard/business/sales" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, margin:'12px 0 4px', padding:'10px', borderRadius:12, background:'var(--bg-3)', border:'1px solid var(--border)', textDecoration:'none', color:'var(--text-2)', fontWeight:700, fontSize:13 }}>
            📊 View full sales analytics
          </Link>
        </div>
      </div>

      <div style={{background:"var(--card-bg)", borderBottom:"1px solid var(--border)", padding:"0 16px"}}>
        <div className="biz-tab-bar max-w-4xl mx-auto flex">
          {(['orders','products','analytics','subscriptions','settings'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{padding:'12px 16px', fontSize:13, fontWeight:700, textTransform:'capitalize', borderBottom:`2px solid ${tab===t?'#FF3008':'transparent'}`, color:tab===t?'#FF3008':'var(--text-3)', background:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap', flexShrink:0}}>
              {t === 'settings' ? '⚙ Settings' : t === 'subscriptions' ? 'Plans' : t}{t === 'orders' && newOrders.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{newOrders.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {tab === 'orders' && (
          <div className="space-y-5">
            {newOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><h2 className="font-bold text-red-600">New Orders ({newOrders.length})</h2></div>
                <div className="space-y-3">
                  {newOrders.map(order => (
                    <div key={order.id} className="card p-4">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold text-sm">#{order.order_number}</span>
                        <span className="font-bold">₹{order.total_amount}</span>
                      </div>
                      {(order as any).customer?.name && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                          👤 {(order as any).customer.name}
                        </div>
                      )}
                      <div style={{ marginBottom: 12 }}>
                        {(order as any).items?.map((i: any) => (
                          <div key={i.id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                            {i.product_name} <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>×{i.quantity}</span>
                            {i.price && <span style={{ float: 'right', fontSize: 13, color: 'var(--text-2)' }}>₹{i.price * i.quantity}</span>}
                          </div>
                        ))}
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                          {order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'} · {order.type === 'delivery' ? '🛵 Delivery' : '🏃 Pickup'}
                          {order.delivery_address && <span> · 📍 {order.delivery_address}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="btn-primary text-sm py-2 flex-1">✓ Accept</button>
                        <button onClick={() => updateOrderStatus(order.id, 'rejected')} className="btn-secondary text-sm py-2 flex-1 text-red-500 border-red-200">✕ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeOrders.length > 0 && (
              <div>
                <h2 className="font-bold text-amber-600 mb-3">Active ({activeOrders.length})</h2>
                <div className="space-y-3">
                  {activeOrders.map(order => {
                    const nextMap: Record<string, { label: string; next: string } | null> = {
                      accepted:  { label: '👨‍🍳 Start Preparing', next: 'preparing' },
                      preparing: { label: '📦 Mark Ready for Pickup', next: 'ready' },
                      ready: null,
                    }
                    const a = nextMap[order.status]
                    const isReady      = order.status === 'ready'
                    const isPickupType = order.type === 'pickup'
                    const hasPartner   = !!(order as any).delivery_partner_id
                    const pickupCode   = (order as any).pickup_code as string | null

                    return (
                      <div key={order.id} style={{ background: 'var(--card-bg)', border: `1px solid ${isReady ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 16, padding: 16, boxShadow: isReady ? '0 0 0 2px var(--brand-glow)' : 'var(--card-shadow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>#{order.order_number}</span>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: isPickupType ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: isPickupType ? '#3b82f6' : '#d97706' }}>
                              {isPickupType ? '🏪 Pickup' : '🛵 Delivery'}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--amber-bg)', color: '#d97706' }}>
                              {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                            </span>
                          </div>
                        </div>
                        {(order as any).customer?.name && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                            👤 {(order as any).customer.name}
                          </div>
                        )}
                        <div style={{ marginBottom: 12 }}>
                          {(order as any).items?.map((i: any) => (
                            <div key={i.id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                              {i.product_name} <span style={{ color: 'var(--text-3)', fontWeight: 700 }}>×{i.quantity}</span>
                              {i.price && <span style={{ float: 'right', fontSize: 13, color: 'var(--text-2)' }}>₹{i.price * i.quantity}</span>}
                            </div>
                          ))}
                        </div>

                        {isReady && isPickupType && (
                          <PickupCodeVerifier orderId={order.id} correctCode={pickupCode} mode="customer" onVerified={() => loadData()} />
                        )}
                        {isReady && !isPickupType && !hasPartner && (
                          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                              <p style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>Waiting for a delivery partner…</p>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>A rider will accept and show you their code</p>
                          </div>
                        )}
                        {isReady && !isPickupType && hasPartner && (
                          <PickupCodeVerifier orderId={order.id} correctCode={pickupCode} mode="rider" onVerified={() => loadData()} />
                        )}
                        {a && (
                          <button onClick={() => updateOrderStatus(order.id, a.next)}
                            style={{ width: '100%', padding: '11px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#ff3008', color: '#fff', boxShadow: '0 4px 12px rgba(255,48,8,0.25)' }}>
                            {a.label}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {newOrders.length === 0 && activeOrders.length === 0 && (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-3">⏳</div>
                <p className="font-bold">No active orders</p>
                <p style={{fontSize:13, color:"var(--text-3)", marginTop:4}}>New orders appear here in real time</p>
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Products ({products.length})</h2>
              <button onClick={() => setShowAddProduct(true)} className="btn-primary text-sm py-2 px-4">+ Add Product</button>
            </div>
            {products.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-5xl mb-3">📦</div>
                <p className="font-bold mb-1">No products yet</p>
                <p style={{fontSize:13, color:"var(--text-3)", marginBottom:16}}>Add products so customers can order from you</p>
                <button onClick={() => setShowAddProduct(true)} className="btn-primary px-6">Add first product</button>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="card px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-brand-500">₹{p.price}</span>
                        {p.original_price && p.original_price > p.price && <span style={{fontSize:12, color:"var(--text-3)", textDecoration:"line-through"}}>₹{p.original_price}</span>}
                        {p.category && <span style={{fontSize:11,color:"var(--text-3)"}}>- {p.category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleProduct(p.id, !p.is_available)}
                        style={{position:'relative', width:40, height:20, borderRadius:999, background:p.is_available?'#22c55e':'var(--bg-4)', border:'none', cursor:'pointer', transition:'background .2s', flexShrink:0}}>
                        <span style={{position:'absolute', top:2, left:2, width:16, height:16, borderRadius:'50%', background:'white', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'transform .2s', transform:p.is_available?'translateX(20px)':'none'}} />
                      </button>
                      <button onClick={() => setEditingProduct(p)} style={{color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontSize:15, padding:"0 4px", fontFamily:"inherit"}} title="Edit & add image">✏️</button>
                      <button onClick={() => deleteProduct(p.id)} style={{color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"0 4px", fontFamily:"inherit"}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'analytics' && shop && <BusinessAnalytics shopId={shop.id} commissionPercent={(shop as any).commission_percent ?? 15} />}
        {tab === 'subscriptions' && shop && <SubscriptionPlans shopId={shop.id} />}
        {tab === 'settings' && shop && <ShopSettings shop={shop} onSaved={loadData} />}
      </div>

      {showAddProduct && shop && user && (
        <AddProductModal shopId={shop.id} userId={user.id} onClose={() => setShowAddProduct(false)} onSuccess={() => { setShowAddProduct(false); loadData() }} />
      )}
      {editingProduct && user && (
        <EditProductModal product={editingProduct} userId={user.id} onClose={() => setEditingProduct(null)} onSuccess={() => { setEditingProduct(null); loadData() }} />
      )}
    </div>
    </>
  )
}

// ── ShopSettings ─────────────────────────────────────────────
const SHOP_CATEGORIES = [
  'Food & Restaurants','Grocery','Pharmacy & Health','Electronics',
  'Fashion','Stationery','Hardware','Salon & Beauty','Pet Supplies','Flowers & Gifts',
]

// ── Subscription Plans manager ──────────────────────────────────────────────
function SubscriptionPlans({ shopId }: { shopId: string }) {
  const [plans, setPlans]         = useState<any[]>([])
  const [subs,  setSubs]          = useState<any[]>([])  // all active subscriber rows
  const [loading, setLoading]     = useState(true)
  const [saving,  setSaving]      = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', delivery_time: '07:00', frequency: 'daily' })

  const load = useCallback(async () => {
    const sb = createClient()
    const [{ data: planRows }, { data: subRows }] = await Promise.all([
      sb.from('subscription_plans').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      sb.from('customer_subscriptions').select('*, customer:users!customer_id(name, phone)').eq('shop_id', shopId).neq('status', 'cancelled'),
    ])
    setPlans(planRows ?? [])
    setSubs(subRows ?? [])
    setLoading(false)
  }, [shopId])

  useEffect(() => { load() }, [load])

  async function savePlan() {
    if (!form.name.trim() || !form.price) return
    setSaving(true)
    const sb = createClient()
    await sb.from('subscription_plans').insert({
      shop_id:       shopId,
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      price:         parseFloat(form.price),
      delivery_time: form.delivery_time,
      frequency:     form.frequency,
      is_active:     true,
    })
    setForm({ name: '', description: '', price: '', delivery_time: '07:00', frequency: 'daily' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function togglePlan(id: string, current: boolean) {
    await createClient().from('subscription_plans').update({ is_active: !current }).eq('id', id)
    setPlans(p => p.map(x => x.id === id ? { ...x, is_active: !current } : x))
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this plan? Existing subscribers will keep their subscriptions.')) return
    await createClient().from('subscription_plans').delete().eq('id', id)
    setPlans(p => p.filter(x => x.id !== id))
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 13px', borderRadius: 12, border: '1.5px solid var(--border)',
    background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', margin: 0 }}>Subscription Plans</h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
            {subs.filter(s => s.status === 'active').length} active subscriber{subs.filter(s => s.status === 'active').length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showForm ? 'Cancel' : '+ New Plan'}
        </button>
      </div>

      {/* Create plan form */}
      {showForm && (
        <div style={{ background: 'var(--card-bg)', border: '1.5px solid #FF3008', borderRadius: 18, padding: '20px 18px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', margin: 0 }}>Create a new plan</p>
          <input placeholder="Plan name (e.g. Daily Milk 500ml)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} />
          <input placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 5 }}>Price per delivery (₹)</p>
              <input type="number" placeholder="e.g. 50" min="1" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={inp} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 5 }}>Delivery time</p>
              <input type="time" value={form.delivery_time} onChange={e => setForm(f => ({ ...f, delivery_time: e.target.value }))} style={inp} />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 5 }}>Frequency</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['daily', 'weekdays', 'custom'].map(opt => (
                <button key={opt} onClick={() => setForm(f => ({ ...f, frequency: opt }))}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${form.frequency === opt ? '#FF3008' : 'var(--border)'}`, background: form.frequency === opt ? 'rgba(255,48,8,.08)' : 'var(--card-bg)', color: form.frequency === opt ? '#FF3008' : 'var(--text-3)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <button onClick={savePlan} disabled={saving || !form.name.trim() || !form.price}
            style={{ padding: '13px', borderRadius: 13, border: 'none', background: form.name && form.price ? '#FF3008' : 'var(--bg-3)', color: form.name && form.price ? '#fff' : 'var(--text-4)', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Creating...' : 'Create Plan'}
          </button>
        </div>
      )}

      {/* Plans list */}
      {plans.length === 0 ? (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(255,48,8,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M4 4h16v2H4zM4 8h16M6 12h12M8 16h8M10 20h4" stroke="#FF3008" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>No plans yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>Create plans like "Daily Milk", "Morning Tiffin" that customers can subscribe to.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plans.map(plan => {
            const planSubs = subs.filter(s => s.plan_id === plan.id)
            const activeSubs = planSubs.filter(s => s.status === 'active')
            return (
              <div key={plan.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden', opacity: plan.is_active ? 1 : 0.65 }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', margin: 0 }}>{plan.name}</p>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: plan.is_active ? 'rgba(22,163,74,.1)' : 'rgba(150,150,150,.1)', color: plan.is_active ? '#16a34a' : 'var(--text-3)' }}>
                          {plan.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      {plan.description && <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>{plan.description}</p>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#FF3008' }}>₹{plan.price}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>/delivery</span></span>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-2)', padding: '2px 9px', borderRadius: 999 }}>
                          {plan.delivery_time} · {plan.frequency}
                        </span>
                        <span style={{ fontSize: 12, color: activeSubs.length > 0 ? '#16a34a' : 'var(--text-3)', background: activeSubs.length > 0 ? 'rgba(22,163,74,.1)' : 'var(--bg-2)', padding: '2px 9px', borderRadius: 999, fontWeight: 700 }}>
                          {activeSubs.length} subscriber{activeSubs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => togglePlan(plan.id, plan.is_active)}
                        style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-1)', color: 'var(--text-3)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {plan.is_active ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => deletePlan(plan.id)}
                        style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.06)', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subscribers */}
                {activeSubs.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', background: 'var(--bg-1)' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Subscribers</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {activeSubs.map((s: any) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{s.customer?.name || '—'}</span>
                            {s.delivery_address && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 8 }}>{s.delivery_address}</span>}
                          </div>
                          {s.customer?.phone && (
                            <a href={`tel:${s.customer.phone}`} style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#16a34a', padding: '3px 10px', borderRadius: 8, textDecoration: 'none' }}>
                              Call
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ShopSettings ─────────────────────────────────────────────────────────────
function ShopSettings({ shop, onSaved }: { shop: any; onSaved: () => void }) {
  const [section, setSection] = useState<'info'|'hours'|'delivery'|'images'|'offers'>('info')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState('')
  const [err, setErr]         = useState('')
  const [copied, setCopied]   = useState(false)
  const [name, setName]             = useState(shop.name || '')
  const [description, setDesc]      = useState(shop.description || '')
  const [category, setCategory]     = useState(shop.category_name || '')
  const [phone, setPhone]           = useState(shop.phone || '')
  const [address, setAddress]       = useState(shop.address || '')
  const [area, setArea]             = useState(shop.area || '')
  const [openTime, setOpenTime]     = useState(shop.opening_time || '09:00')
  const [closeTime, setCloseTime]   = useState(shop.closing_time || '21:00')
  const [deliveryEnabled, setDelivery] = useState(shop.delivery_enabled ?? true)
  const [pickupEnabled, setPickup]     = useState(shop.pickup_enabled ?? true)
  const [minOrder, setMinOrder]        = useState(String(shop.min_order_amount || 0))
  const [avgTime, setAvgTime]          = useState(String(shop.avg_delivery_time || 30))
  const [deliveryFee, setDeliveryFee]  = useState(String(shop.delivery_fee || 0))
  const [offerText, setOfferText]        = useState(shop.offer_text || '')
  const [freeDeliveryAbove, setFreeD]    = useState(String(shop.free_delivery_above || ''))
  const [logoProgress, setLogoProg]      = useState(0)
  const [bannerProgress, setBannerProg]  = useState(0)
  const [imgError, setImgError]          = useState('')
  const sb = createClient()

  async function saveInfo() {
    if (!name.trim()) { setErr('Shop name is required'); return }
    setSaving(true); setErr('')
    try {
      await sb.from('shops').update({ name: name.trim(), description: description.trim() || null, category_name: category, phone: phone.trim() || null, address: address.trim() || null, area: area.trim() || null }).eq('id', shop.id)
      setSaved('info'); setTimeout(() => setSaved(''), 2200); onSaved()
    } catch(e) { setErr('Save failed — please try again') } finally { setSaving(false) }
  }
  async function saveHours() {
    setSaving(true)
    try {
      await sb.from('shops').update({ opening_time: openTime, closing_time: closeTime }).eq('id', shop.id)
      setSaved('hours'); setTimeout(() => setSaved(''), 2200); onSaved()
    } finally { setSaving(false) }
  }
  async function saveDelivery() {
    setSaving(true)
    try {
      await sb.from('shops').update({ delivery_enabled: deliveryEnabled, pickup_enabled: pickupEnabled, min_order_amount: parseInt(minOrder) || 0, avg_delivery_time: parseInt(avgTime) || 30, delivery_fee: parseInt(deliveryFee) || 0 }).eq('id', shop.id)
      setSaved('delivery'); setTimeout(() => setSaved(''), 2200); onSaved()
    } finally { setSaving(false) }
  }
  async function saveOffers() {
    setSaving(true)
    try {
      await sb.from('shops').update({ offer_text: offerText.trim() || null, free_delivery_above: freeDeliveryAbove ? parseInt(freeDeliveryAbove) : null }).eq('id', shop.id)
      setSaved('offers'); setTimeout(() => setSaved(''), 2200); onSaved()
    } finally { setSaving(false) }
  }
  async function handleImg(file: File, type: 'logo' | 'banner') {
    setImgError('')
    try {
      const { uploadShopImage } = await import('@/lib/imageService')
      const { url } = await uploadShopImage(file, shop.owner_id, type, type === 'logo' ? setLogoProg : setBannerProg)
      await sb.from('shops').update(type === 'logo' ? { image_url: url } : { banner_url: url }).eq('id', shop.id)
      onSaved()
    } catch(e: any) { setImgError(e.message || 'Upload failed') }
  }

  const shopUrl  = typeof window !== 'undefined' ? `${window.location.origin}/stores/${shop.id}` : `https://welokl.com/stores/${shop.id}`
  const waText   = encodeURIComponent(`Order from ${shop.name} on Welokl: ${shopUrl}`)
  const waLink   = `https://wa.me/?text=${waText}`
  const smsLink  = `sms:?body=${encodeURIComponent(`Order from ${shop.name}: ${shopUrl}`)}`
  async function copyLink() {
    try { await navigator.clipboard.writeText(shopUrl) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2200)
  }

  const sections = [
    { id: 'info',     icon: '🏪', label: 'Shop info'   },
    { id: 'hours',    icon: '🕐', label: 'Hours'        },
    { id: 'delivery', icon: '🛵', label: 'Delivery'     },
    { id: 'images',   icon: '🖼️', label: 'Images'       },
    { id: 'offers',   icon: '🏷️', label: 'Offers'       },
  ]
  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
  const SaveBtn = ({ id }: { id: string }) => (
    <button onClick={id === 'info' ? saveInfo : id === 'hours' ? saveHours : id === 'delivery' ? saveDelivery : saveOffers} disabled={saving}
      style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: saved === id ? '#16a34a' : '#FF3008', color: '#fff', fontWeight: 900, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', marginTop: 8, transition: 'background .2s' }}>
      {saving ? 'Saving…' : saved === id ? '✓ Saved!' : 'Save changes'}
    </button>
  )

  return (
    <div style={{ maxWidth: 520 }}>

      {/* ── Boost status ── */}
      {(() => {
        const boost = (shop as any).active_boost
        const planName   = boost?.plan?.name       ?? null
        const badgeColor = boost?.plan?.badge_color ?? '#6b7280'
        const endDate    = boost?.end_date          ?? null
        const daysLeft   = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0
        const isActive   = boost?.status === 'active' && daysLeft > 0
        return (
          <div style={{ background: isActive ? `${badgeColor}12` : 'var(--card-2)', border: `1.5px solid ${isActive ? badgeColor + '44' : 'var(--border)'}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <svg viewBox="0 0 16 16" fill="none" width={18} height={18}>
                <path d="M8 1l1.5 3.5L13 5.5l-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-1L8 1z" stroke={isActive ? badgeColor : 'var(--text-3)'} strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
              <div style={{ flex:1 }}>
                {isActive ? (
                  <>
                    <p style={{ fontSize:13, fontWeight:800, color: badgeColor }}>
                      {planName} Boost Active
                    </p>
                    <p style={{ fontSize:11, color:'var(--text-2)', marginTop:1 }}>
                      Your shop gets higher visibility · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>No active boost</p>
                    <p style={{ fontSize:11, color:'var(--text-2)', marginTop:1 }}>
                      Contact the Welokl team to boost your shop and appear at the top of the feed
                    </p>
                  </>
                )}
              </div>
              {isActive && (
                <div style={{ padding:'4px 10px', borderRadius:8, background: badgeColor, color:'#fff', fontSize:11, fontWeight:800, flexShrink:0 }}>
                  {planName}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Share your shop link ── */}
      <div style={{ background: 'rgba(37,211,102,.06)', border: '1.5px solid rgba(37,211,102,.25)', borderRadius: 16, padding: '16px', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#15803d', marginBottom: 3 }}>Share your shop link</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.55 }}>
          Send this to your existing customers via WhatsApp — they can order directly without calling you
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px', fontSize: 11, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            welokl.com/stores/{shop.id}
          </div>
          <button onClick={copyLink} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: copied ? '#16a34a' : '#111', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background .2s' }}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={waLink} target="_blank" rel="noreferrer"
            style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10, background: '#25D366', color: '#fff', fontWeight: 800, fontSize: 12, textDecoration: 'none', display: 'block' }}>
            WhatsApp
          </a>
          <a href={smsLink}
            style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: 10, background: 'rgba(59,130,246,.12)', color: '#3b82f6', fontWeight: 800, fontSize: 12, textDecoration: 'none', display: 'block' }}>
            SMS
          </a>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id as any)}
            style={{ padding: '8px 16px', borderRadius: 999, border: `1.5px solid ${section === s.id ? '#FF3008' : 'var(--border)'}`, background: section === s.id ? 'rgba(255,48,8,.07)' : 'var(--card-bg)', color: section === s.id ? '#FF3008' : 'var(--text-2)', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
      {err && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>⚠ {err}</div>}

      {section === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Shop name *</label><input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Your shop name" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Description</label><textarea value={description} onChange={e => setDesc(e.target.value)} rows={3} style={{ ...inp, resize: 'none' }} placeholder="What does your shop sell?" /></div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Category</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SHOP_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)}
                  style={{ padding: '7px 14px', borderRadius: 999, border: `1.5px solid ${category === cat ? '#FF3008' : 'var(--border)'}`, background: category === cat ? 'rgba(255,48,8,.08)' : 'var(--card-bg)', color: category === cat ? '#FF3008' : 'var(--text-2)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{cat}</button>
              ))}
            </div>
          </div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Phone number</label><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="10-digit number" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Address</label><input value={address} onChange={e => setAddress(e.target.value)} style={inp} placeholder="Shop no., building, street" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Area / locality</label><input value={area} onChange={e => setArea(e.target.value)} style={inp} placeholder="Bandra, Koramangala, etc." /></div>
          <SaveBtn id="info" />
        </div>
      )}

      {section === 'hours' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,48,8,.06)', border: '1px solid rgba(255,48,8,.15)', borderRadius: 14, padding: '14px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            <p style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>⏰ How automatic hours work</p>
            <p>• Your shop <strong>auto-opens</strong> at the opening time every day</p>
            <p>• Your shop <strong>auto-closes</strong> at the closing time every day</p>
            <p>• If you <strong>manually close</strong> during working hours, it stays closed until you reopen it or the closing time resets it for the next day</p>
          </div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Opening time</label><input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} style={inp} /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Closing time</label><input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} style={inp} /></div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⏰</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Current schedule</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{openTime} – {closeTime}</p>
              {(shop as any).manually_closed && (
                <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>⚠ Manually closed override active</p>
              )}
            </div>
          </div>
          <SaveBtn id="hours" />
        </div>
      )}

      {section === 'delivery' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: '🛵 Delivery', sub: 'Riders deliver to customers', val: deliveryEnabled, set: setDelivery },
            { label: '🏪 Pickup', sub: 'Customers come to your shop', val: pickupEnabled, set: setPickup },
          ].map(item => (
            <div key={item.label} onClick={() => item.set(!item.val)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--card-bg)', border: `1.5px solid ${item.val ? '#FF3008' : 'var(--border)'}`, borderRadius: 16, padding: '14px 16px', cursor: 'pointer', transition: 'border .2s' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{item.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.sub}</p>
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 999, background: item.val ? '#FF3008' : 'var(--bg-3)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 3, left: item.val ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
              </div>
            </div>
          ))}
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Minimum order amount (₹)</label><input type="number" value={minOrder} onChange={e => setMinOrder(e.target.value)} min="0" style={inp} placeholder="0 = no minimum" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Delivery fee (₹)</label><input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} min="0" style={inp} placeholder="0 = free delivery" /></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Avg delivery time (minutes)</label><input type="number" value={avgTime} onChange={e => setAvgTime(e.target.value)} min="5" max="120" style={inp} placeholder="e.g. 30" /></div>
          <SaveBtn id="delivery" />
        </div>
      )}

      {section === 'images' && (
        <div>
          {imgError && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>⚠ {imgError}</div>}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Shop logo <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>(square, shown in shop cards)</span></label>
            <div style={{ width: 160 }}><ImageUploader label="Upload logo" currentUrl={shop?.image_url || null} aspectRatio="1:1" progress={logoProgress} onUpload={(f: File) => handleImg(f, 'logo')} hint="Min 200×200px" /></div>
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Shop banner <span style={{ color: 'var(--text-4)', fontWeight: 500 }}>(wide, shown at top of store page)</span></label>
            <ImageUploader label="Upload banner" currentUrl={shop?.banner_url || null} aspectRatio="16:9" progress={bannerProgress} onUpload={(f: File) => handleImg(f, 'banner')} hint="Min 800×450px" />
          </div>
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
            Images are automatically compressed to WebP before upload. Max 300 KB per image.
          </div>
        </div>
      )}

      {section === 'offers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(255,48,8,.06)', border: '1px solid rgba(255,48,8,.15)', borderRadius: 14, padding: '14px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            🏷️ Offer badges show up on your shop card on the home screen — customers see them before tapping in.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Offer text</label>
            <input value={offerText} onChange={e => setOfferText(e.target.value)} maxLength={60} style={inp} placeholder="e.g. 20% off today · Free biryani above ₹300" />
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{offerText.length}/60</p>
          </div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Free delivery above (₹)</label><input type="number" value={freeDeliveryAbove} onChange={e => setFreeD(e.target.value)} min="0" style={inp} placeholder="e.g. 199 (leave empty to disable)" /></div>
          {(offerText || freeDeliveryAbove) && (
            <div style={{ background: 'var(--bg-2)', borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>Preview on shop card:</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {offerText && <span style={{ fontSize: 11, fontWeight: 800, color: '#FF3008', background: 'rgba(255,48,8,.1)', padding: '3px 10px', borderRadius: 8 }}>🏷️ {offerText}</span>}
                {freeDeliveryAbove && <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,.1)', padding: '3px 10px', borderRadius: 8 }}>🚚 Free above ₹{freeDeliveryAbove}</span>}
              </div>
            </div>
          )}
          <SaveBtn id="offers" />
        </div>
      )}
    </div>
  )
}

// ── PickupCodeVerifier ────────────────────────────────────────
function PickupCodeVerifier({ orderId, correctCode, mode = 'rider', onVerified }: { orderId: string; correctCode: string | null; mode?: 'customer' | 'rider'; onVerified: () => void }) {
  const [digits, setDigits]     = useState(['', '', '', ''])
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(false)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const isCustomer  = mode === 'customer'
  const confirmText = isCustomer ? '✅ Confirm & Complete Order' : '✅ Verify & Hand Over'
  const nextStatus  = isCustomer ? 'delivered' : 'picked_up'
  const logMsg      = isCustomer ? 'Pickup code verified by shop — customer collected order' : 'Pickup code verified by shop — handed to rider'

  function handleDigit(i: number, val: string) {
    const d = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]; next[i] = d; setDigits(next); setError('')
    if (d && i < 3) refs[i + 1].current?.focus()
    if (!d && i > 0) refs[i - 1].current?.focus()
  }

  async function verify() {
    const entered = digits.join('')
    if (entered.length < 4) { setError('Enter all 4 digits'); return }
    if (!correctCode) { setError('No code assigned yet'); return }
    if (entered !== correctCode) { setError('Wrong code. Please check again.'); return }
    setChecking(true)
    const sb = createClient()
    await sb.from('orders').update({ status: nextStatus, pickup_code: null }).eq('id', orderId)
    await sb.from('order_status_log').insert({ order_id: orderId, status: nextStatus, message: logMsg })
    const notifyType = nextStatus === 'delivered' ? 'order_delivered' : nextStatus === 'picked_up' ? 'order_picked_up' : null
    if (notifyType) {
      const { data: ord } = await sb.from('orders').select('customer_id, shop_id').eq('id', orderId).single()
      if (ord) fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ type: notifyType, order_id: orderId, customer_id: ord.customer_id, shop_id: ord.shop_id })
      }).catch(() => {})
    }
    setChecking(false); onVerified()
  }

  const filled = digits.join('').length === 4
  return (
    <div style={{ background: isCustomer ? 'rgba(59,130,246,0.08)' : 'var(--bg-1)', border: `2px solid ${isCustomer ? 'rgba(59,130,246,0.4)' : 'var(--brand)'}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>{isCustomer ? '🏪' : '🔐'}</span>
        <div>
          <p style={{ fontWeight: 900, fontSize: 13, color: 'var(--text)' }}>{isCustomer ? "Enter the customer's pickup code" : "Enter the rider's pickup code"}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{isCustomer ? 'The customer will show you a 4-digit code on their phone' : 'The delivery partner will show you a 4-digit code'}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
        {digits.map((d, i) => (
          <input key={i} ref={refs[i]} value={d} type="tel" inputMode="numeric" maxLength={1}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus() }}
            style={{ width: 52, height: 60, textAlign: 'center', fontSize: 28, fontWeight: 900, fontFamily: 'monospace', borderRadius: 12, border: `2px solid ${error ? '#ef4444' : d ? (isCustomer ? '#3b82f6' : 'var(--brand)') : 'var(--border-2)'}`, background: 'var(--card-bg)', color: 'var(--text)', outline: 'none', transition: 'border-color 0.15s', caretColor: 'transparent' }} />
        ))}
      </div>
      {error && <p style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textAlign: 'center', marginBottom: 10 }}>⚠️ {error}</p>}
      <button onClick={verify} disabled={checking || !filled}
        style={{ width: '100%', padding: '11px', borderRadius: 12, fontWeight: 900, fontSize: 14, border: 'none', cursor: filled ? 'pointer' : 'default', fontFamily: 'inherit', background: filled ? (isCustomer ? '#3b82f6' : '#16a34a') : 'var(--bg-3)', color: filled ? '#fff' : 'var(--text-4)', opacity: checking ? 0.7 : 1, boxShadow: filled ? `0 4px 12px ${isCustomer ? 'rgba(59,130,246,0.3)' : 'rgba(22,163,74,0.3)'}` : 'none', transition: 'all 0.2s' }}>
        {checking ? 'Verifying…' : confirmText}
      </button>
    </div>
  )
}

function AddProductModal({ shopId, userId, onClose, onSuccess }: { shopId: string; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', original_price: '', category: '', is_veg: '', is_available: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imgFiles, setImgFiles] = useState<(File | null)[]>([null, null])
  const [imgPreviews, setImgPreviews] = useState<(string | null)[]>([null, null])
  const [imgProgress, setImgProgress] = useState<number[]>([0, 0])
  const [existingCats, setExistingCats] = useState<string[]>([])
  function update(field: string, value: string | boolean) { setForm(p => ({ ...p, [field]: value })) }

  useEffect(() => {
    createClient().from('products').select('category').eq('shop_id', shopId).not('category', 'is', null)
      .then(({ data }) => {
        const cats = Array.from(new Set((data ?? []).map((r: any) => r.category).filter(Boolean))) as string[]
        setExistingCats(cats)
      })
  }, [shopId])
  function handleImgSelect(file: File, slot: 0 | 1) {
    const newFiles = [...imgFiles]; newFiles[slot] = file; setImgFiles(newFiles)
    const newPreviews = [...imgPreviews]; newPreviews[slot] = URL.createObjectURL(file); setImgPreviews(newPreviews)
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price required'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: product, error: err } = await supabase.from('products').insert({
      shop_id: shopId, name: form.name.trim(), description: form.description.trim() || null,
      price: parseInt(form.price), original_price: form.original_price ? parseInt(form.original_price) : null,
      category: form.category.trim() || null,
      is_veg: form.is_veg === 'veg' ? true : form.is_veg === 'nonveg' ? false : null,
      is_available: form.is_available,
    }).select('id').single()
    if (err || !product) { setError(err?.message || 'Failed to create product'); setLoading(false); return }
    const { uploadProductImage } = await import('@/lib/imageService')
    let image_url: string | null = null
    for (let i = 0; i < 2; i++) {
      if (imgFiles[i]) {
        try {
          const { url } = await uploadProductImage(imgFiles[i]!, userId, product.id, (i + 1) as 1 | 2, (pct: number) => setImgProgress(prev => { const n = [...prev]; n[i] = pct; return n }))
          if (i === 0) image_url = url
        } catch (uploadErr: any) {
          setError(`Image upload failed: ${uploadErr.message}. Product saved without image — you can re-upload from the edit screen.`)
          setLoading(false)
          onSuccess() // product was saved — just image failed
          return
        }
      }
    }
    if (image_url) {
      const { error: imgUpdateErr } = await supabase.from('products').update({ image_url }).eq('id', product.id)
      if (imgUpdateErr) setError(`Product saved but image link failed: ${imgUpdateErr.message}`)
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div style={{background:"var(--card-bg)", width:"100%", maxWidth:448, borderRadius:"16px 16px 0 0", maxHeight:"90vh", overflowY:"auto"}}>
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div style={{width:40, height:4, background:"var(--bg-3)", borderRadius:999}} /></div>
        <div style={{padding:"16px 20px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <h2 className="font-bold text-lg">Add Product</h2>
          <button onClick={onClose} style={{color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", fontSize:20, fontFamily:"inherit"}}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:6}}>Product name *</label><input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="input-field" placeholder="Butter Chicken, Amul Milk 1L..." required /></div>
          <div><label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:6}}>Description</label><textarea value={form.description} onChange={e => update('description', e.target.value)} className="input-field resize-none" rows={2} placeholder="Short description..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:6}}>Selling Price (₹) *</label><input type="number" value={form.price} onChange={e => update('price', e.target.value)} className="input-field" placeholder="199" min="0" required /></div>
            <div><label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:6}}>Original Price (₹)</label><input type="number" value={form.original_price} onChange={e => update('original_price', e.target.value)} className="input-field" placeholder="249" min="0" /></div>
          </div>
          <div>
            <label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:6}}>Category</label>
            {existingCats.length > 0 ? (
              <select value={existingCats.includes(form.category) ? form.category : form.category ? '__custom__' : ''} onChange={e => { if (e.target.value === '__custom__') update('category', ''); else update('category', e.target.value) }} className="input-field" style={{cursor:'pointer'}}>
                <option value="">-- Select category --</option>
                {existingCats.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom__">+ Add new category</option>
              </select>
            ) : null}
            {(existingCats.length === 0 || !existingCats.includes(form.category)) && (
              <input type="text" value={form.category} onChange={e => update('category', e.target.value)} className="input-field" placeholder="e.g. Starters, Main Course, Dairy…" style={{marginTop: existingCats.length > 0 ? 8 : 0}} />
            )}
          </div>
          <div>
            <label style={{display:"block", fontSize:13, fontWeight:700, color:"var(--text-2)", marginBottom:8}}>Type</label>
            <div className="flex gap-2">
              {[{ val: 'veg', label: '🟢 Veg' }, { val: 'nonveg', label: '🔴 Non-Veg' }, { val: '', label: 'N/A' }].map(o => (
                <button key={o.val} type="button" onClick={() => update('is_veg', o.val)}
                  style={{flex:1, padding:'8px 0', borderRadius:12, border:`2px solid ${form.is_veg===o.val?'#FF3008':'var(--border-2)'}`, fontSize:13, fontWeight:700, background:form.is_veg===o.val?'rgba(255,48,8,.08)':'transparent', color:form.is_veg===o.val?'#FF3008':'var(--text-2)', cursor:'pointer', fontFamily:'inherit', transition:'all .15s'}}>{o.label}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:12, background:"var(--bg-2)", borderRadius:12}}>
            <div><p className="font-semibold text-sm">Available to order</p><p style={{fontSize:11,color:"var(--text-3)"}}>Customers can add this to cart</p></div>
            <button type="button" onClick={() => update('is_available', !form.is_available)}
              style={{position:'relative', width:44, height:24, borderRadius:999, background:form.is_available?'#22c55e':'var(--bg-4)', border:'none', cursor:'pointer', transition:'background .2s'}}>
              <span style={{position:'absolute', top:2, left:2, width:16, height:16, borderRadius:'50%', background:'white', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'transform .2s', transform:form.is_available?'translateX(20px)':'none'}} />
            </button>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10 }}>Product Photos <span style={{ fontWeight: 500, color: 'var(--text-4)' }}>(optional, max 2)</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[0, 1].map(i => (
                <div key={i}><ImageUploader label={i === 0 ? 'Main photo' : 'Extra photo'} currentUrl={imgPreviews[i]} aspectRatio="1:1" progress={imgProgress[i]} onUpload={(file: File) => handleImgSelect(file, i as 0 | 1)} hint={i === 0 ? 'Primary image' : 'Optional 2nd image'} /></div>
              ))}
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">{loading ? 'Adding...' : 'Add product'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditProductModal({ product, userId, onClose, onSuccess }: { product: any; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: product.name || '', description: product.description || '',
    price: String(product.price || ''), original_price: String(product.original_price || ''),
    category: product.category || product.category_name || '',
    is_veg: product.is_veg === true ? 'veg' : product.is_veg === false ? 'nonveg' : '',
    is_available: product.is_available ?? true,
  })
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(product.image_url || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [existingCats, setExistingCats] = useState<string[]>([])

  useEffect(() => {
    createClient().from('products').select('category').eq('shop_id', product.shop_id).not('category', 'is', null)
      .then(({ data }) => {
        const cats = Array.from(new Set((data ?? []).map((r: any) => r.category).filter(Boolean))) as string[]
        setExistingCats(cats)
      })
  }, [product.shop_id])

  function handleImgSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImgFile(file); setImgPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name required'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price required'); return }
    setUploading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('products').update({
      name: form.name.trim(), description: form.description.trim() || null,
      price: parseInt(form.price), original_price: form.original_price ? parseInt(form.original_price) : null,
      category: form.category.trim() || null,
      is_veg: form.is_veg === 'veg' ? true : form.is_veg === 'nonveg' ? false : null,
      is_available: form.is_available,
    }).eq('id', product.id)
    if (err) { setError(err.message); setUploading(false); return }
    if (imgFile) {
      try {
        const { uploadProductImage } = await import('@/lib/imageService')
        const { url } = await uploadProductImage(imgFile, userId, product.id, 1, () => {})
        const { error: imgErr } = await supabase.from('products').update({ image_url: url }).eq('id', product.id)
        if (imgErr) setError(`Product saved but image link failed: ${imgErr.message}`)
      } catch (e: any) {
        setError(`Image upload failed: ${e.message}. Product saved — re-upload from edit screen.`)
        setUploading(false); onSuccess(); return
      }
    }
    setUploading(false); onSuccess()
  }

  const inp = { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text)', width: '100%', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>Edit Product</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>PRODUCT IMAGE</p>
            <label style={{ display: 'block', cursor: 'pointer' }}>
              <div style={{ width: '100%', height: 160, borderRadius: 14, border: '2px dashed var(--border)', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                {imgPreview ? <img src={imgPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 8 }}>📷</div><p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>Tap to add image</p></div>}
                {imgPreview && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .2s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.opacity = '1'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.opacity = '0'}>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Change image</span>
                </div>}
              </div>
              <input type="file" accept="image/*" onChange={handleImgSelect} style={{ display: 'none' }} />
            </label>
          </div>
          <input placeholder="Product name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
          <input placeholder="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input placeholder="Price ₹ *" type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} style={inp} />
            <input placeholder="Original ₹ (optional)" type="number" value={form.original_price} onChange={e => setForm(p => ({ ...p, original_price: e.target.value }))} style={inp} />
          </div>
          {existingCats.length > 0 ? (
            <select value={existingCats.includes(form.category) ? form.category : form.category ? '__custom__' : ''} onChange={e => { if (e.target.value === '__custom__') setForm(p => ({ ...p, category: '' })); else setForm(p => ({ ...p, category: e.target.value })) }} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">-- Select category --</option>
              {existingCats.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Add new category</option>
            </select>
          ) : null}
          {(existingCats.length === 0 || !existingCats.includes(form.category)) && (
            <input placeholder="e.g. Starters, Main Course, Dairy…" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp, marginTop: existingCats.length > 0 ? 8 : 0 }} />
          )}
          <select value={form.is_veg} onChange={e => setForm(p => ({ ...p, is_veg: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
            <option value="">Veg / Non-veg (optional)</option>
            <option value="veg">🟢 Veg</option>
            <option value="nonveg">🔴 Non-veg</option>
          </select>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={handleSave} disabled={uploading}
              style={{ flex: 2, padding: 13, borderRadius: 12, background: uploading ? 'var(--bg-4)' : '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', border: 'none' }}>
              {uploading ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}