'use client'
import { useEffect, useState } from 'react'
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
  const [locationStatus, setLocationStatus] = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [radius, setRadius] = useState(10)

  useEffect(() => {
    loadData()
    // Load saved location
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) { setUserLat(saved.lat); setUserLng(saved.lng); setLocationStatus('granted') }
      else askLocation()
    } catch { askLocation() }
  }, [])

  function askLocation() {
    if (!navigator.geolocation) return
    setLocationStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationStatus('granted') },
      () => setLocationStatus('denied'),
      { timeout: 6000, enableHighAccuracy: false }
    )
  }

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

  const shopsWithDist = shops.map(s => ({
    ...s,
    distance: (userLat && userLng && s.latitude && s.longitude)
      ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude))
      : null
  }))

  const filtered = shopsWithDist
    .filter(s => {
      const matchCat = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory.toLowerCase())
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())
      const inRadius = !userLat || s.distance === null || s.distance <= radius
      return matchCat && matchSearch && inRadius
    })
    .sort((a, b) => (a.distance !== null && b.distance !== null) ? a.distance - b.distance : 0)

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
            <Link href="/location?return=/stores" className="flex-1 flex items-center gap-2 bg-white border-2 rounded-xl px-3 py-1.5 hover:border-brand-500 transition-colors" style={{ borderColor: '#e5e7eb' }}>
              <span className="text-sm" style={{ color: '#ff5a1f' }}>📍</span>
              <div className="flex-1 min-w-0">
                {locationStatus === 'granted' ? (
                  <p className="text-xs font-bold text-gray-800 truncate">Delivery here</p>
                ) : (
                  <p className="text-xs text-gray-400 font-medium">Set your location</p>
                )}
              </div>
              <span className="text-gray-400 text-xs">▼</span>
            </Link>

            {/* Search */}
            <Link href="/search" className="w-9 h-9 bg-white border-2 rounded-xl flex items-center justify-center text-gray-500 hover:border-brand-500 transition-colors flex-shrink-0" style={{ borderColor: '#e5e7eb' }}>
              🔍
            </Link>

            <Link href="/auth/login" className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl" style={{ background: '#fff3ef', color: '#ff5a1f' }}>
              Login
            </Link>
          </div>

          {/* Radius selector when location granted */}
          {locationStatus === 'granted' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Within:</span>
              {[1, 2, 5, 10, 25].map(r => (
                <button key={r} onClick={() => setRadius(r)}
                  className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${radius === r ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                  style={radius === r ? { background: '#ff5a1f' } : {}}>
                  {r}km
                </button>
              ))}
              <button onClick={() => setRadius(999)}
                className={`text-xs font-bold px-2.5 py-1 rounded-full transition-all ${radius === 999 ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                style={radius === 999 ? { background: '#ff5a1f' } : {}}>
                All
              </button>
            </div>
          )}

          {locationStatus === 'denied' && (
            <button onClick={askLocation} className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: '#fff3ef', color: '#ff5a1f' }}>
              📍 Allow location for nearby shops
            </button>
          )}

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button onClick={() => setActiveCategory('all')}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all"
              style={activeCategory === 'all' ? { background: '#ff5a1f', color: 'white' } : { background: '#f3f4f6', color: '#6b7280' }}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.name)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1"
                style={activeCategory === cat.name ? { background: '#ff5a1f', color: 'white' } : { background: '#f3f4f6', color: '#6b7280' }}>
                {cat.icon} {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-gray-600">
            {filtered.length} shops {locationStatus === 'granted' && radius !== 999 ? `within ${radius}km` : 'available'}
          </p>
          {locationStatus === 'asking' && (
            <p className="text-xs text-amber-600 font-semibold animate-pulse">📍 Detecting location...</p>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({length:8}).map((_,i) => <div key={i} className="h-48 shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏪</div>
            <p className="font-bold text-xl mb-1">No shops found</p>
            <p className="text-gray-400 text-sm mb-5">{userLat ? `Try increasing radius or browse all shops` : 'Try a different search'}</p>
            {userLat && <button onClick={() => setRadius(999)} className="btn-primary">Show all shops</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(shop => {
              const catKey = Object.keys(CAT_ICONS).find(k => shop.category_name?.toLowerCase().includes(k)) || 'food'
              const bg = CAT_COLORS[catKey] || CAT_COLORS.default
              return (
                <Link key={shop.id} href={`/stores/${shop.id}`}>
                  <div className="card-hover overflow-hidden cursor-pointer">
                    <div className="h-28 sm:h-32 flex items-center justify-center relative" style={{ background: bg }}>
                      <div className="text-4xl">{CAT_ICONS[catKey]}</div>
                      <div className="absolute top-2 left-2">
                        {shop.is_open
                          ? <span className="badge-green text-xs">Open</span>
                          : <span className="badge-gray text-xs">Closed</span>}
                      </div>
                      <div className="absolute top-2 right-2 bg-white rounded-lg px-1.5 py-0.5 text-xs font-black" style={{ color: '#d97706' }}>
                        ★ {shop.rating}
                      </div>
                      {(shop as any).distance !== null && (shop as any).distance !== undefined && (
                        <div className="absolute bottom-2 right-2 bg-white/90 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                          {(shop as any).distance < 1 ? `${Math.round((shop as any).distance * 1000)}m` : `${(shop as any).distance.toFixed(1)}km`}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-black text-sm leading-tight line-clamp-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{shop.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{shop.category_name?.split(' ')[0]} · {shop.area}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid #f3f4f6' }}>
                        {shop.delivery_enabled && <span className="text-xs text-gray-500">🛵 {shop.avg_delivery_time}m</span>}
                        {shop.pickup_enabled && <span className="text-xs text-gray-500">🏃</span>}
                        <span className="ml-auto text-xs text-gray-400">{shop.min_order_amount ? `₹${shop.min_order_amount}+` : 'No min'}</span>
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
              style={{ color: item.active ? '#ff5a1f' : '#9ca3af' }}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-bold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
