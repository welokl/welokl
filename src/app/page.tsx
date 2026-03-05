'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ThemeToggle from '@/components/ThemeToggle'

interface Shop {
  id: string
  name: string
  description: string | null
  category_name: string
  is_open: boolean
  rating: number
  avg_delivery_time: number
  delivery_enabled: boolean
  pickup_enabled: boolean
  min_order_amount: number
  area: string
  image_url: string | null
  latitude: number | null
  longitude: number | null
}

interface Product {
  id: string
  name: string
  price: number
  original_price: number | null
  image_url: string | null
  shop_id: string
  shop_name?: string
}

// ── haversine distance in km ──
function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CATEGORIES = [
  { icon: '🍔', name: 'Food', q: 'food' },
  { icon: '🛒', name: 'Grocery', q: 'grocery' },
  { icon: '💊', name: 'Pharmacy', q: 'pharmacy' },
  { icon: '📱', name: 'Electronics', q: 'electronics' },
  { icon: '💇', name: 'Salon', q: 'salon' },
  { icon: '🌸', name: 'Gifts', q: 'gifts' },
  { icon: '🔧', name: 'Hardware', q: 'hardware' },
  { icon: '🐾', name: 'Pets', q: 'pet' },
]

const TICKER = [
  '🍕 Pizza — 18 min',
  '🥛 Milk — 9 min',
  '💊 Pharmacy — midnight',
  '🌹 Flowers — now',
  '🍦 Ice cream — 2am',
]

const CAT_COLOR: Record<string, string> = {
  food: '#FF3008', grocery: '#00A878', pharmacy: '#0066FF',
  electronics: '#7B2FFF', salon: '#FF2D78', default: '#FF5A1F',
}
const CAT_ICON: Record<string, string> = {
  food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
  salon: '💇', hardware: '🔧', pet: '🐾', flower: '🌸', default: '🏪',
}

