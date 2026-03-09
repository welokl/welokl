'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import NotificationSetup from '@/components/NotificationSetup'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'

// ── Types ────────────────────────────────────────────────────────
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

// ── Haversine ────────────────────────────────────────────────────
function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const CATS = [
  {icon:'🍔',label:'Food',q:'food'},{icon:'🛒',label:'Grocery',q:'grocery'},
  {icon:'💊',label:'Pharmacy',q:'pharmacy'},{icon:'📱',label:'Electronics',q:'electronics'},
  {icon:'💇',label:'Salon',q:'salon'},{icon:'🔧',label:'Hardware',q:'hardware'},
  {icon:'🌸',label:'Gifts',q:'gifts'},{icon:'🐾',label:'Pets',q:'pet'},
]

const CAT_COLOR: Record<string,string> = {
  food:'#FF3008',grocery:'#00A878',pharmacy:'#0066FF',
  electronics:'#7B2FFF',salon:'#FF2D78',hardware:'#78716C',pet:'#FB923C',default:'#FF5A1F',
}
const CAT_ICON: Record<string,string> = {
  food:'🍔',grocery:'🛒',pharmacy:'💊',electronics:'📱',
  salon:'💇',hardware:'🔧',pet:'🐾',flower:'🌸',default:'🏪',
}

