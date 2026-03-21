'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useFCM } from '@/hooks/useFCM'
import { useCart } from '@/store/cart'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'
import ThemeToggle from '@/components/ThemeToggle'
import { PhoneGate } from '@/components/PhoneGate'
import InAppToast from '@/components/InAppToast'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; latitude: number | null; longitude: number | null
  offer_text?: string | null; free_delivery_above?: number | null
}
interface Product {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; shop_id: string; shop_name?: string
}

function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Category SVG icons
const CAT_SVG: Record<string, JSX.Element> = {
  food:        <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  grocery:     <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pharmacy:    <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  electronics: <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  salon:       <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M3.51 8.51L10 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  hardware:    <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  gifts:       <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pet:         <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.057-3.5 4 0 .75.562 1.931 1 2.5M14 5.172C14 3.782 15.577 2.679 17.5 3c2 .336 3.5 2.057 3.5 4 0 .75-.562 1.931-1 2.5M12 19c-4 0-7-1.5-7-5 0-2 1-3.5 3.5-4.5M12 19c4 0 7-1.5 7-5 0-2-1-3.5-3.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
}

const CATS = [
  { label:'Food',        q:'food',        bg:'var(--red-light)',    color:'#FF3008' },
  { label:'Grocery',     q:'grocery',     bg:'var(--green-light)',  color:'#16a34a' },
  { label:'Pharmacy',    q:'pharmacy',    bg:'var(--blue-light)',   color:'#4f46e5' },
  { label:'Electronics', q:'electronics', bg:'var(--purple-light)', color:'#7c3aed' },
  { label:'Salon',       q:'salon',       bg:'var(--pink-light)',   color:'#db2777' },
  { label:'Hardware',    q:'hardware',    bg:'var(--yellow-light)', color:'#d97706' },
  { label:'Gifts',       q:'gifts',       bg:'var(--purple-light)', color:'#7c3aed' },
  { label:'Pets',        q:'pet',         bg:'var(--orange-light)', color:'#ea580c' },
]

const CAT_COLOR: Record<string,string> = {
  food:'#FF3008', grocery:'#16a34a', pharmacy:'#4f46e5',
  electronics:'#7c3aed', salon:'#db2777', hardware:'#d97706', pet:'#ea580c', default:'#FF3008',
}
const CAT_ICON_SVG: Record<string,JSX.Element> = {
  food:        <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  grocery:     <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pharmacy:    <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  electronics: <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  salon:       <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M3.51 8.51L10 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  hardware:    <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pet:         <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.057-3.5 4 0 .75.562 1.931 1 2.5M14 5.172C14 3.782 15.577 2.679 17.5 3c2 .336 3.5 2.057 3.5 4 0 .75-.562 1.931-1 2.5M12 19c-4 0-7-1.5-7-5 0-2 1-3.5 3.5-4.5M12 19c4 0 7-1.5 7-5 0-2-1-3.5-3.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  default:     <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
}

