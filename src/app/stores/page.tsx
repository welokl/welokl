'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Shop, Category } from '@/types'

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CAT_ICONS: Record<string, string> = {
  food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
  salon: '💇', fashion: '👗', stationery: '📚', hardware: '🔧', pet: '🐾', flower: '🌸'
}
const CAT_COLORS: Record<string, string> = {
  food: '#fff1f0', grocery: '#f0fdf4', pharmacy: '#eff6ff', electronics: '#f5f3ff',
  salon: '#fdf2f8', fashion: '#fdf2f8', stationery: '#fffbeb', hardware: '#fafaf9', default: '#fff3ef'
}

export default function StoresPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationName, setLocationName] = useState<string>('')
  const [locationStatus, setLocationStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [radius, setRadius] = useState(5) // FIX: default 5km, not 10km

  // FIX: Save location to localStorage whenever it changes
  const saveLocation = useCallback((lat: number, lng: number, name?: string) => {
    setUserLat(lat)
    setUserLng(lng)
    setLocationStatus('granted')
    if (name) setLocationName(name)
    try {
      localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name: name || '' }))
    } catch { }
  }, [])

  const askLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    setLocationStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        // Reverse geocode to get area name
        let name = ''
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const data = await res.json()
          name = data.address?.suburb || data.address?.neighbourhood || data.address?.town || data.address?.city || ''
        } catch { }
        saveLocation(latitude, longitude, name)
      },
      () => setLocationStatus('denied'),
      { timeout: 8000, enableHighAccuracy: true }
    )
  }, [saveLocation])

  useEffect(() => {
    loadData()
    // FIX: Load saved location from localStorage first
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat && saved?.lng) {
        setUserLat(saved.lat)
        setUserLng(saved.lng)
        setLocationName(saved.name || '')
        setLocationStatus('granted')
      } else {
        askLocation()
      }
    } catch {
      askLocation()
    }
  }, []) // eslint-disable-line

  async function loadData() {
    const supabase = createClient()
    const [{ data: shopData }, { data: catData }] = await Promise.all([
      supabase.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setShops(shopData || [])
    setCategories(catData || [])
    setLoading(false)
  }

  // FIX: Only compute distance when we have actual coordinates
  const shopsWithDist = shops.map(s => ({
    ...s,
    distance: (userLat !== null && userLng !== null && s.latitude && s.longitude)
      ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude))
      : null
  }))

  // FIX: Strict radius filtering — when location is known, ONLY show shops within radius
  const filtered = shopsWithDist
    .filter(s => {
      const matchCat = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory.toLowerCase())
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())
      // FIX: If we have location + distance, strictly enforce radius. Don't show shops with null distance when location is granted.
      const inRadius = locationStatus !== 'granted'
        ? true
        : (s.distance !== null && s.distance <= radius) || radius === 999
      return matchCat && matchSearch && inRadius
    })
    .sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance
      if (a.distance !== null) return -1
      if (b.distance !== null) return 1
      return 0
    })

  const openCount = filtered.filter(s => s.is_open).length
  const closedCount = filtered.filter(s => !s.is_open).length

  return (
    <div className="min-h-screen pb-24" style={{ background: '#f8f7f4' }}>

      {/* Sticky header */}
      <div className="sticky top-0 z-40 glass border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-3 py-2.5 space-y-2">

          {/* Top row */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex-shrink-0 flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ background: '#ff5a1f' }}>W</div>
            </Link>

            {/* Location bar */}
            <button
              onClick={askLocation}
              className="flex-1 flex items-center gap-2 bg-white border-2 rounded-xl px-3 py-1.5 hover:border-orange-400 transition-colors text-left"
              style={{ borderColor: locationStatus === 'granted' ? '#ff5a1f' : '#e5e7eb' }}
            >
              <span className="text-sm" style={{ color: '#ff5a1f' }}>📍</span>
              <div className="flex-1 min-w-0">
                {locationStatus === 'granted' && locationName ? (
                  <p className="text-xs font-black text-gray-800 truncate">{locationName}</p>
                ) : locationStatus === 'granted' ? (
                  <p className="text-xs font-bold text-gray-800 truncate">Location set ✓</p>
                ) : locationStatus === 'asking' ? (
                  <p className="text-xs text-amber-500 font-semibold animate-pulse">Detecting location…</p>
                ) : (
                  <p className="text-xs text-gray-400 font-medium">Tap to set location</p>
                )}
              </div>
              <span className="text-gray-400 text-xs">▼</span>
            </button>

            {/* Search input inline */}
            <div className="flex-1 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search shops..."
                className="w-full bg-white border-2 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold outline-none focus:border-orange-400 transition-colors"
                style={{ borderColor: '#e5e7eb' }}
              />
            </div>
          </div>

          {/* Radius selector */}
          {locationStatus === 'granted' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 font-bold">Within:</span>
              {[1, 2, 5, 10, 25].map(r => (
                <button key={r} onClick={() => setRadius(r)}
                  className={`text-xs font-black px-2.5 py-1 rounded-full transition-all ${radius === r ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                  style={radius === r ? { background: '#ff5a1f' } : {}}>
                  {r}km
                </button>
              ))}
              <button onClick={() => setRadius(999)}
                className={`text-xs font-black px-2.5 py-1 rounded-full transition-all ${radius === 999 ? 'text-white shadow-sm' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
                style={radius === 999 ? { background: '#ff5a1f' } : {}}>
                All
              </button>
            </div>
          )}

          {locationStatus === 'denied' && (
            <button onClick={askLocation} className="w-full text-xs font-bold px-3 py-2 rounded-xl text-center" style={{ background: '#fff3ef', color: '#ff5a1f' }}>
              📍 Allow location to see nearby shops
            </button>
          )}

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button onClick={() => setActiveCategory('all')}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition-all"
              style={activeCategory === 'all' ? { background: '#ff5a1f', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.name)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1"
                style={activeCategory === cat.name ? { background: '#ff5a1f', color: 'white' } : { background: '#f3f4f6', color: '#374151' }}>
                {cat.icon} {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-black text-gray-800">
              {filtered.length} shops {locationStatus === 'granted' && radius !== 999 ? `within ${radius}km` : 'available'}
            </p>
            {filtered.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                {openCount} open now · {closedCount} closed
              </p>
            )}
          </div>
          {locationStatus === 'asking' && (
            <p className="text-xs text-amber-600 font-semibold animate-pulse">📍 Detecting…</p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-48 rounded-2xl shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <p className="font-black text-xl mb-1 text-gray-800">No shops found</p>
            <p className="text-gray-400 text-sm mb-5">
              {locationStatus === 'granted' ? `No shops within ${radius}km. Try a larger radius.` : 'Allow location or try searching.'}
            </p>
            {locationStatus === 'granted' && radius !== 999 && (
              <button onClick={() => setRadius(999)}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: '#ff5a1f' }}>
                Show all shops
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(shop => {
              const catKey = Object.keys(CAT_ICONS).find(k => shop.category_name?.toLowerCase().includes(k)) || 'food'
              const bg = CAT_COLORS[catKey] || CAT_COLORS.default
              const dist = (shop as any).distance
              return (
                <Link key={shop.id} href={`/stores/${shop.id}`}>
                  <div className="card-hover overflow-hidden cursor-pointer rounded-2xl bg-white shadow-sm hover:shadow-md transition-all">
                    <div className="h-28 sm:h-32 flex items-center justify-center relative" style={{ background: bg }}>
                      {/* Shop image or emoji */}
                      {(shop as any).image_url ? (
                        <img src={(shop as any).image_url} alt={shop.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-4xl">{CAT_ICONS[catKey]}</div>
                      )}
                      <div className="absolute top-2 left-2">
                        {shop.is_open
                          ? <span className="badge-green text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#dcfce7', color: '#16a34a' }}>● Open</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: '#f1f5f9', color: '#64748b' }}>● Closed</span>}
                      </div>
                      <div className="absolute top-2 right-2 bg-white rounded-lg px-1.5 py-0.5 text-xs font-black shadow-sm" style={{ color: '#d97706' }}>
                        ★ {shop.rating}
                      </div>
                      {dist !== null && dist !== undefined && (
                        <div className="absolute bottom-2 right-2 bg-white/95 rounded-lg px-1.5 py-0.5 text-xs font-bold text-gray-700 shadow-sm">
                          📍 {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-black text-sm leading-tight line-clamp-1 text-gray-900">{shop.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{shop.category_name?.split(' ')[0]} · {shop.area}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
                        {shop.delivery_enabled && (
                          <span className="text-xs text-gray-600 font-semibold">🛵 {shop.avg_delivery_time}m</span>
                        )}
                        {shop.pickup_enabled && <span className="text-xs text-gray-500">🏃 Pickup</span>}
                        {(shop as any).free_delivery && (
                          <span className="text-xs font-bold" style={{ color: '#16a34a' }}>Free delivery</span>
                        )}
                        <span className="ml-auto text-xs font-bold text-gray-500">
                          {shop.min_order_amount ? `₹${shop.min_order_amount}+` : 'No min'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 glass border-t border-gray-200 z-50">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { icon: '🏠', label: 'Home', href: '/' },
            { icon: '🛍️', label: 'Shops', href: '/stores', active: true },
            { icon: '🛒', label: 'Cart', href: '/cart' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer' },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all"
              style={{ color: item.active ? '#ff5a1f' : '#6b7280' }}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-black">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}