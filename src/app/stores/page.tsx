'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Shop } from '@/types'
import BottomNav from '@/components/BottomNav'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Category config — colors + SVG icons
const CATS: Record<string,{ color:string; bg:string; svg:JSX.Element }> = {
  food:        { color:'#FF3008', bg:'rgba(255,48,8,.1)',   svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  grocery:     { color:'#16a34a', bg:'rgba(22,163,74,.1)',  svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  pharmacy:    { color:'#4f46e5', bg:'rgba(79,70,229,.1)',  svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M8 21h12a2 2 0 002-2v-2H10v2a2 2 0 01-2 2zm4-18H6a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2zM4 9v10a2 2 0 002 2h2a2 2 0 002-2V9H4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 13h2M12 12v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  electronics: { color:'#7c3aed', bg:'rgba(124,58,237,.1)', svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  salon:       { color:'#db2777', bg:'rgba(219,39,119,.1)', svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M20 7.5c0 2.485-2.015 4.5-4.5 4.5a4.5 4.5 0 01-4.5-4.5c0-2.485 2.015-4.5 4.5-4.5S20 5.015 20 7.5zM6 21v-1a6 6 0 016-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 21l3-3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  hardware:    { color:'#d97706', bg:'rgba(217,119,6,.1)',  svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  pet:         { color:'#ea580c', bg:'rgba(234,88,12,.1)',  svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.057-3.5 4 0 .75.562 1.931 1 2.5M14 5.172C14 3.782 15.577 2.679 17.5 3c2 .336 3.5 2.057 3.5 4 0 .75-.562 1.931-1 2.5M12 19c-4 0-7-1.5-7-5 0-2 1-3.5 3.5-4.5M12 19c4 0 7-1.5 7-5 0-2-1-3.5-3.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  default:     { color:'#FF3008', bg:'rgba(255,48,8,.08)',  svg: <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
}

function getCat(name?: string | null) {
  const key = Object.keys(CATS).find(k => k !== 'default' && name?.toLowerCase().includes(k))
  return CATS[key || 'default']
}

// Sort icons as SVG
const SortIcons = {
  open:     <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  rating:   <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  distance: <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" stroke="currentColor" strokeWidth="1.8"/></svg>,
}

export default function StoresPage() {
  const [shops,         setShops]        = useState<Shop[]>([])
  const [activeCategory,setActiveCat]    = useState('all')
  const [search,        setSearch]       = useState('')
  const [loading,       setLoading]      = useState(true)
  const [userLat,       setUserLat]      = useState<number|null>(null)
  const [userLng,       setUserLng]      = useState<number|null>(null)
  const [areaName,      setAreaName]     = useState('')
  const [locStatus,     setLocStatus]    = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [radius,        setRadius]       = useState(5)
  const [sortBy,        setSortBy]       = useState<'open'|'rating'|'distance'>('open')

  useEffect(() => {
    loadShops()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) {
        setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted')
        if (saved.name) setAreaName(saved.name)
      } else askLocation()
    } catch { askLocation() }
  }, [])

  function askLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      setUserLat(lat); setUserLng(lng); setLocStatus('granted')
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language':'en' } })
        const d = await r.json()
        const name = d.address?.suburb || d.address?.neighbourhood || d.address?.town || ''
        if (name) setAreaName(name)
        localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name }))
      } catch {
        localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name:'' }))
      }
    }, () => setLocStatus('denied'), { timeout:6000, enableHighAccuracy:false })
  }

  async function loadShops() {
    const { data } = await createClient().from('shops').select('*')
      .eq('is_active', true).order('rating', { ascending:false })
    setShops(data || []); setLoading(false)
  }

  const shopsWithDist = shops.map(s => ({
    ...s,
    distance: (userLat && userLng && s.latitude && s.longitude)
      ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null
  }))

  const filtered = shopsWithDist
    .filter(s => {
      const matchCat    = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory)
      const matchSearch = !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || (s as any).area?.toLowerCase().includes(search.toLowerCase())
      const matchRadius = !userLat || s.distance === null || s.distance <= radius
      return matchCat && matchSearch && matchRadius
    })
    .sort((a, b) => {
      if (sortBy === 'rating')   return (b.rating||0) - (a.rating||0)
      if (sortBy === 'distance') return (a.distance??99) - (b.distance??99)
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance
      return (b.rating||0) - (a.rating||0)
    })

  const openShops   = filtered.filter(s => s.is_open)
  const closedShops = filtered.filter(s => !s.is_open)
  const allCatNames = Array.from(new Set(shops.map(s => s.category_name).filter(Boolean))) as string[]

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80 }}>
      <style>{`
        .st-card { display:flex; align-items:stretch; background:var(--card-white); border-radius:20px; overflow:hidden; text-decoration:none; transition:transform .15s; -webkit-tap-highlight-color:transparent; }
        .st-card:active { transform:scale(.98); }
        .st-pill { flex-shrink:0; display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:999px; font-size:12px; font-weight:700; white-space:nowrap; border:1.5px solid var(--divider); background:var(--card-white); color:var(--text-muted); cursor:pointer; font-family:inherit; transition:all .15s; }
        .st-pill.on { background:#FF3008; border-color:#FF3008; color:#fff; }
        .st-sort { padding:7px 12px; border-radius:999px; font-size:11px; font-weight:700; border:1.5px solid var(--divider); background:var(--card-white); color:var(--text-muted); cursor:pointer; font-family:inherit; display:flex; align-items:center; gap:5px; transition:all .14s; }
        .st-sort.on { background:var(--chip-bg); color:var(--text-primary); border-color:var(--text-faint); }
        @keyframes sk { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background:linear-gradient(90deg,var(--chip-bg) 25%,var(--page-bg) 50%,var(--chip-bg) 75%); background-size:400px 100%; animation:sk 1.4s infinite; border-radius:20px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .st-appear { animation:fadeUp .2s ease both; }
      `}</style>

      {/* ── Sticky header ── */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--card-white)', borderBottom:'1px solid var(--divider)' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'10px 14px 0' }}>

          {/* Top row */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <Link href="/dashboard/customer" style={{ width:38, height:38, borderRadius:12, background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
                <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', letterSpacing:'-0.02em', lineHeight:1.1 }}>All Shops</p>
              <p style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
                {loading ? 'Loading…' : locStatus === 'granted'
                  ? `${openShops.length} open · ${closedShops.length} closed${areaName ? ` · ${areaName}` : ''}`
                  : `${shops.length} shops`}
              </p>
            </div>
            {/* Location button */}
            {locStatus !== 'granted' && (
              <button onClick={askLocation}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:12, background:'var(--red-light)', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:12, color:'#FF3008', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={14} height={14}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/>
                </svg>
                {locStatus === 'asking' ? 'Detecting…' : 'Set location'}
              </button>
            )}
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginBottom:10 }}>
            <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
                <circle cx="11" cy="11" r="8" stroke="var(--text-faint)" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search shop name or area…"
              style={{ width:'100%', padding:'11px 36px 11px 38px', background:'var(--page-bg)', border:'1.5px solid var(--divider)', borderRadius:14, fontSize:14, fontWeight:500, color:'var(--text-primary)', outline:'none', fontFamily:'inherit', boxSizing:'border-box', transition:'border .2s' }}
              onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
              onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'var(--chip-bg)', border:'none', cursor:'pointer', width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width={12} height={12}>
                  <path d="M18 6L6 18M6 6l12 12" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          {/* Category pills */}
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:10, scrollbarWidth:'none' }}>
            <button className={`st-pill${activeCategory === 'all' ? ' on' : ''}`} onClick={() => setActiveCat('all')}>
              <svg viewBox="0 0 24 24" fill="none" width={13} height={13}>
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
              </svg>
              All
            </button>
            {allCatNames.slice(0,10).map(cat => {
              const c = getCat(cat)
              const isOn = activeCategory === cat
              return (
                <button key={cat} className={`st-pill${isOn ? ' on' : ''}`} onClick={() => setActiveCat(isOn ? 'all' : cat)}
                  style={isOn ? {} : { color: c.color, borderColor:`${c.color}40`, background: c.bg }}>
                  <span style={{ color: isOn ? '#fff' : c.color }}>{c.svg}</span>
                  {cat.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort + radius */}
        <div style={{ borderTop:'1px solid var(--divider)', padding:'8px 14px', display:'flex', alignItems:'center', gap:8, overflowX:'auto', scrollbarWidth:'none', background:'var(--page-bg)' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', flexShrink:0 }}>Sort:</span>
          {(['open','rating','distance'] as const).map(s => (
            <button key={s} className={`st-sort${sortBy === s ? ' on' : ''}`} onClick={() => setSortBy(s)}>
              {SortIcons[s]}
              {s === 'open' ? 'Open first' : s === 'rating' ? 'Top rated' : 'Nearest'}
            </button>
          ))}
          {locStatus === 'granted' && (
            <>
              <div style={{ width:1, height:14, background:'var(--divider)', flexShrink:0, marginLeft:4 }} />
              {[1,2,5,7].map(r => (
                <button key={r} className={`st-sort${radius === r ? ' on' : ''}`} onClick={() => setRadius(r)}>{r}km</button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth:960, margin:'0 auto', padding:'14px 12px 20px' }}>

        {/* Skeletons */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="sk" style={{ height:96 }} />)}
          </div>
        )}

        {/* No results */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'72px 20px' }}>
            <div style={{ width:80, height:80, background:'var(--chip-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={36} height={36}>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', marginBottom:8 }}>
              {search ? `No shops matching "${search}"` : 'No shops found'}
            </p>
            <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:20 }}>
              {locStatus === 'granted' ? 'Try expanding the radius' : 'Try a different search'}
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              {search && <button onClick={() => setSearch('')} style={{ padding:'11px 22px', borderRadius:14, background:'var(--chip-bg)', color:'var(--text-primary)', fontWeight:800, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Clear search</button>}
              {locStatus === 'granted' && <button onClick={() => setRadius(999)} style={{ padding:'11px 22px', borderRadius:14, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Show all shops</button>}
            </div>
          </div>
        )}

        {/* Open shops */}
        {!loading && openShops.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', letterSpacing:'.08em', marginBottom:10 }}>
              OPEN NOW · {openShops.length}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {openShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
            </div>
          </>
        )}

        {/* Closed shops */}
        {!loading && closedShops.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
              <span style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', letterSpacing:'.08em', whiteSpace:'nowrap' }}>
                CLOSED · {closedShops.length}
              </span>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, opacity:.55 }}>
              {closedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} index={i} />)}
            </div>
          </>
        )}
      </div>

      <BottomNav active="shops" />
    </div>
  )
}