export default function CustomerHome() {
  const [user, setUser]                 = useState<User | null>(null)
  const [orders, setOrders]             = useState<Order[]>([])
  const [allShops, setAllShops]         = useState<Shop[]>([])
  const [products, setProducts]         = useState<Product[]>([])
  const [displayShops, setDisplayShops] = useState<(Shop & { km: number | null })[]>([])
  const [loading, setLoading]           = useState(true)
  const [shopsLoaded, setShopsLoaded]   = useState(false)
  const [locStatus, setLocStatus]       = useState<'idle'|'detecting'|'granted'|'denied'>('idle')
  const [userLat, setUserLat]           = useState<number | null>(null)
  const [userLng, setUserLng]           = useState<number | null>(null)
  const [areaName, setAreaName]         = useState('')
  const [radius, setRadius]             = useState(10)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchVal, setSearchVal]       = useState('')
  const [greeting, setGreeting]         = useState('Hey')
  const searchRef                       = useRef<HTMLInputElement>(null)

  useCustomerOrderAlerts(user?.id)

  // ── Load user + orders ─────────────────────────────────────
  const loadOrders = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }

    const role = authUser.user_metadata?.role || 'customer'
    if (role === 'shopkeeper' || role === 'business') { window.location.replace('/dashboard/business'); return }
    if (role === 'delivery') { window.location.replace('/dashboard/delivery'); return }
    if (role === 'admin')    { window.location.replace('/dashboard/admin'); return }

    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('orders')
        .select('*, shop:shops(name,category_name), items:order_items(*)')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setUser(profile); setOrders(orderData || []); setLoading(false)
  }, [])

  // ── Load shops + products ──────────────────────────────────
  const loadShops = useCallback(async () => {
    const supabase = createClient()
    const { data: shops } = await supabase.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false })
    setAllShops(shops || [])
    const { data: prods } = await supabase.from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name)')
      .eq('is_available', true).limit(20)
    setProducts((prods || []).map((p: any) => ({ ...p, shop_name: p.shops?.name })))
    setShopsLoaded(true)
  }, [])

  // ── Location ───────────────────────────────────────────────
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
        } catch {
          localStorage.setItem('welokl_location', JSON.stringify({ lat: latitude, lng: longitude, name: '' }))
        }
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
      if (saved?.lat && saved?.lng) { setUserLat(saved.lat); setUserLng(saved.lng); setAreaName(saved.name || ''); setLocStatus('granted'); return }
    } catch {}
    detectLocation()
  }, [loadOrders, loadShops])

  // ── Realtime orders ────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient()
    let customerId: string | null = null
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      customerId = u.id
      supabase.channel(`cust-rt-${u.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${u.id}` }, () => loadOrders())
        .subscribe()
    })
    return () => { if (customerId) createClient().channel(`cust-rt-${customerId}`).unsubscribe() }
  }, [loadOrders])

  // ── Filter shops ───────────────────────────────────────────
  useEffect(() => {
    let shops = allShops.map(s => ({
      ...s,
      km: (userLat && userLng && s.latitude && s.longitude)
        ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null,
    }))
    if (userLat && userLng) shops = shops.filter(s => s.km !== null && s.km <= radius)
    if (activeCategory)    shops = shops.filter(s => s.category_name?.toLowerCase().includes(activeCategory))
    if (searchVal.trim())  { const q = searchVal.toLowerCase(); shops = shops.filter(s => s.name.toLowerCase().includes(q) || s.area?.toLowerCase().includes(q) || s.category_name?.toLowerCase().includes(q)) }
    shops.sort((a, b) => { if (a.is_open !== b.is_open) return a.is_open ? -1 : 1; if (a.km !== null && b.km !== null) return a.km - b.km; return b.rating - a.rating })
    setDisplayShops(shops)
  }, [allShops, userLat, userLng, radius, activeCategory, searchVal])

  const activeOrders = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const pastOrders   = orders.filter(o =>  ['delivered','cancelled','rejected'].includes(o.status))
  const openShops    = displayShops.filter(s => s.is_open)
  const closedShops  = displayShops.filter(s => !s.is_open)
  const dealProducts = products.filter(p => p.original_price && p.original_price > p.price)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes pulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.6}}
        @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .shimmer{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:shimmer 1.4s infinite;}
        .shop-card{transition:transform .18s,box-shadow .18s;}
        .shop-card:hover{transform:translateY(-3px);box-shadow:0 12px 28px rgba(0,0,0,.13);}
        .no-scrollbar{scrollbar-width:none;-ms-overflow-style:none;}
        .no-scrollbar::-webkit-scrollbar{display:none;}
        .pill-btn{cursor:pointer;font-family:inherit;transition:all .15s;}
        .fade-in{animation:fadeIn .4s ease both;}
        .deal-badge{position:absolute;top:8px;left:8px;background:#22C55E;color:white;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px;z-index:2}
      `}</style>

      {/* ── TOP HEADER ─────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)', padding: '16px 16px 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Row 1: greeting + nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.4)', letterSpacing: '0.08em', marginBottom: 1 }}>{greeting.toUpperCase()}</p>
              <h1 style={{ fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                {user?.name?.split(' ')[0] || 'Welcome'} 👋
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href="/favourites" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 17 }}>❤️</Link>
              <Link href="/orders/history" style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', fontSize: 17 }}>📦</Link>
              <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
                style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.06)', border: 'none', cursor: 'pointer', fontSize: 17 }}>🚪</button>
            </div>
          </div>

          {/* Row 2: location + search */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={detectLocation} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: locStatus === 'granted' ? '#22C55E' : 'rgba(255,255,255,.6)', fontFamily: 'inherit', whiteSpace: 'nowrap', maxWidth: 130 }}>
              📍 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{locStatus === 'detecting' ? 'Locating…' : areaName || 'Set area'}</span>
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,.35)', pointerEvents: 'none' }}>🔍</span>
              <input ref={searchRef} value={searchVal} onChange={e => setSearchVal(e.target.value)}
                placeholder="Search shops, food, medicine…"
                style={{ width: '100%', padding: '9px 10px 9px 34px', background: 'rgba(255,255,255,.08)', border: '1.5px solid transparent', borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#fff', outline: 'none', fontFamily: 'inherit', transition: 'border-color .15s' }}
                onFocus={e => e.target.style.borderColor = '#FF3008'}
                onBlur={e => e.target.style.borderColor = 'transparent'} />
              {searchVal && <button onClick={() => setSearchVal('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 13 }}>✕</button>}
            </div>
          </div>
        </div>
      </div>

      {/* ── ACTIVE ORDER BANNER ─────────────────────────────── */}
      {activeOrders.length > 0 && (
        <div style={{ background: 'rgba(255,48,8,.1)', borderBottom: '1px solid rgba(255,48,8,.2)', padding: '10px 16px' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Link href={`/orders/${activeOrders[0].id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulseDot 2s infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#FF3008' }}>
                {activeOrders.length} active order{activeOrders.length > 1 ? 's' : ''} in progress
              </span>
              <span style={{ fontSize: 12, color: 'rgba(255,48,8,.7)', flex: 1 }}>
                — {(activeOrders[0] as any).shop?.name} · {ORDER_STATUS_ICONS[(activeOrders[0].status as keyof typeof ORDER_STATUS_ICONS)]} {ORDER_STATUS_LABELS[(activeOrders[0].status as keyof typeof ORDER_STATUS_LABELS)]}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#FF3008', flexShrink: 0 }}>Track →</span>
            </Link>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 16px' }}>

        {/* ── CATEGORY PILLS ─────────────────────────────────── */}
        <div style={{ padding: '14px 16px 0', position: 'sticky', top: 89, zIndex: 40, background: 'var(--bg)', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            <button onClick={() => setActiveCategory(null)} className="pill-btn"
              style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: !activeCategory ? '#FF3008' : 'var(--bg-3)', color: !activeCategory ? 'white' : 'var(--text-2)', border: 'none' }}>
              All
            </button>
            {CATS.map(c => (
              <button key={c.q} onClick={() => setActiveCategory(activeCategory === c.q ? null : c.q)} className="pill-btn"
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: activeCategory === c.q ? '#FF3008' : 'var(--bg-3)', color: activeCategory === c.q ? 'white' : 'var(--text-2)', border: 'none', whiteSpace: 'nowrap' }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── DEALS / TRENDING PRODUCTS ──────────────────────── */}
        {(dealProducts.length > 0 || products.length > 0) && !activeCategory && !searchVal && (
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {dealProducts.length > 0 ? '🔥 Deals right now' : '✨ Trending products'}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {dealProducts.length > 0 ? 'Best prices from local shops' : 'Most ordered today'}
                </p>
              </div>
            </div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {(dealProducts.length > 0 ? dealProducts : products).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* ── LOCATION RADIUS CHIPS ──────────────────────────── */}
        {locStatus === 'granted' && (
          <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Radius:</span>
            {[2, 5, 10, 20].map(r => (
              <button key={r} onClick={() => setRadius(r)} className="pill-btn"
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: radius === r ? '#FF3008' : 'var(--bg-3)', color: radius === r ? 'white' : 'var(--text-2)', border: 'none' }}>
                {r}km
              </button>
            ))}
          </div>
        )}

        {/* ── SHOPS SECTION ──────────────────────────────────── */}
        <div style={{ padding: '20px 16px 0' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                {searchVal ? `Results for "${searchVal}"` : activeCategory ? `${CATS.find(c=>c.q===activeCategory)?.label} near you` : locStatus === 'granted' ? `Open shops near ${areaName || 'you'}` : 'Shops near you'}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {shopsLoaded ? `${openShops.length} open · ${closedShops.length} closed` : 'Loading…'}
              </p>
            </div>
            <Link href="/stores" style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand)', textDecoration: 'none' }}>See all →</Link>
          </div>

          {/* Location denied */}
          {locStatus === 'denied' && (
            <div style={{ textAlign: 'center', padding: '36px 20px', background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📍</div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Allow location to see nearby shops</h3>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 20 }}>We only show shops in your area.</p>
              <button onClick={detectLocation} style={{ background: '#FF3008', border: 'none', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Enable location</button>
            </div>
          )}

          {/* Shop grid skeleton */}
          {!shopsLoaded && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px,100%), 1fr))', gap: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 220, borderRadius: 16 }} className="shimmer" />)}
            </div>
          )}

          {/* Open shops */}
          {shopsLoaded && openShops.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px,100%), 1fr))', gap: 12, marginBottom: openShops.length > 0 ? 20 : 0 }}>
              {openShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
            </div>
          )}

          {/* Empty state */}
          {shopsLoaded && displayShops.length === 0 && locStatus !== 'denied' && (
            <div style={{ textAlign: 'center', padding: '52px 20px', background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🏪</div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>No shops found</h3>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 16 }}>
                {locStatus === 'granted' ? `No shops within ${radius}km.` : 'Set your location first.'}
              </p>
              {locStatus === 'granted' && (
                <button onClick={() => setRadius(50)} style={{ background: '#FF3008', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Expand to 50km</button>
              )}
            </div>
          )}

          {/* Closed shops */}
          {shopsLoaded && closedShops.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-3)' }}>Closed now</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px,100%), 1fr))', gap: 12, marginBottom: 24 }}>
                {closedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} closed />)}
              </div>
            </>
          )}
        </div>

        {/* ── ORDERS SECTION ─────────────────────────────────── */}
        <div style={{ padding: '24px 16px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.02em' }}>Your Orders</h2>
            {orders.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>{orders.length} total</span>}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 76, borderRadius: 16 }} />)}
            </div>
          ) : orders.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🛍️</div>
              <p style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>No orders yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Pick a shop above and place your first order!</p>
              <button onClick={() => searchRef.current?.focus()} style={{ padding: '10px 28px', borderRadius: 12, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Find shops near me
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...activeOrders, ...pastOrders].map(o => <OrderCard key={o.id} order={o} active={activeOrders.includes(o)} />)}
            </div>
          )}
        </div>
      </div>

      {user?.id && <NotificationSetup userId={user.id} />}

      {/* ── BOTTOM NAV ──────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card-bg)', borderTop: '1px solid var(--border)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', maxWidth: 480, margin: '0 auto' }}>
          {[
            { icon: '🏠', label: 'Home',   href: '/dashboard/customer', active: true },
            { icon: '🛍️', label: 'Shops',  href: '/stores' },
            { icon: '❤️', label: 'Saved',  href: '/favourites' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer#orders' },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 16px', borderRadius: 12, textDecoration: 'none', color: item.active ? '#FF3008' : 'var(--text-3)' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SHOP CARD ────────────────────────────────────────────────────
function ShopCard({ shop, index, closed }: { shop: Shop & { km: number | null }; index: number; closed?: boolean }) {
  const catKey = Object.keys(CAT_ICON).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'
  const accent = CAT_COLOR[catKey] || CAT_COLOR.default

  return (
    <Link href={`/stores/${shop.id}`} style={{ textDecoration: 'none' }}>
      <div className="shop-card fade-in" style={{ background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)', opacity: closed ? 0.65 : 1, animationDelay: `${index * 30}ms`, animationFillMode: 'both' }}>
        <div style={{ height: 130, position: 'relative', overflow: 'hidden', background: `${accent}14`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {shop.image_url ? (
            <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 48, opacity: 0.3 }}>{CAT_ICON[catKey]}</span>
          )}
          {shop.image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.45) 0%, transparent 55%)' }} />}
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            {shop.is_open
              ? <span style={{ background: 'rgba(22,197,94,.95)', color: 'white', fontWeight: 700, fontSize: 10, padding: '3px 7px', borderRadius: 999 }}>● Open</span>
              : <span style={{ background: 'rgba(0,0,0,.55)', color: 'rgba(255,255,255,.7)', fontWeight: 600, fontSize: 10, padding: '3px 7px', borderRadius: 999 }}>Closed</span>}
          </div>
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', borderRadius: 7, padding: '3px 7px', fontSize: 11, fontWeight: 800, color: '#FFB800', display: 'flex', alignItems: 'center', gap: 2 }}>
            ★ {shop.rating?.toFixed(1)}
          </div>
          {shop.km !== null && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)', borderRadius: 7, padding: '3px 7px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>
              📍 {shop.km < 1 ? `${Math.round(shop.km*1000)}m` : `${shop.km.toFixed(1)}km`}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 12px 10px' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.description || `${shop.category_name?.split(' ')[0]} · ${shop.area}`}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>{shop.delivery_enabled ? `🛵 ${shop.avg_delivery_time}m` : '🏃 Pickup'}</span>
            <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>{shop.min_order_amount > 0 ? `₹${shop.min_order_amount}+` : 'No min'}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── PRODUCT CARD ─────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null

  return (
    <Link href={`/stores/${product.shop_id}`} style={{ textDecoration: 'none' }}>
      <div className="shop-card" style={{ flexShrink: 0, width: 148, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ height: 110, background: 'var(--bg-3)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 36, opacity: 0.25 }}>🍽️</span>}
          {disc && <div className="deal-badge">-{disc}%</div>}
        </div>
        <div style={{ padding: '10px 11px 12px' }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
          {product.shop_name && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.shop_name}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#FF3008' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize: 11, color: 'var(--text-4)', textDecoration: 'line-through' }}>₹{product.original_price}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── ORDER CARD ───────────────────────────────────────────────────
function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  return (
    <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--card-bg)', border: `${active ? '2px solid #FF3008' : '1px solid var(--border)'}`, borderRadius: 16, padding: '14px 16px', transition: 'all .15s' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{(order as any).shop?.name || 'Shop'}</p>
              {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {order.items?.length || 0} item{(order.items?.length||0)!==1?'s':''} · ₹{order.total_amount} · #{order.order_number}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {order.payment_method==='cod'?'💵 COD':'📲 UPI'} · {order.type==='delivery'?'🛵 Delivery':'🏪 Pickup'}
            </p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0, background: active ? 'rgba(255,48,8,.12)' : 'var(--bg-3)', color: active ? '#FF3008' : 'var(--text-2)' }}>
            {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
        </div>
      </div>
    </Link>
  )
}