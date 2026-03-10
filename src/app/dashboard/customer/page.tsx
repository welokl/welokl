'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useFCM } from '@/hooks/useFCM'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import NotificationSetup from '@/components/NotificationSetup'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'
import ThemeToggle from '@/components/ThemeToggle'

// ── Types ──────────────────────────────────────────────────────────
interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; latitude: number | null; longitude: number | null
}
interface Product {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; shop_id: string; shop_name?: string
}

// ── Haversine ──────────────────────────────────────────────────────
function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ── Category config ────────────────────────────────────────────────
const CATS = [
  { icon:'🍔', label:'Food',        q:'food',        grad:'linear-gradient(135deg,#FF3008,#ff6b35)' },
  { icon:'🛒', label:'Grocery',     q:'grocery',     grad:'linear-gradient(135deg,#00b874,#00d68f)' },
  { icon:'💊', label:'Pharmacy',    q:'pharmacy',    grad:'linear-gradient(135deg,#2563eb,#60a5fa)' },
  { icon:'📱', label:'Electronics', q:'electronics', grad:'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { icon:'💇', label:'Salon',       q:'salon',       grad:'linear-gradient(135deg,#db2777,#f472b6)' },
  { icon:'🔧', label:'Hardware',    q:'hardware',    grad:'linear-gradient(135deg,#b45309,#fbbf24)' },
  { icon:'🌸', label:'Gifts',       q:'gifts',       grad:'linear-gradient(135deg,#0891b2,#67e8f9)' },
  { icon:'🐾', label:'Pets',        q:'pet',         grad:'linear-gradient(135deg,#ea580c,#fb923c)' },
]
const CAT_ICON_MAP: Record<string,string> = {
  food:'🍔',grocery:'🛒',pharmacy:'💊',electronics:'📱',salon:'💇',hardware:'🔧',pet:'🐾',flower:'🌸',default:'🏪',
}
const CAT_COLOR_MAP: Record<string,string> = {
  food:'#FF3008',grocery:'#00b874',pharmacy:'#2563eb',electronics:'#7c3aed',salon:'#db2777',hardware:'#b45309',pet:'#ea580c',default:'#FF5A1F',
}
const PROMISES = [
  { icon:'⚡', text:'Under 30 min delivery' },
  { icon:'🏪', text:'500+ local shops' },
  { icon:'💳', text:'UPI & Cash accepted' },
  { icon:'📍', text:'Hyperlocal, real riders' },
]

export default function CustomerHome() {
  const [user, setUser]                     = useState<User | null>(null)
  useFCM(user?.id ?? null)
  const [orders, setOrders]                 = useState<Order[]>([])
  const [allShops, setAllShops]             = useState<Shop[]>([])
  const [products, setProducts]             = useState<Product[]>([])
  const [displayShops, setDisplayShops]     = useState<(Shop & { km: number | null })[]>([])
  const [loading, setLoading]               = useState(true)
  const [shopsLoaded, setShopsLoaded]       = useState(false)
  const [locStatus, setLocStatus]           = useState<'idle'|'detecting'|'granted'|'denied'>('idle')
  const [userLat, setUserLat]               = useState<number | null>(null)
  const [userLng, setUserLng]               = useState<number | null>(null)
  const [areaName, setAreaName]             = useState('')
  const [radius, setRadius]                 = useState(10)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchVal, setSearchVal]           = useState('')
  const [greeting, setGreeting]             = useState('Hey')
  const searchRef                           = useRef<HTMLInputElement>(null)

  useCustomerOrderAlerts(user?.id)

  const loadOrders = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }
    const role = authUser.user_metadata?.role || 'customer'
    if (role === 'shopkeeper' || role === 'business') { window.location.replace('/dashboard/business'); return }
    if (role === 'delivery') { window.location.replace('/dashboard/delivery'); return }
    if (role === 'admin')    { window.location.replace('/dashboard/admin');    return }
    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('orders')
        .select('*, shop:shops(name,category_name), items:order_items(*)')
        .eq('customer_id', authUser.id).order('created_at', { ascending: false }).limit(20),
    ])
    setUser(profile); setOrders(orderData || []); setLoading(false)
  }, [])

  const loadShops = useCallback(async () => {
    const supabase = createClient()
    const { data: shops } = await supabase.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false })
    setAllShops(shops || [])
    setShopsLoaded(true)
  }, [])

  // Load products only from shops visible after location filter
  const loadLocalProducts = useCallback(async (shopIds: string[]) => {
    if (shopIds.length === 0) { setProducts([]); return }
    const supabase = createClient()
    const { data: prods } = await supabase.from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name)')
      .in('shop_id', shopIds.slice(0, 50))   // Supabase IN limit safety
      .eq('is_available', true)
      .order('original_price', { ascending: false })
      .limit(24)
    setProducts((prods || []).map((p: any) => ({ ...p, shop_name: p.shops?.name })))
  }, [])

  function detectLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setUserLat(latitude); setUserLng(longitude); setLocStatus('granted')
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`, { headers: { 'Accept-Language': 'en' } })
          const d = await r.json()
          const name = d.address?.suburb || d.address?.neighbourhood || d.address?.town || d.address?.city || 'Your area'
          setAreaName(name)
          localStorage.setItem('welokl_location', JSON.stringify({ lat: latitude, lng: longitude, name }))
        } catch { localStorage.setItem('welokl_location', JSON.stringify({ lat: latitude, lng: longitude, name: '' })) }
      },
      () => setLocStatus('denied'),
      { timeout: 8000, enableHighAccuracy: false }
    )
  }

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    loadOrders(); loadShops()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat && saved?.lng) {
        setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted')
        if (saved.name) {
          setAreaName(saved.name)
          return
        }
        // Have coords but no name — reverse geocode silently
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${saved.lat}&lon=${saved.lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json())
          .then(d => {
            const name = d.address?.suburb || d.address?.neighbourhood || d.address?.town || d.address?.city || ''
            if (name) {
              setAreaName(name)
              localStorage.setItem('welokl_location', JSON.stringify({ lat: saved.lat, lng: saved.lng, name }))
            }
          }).catch(() => {})
        return
      }
    } catch {}
    detectLocation()
  }, [loadOrders, loadShops])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      supabase.channel(`cust-rt-${u.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${u.id}` }, () => loadOrders())
        .subscribe()
    })
  }, [loadOrders])

  useEffect(() => {
    let shops = allShops.map(s => ({
      ...s,
      km: (userLat && userLng && s.latitude && s.longitude) ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null,
    }))
    if (userLat && userLng) shops = shops.filter(s => s.km !== null && s.km <= radius)
    if (activeCategory)     shops = shops.filter(s => s.category_name?.toLowerCase().includes(activeCategory))
    if (searchVal.trim()) { const q = searchVal.toLowerCase(); shops = shops.filter(s => s.name.toLowerCase().includes(q) || s.area?.toLowerCase().includes(q) || s.category_name?.toLowerCase().includes(q)) }
    shops.sort((a, b) => { if (a.is_open !== b.is_open) return a.is_open ? -1 : 1; if (a.km !== null && b.km !== null) return a.km - b.km; return b.rating - a.rating })
    setDisplayShops(shops)
    // Only load products from nearby shops — don't show random city products when location unknown
    if (locStatus === 'granted' && userLat && userLng) {
      const openShopIds = shops.filter(s => s.is_open).map(s => s.id)
      loadLocalProducts(openShopIds.length > 0 ? openShopIds : shops.map(s => s.id))
    } else if (locStatus === 'denied') {
      // Location denied — load from all shops as fallback
      const openShopIds = shops.filter(s => s.is_open).map(s => s.id)
      loadLocalProducts(openShopIds.slice(0, 20))
    }
    // If locStatus is 'idle' or 'detecting' — wait, show nothing until we know location
  }, [allShops, userLat, userLng, radius, activeCategory, searchVal, locStatus, loadLocalProducts])

  const activeOrders     = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const pastOrders       = orders.filter(o =>  ['delivered','cancelled','rejected'].includes(o.status))
  const openShops        = displayShops.filter(s => s.is_open)
  const closedShops      = displayShops.filter(s => !s.is_open)
  const dealProducts     = products.filter(p => p.original_price && p.original_price > p.price)
  const featuredProducts = dealProducts.length > 0 ? dealProducts : products

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:72 }}>

      {/* ══ STICKY HEADER ════════════════════════════════════════ */}
      <div className="cd-header">
        <div className="cd-header-inner">
          {/* Location + nav icons */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button className="cd-loc-btn" onClick={detectLocation}>
              <span style={{ fontSize:16 }}>📍</span>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', letterSpacing:'0.06em' }}>
                  {locStatus === 'detecting' ? 'DETECTING…' : locStatus === 'granted' && areaName ? areaName.toUpperCase().slice(0,12) : 'DELIVER TO'}
                </div>
                <div style={{ fontSize:15, fontWeight:900, color:'var(--text)', lineHeight:1.2, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {areaName || (locStatus === 'detecting' ? 'Detecting…' : 'Set your area')} <span style={{ fontSize:11, fontWeight:500 }}>▾</span>
                </div>
              </div>
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Link href="/favourites"   style={{ width:36, height:36, borderRadius:10, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:18 }}>❤️</Link>
              <Link href="/orders/history" style={{ width:36, height:36, borderRadius:10, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:18 }}>📦</Link>
              <ThemeToggle />
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--text-3)', pointerEvents:'none' }}>🔍</span>
            <input
              ref={searchRef} value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder={`Search shops, food, medicine in ${areaName || 'your area'}…`}
              className="cd-search" style={{ paddingLeft:38 }}
            />
            {searchVal && (
              <button onClick={() => setSearchVal('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center' }}>✕</button>
            )}
          </div>
        </div>

        {/* Greeting strip */}
        <div style={{ background:'var(--bg-1)', borderTop:'1px solid var(--border)', padding:'8px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>
            {greeting}, <span style={{ color:'var(--text)', fontWeight:800 }}>{user?.name?.split(' ')[0] || 'there'}</span> 👋
          </p>
          <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
            style={{ fontSize:11, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            Sign out
          </button>
        </div>
      </div>

      {/* ══ PROMISE TICKER ═══════════════════════════════════════ */}
      <div className="cd-promise">
        {PROMISES.map((p, i) => (
          <div key={i} className="cd-promise-pill">
            <span style={{ fontSize:14 }}>{p.icon}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-2)' }}>{p.text}</span>
            {i < PROMISES.length - 1 && <span style={{ marginLeft:16, width:1, height:12, background:'var(--border)', display:'inline-block', flexShrink:0 }} />}
          </div>
        ))}
      </div>

      {/* ══ ACTIVE ORDER BANNER ══════════════════════════════════ */}
      {activeOrders.length > 0 && (
        <div className="cd-active-order">
          <div style={{ maxWidth:980, margin:'0 auto', padding:'0 clamp(16px,4vw,40px)' }}>
            <Link href={`/orders/${activeOrders[0].id}`} style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#22C55E', display:'inline-block', animation:'cdPulse 1.8s infinite', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#FF3008' }}>
                  {activeOrders.length} active order{activeOrders.length > 1 ? 's' : ''} in progress
                </span>
                <span style={{ fontSize:12, color:'rgba(255,48,8,.65)', marginLeft:6 }}>
                  — {(activeOrders[0] as any).shop?.name}
                </span>
              </div>
              <span style={{ fontSize:12, fontWeight:800, color:'#FF3008', flexShrink:0, background:'rgba(255,48,8,.12)', padding:'4px 10px', borderRadius:8 }}>Track →</span>
            </Link>
          </div>
        </div>
      )}

      {/* ══ CATEGORY GRID ════════════════════════════════════════ */}
      {!searchVal && (
        <div className="cd-cat-grid">
          {CATS.map(cat => (
            <button
              key={cat.q}
              onClick={() => setActiveCategory(activeCategory === cat.q ? null : cat.q)}
              className={`cd-cat-card${activeCategory === cat.q ? ' active' : ''}`}
              style={{
                background: activeCategory === cat.q ? cat.grad : 'var(--card-bg)',
                border: `2px solid ${activeCategory === cat.q ? 'transparent' : 'var(--border)'}`,
              }}
            >
              <span style={{ fontSize:30, lineHeight:1, filter: activeCategory && activeCategory !== cat.q ? 'grayscale(0.6)' : 'none', transition:'filter .15s' }}>{cat.icon}</span>
              <span style={{ fontSize:11, fontWeight:800, color: activeCategory === cat.q ? '#fff' : 'var(--text-2)', letterSpacing:'0.01em', lineHeight:1.2 }}>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ══ PROMO BANNER ═════════════════════════════════════════ */}
      {!searchVal && !activeCategory && (
        <div style={{ maxWidth:980, margin:'18px auto 0', padding:'0 clamp(16px,4vw,40px)' }}>
          <div className="cd-promo">
            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,120,80,.8)', letterSpacing:'0.1em', marginBottom:6 }}>WELOKL PROMISE</div>
              <div style={{ fontSize:24, fontWeight:900, color:'var(--text)', letterSpacing:'-0.03em', lineHeight:1.1 }}>
                Delivered in<br /><span style={{ color:'#FF3008' }}>under 30 min</span> 🚀
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:10 }}>Real riders. Real local shops. No dark kitchens.</div>
            </div>
            <span style={{ fontSize:72, lineHeight:1, filter:'drop-shadow(0 4px 20px rgba(255,48,8,.35))', flexShrink:0 }}>🛵</span>
            {/* Decorative circles */}
            <div style={{ position:'absolute', top:-24, right:-24, width:90, height:90, borderRadius:'50%', background:'rgba(255,48,8,.08)', pointerEvents:'none' }} />
            <div style={{ position:'absolute', bottom:-16, left:180, width:52, height:52, borderRadius:'50%', background:'rgba(255,48,8,.06)', pointerEvents:'none' }} />
          </div>
        </div>
      )}

      {/* ══ DEALS / PRODUCTS ROW ═════════════════════════════════ */}
      {!activeCategory && (
        <div className="cd-section">
          <div className="cd-section-head">
            <div>
              <div className="cd-section-title">{dealProducts.length > 0 ? '🔥 Deals right now' : '✨ Top products'}</div>
              <div className="cd-section-sub">{dealProducts.length > 0 ? 'Best prices from local shops' : 'Most ordered near you'}</div>
            </div>
            <Link href="/stores" className="cd-see-all">See all →</Link>
          </div>

          {products.length === 0 ? (
            <div className="cd-scroll" style={{ display:'flex', gap:12, paddingBottom:4 }}>
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="cd-shimmer" style={{ flexShrink:0, width:152, height:190 }} />)}
            </div>
          ) : (
            <div className="cd-scroll" style={{ display:'flex', gap:12, paddingBottom:4 }}>
              {featuredProducts.slice(0, 12).map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ══ RADIUS CHIPS ═════════════════════════════════════════ */}
      {locStatus === 'granted' && (
        <div className="cd-radius-row">
          <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:700 }}>Radius:</span>
          {[2, 5, 10, 20].map(r => (
            <button key={r} onClick={() => setRadius(r)} className={`cd-radius-chip${radius === r ? ' on' : ''}`}>{r}km</button>
          ))}
        </div>
      )}

      {/* ══ SHOPS ════════════════════════════════════════════════ */}
      <div className="cd-section">
        <div className="cd-section-head">
          <div>
            <div className="cd-section-title">
              {searchVal ? `Results for "${searchVal}"` : activeCategory ? `${CATS.find(c => c.q === activeCategory)?.icon} ${CATS.find(c => c.q === activeCategory)?.label} near you` : locStatus === 'granted' ? `Open near ${areaName || 'you'}` : 'Shops near you'}
            </div>
            <div className="cd-section-sub">
              {shopsLoaded ? `${openShops.length} open - ${closedShops.length} closed` : 'Loading shops…'}
            </div>
          </div>
          <Link href="/stores" className="cd-see-all">Map view →</Link>
        </div>

        {locStatus === 'denied' && (
          <div className="cd-empty">
            <div className="cd-empty-icon">📍</div>
            <div className="cd-empty-title">Allow location</div>
            <div className="cd-empty-sub">We only show shops in your neighbourhood</div>
            <button onClick={detectLocation} style={{ background:'#FF3008', border:'none', borderRadius:12, padding:'11px 26px', fontSize:14, fontWeight:800, color:'white', cursor:'pointer', fontFamily:'inherit' }}>Enable location</button>
          </div>
        )}

        {!shopsLoaded && (
          <div className="cd-shop-row">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="cd-shimmer" style={{ height:100, borderRadius:18 }} />)}
          </div>
        )}

        {shopsLoaded && openShops.length > 0 && (
          <div className="cd-shop-row" style={{ marginBottom: closedShops.length > 0 ? 24 : 0 }}>
            {openShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
          </div>
        )}

        {shopsLoaded && displayShops.length === 0 && locStatus !== 'denied' && (
          <div className="cd-empty">
            <div className="cd-empty-icon">🏪</div>
            <div className="cd-empty-title">No shops found</div>
            <div className="cd-empty-sub">{locStatus === 'granted' ? `No shops within ${radius}km.` : 'Set your location first.'}</div>
            {locStatus === 'granted' && (
              <button onClick={() => setRadius(50)} style={{ background:'#FF3008', border:'none', borderRadius:12, padding:'10px 24px', fontSize:14, fontWeight:800, color:'white', cursor:'pointer', fontFamily:'inherit' }}>Expand to 50km</button>
            )}
          </div>
        )}

        {shopsLoaded && closedShops.length > 0 && (
          <>
            <div className="cd-divider">
              <div className="cd-divider-line" />
              <span className="cd-divider-label">CLOSED NOW — {closedShops.length}</span>
              <div className="cd-divider-line" />
            </div>
            <div className="cd-shop-row" style={{ opacity:0.6, marginBottom:24 }}>
              {closedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} closed />)}
            </div>
          </>
        )}
      </div>


      {user?.id && <NotificationSetup userId={user.id} />}

      {/* ══ BOTTOM NAV ═══════════════════════════════════════════ */}
      <div className="cd-bottom-nav">
        <div className="cd-bottom-nav-inner">
          {[
            { icon:'🏠', label:'Home',   href:'/dashboard/customer', on:true  },
            { icon:'🛍️', label:'Shops',  href:'/stores',              on:false },
            { icon:'❤️', label:'Saved',  href:'/favourites',           on:false },
            { icon:'📦', label:'Orders', href:'/orders/history',       on:false },
          ].map(item => (
            <Link key={item.label} href={item.href} className={`cd-nav-item${item.on ? ' on' : ''}`}>
              <span style={{ fontSize:23, lineHeight:1 }}>{item.icon}</span>
              <span style={{ fontSize:11, fontWeight:800, marginTop:2, letterSpacing:'0.01em' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══ SHOP CARD — horizontal list style (Blinkit-inspired) ══════════
function ShopCard({ shop, index, closed }: { shop: Shop & { km: number | null }; index: number; closed?: boolean }) {
  const catKey  = Object.keys(CAT_ICON_MAP).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'
  const bgColor = `${CAT_COLOR_MAP[catKey]}18`
  const catIcon = CAT_ICON_MAP[catKey]

  return (
    <Link href={`/stores/${shop.id}`} className="cd-shop-card cd-fade" style={{ animationDelay:`${index * 25}ms` }}>
      <div className="cd-shop-img-wrap" style={{ background: bgColor }}>
        {shop.image_url
          ? <img src={shop.image_url} alt={shop.name} className="cd-shop-img" />
          : <div className="cd-shop-no-img">{catIcon}</div>
        }
        <div style={{ position:'absolute', bottom:7, left:7 }}>
          {shop.is_open
            ? <span style={{ background:'rgba(22,163,74,.92)', color:'var(--text)', fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:6 }}>● OPEN</span>
            : <span style={{ background:'rgba(0,0,0,.6)', color:'rgba(255,255,255,.55)', fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:6 }}>CLOSED</span>
          }
        </div>
      </div>
      <div className="cd-shop-body">
        <div className="cd-shop-name">{shop.name}</div>
        <div className="cd-shop-desc">{shop.description || `${shop.category_name?.split(' ')[0]} - ${shop.area}`}</div>
        <div className="cd-shop-meta">
          <span className="cd-shop-pill">⏱ {shop.avg_delivery_time}min</span>
          {shop.min_order_amount > 0 && <span className="cd-shop-pill">₹{shop.min_order_amount} min</span>}
          {shop.delivery_enabled && <span className="cd-shop-pill">🛵 Delivery</span>}
          {shop.pickup_enabled   && <span className="cd-shop-pill">🏪 Pickup</span>}
        </div>
      </div>
      <div className="cd-shop-right">
        <div className="cd-shop-rating">★ {shop.rating?.toFixed(1) || '4.0'}</div>
        {shop.km !== null && (
          <div className="cd-shop-dist">{shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`}</div>
        )}
      </div>
    </Link>
  )
}