// ── Shop Card ──────────────────────────────────────────────────────
function ShopCard({ shop, index }: { shop: any; index: number }) {
  const cat = getCat(shop.category_name)

  return (
    <Link href={`/stores/${shop.id}`} className="st-card st-appear" style={{ animationDelay:`${Math.min(index,8)*30}ms` }}>
      {/* Image */}
      <div style={{ width:96, height:96, flexShrink:0, background: cat.bg, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', color: cat.color }}>
        {shop.image_url
          ? <img src={shop.image_url} alt={shop.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
          : <span style={{ color: cat.color, opacity:.7 }}>{cat.svg}</span>
        }
        <div style={{ position:'absolute', bottom:5, left:5 }}>
          {shop.is_open
            ? <span style={{ background:'rgba(22,163,74,.92)', color:'#fff', fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:5 }}>OPEN</span>
            : <span style={{ background:'rgba(0,0,0,.6)', color:'rgba(255,255,255,.7)', fontSize:8, fontWeight:800, padding:'2px 6px', borderRadius:5 }}>CLOSED</span>
          }
        </div>
      </div>

      {/* Info */}
      <div style={{ flex:1, padding:'12px 12px', minWidth:0 }}>
        <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.name}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {shop.category_name} · {shop.area}
        </p>

        {/* Offer badges */}
        {(shop.offer_text || shop.free_delivery_above) && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
            {shop.offer_text && <span style={{ fontSize:10, fontWeight:700, color:'#FF3008', background:'var(--red-light)', padding:'2px 7px', borderRadius:6 }}>{shop.offer_text}</span>}
            {shop.free_delivery_above && <span style={{ fontSize:10, fontWeight:700, color:'#16a34a', background:'var(--green-light)', padding:'2px 7px', borderRadius:6 }}>Free above ₹{shop.free_delivery_above}</span>}
          </div>
        )}

        {/* Meta row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
            <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            {(shop.rating||4.0).toFixed(1)}
          </div>
          {shop.delivery_enabled && (
            <>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', flexShrink:0 }} />
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" width={13} height={13}>
                  <circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 18H3V7a1 1 0 011-1h9v5M16 18h-3.5M8 7h5l3 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 12h5l1 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {shop.avg_delivery_time}min
              </div>
            </>
          )}
          {shop.distance !== null && (
            <>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', flexShrink:0 }} />
              <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--text-muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" width={11} height={11}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor" opacity=".5"/>
                </svg>
                {shop.distance < 1 ? `${Math.round(shop.distance*1000)}m` : `${shop.distance.toFixed(1)}km`}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ display:'flex', alignItems:'center', paddingRight:14, flexShrink:0 }}>
        <svg viewBox="0 0 24 24" fill="none" width={16} height={16}>
          <path d="M9 18l6-6-6-6" stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}