export default function HomePage() {
  const [user, setUser] = useState<any>(undefined)
  const [allShops, setAllShops] = useState<Shop[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [displayShops, setDisplayShops] = useState<(Shop & { km: number | null })[]>([])
  const [loaded, setLoaded] = useState(false)
  const [locStatus, setLocStatus] = useState<'idle' | 'detecting' | 'granted' | 'denied'>('idle')
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [areaName, setAreaName] = useState('')
  const [radius, setRadius] = useState(10)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [tickerIdx, setTickerIdx] = useState(0)
  const [searchVal, setSearchVal] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // ticker
  useEffect(() => {
    const t = setInterval(() => setTickerIdx(i => (i + 1) % TICKER.length), 2800)
    return () => clearInterval(t)
  }, [])

  // auth
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null))
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  // location init
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat && saved?.lng) {
        setUserLat(saved.lat)
        setUserLng(saved.lng)
        setAreaName(saved.name || '')
        setLocStatus('granted')
        return
      }
    } catch {}
    detectLocation()
  }, [])

  function detectLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('detecting')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setUserLat(latitude)
        setUserLng(longitude)
        setLocStatus('granted')
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

  // load shops
  const loadShops = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false })
    setAllShops(data || [])
    const { data: prods } = await supabase.from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name)')
      .eq('is_available', true).limit(16)
    setProducts((prods || []).map((p: any) => ({ ...p, shop_name: p.shops?.name })))
    setLoaded(true)
  }, [])

  useEffect(() => { loadShops() }, [loadShops])

  // filter + sort shops whenever deps change
  useEffect(() => {
    let shops = allShops.map(s => ({
      ...s,
      km: (userLat && userLng && s.latitude && s.longitude)
        ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude))
        : null
    }))

    // STRICT location filter — if we have coords, only show within radius
    if (userLat && userLng) {
      shops = shops.filter(s => {
        if (s.km === null) return false   // shop has no coords → exclude
        return s.km <= radius
      })
    }

    // category filter
    if (activeCategory) {
      shops = shops.filter(s => s.category_name?.toLowerCase().includes(activeCategory.toLowerCase()))
    }

    // search filter
    if (searchVal.trim()) {
      const q = searchVal.toLowerCase()
      shops = shops.filter(s => s.name.toLowerCase().includes(q) || s.area?.toLowerCase().includes(q) || s.category_name?.toLowerCase().includes(q))
    }

    // sort: open first, then by distance, then rating
    shops.sort((a, b) => {
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1
      if (a.km !== null && b.km !== null) return a.km - b.km
      return b.rating - a.rating
    })

    setDisplayShops(shops)
  }, [allShops, userLat, userLng, radius, activeCategory, searchVal])

  const openShops = displayShops.filter(s => s.is_open)
  const closedShops = displayShops.filter(s => !s.is_open)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;0,9..40,900;1,9..40,400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .shimmer { background: linear-gradient(90deg, #F0F0F0 25%, #E0E0E0 50%, #F0F0F0 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 16px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeUp 0.4s ease forwards; }
        .shop-card { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .shop-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.12); }
        .pill-btn { border: none; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .pill-btn:hover { opacity: 0.85; }
        input { font-family: inherit; }
      `}</style>

      {/* ── TOP NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FF3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16 }}>W</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.03em' }}>welokl</span>
          </Link>

          {/* Location pill */}
          <button
            onClick={detectLocation}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10,
              padding: '7px 12px', cursor: 'pointer', flexShrink: 0,
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 14 }}>📍</span>
            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locStatus === 'detecting' ? 'Detecting…' : areaName || 'Set location'}
            </span>
            <span style={{ color: 'var(--text-3)', fontSize: 10 }}>▼</span>
          </button>

          {/* Search */}
          <div style={{ flex: 1, position: 'relative', maxWidth: 440 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-3)', pointerEvents: 'none' }}>🔍</span>
            <input
              ref={searchRef}
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setSearchVal('')}
              placeholder="Search shops, dishes, products…"
              style={{
                width: '100%', padding: '9px 12px 9px 38px',
                background: 'var(--input-bg)', border: '2px solid transparent',
                borderRadius: 12, fontSize: 14, fontWeight: 500, color: 'var(--text)',
                outline: 'none', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#FF3008'}
              onBlur={e => e.target.style.borderColor = 'transparent'}
            />
            {searchVal && (
              <button onClick={() => setSearchVal('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 14, color: 'var(--text-3)', cursor: 'pointer' }}>✕</button>
            )}
          </div>

          {/* Auth + Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
            {user === undefined ? (
              <div style={{ width: 80, height: 34, borderRadius: 10 }} className="shimmer" />
            ) : user ? (
              <>
                <Link href="/dashboard/customer" style={{
                  textDecoration: 'none', fontSize: 13, fontWeight: 700,
                  padding: '7px 14px', borderRadius: 10,
                  background: 'var(--brand-muted)', color: 'var(--brand)',
                }}>My Orders</Link>
                <button onClick={async () => { await createClient().auth.signOut(); setUser(null) }}
                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', padding: '7px 12px' }}>Log in</Link>
                <Link href="/auth/signup" style={{
                  textDecoration: 'none', fontSize: 13, fontWeight: 700,
                  padding: '8px 16px', borderRadius: 10,
                  background: 'var(--brand)', color: 'white',
                }}>Sign up</Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ background: '#1A1A1A', position: 'relative', overflow: 'hidden', padding: '48px 16px 56px' }}>
        {/* subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '40px 40px', pointerEvents: 'none',
        }} />
        {/* glow */}
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, background: '#FF3008', borderRadius: '50%', opacity: 0.08, filter: 'blur(120px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1120, margin: '0 auto', position: 'relative' }}>
          {/* Ticker */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 14px', marginBottom: 24, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.45)', marginRight: 2 }}>Near you:</span>
            <span style={{ fontWeight: 600, color: 'white' }}>{TICKER[tickerIdx]}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.6rem)', fontWeight: 900, color: 'white', lineHeight: 1.05, letterSpacing: '-0.04em', marginBottom: 16 }}>
                Anything from your<br />
                <span style={{ color: '#FF3008' }}>neighbourhood</span>, delivered.
              </h1>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, maxWidth: 440, marginBottom: 28 }}>
                Food, grocery, pharmacy, salon — real local shops near you. Real riders. Under 30 minutes.
              </p>

              {/* Location status & radius */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {locStatus === 'denied' && (
                  <button onClick={detectLocation} style={{
                    background: '#FF3008', border: 'none', borderRadius: 12,
                    padding: '10px 20px', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit'
                  }}>📍 Allow location to see nearby shops</button>
                )}
                {locStatus === 'detecting' && (
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="shimmer" style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} /> Detecting your location…
                  </div>
                )}
                {locStatus === 'granted' && areaName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '8px 14px' }}>
                    <span style={{ color: '#22C55E', fontSize: 13 }}>📍</span>
                    <span style={{ color: '#22C55E', fontWeight: 700, fontSize: 13 }}>{areaName}</span>
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>·</span>
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>within {radius}km</span>
                  </div>
                )}

                {/* Radius chips */}
                {locStatus === 'granted' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[2, 5, 10, 20].map(r => (
                      <button key={r} onClick={() => setRadius(r)}
                        className="pill-btn"
                        style={{
                          padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: radius === r ? '#FF3008' : 'rgba(255,255,255,0.1)',
                          color: radius === r ? 'white' : 'rgba(255,255,255,0.5)',
                          border: radius === r ? 'none' : '1px solid rgba(255,255,255,0.15)',
                        }}>{r}km</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div style={{ display: 'grid', gap: 8, minWidth: 200 }}>
              {[
                { icon: '🏪', val: loaded ? displayShops.length : '…', label: locStatus === 'granted' ? `shops within ${radius}km` : 'shops nearby' },
                { icon: '🟢', val: loaded ? openShops.length : '…', label: 'open right now' },
                { icon: '⚡', val: '< 30', label: 'min avg delivery' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 22, color: 'white', lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORY PILLS ── */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', position: 'sticky', top: 60, zIndex: 40 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 16px' }}>
          <div className="no-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            <button
              onClick={() => setActiveCategory(null)}
              className="pill-btn"
              style={{
                flexShrink: 0, padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                background: !activeCategory ? 'var(--brand)' : 'var(--bg-3)',
                color: !activeCategory ? 'white' : 'var(--text-2)',
                border: 'none',
              }}
            >All</button>
            {CATEGORIES.map(cat => (
              <button key={cat.name}
                onClick={() => setActiveCategory(activeCategory === cat.q ? null : cat.q)}
                className="pill-btn"
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                  background: activeCategory === cat.q ? '#FF3008' : '#F5F5F5',
                  color: activeCategory === cat.q ? 'white' : 'var(--text-2)',
                  border: 'none', whiteSpace: 'nowrap',
                }}>
                <span>{cat.icon}</span>{cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 80px' }}>

        {/* Location required state */}
        {locStatus === 'denied' && (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)', marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📍</div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', marginBottom: 8 }}>Share your location</h2>
            <p style={{ color: 'var(--text-3)', fontSize: 15, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              We only show shops near you. Enable location to see what's available right now.
            </p>
            <button onClick={detectLocation} style={{
              background: '#FF3008', border: 'none', borderRadius: 12,
              padding: '12px 28px', fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit',
            }}>Enable location</button>
          </div>
        )}

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {activeCategory
                ? `${CATEGORIES.find(c => c.q === activeCategory)?.name} near you`
                : searchVal
                  ? `Results for "${searchVal}"`
                  : locStatus === 'granted' ? `Shops within ${radius}km` : 'Shops near you'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
              {loaded
                ? `${openShops.length} open · ${closedShops.length} closed`
                : 'Loading…'}
              {locStatus === 'detecting' && ' · Detecting location…'}
            </p>
          </div>
          <Link href="/stores" style={{ textDecoration: 'none', fontSize: 13, fontWeight: 700, color: 'var(--brand)' }}>See all →</Link>
        </div>

        {/* Shop grid */}
        {!loaded ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ height: 240 }} className="shimmer" />
            ))}
          </div>
        ) : displayShops.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', background: 'var(--card-bg)', borderRadius: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏪</div>
            <h3 style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>No shops found nearby</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 20 }}>
              {locStatus === 'granted' ? `No shops within ${radius}km. Try increasing your radius.` : 'Set your location to see nearby shops.'}
            </p>
            {locStatus === 'granted' && (
              <button onClick={() => setRadius(50)} style={{
                background: '#FF3008', border: 'none', borderRadius: 12,
                padding: '10px 24px', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', fontFamily: 'inherit',
              }}>Expand to 50km</button>
            )}
          </div>
        ) : (
          <>
            {/* Open shops */}
            {openShops.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
                {openShops.map((shop, i) => (
                  <ShopCard key={shop.id} shop={shop} index={i} />
                ))}
              </div>
            )}

            {/* Closed shops */}
            {closedShops.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-3)' }}>Closed now</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, marginBottom: 40 }}>
                  {closedShops.map((shop, i) => (
                    <ShopCard key={shop.id} shop={shop} index={i} closed />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Trending products */}
        {products.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', letterSpacing: '-0.02em' }}>🔥 Trending products</h2>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>Ordered the most today</p>
              </div>
            </div>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}

        {/* Partner CTA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 56, borderTop: '1px solid var(--border)', paddingTop: 40 }}>
          <Link href="/auth/signup?role=business" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 20, padding: 28, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🏪</div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Own a shop?</h3>
              <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>List free. 15% only on sales. We bring customers to you.</p>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FF3008' }}>Register your shop →</span>
            </div>
          </Link>
          <Link href="/auth/signup?role=delivery" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#1A1A1A', borderRadius: 20, padding: 28, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(255,48,8,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🛵</div>
              <h3 style={{ fontWeight: 900, fontSize: 18, color: 'white', marginBottom: 6 }}>Earn with Welokl</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 16 }}>₹20 per delivery, instant wallet credit. Work when you want.</p>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FF3008' }}>Become a rider →</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--card-bg)', padding: '28px 16px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#FF3008', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 13 }}>W</div>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.02em' }}>welokl</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Your neighbourhood, on your phone · © {new Date().getFullYear()} Welokl</p>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-3)' }}>
            <a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>Privacy</a>
            <a href="#" style={{ textDecoration: 'none', color: 'inherit' }}>Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── SHOP CARD ──
function ShopCard({ shop, index, closed }: { shop: Shop & { km: number | null }; index: number; closed?: boolean }) {
  const catKey = Object.keys(CAT_ICON).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'
  const accentColor = CAT_COLOR[catKey] || CAT_COLOR.default
  const catBg: Record<string, string> = {
    food: 'rgba(255,48,8,0.06)', grocery: 'rgba(0,168,120,0.07)', pharmacy: 'rgba(0,102,255,0.07)',
    electronics: 'rgba(123,47,255,0.07)', salon: 'rgba(255,45,120,0.07)', hardware: 'rgba(120,113,108,0.07)',
    pet: 'rgba(251,146,60,0.07)', default: 'rgba(255,90,31,0.06)'
  }
  const bg = catBg[catKey] || catBg.default

  return (
    <Link href={`/stores/${shop.id}`} style={{ textDecoration: 'none' }}>
      <div
        className="shop-card fade-in"
        style={{
          background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden',
          border: '1px solid var(--border)', opacity: closed ? 0.65 : 1,
          animationDelay: `${index * 30}ms`, animationFillMode: 'both',
        }}
      >
        {/* Image / placeholder */}
        <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {shop.image_url ? (
            <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 52, opacity: 0.35 }}>{CAT_ICON[catKey]}</span>
          )}
          {shop.image_url && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)' }} />
          )}

          {/* Open/closed badge */}
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            {shop.is_open ? (
              <span style={{ background: 'rgba(22,197,94,0.95)', color: 'white', fontWeight: 700, fontSize: 11, padding: '3px 8px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>● Open</span>
            ) : (
              <span style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 11, padding: '3px 8px', borderRadius: 999, backdropFilter: 'blur(4px)' }}>Closed</span>
            )}
          </div>

          {/* Rating */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800, color: '#FFB800', display: 'flex', alignItems: 'center', gap: 3 }}>
            ★ {shop.rating?.toFixed(1)}
          </div>

          {/* Distance */}
          {shop.km !== null && (
            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: 8, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
              📍 {shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: '14px 14px 12px' }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shop.description || `${shop.category_name?.split(' ')[0]} · ${shop.area}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
              {shop.delivery_enabled ? `🛵 ${shop.avg_delivery_time} min` : '🏃 Pickup only'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>
              {shop.min_order_amount > 0 ? `₹${shop.min_order_amount}+ min` : 'No minimum'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── PRODUCT CARD ──
function ProductCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : null

  return (
    <Link href={`/stores/${product.shop_id}`} style={{ textDecoration: 'none' }}>
      <div className="shop-card" style={{ flexShrink: 0, width: 160, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ height: 110, background: 'var(--bg-3)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 36, opacity: 0.25 }}>🍽️</span>
          )}
          {disc && (
            <div style={{ position: 'absolute', top: 8, left: 8, background: '#22C55E', color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 999 }}>-{disc}%</div>
          )}
        </div>
        <div style={{ padding: '10px 12px 12px' }}>
          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
          {product.shop_name && <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.shop_name}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#FF3008' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize: 12, color: 'var(--text-4)', textDecoration: 'line-through' }}>₹{product.original_price}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}