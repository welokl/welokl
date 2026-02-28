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

export default function StoresPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [radius, setRadius] = useState(10)

  useEffect(() => {
    loadData()
    askLocation()
  }, [])

  function askLocation() {
    if (!navigator.geolocation) return
    setLocationStatus('asking')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocationStatus('granted') },
      () => setLocationStatus('denied'),
      { timeout: 8000, enableHighAccuracy: true }
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

  const shopsWithDistance = shops.map(s => ({
    ...s,
    distance: (userLat && userLng && s.latitude && s.longitude)
      ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude))
      : null
  }))

  const filtered = shopsWithDistance
    .filter(s => {
      const matchCat = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory.toLowerCase())
      const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())
      const inRadius = !userLat || s.distance === null || s.distance <= radius
      return matchCat && matchSearch && inRadius
    })
    .sort((a, b) => (a.distance !== null && b.distance !== null) ? a.distance - b.distance : 0)

  const icons: Record<string, string> = {
    food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
    salon: '💇', fashion: '👗', stationery: '📚', hardware: '🔧', pet: '🐾', flower: '🌸'
  }
  const bgs: Record<string, string> = {
    food: 'bg-red-50', grocery: 'bg-green-50', pharmacy: 'bg-blue-50', electronics: 'bg-purple-50',
    salon: 'bg-pink-50', fashion: 'bg-pink-50', stationery: 'bg-amber-50', hardware: 'bg-stone-50', default: 'bg-orange-50'
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-2 space-y-2">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex-shrink-0 flex items-center gap-1.5">
              <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center text-white font-black text-xs">W</div>
              <span className="font-display font-bold text-base hidden sm:block">welokl</span>
            </Link>
            <div className="flex-1 relative">
              <input value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 bg-gray-100 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Search shops, areas..." />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
            </div>
            <Link href="/auth/login" className="flex-shrink-0 text-xs font-semibold text-brand-500 bg-brand-50 px-3 py-1.5 rounded-xl">Login</Link>
          </div>

          {/* Location */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {locationStatus === 'asking' && (
              <span className="flex-shrink-0 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                <span className="animate-pulse">📍</span> Detecting...
              </span>
            )}
            {locationStatus === 'granted' && (
              <>
                <span className="flex-shrink-0 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">📍 Location on</span>
                <select value={radius} onChange={e => setRadius(Number(e.target.value))}
                  className="flex-shrink-0 text-xs border border-gray-200 rounded-full px-3 py-1.5 bg-white font-semibold">
                  <option value={1}>1 km</option>
                  <option value={2}>2 km</option>
                  <option value={5}>5 km</option>
                  <option value={10}>10 km</option>
                  <option value={25}>25 km</option>
                  <option value={999}>All</option>
                </select>
              </>
            )}
            {(locationStatus === 'denied' || locationStatus === 'idle') && (
              <button onClick={askLocation} className="flex-shrink-0 text-xs text-brand-500 bg-brand-50 px-3 py-1.5 rounded-full">
                📍 Find shops near me
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setActiveCategory('all')}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeCategory === 'all' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.name)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${activeCategory === cat.name ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {cat.icon} {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shop grid */}
      <div className="max-w-6xl mx-auto px-3 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-600">{filtered.length} shops {locationStatus === 'granted' ? `within ${radius}km` : 'nearby'}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({length: 8}).map((_, i) => <div key={i} className="h-44 card shimmer" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🏪</div>
            <p className="font-bold mb-1">No shops found</p>
            <p className="text-gray-400 text-sm mb-4">{userLat ? `Try increasing radius above ${radius}km` : 'Try a different search'}</p>
            {userLat && <button onClick={() => setRadius(999)} className="btn-primary text-sm">Show all shops</button>}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(shop => {
              const catKey = Object.keys(icons).find(k => shop.category_name?.toLowerCase().includes(k)) || 'food'
              const bgKey = Object.keys(bgs).find(k => shop.category_name?.toLowerCase().includes(k)) || 'default'
              return (
                <Link key={shop.id} href={`/stores/${shop.id}`}>
                  <div className="card overflow-hidden active:scale-95 transition-transform duration-150">
                    <div className={`h-28 ${bgs[bgKey]} flex items-center justify-center relative`}>
                      <div className="text-4xl">{icons[catKey]}</div>
                      <div className="absolute top-2 left-2">
                        {shop.is_open
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">Open</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">Closed</span>}
                      </div>
                      <div className="absolute top-2 right-2 bg-white/90 rounded-lg px-1.5 py-0.5 text-xs font-bold text-amber-600">★ {shop.rating}</div>
                      {shop.distance !== null && shop.distance !== undefined && (
                        <div className="absolute bottom-2 right-2 bg-white/90 rounded-lg px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                          {shop.distance < 1 ? `${Math.round(shop.distance * 1000)}m` : `${shop.distance.toFixed(1)}km`}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-sm leading-tight line-clamp-1">{shop.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{shop.category_name?.split(' ')[0]} · {shop.area}</p>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
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

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { icon: '🏠', label: 'Home', href: '/' },
            { icon: '🛍️', label: 'Shops', href: '/stores', active: true },
            { icon: '🛒', label: 'Cart', href: '/cart' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer' },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all ${item.active ? 'text-brand-500' : 'text-gray-400'}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