// ══ PRODUCT CARD — with + button ══════════════════════════════════
function ProductCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null

  return (
    <Link href={`/stores/${product.shop_id}`} style={{ textDecoration:'none' }}>
      <div className="cd-prod-card">
        <div style={{ position:'relative' }}>
          <div className="cd-prod-no-img" style={{ position:'absolute', inset:0 }}><span style={{ fontSize:38, opacity:.15 }}>🍽️</span></div>
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="cd-prod-img" style={{ position:'relative', zIndex:1 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.opacity='0' }} />
          )}
          {disc && <div className="cd-disc-badge">-{disc}%</div>}
        </div>
        <div className="cd-prod-body">
          <div className="cd-prod-name">{product.name}</div>
          {product.shop_name && <div className="cd-prod-shop">{product.shop_name}</div>}
          <div className="cd-prod-footer">
            <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
              <span className="cd-prod-price">₹{product.price}</span>
              {product.original_price && <span className="cd-prod-mrp">₹{product.original_price}</span>}
            </div>
            <button className="cd-prod-add" onClick={e => { e.preventDefault(); window.location.href = `/stores/${product.shop_id}` }}>+</button>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ══ ORDER CARD ════════════════════════════════════════════════════
function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  return (
    <Link href={`/orders/${order.id}`} className={`cd-order-card${active ? ' live' : ''}`}>
      {active && (
        <div className="cd-order-live-bar">
          <span style={{ width:7, height:7, borderRadius:'50%', background:'rgba(255,255,255,.9)', display:'inline-block', animation:'cdPulse 1.8s infinite' }} />
          <span style={{ fontSize:11, fontWeight:800, color:'white', letterSpacing:'0.04em' }}>LIVE</span>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.75)', marginLeft:4 }}>
            {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
          <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color:'var(--text)' }}>Tap to track →</span>
        </div>
      )}
      <div className="cd-order-body">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:800, fontSize:14, color:'var(--text)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(order as any).shop?.name || 'Shop'}</p>
            <p style={{ fontSize:12, color:'var(--text-3)' }}>{order.items?.length || 0} item{(order.items?.length||0)!==1?'s':''} - ₹{order.total_amount} - #{order.order_number}</p>
            <p style={{ fontSize:11, color:'var(--text-4)', marginTop:2 }}>{order.payment_method==='cod'?'💵 Cash':'📲 UPI'} - {order.type==='delivery'?'🛵 Delivery':'🏪 Pickup'}</p>
          </div>
          {!active && (
            <span style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:999, flexShrink:0, background:'var(--bg-3)', color:'var(--text-2)' }}>
              {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}