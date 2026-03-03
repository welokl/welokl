'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Shop } from '@/types'

export default function FavouritesPage() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFavourites()
  }, [])

  async function loadFavourites() {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    if (ids.length === 0) { setLoading(false); return }
    const supabase = createClient()
    const { data } = await supabase.from('shops').select('*').in('id', ids).eq('is_active', true)
    setShops(data || [])
    setLoading(false)
  }

  function removeFavourite(shopId: string) {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    const updated = ids.filter(id => id !== shopId)
    localStorage.setItem('welokl_favourites', JSON.stringify(updated))
    setShops(shops.filter(s => s.id !== shopId))
  }

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-24">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-xl text-lg">←</button>
        <h1 className="font-bold">Saved Shops ❤️</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5">
        {loading ? (
          <div className="space-y-3">{Array.from({length:3}).map((_,i) => <div key={i} className="h-24 card shimmer" />)}</div>
        ) : shops.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">❤️</div>
            <p className="font-bold text-lg mb-1">No saved shops yet</p>
            <p className="text-gray-400 text-sm mb-5">Tap the heart icon on any shop to save it here</p>
            <Link href="/stores" className="btn-primary">Browse shops</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map(shop => (
              <div key={shop.id} className="card p-4 flex items-center gap-3">
                <Link href={`/stores/${shop.id}`} className="flex-1 flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {shop.category_name?.includes('Food') ? '🍔' : shop.category_name?.includes('Grocery') ? '🛒' :
                     shop.category_name?.includes('Pharmacy') ? '💊' : shop.category_name?.includes('Electronics') ? '📱' : '🏪'}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{shop.name}</p>
                    <p className="text-xs text-gray-400">{shop.category_name?.split(' ')[0]} · {shop.area} · ★ {shop.rating}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {shop.is_open ? <span className="text-xs text-green-600 font-semibold">Open</span> : <span className="text-xs text-gray-400">Closed</span>}
                      {shop.delivery_enabled && <span className="text-xs text-gray-400">🛵 {shop.avg_delivery_time}min</span>}
                    </div>
                  </div>
                </Link>
                <button onClick={() => removeFavourite(shop.id)}
                  className="text-red-400 hover:text-red-600 text-xl flex-shrink-0 p-2">❤️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