export default function CustomerHome() {
  const [user, setUser]                   = useState<User | null>(null)
  useFCM(user?.id ?? null)
  const cart = useCart() as any
  const cartCount = (cart.count?.() ?? cart.itemCount?.() ?? 0) as number
  useEffect(() => { cart._hydrate?.() }, [])

  const [orders, setOrders]               = useState<Order[]>([])
  const [allShops, setAllShops]           = useState<Shop[]>([])
  const [products, setProducts]           = useState<Product[]>([])
  const [displayShops, setDisplayShops]   = useState<(Shop & { km: number | null })[]>([])
  const [loading, setLoading]             = useState(true)
  const [shopsLoaded, setShopsLoaded]     = useState(false)
  const [locStatus, setLocStatus]         = useState<'idle'|'detecting'|'granted'|'denied'>('idle')
  const [userLat, setUserLat]             = useState<number | null>(null)
  const [userLng, setUserLng]             = useState<number | null>(null)
  const [areaName, setAreaName]           = useState('')
  const [radius, setRadius]               = useState(5)
  const [activeCategory, setActiveCat]    = useState<string | null>(null)
  const [activeCats, setActiveCats]       = useState<{name:string; q:string}[]>([])
  const [showPhoneGate, setShowPhoneGate] = useState(false)

  useCustomerOrderAlerts(user?.id)

  const loadOrders = useCallback(async () => {
    const sb = createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) { window.location.href = '/auth/login'; return }

    // Fetch profile from DB first — more reliable than JWT metadata for role checks
    const { data: profile } = await sb.from('users').select('*').eq('id', u.id).single()

    // New Google user who skipped signup
    if (!profile) {
      const name  = encodeURIComponent(u.user_metadata?.full_name || u.user_metadata?.name || '')
      const email = encodeURIComponent(u.email || '')
      window.location.href = `/auth/signup?from=google&email=${email}&name=${name}`
      return
    }

    // Role guard — read from DB, not JWT metadata
    const role = profile.role || ''
    if (role === 'business' || role === 'shopkeeper')           { window.location.replace('/dashboard/business'); return }
    if (role === 'delivery' || role === 'delivery_partner')     { window.location.replace('/dashboard/delivery'); return }
    if (role === 'admin')                                       { window.location.replace('/dashboard/admin');    return }

    if (!profile.phone) setShowPhoneGate(true)
    setUser(profile)

    const { data: orderData } = await sb
      .from('orders').select('*, shop:shops(name,category_name), items:order_items(*)')
      .eq('customer_id', u.id).order('created_at', { ascending: false }).limit(20)

    setOrders(orderData || [])
    setLoading(false)
  }, [])

  const loadShops = useCallback(async () => {
    const sb = createClient()
    const [{ data: shops }, { data: cats }] = await Promise.all([
      sb.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false }),
      sb.from('categories').select('*').eq('is_active', true),
    ])
    setAllShops(shops || [])
    setShopsLoaded(true)
    if (cats?.length) {
      // Map DB categories to our SVG keys
      const mapped = cats.map((c: any) => ({
        name: c.name || c.label || '',
        q: (c.slug || c.name || c.label || '').toLowerCase().replace(/[^a-z]/g, ''),
      })).filter((c: any) => c.name && c.q)
      setActiveCats(mapped)
    } else {
      // Fallback: derive from shop categories
      // (used when categories table is empty)
    }
  }, [])

  const loadProducts = useCallback(async (shopIds: string[]) => {
    if (!shopIds.length) { setProducts([]); return }
    const { data } = await createClient().from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name)')
      .in('shop_id', shopIds.slice(0, 50))
      .order('original_price', { ascending: false }).limit(24)
    // Filter unavailable in JS — avoids broken .or() query
    const available = (data || []).filter((p: any) => p.is_available !== false)
    setProducts(available.map((p: any) => ({ ...p, shop_name: p.shops?.name })))
  }, [])

  function detectLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('detecting')
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      setUserLat(lat); setUserLng(lng); setLocStatus('granted')
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
        const d = await r.json()
        const name = d.address?.suburb || d.address?.neighbourhood || d.address?.village || d.address?.town || d.address?.city_district || d.address?.city || d.address?.county || ''
        setAreaName(name)
        localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name }))
      } catch { localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name: '' })) }
    }, () => setLocStatus('denied'), { timeout: 8000, enableHighAccuracy: false })
  }

  useEffect(() => {
    loadOrders(); loadShops()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) {
        setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted')
        if (saved.name) { setAreaName(saved.name); return }
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${saved.lat}&lon=${saved.lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json()).then(d => {
            const name = d.address?.suburb || d.address?.neighbourhood || d.address?.village || d.address?.town || d.address?.city_district || d.address?.city || d.address?.county || ''
            if (name) { setAreaName(name); localStorage.setItem('welokl_location', JSON.stringify({ lat: saved.lat, lng: saved.lng, name })) }
          }).catch(() => {})
        return
      }
    } catch {}
    detectLocation()
  }, [])

  useEffect(() => {
    const sb = createClient()
    let channel: ReturnType<typeof sb.channel> | null = null
    sb.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      channel = sb.channel(`cust-rt-${u.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${u.id}` }, () => loadOrders())
        .subscribe()
    })
    return () => { if (channel) sb.removeChannel(channel) }
  }, [loadOrders])

  useEffect(() => {
    let shops = allShops.map(s => ({
      ...s,
      km: (userLat && userLng && s.latitude && s.longitude) ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null,
    }))
    if (userLat && userLng) shops = shops.filter(s => s.km !== null && s.km <= radius)
    if (activeCategory)     shops = shops.filter(s => s.category_name?.toLowerCase().includes(activeCategory))
    shops.sort((a, b) => { if (a.is_open !== b.is_open) return a.is_open ? -1 : 1; if (a.km !== null && b.km !== null) return a.km - b.km; return b.rating - a.rating })
    setDisplayShops(shops)
    if (locStatus === 'granted' || locStatus === 'denied') {
      const ids = shops.filter(s => s.is_open).map(s => s.id)
      loadProducts(ids.length ? ids : shops.map(s => s.id))
    }
  }, [allShops, userLat, userLng, radius, activeCategory, locStatus, loadProducts])

  const activeOrders   = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const openShops      = displayShops.filter(s => s.is_open)
  const closedShops    = displayShops.filter(s => !s.is_open)
  const dealProducts   = products.filter(p => p.original_price && p.original_price > p.price)
  const featuredProds  = dealProducts.length > 0 ? dealProducts : products
  const greeting       = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()

  return (
    <>
    <InAppToast />
    {showPhoneGate && user?.id && <PhoneGate userId={user.id} onDone={() => setShowPhoneGate(false)} />}
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80 }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
        @keyframes shimmer { 0% { background-position:-400px 0 } 100% { background-position:400px 0 } }
        .sk { background: linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%); background-size:400px 100%; animation: shimmer 1.4s infinite; border-radius:12px; }
        .cat-btn { display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 8px 12px; border-radius:20px; border:none; cursor:pointer; transition:transform .15s,box-shadow .15s; flex:1; min-width:0; }
        .cat-btn:active { transform:scale(.94); }
        .shop-card { display:flex; align-items:center; gap:0; background:var(--card-white); border-radius:20px; overflow:hidden; text-decoration:none; transition:transform .15s,box-shadow .15s; box-shadow:0 2px 8px rgba(0,0,0,.06); }
        .shop-card:active { transform:scale(.98); }
        .prod-card { background:var(--card-white); border-radius:18px; overflow:hidden; text-decoration:none; display:block; box-shadow:0 2px 8px rgba(0,0,0,.05); }
        .prod-card:active { transform:scale(.97); }
        .nav-item { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; flex:1; padding:8px 4px; text-decoration:none; color:var(--text-muted); transition:color .15s; }
        .nav-item.on { color:#FF3008; }
        .nav-item svg { width:22px; height:22px; }
        .section-card { background:var(--card-white); border-radius:24px; margin:0 12px 12px; padding:18px 16px; }
      `}</style>

      {/* ── STICKY HEADER ─────────────────────────────────── */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'var(--card-white)', boxShadow:'0 1px 0 #eee' }}>

        {/* Location bar */}
        <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={detectLocation} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:18, height:18, color:'#FF3008', flexShrink:0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF3008"/>
            </svg>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.05em', lineHeight:1 }}>DELIVER TO</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:1 }}>
                <span style={{ fontSize:15, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                  {locStatus === 'detecting' ? 'Detecting…' : areaName ? areaName.split(',')[0].trim() : 'Set location'}
                </span>
                <svg viewBox="0 0 24 24" fill="none" style={{ width:14, height:14, color:'var(--text-primary)', flexShrink:0 }}>
                  <path d="M7 10l5 5 5-5" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Link href="/orders/history" style={{ width:38, height:38, borderRadius:12, background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width:20, height:20 }}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </Link>
            <Link href="/cart" style={{ position:'relative', width:38, height:38, borderRadius:12, background: cartCount > 0 ? '#FF3008' : 'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width:20, height:20 }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2"/>
                <path d="M16 10a4 4 0 01-8 0" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cartCount > 0 && (
                <span style={{ position:'absolute', top:-5, right:-5, width:18, height:18, background:'var(--card-white)', border:'2px solid #FF3008', borderRadius:'50%', fontSize:9, fontWeight:900, color:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Greeting */}
        <div style={{ padding:'4px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)' }}>
            {greeting}, <span style={{ color:'var(--text-primary)', fontWeight:800 }}>{user?.name?.split(' ')[0] || 'there'}</span> 👋
          </p>
        </div>

        {/* Search bar */}
        <div style={{ padding:'10px 16px 12px' }}>
          <Link href="/search" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, background:'var(--page-bg)', borderRadius:14, padding:'11px 14px' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:18, height:18, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8" stroke="var(--text-muted)" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:600 }}>Search for products & shops…</span>
          </Link>
        </div>
      </div>

      {/* ── SUBSCRIPTIONS PILL ─────────────────────────────── */}
      <Link href="/subscriptions" style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 12px 0', background:'var(--card-white)', borderRadius:16, padding:'12px 16px', textDecoration:'none', border:'1.5px solid var(--divider)' }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,48,8,.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>🔁</div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>My Subscriptions</p>
          <p style={{ fontSize:11, color:'var(--text-muted)' }}>Daily milk, tiffin, eggs & more</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </Link>

      {/* ── ACTIVE ORDER PILL ─────────────────────────────── */}
      {activeOrders.length > 0 && (
        <Link href={`/orders/${activeOrders[0].id}`} style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 12px 0', background:'#FF3008', borderRadius:16, padding:'12px 16px', textDecoration:'none', boxShadow:'0 4px 16px rgba(255,48,8,.3)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--card-white)', flexShrink:0, animation:'pulse 1.5s infinite', display:'block' }} />
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{(activeOrders[0] as any).shop?.name} · {ORDER_STATUS_LABELS[activeOrders[0].status as keyof typeof ORDER_STATUS_LABELS]}</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.75)' }}>Tap to track your order</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" style={{ width:18, height:18, flexShrink:0 }}>
            <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      )}

      {/* ── CATEGORY STRIP — horizontal scroll like Blinkit ── */}
      <div style={{ overflowX:'auto', scrollbarWidth:'none', WebkitOverflowScrolling:'touch', padding:'12px 12px 0' }}>
        <div style={{ display:'flex', gap:8, width:'max-content' }}>
          {(activeCats.length ? activeCats : CATS.map(c => ({ name: c.label, q: c.q }))).map(cat => {
            const cfg = CATS.find(c => c.q === cat.q) || { color:'#FF3008', bg:'var(--red-light)' }
            const isActive = activeCategory === cat.q
            return (
              <button key={cat.q}
                onClick={() => setActiveCat(isActive ? null : cat.q)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:14, border:`1.5px solid ${isActive ? cfg.color : 'transparent'}`, background: isActive ? cfg.color : cfg.bg, cursor:'pointer', fontFamily:'inherit', flexShrink:0, minWidth:64, transition:'all .15s' }}>
                <span style={{ color: isActive ? '#fff' : cfg.color, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {CAT_SVG[cat.q] || CAT_SVG['food']}
                </span>
                <span style={{ fontSize:11, fontWeight:800, color: isActive ? '#fff' : 'var(--text-primary)', whiteSpace:'nowrap' }}>{cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── DELIVERY PROMISE PILL — compact ─────────────── */}
      {!activeCategory && (
        <div style={{ padding:'10px 12px 0' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--red-light)', border:'1px solid rgba(255,48,8,.15)', borderRadius:999, padding:'6px 14px' }}>
            <svg viewBox="0 0 24 24" fill="none" width={14} height={14}>
              <circle cx="12" cy="12" r="10" stroke="#FF3008" strokeWidth="2"/>
              <polyline points="12 6 12 12 16 14" stroke="#FF3008" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:12, fontWeight:800, color:'#FF3008' }}>Delivered in 30 min</span>
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>· Local shops · 5km</span>
          </div>
        </div>
      )}

      {/* ── DEALS ROW ─────────────────────────────────────── */}
      {!activeCategory && featuredProds.length > 0 && (
        <div style={{ margin:'16px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{dealProducts.length > 0 ? 'Deals near you' : 'Top picks'}</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Best from local shops</p>
            </div>
            <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all →</Link>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {products.length === 0
              ? Array.from({length:5}).map((_,i) => <div key={i} className="sk" style={{ width:140, height:190, flexShrink:0 }} />)
              : featuredProds.slice(0,12).map(p => <ProductCard key={p.id} product={p} />)
            }
          </div>
        </div>
      )}

      {/* ── RADIUS CHIPS ──────────────────────────────────── */}
      {locStatus === 'granted' && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 16px 0', overflowX:'auto', scrollbarWidth:'none' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', flexShrink:0, display:'flex', alignItems:'center', gap:4 }}>
              <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="var(--text-muted)"/></svg>
              Within:
            </span>
          {[1, 2, 5, 7].map(r => (
            <button key={r} onClick={() => setRadius(r)}
              style={{ flexShrink:0, padding:'6px 14px', borderRadius:999, border:'none', background: radius === r ? '#FF3008' : 'var(--chip-bg)', color: radius === r ? '#fff' : 'var(--text-secondary)', fontWeight:800, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              {r}km
            </button>
          ))}
        </div>
      )}

      {/* ── SHOPS ─────────────────────────────────────────── */}
      <div style={{ margin:'14px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              {activeCategory ? `${CATS.find(c => c.q === activeCategory)?.label} near you` : locStatus === 'granted' ? `Shops near ${areaName || 'you'}` : 'Shops near you'}
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
              {shopsLoaded ? `${openShops.length} open` : 'Loading…'}
            </p>
          </div>
          <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>Map view →</Link>
        </div>

        {/* Location denied */}
        {locStatus === 'denied' && (
          <div style={{ margin:'0 12px', background:'var(--card-white)', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
            <div style={{ width:56, height:56, background:'var(--red-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>Allow location access</p>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>We only show shops in your neighbourhood</p>
            <button onClick={detectLocation} style={{ background:'#FF3008', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
              Enable location
            </button>
          </div>
        )}

        {/* Skeletons */}
        {!shopsLoaded && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 12px' }}>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} className="sk" style={{ height:90, borderRadius:20 }} />
            ))}
          </div>
        )}

        {/* Open shops */}
        {shopsLoaded && openShops.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 12px' }}>
            {openShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
          </div>
        )}

        {/* Empty state */}
        {shopsLoaded && displayShops.length === 0 && locStatus !== 'denied' && (
          <div style={{ margin:'0 12px', background:'var(--card-white)', borderRadius:20, padding:'36px 20px', textAlign:'center' }}>
            <div style={{ width:56, height:56, background:'var(--chip-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>No shops nearby</p>
            <p style={{ fontSize:13, color:'var(--text-muted)' }}>{locStatus === 'granted' ? `Try expanding your radius above` : 'Set your location to find shops'}</p>
          </div>
        )}

        {/* Closed shops */}
        {shopsLoaded && closedShops.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 16px 12px' }}>
              <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', letterSpacing:'0.05em' }}>CLOSED NOW · {closedShops.length}</span>
              <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 12px', opacity:0.55 }}>
              {closedShops.slice(0,3).map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
            </div>
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ────────────────────────────────────── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--card-white)', borderTop:'1px solid var(--divider)', paddingBottom:'env(safe-area-inset-bottom,0)', zIndex:50 }}>
        <div style={{ display:'flex', maxWidth:480, margin:'0 auto' }}>
          {[
            { label:'Home',   href:'/dashboard/customer', on:true,  icon: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> },
            { label:'Search', href:'/search',              on:false, icon: <><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> },
            { label:'Shops',  href:'/stores',              on:false, icon: <><path d="M3 3h18v4H3zM5 7v11a2 2 0 002 2h10a2 2 0 002-2V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></> },
            { label:'Orders', href:'/orders/history',      on:false, icon: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="2" stroke="currentColor" strokeWidth="2"/></> },
            { label:'Account',href:'/profile',             on:false, icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></> },
          ].map(item => (
            <Link key={item.label} href={item.href} className={`nav-item${item.on ? ' on' : ''}`}>
              <svg viewBox="0 0 24 24" fill="none">{item.icon}</svg>
              <span style={{ fontSize:10, fontWeight:700 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}

// ── SHOP CARD ─────────────────────────────────────────────────────
function ShopCard({ shop, index }: { shop: Shop & { km: number | null }; index: number }) {
  const catKey  = Object.keys(CAT_COLOR).find(k => k !== 'default' && shop.category_name?.toLowerCase().includes(k)) || 'default'
  const color   = CAT_COLOR[catKey]

  return (
    <Link href={`/stores/${shop.id}`} className="shop-card" style={{ animation:`fadeUp .2s ease ${index*30}ms both` }}>
      {/* Image */}
      <div style={{ width:90, height:90, flexShrink:0, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        {shop.image_url
          ? <img src={shop.image_url} alt={shop.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ color: color, opacity:.6 }}>{CAT_ICON_SVG[catKey] || CAT_ICON_SVG['default']}</span>
        }
        <div style={{ position:'absolute', bottom:5, left:5 }}>
          {shop.is_open
            ? <span style={{ background:'#16a34a', color:'#fff', fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:5 }}>OPEN</span>
            : <span style={{ background:'rgba(0,0,0,.55)', color:'rgba(255,255,255,.7)', fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:5 }}>CLOSED</span>
          }
        </div>
      </div>

      {/* Info */}
      <div style={{ flex:1, padding:'10px 12px', minWidth:0 }}>
        <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.name}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {shop.category_name?.split(' ')[0]} · {shop.area}
        </p>
        {(shop.offer_text || shop.free_delivery_above) && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
            {shop.offer_text && <span style={{ fontSize:10, fontWeight:700, color:'#FF3008', background:'var(--red-light)', padding:'2px 7px', borderRadius:6 }}>{shop.offer_text}</span>}
            {shop.free_delivery_above && <span style={{ fontSize:10, fontWeight:700, color:'#16a34a', background:'var(--green-light)', padding:'2px 7px', borderRadius:6 }}>Free delivery above ₹{shop.free_delivery_above}</span>}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>
            <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {shop.rating?.toFixed(1) || '4.0'}
          </span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)' }} />
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="none" width={12} height={12}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {shop.avg_delivery_time}min
          </span>
          {shop.km !== null && (
            <>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)' }} />
              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--text-muted)' }}>
              <svg viewBox="0 0 24 24" fill="none" width={11} height={11}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor" opacity=".6"/></svg>
              {shop.km < 1 ? `${Math.round(shop.km*1000)}m` : `${shop.km.toFixed(1)}km`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ paddingRight:14, flexShrink:0 }}>
        <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, color:'var(--text-faint)' }}>
          <path d="M9 18l6-6-6-6" stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}

// ── PRODUCT CARD ──────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null

  return (
    <Link href={`/stores/${product.shop_id}`} className="prod-card" style={{ width:140, flexShrink:0 }}>
      <div style={{ height:130, background:'var(--chip-bg)', position:'relative', overflow:'hidden' }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><svg viewBox="0 0 24 24" fill="none" width={40} height={40}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        }
        {disc && (
          <div style={{ position:'absolute', top:8, left:8, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 7px', borderRadius:8 }}>
            -{disc}%
          </div>
        )}
      </div>
      <div style={{ padding:'10px 10px 12px' }}>
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>{product.name}</p>
        {product.shop_name && <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.shop_name}</p>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize:11, color:'var(--text-faint)', textDecoration:'line-through', marginLeft:4 }}>₹{product.original_price}</span>}
          </div>
          <div style={{ width:28, height:28, borderRadius:8, border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008', fontSize:18, fontWeight:900, lineHeight:1 }}>+</div>
        </div>
      </div>
    </Link>
  )
}