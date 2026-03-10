'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Shop, Category } from '@/types'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const CAT_ICONS: Record<string,string> = {
  food:'🍔', grocery:'🛒', pharmacy:'💊', electronics:'📱',
  salon:'💇', fashion:'👗', stationery:'📚', hardware:'🔧',
  pet:'🐾', flower:'🌸', bakery:'🥐', dessert:'🍦',
}

export default function StoresPage() {
  const [shops, setShops]               = useState<Shop[]>([])
  const [categories, setCategories]     = useState<Category[]>([])
  const [activeCategory, setActiveCat]  = useState('all')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [userLat, setUserLat]           = useState<number|null>(null)
  const [userLng, setUserLng]           = useState<number|null>(null)
  const [locStatus, setLocStatus]       = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [radius, setRadius]             = useState(10)
  const [sortBy, setSortBy]             = useState<'distance'|'rating'|'open'>('open')

  useEffect(() => {
    loadData()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) { setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted') }
      else askLocation()
    } catch { askLocation() }
  }, [])

  function askLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocStatus('granted')
        localStorage.setItem('welokl_location', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
      },
      () => setLocStatus('denied'),
      { timeout: 6000, enableHighAccuracy: false }
    )
  }

  async function loadData() {
    const sb = createClient()
    const [{ data: sd }, { data: cd }] = await Promise.all([
      sb.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false }),
      sb.from('categories').select('*').order('sort_order'),
    ])
    setShops(sd || []); setCategories(cd || []); setLoading(false)
  }

  const shopsWithDist = shops.map(s => ({
    ...s,
    distance: (userLat && userLng && s.latitude && s.longitude)
      ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude))
      : null
  }))

  const filtered = shopsWithDist
    .filter(s => {
      const matchCat  = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory.toLowerCase())
      const matchSearch = !search.trim() || s.name.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())
      // Only filter by radius if we have location AND user hasn't expanded
      const matchRadius = !userLat || s.distance === null || s.distance <= radius
      return matchCat && matchSearch && matchRadius
    })
    .sort((a, b) => {
      if (sortBy === 'open')     { if (a.is_open !== b.is_open) return a.is_open ? -1 : 1 }
      if (sortBy === 'rating')   return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'distance') return (a.distance ?? 99) - (b.distance ?? 99)
      // default: open first, then distance
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance
      return (b.rating || 0) - (a.rating || 0)
    })

  const openCount   = filtered.filter(s => s.is_open).length
  const closedCount = filtered.filter(s => !s.is_open).length

  // Get unique categories from loaded shops for filter pills
  const allCatNames = Array.from(new Set(shops.map(s => s.category_name).filter(Boolean))) as string[]

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:"'Plus Jakarta Sans', sans-serif", paddingBottom:80 }}>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        .st-shop-card {
          display:flex; align-items:stretch; background:var(--card-bg);
          border:1.5px solid var(--border); border-radius:18px; overflow:hidden;
          text-decoration:none; transition:box-shadow .18s, transform .18s;
          -webkit-tap-highlight-color:transparent;
        }
        .st-shop-card:active { transform:scale(.98); }
        .st-shop-card:hover  { box-shadow:0 8px 28px rgba(0,0,0,.12); transform:translateY(-2px); }
        .st-cat-pill {
          flex-shrink:0; padding:8px 16px; border-radius:999px;
          font-size:13px; font-weight:700; white-space:nowrap;
          border:1.5px solid var(--border); background:var(--card-bg);
          color:var(--text-2); cursor:pointer; font-family:inherit;
          transition:all .14s; -webkit-tap-highlight-color:transparent;
        }
        .st-cat-pill.active { background:#ff3008; border-color:#ff3008; color:#fff; }
        .st-cat-pill:not(.active):active { background:var(--bg-3); }
        .st-sort-btn {
          padding:7px 14px; border-radius:999px; font-size:12px; font-weight:700;
          border:1.5px solid var(--border); background:var(--card-bg); color:var(--text-3);
          cursor:pointer; font-family:inherit; transition:all .14s;
        }
        .st-sort-btn.on { background:var(--bg-3); color:var(--text); border-color:var(--border-strong); }
        @keyframes st-fade { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .st-appear { animation:st-fade .3s ease both; }
        .shimmer {
          background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);
          background-size:600px 100%; animation:sh 1.4s infinite;
        }
        @keyframes sh { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
      `}</style>

      {/* ── Sticky Header ─────────────────────────────────────── */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--card-bg)', borderBottom:'1px solid var(--border)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
        <div style={{ maxWidth:960, margin:'0 auto', padding:'10px 14px 0' }}>

          {/* Back + Title + icons */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <Link href="/dashboard/customer" style={{ width:36, height:36, borderRadius:10, background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', fontSize:18, flexShrink:0, color:'var(--text)' }}>←</Link>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, fontSize:17, color:'var(--text)', letterSpacing:'-.02em' }}>All Shops</div>
              <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>
                {loading ? 'Loading…' : locStatus === 'granted' ? `${openCount} open · ${closedCount} closed` : `${shops.length} shops`}
              </div>
            </div>
            {locStatus !== 'granted' && (
              <button onClick={askLocation}
                style={{ fontSize:12, fontWeight:700, padding:'6px 14px', borderRadius:10, background:'rgba(255,48,8,.1)', color:'#ff3008', border:'none', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                {locStatus === 'asking' ? '📍…' : '📍 Set location'}
              </button>
            )}
          </div>

          {/* Search */}
          <div style={{ position:'relative', marginBottom:10 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'var(--text-3)', pointerEvents:'none' }}>🔍</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search shop name or area…"
              style={{ width:'100%', padding:'10px 36px 10px 38px', background:'var(--bg-2)', border:'1.5px solid var(--border)', borderRadius:12, fontSize:14, fontWeight:500, color:'var(--text)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
            />
            {search && (
              <button onClick={() => setSearch('')}
                style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
            )}
          </div>

          {/* Category filter pills */}
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:10, scrollbarWidth:'none' }}>
            <button className={`st-cat-pill${activeCategory === 'all' ? ' active' : ''}`} onClick={() => setActiveCat('all')}>All</button>
            {allCatNames.slice(0, 12).map(cat => {
              const key = Object.keys(CAT_ICONS).find(k => cat.toLowerCase().includes(k)) || ''
              return (
                <button key={cat} className={`st-cat-pill${activeCategory === cat ? ' active' : ''}`} onClick={() => setActiveCat(activeCategory === cat ? 'all' : cat)}>
                  {key ? CAT_ICONS[key] : '🏪'} {cat.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort + radius row */}
        <div style={{ borderTop:'1px solid var(--border)', padding:'8px 14px', display:'flex', alignItems:'center', gap:8, overflowX:'auto', scrollbarWidth:'none', background:'var(--bg-1)' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', flexShrink:0 }}>Sort:</span>
          {(['open','rating','distance'] as const).map(s => (
            <button key={s} className={`st-sort-btn${sortBy === s ? ' on' : ''}`} onClick={() => setSortBy(s)}>
              {s === 'open' ? '🟢 Open first' : s === 'rating' ? '⭐ Rating' : '📍 Nearest'}
            </button>
          ))}
          {locStatus === 'granted' && (
            <>
              <div style={{ width:1, height:16, background:'var(--border)', flexShrink:0, marginLeft:4 }} />
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', flexShrink:0 }}>Radius:</span>
              {[2,5,10,25,50].map(r => (
                <button key={r}
                  className={`st-sort-btn${radius === r ? ' on' : ''}`}
                  onClick={() => setRadius(r)}>
                  {r}km
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div style={{ maxWidth:960, margin:'0 auto', padding:'14px 14px 20px' }}>

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="shimmer" style={{ height:100, borderRadius:18 }} />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', paddingTop:60 }}>
            <div style={{ fontSize:56, marginBottom:14 }}>🏪</div>
            <p style={{ fontWeight:900, fontSize:18, color:'var(--text)', marginBottom:8 }}>
              {search ? `No shops matching "${search}"` : 'No shops in this area'}
            </p>
            <p style={{ fontSize:14, color:'var(--text-3)', marginBottom:20 }}>
              {locStatus === 'granted' ? `Try increasing the radius or browse all shops` : 'Try a different search'}
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
              {search && <button onClick={() => setSearch('')} style={{ padding:'10px 22px', borderRadius:12, background:'var(--bg-3)', color:'var(--text)', fontWeight:800, fontSize:13, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Clear search</button>}
              {locStatus === 'granted' && <button onClick={() => setRadius(999)} style={{ padding:'10px 22px', borderRadius:12, background:'#ff3008', color:'#fff', fontWeight:800, fontSize:13, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Show all shops</button>}
            </div>
          </div>
        )}

        {/* Open shops */}
        {!loading && filtered.filter(s => s.is_open).length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text-3)', letterSpacing:'.06em', marginBottom:10 }}>
              OPEN NOW — {filtered.filter(s => s.is_open).length}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {filtered.filter(s => s.is_open).map((shop, i) => (
                <ShopCard key={shop.id} shop={shop} index={i} />
              ))}
            </div>
          </>
        )}

        {/* Closed shops */}
        {!loading && filtered.filter(s => !s.is_open).length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
              <span style={{ fontSize:12, fontWeight:800, color:'var(--text-3)', letterSpacing:'.06em', whiteSpace:'nowrap' }}>
                CLOSED — {filtered.filter(s => !s.is_open).length}
              </span>
              <div style={{ flex:1, height:1, background:'var(--border)' }} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, opacity:.65 }}>
              {filtered.filter(s => !s.is_open).map((shop, i) => (
                <ShopCard key={shop.id} shop={shop} index={i} closed />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Bottom nav ─────────────────────────────────────────── */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'var(--card-bg)', borderTop:'1px solid var(--border)', paddingBottom:'env(safe-area-inset-bottom,0)', zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-around', padding:'6px 0 8px', maxWidth:480, margin:'0 auto' }}>
          {[
            { icon:'🏠', label:'Home',   href:'/dashboard/customer', on:false },
            { icon:'🛍️', label:'Shops',  href:'/stores',              on:true  },
            { icon:'❤️', label:'Saved',  href:'/favourites',           on:false },
            { icon:'📦', label:'Orders', href:'/orders/history',       on:false },
          ].map(item => (
            <Link key={item.label} href={item.href}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'6px 18px', borderRadius:14, textDecoration:'none', color: item.on ? '#ff3008' : 'var(--text-3)', WebkitTapHighlightColor:'transparent' }}>
              <span style={{ fontSize:22, lineHeight:1 }}>{item.icon}</span>
              <span style={{ fontSize:11, fontWeight:800, letterSpacing:'0.01em' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const CAT_ICON_MAP: Record<string,string> = {
  food:'🍔',grocery:'🛒',pharmacy:'💊',electronics:'📱',salon:'💇',hardware:'🔧',pet:'🐾',flower:'🌸',bakery:'🥐',default:'🏪'
}
const CAT_COLOR_MAP: Record<string,string> = {
  food:'#FF3008',grocery:'#00b874',pharmacy:'#2563eb',electronics:'#7c3aed',salon:'#db2777',hardware:'#b45309',pet:'#ea580c',default:'#FF5A1F'
}

function ShopCard({ shop, index, closed }: { shop: any; index: number; closed?: boolean }) {
  const key      = Object.keys(CAT_ICON_MAP).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'
  const icon     = CAT_ICON_MAP[key]
  const color    = CAT_COLOR_MAP[key]
  const bg       = `${color}18`

  return (
    <Link href={`/stores/${shop.id}`} className="st-shop-card st-appear" style={{ animationDelay:`${Math.min(index,8) * 30}ms` }}>
      {/* Image */}
      <div style={{ width:100, height:100, flexShrink:0, background:bg, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {shop.image_url
          ? <img src={shop.image_url} alt={shop.name} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
          : <span style={{ fontSize:36 }}>{icon}</span>
        }
        {/* Open/closed badge */}
        <div style={{ position:'absolute', bottom:6, left:6 }}>
          {shop.is_open
            ? <span style={{ background:'rgba(22,163,74,.92)', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:6, letterSpacing:'.04em' }}>OPEN</span>
            : <span style={{ background:'rgba(0,0,0,.6)', color:'rgba(255,255,255,.7)', fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:6 }}>CLOSED</span>
          }
        </div>
      </div>

      {/* Info */}
      <div style={{ flex:1, padding:'12px 14px', minWidth:0, display:'flex', flexDirection:'column', justifyContent:'center', gap:3 }}>
        <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.name}</div>
        <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {shop.category_name} · {shop.area}
        </div>
        {shop.description && (
          <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.description}</div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, flexWrap:'wrap' }}>
          {shop.delivery_enabled && <span style={{ fontSize:11, fontWeight:600, color:'var(--text-3)' }}>🛵 {shop.avg_delivery_time}min</span>}
          {shop.pickup_enabled   && <span style={{ fontSize:11, fontWeight:600, color:'var(--text-3)' }}>🏪 Pickup</span>}
          {shop.min_order_amount > 0 && <span style={{ fontSize:11, fontWeight:600, color:'var(--text-3)' }}>₹{shop.min_order_amount} min</span>}
        </div>
      </div>

      {/* Rating + distance */}
      <div style={{ padding:'12px 14px 12px 0', display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'space-between', flexShrink:0, gap:4 }}>
        <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:800, color:'#f59e0b' }}>★ {(shop.rating || 4.0).toFixed(1)}</div>
        {shop.distance !== null && (
          <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textAlign:'right' }}>
            {shop.distance < 1 ? `${Math.round(shop.distance * 1000)}m` : `${shop.distance.toFixed(1)}km`}
          </div>
        )}
      </div>
    </Link>
  )
}