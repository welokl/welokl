'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Shop } from '@/types'

export default function FavouritesPage() {
  const [shops, setShops]     = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadFavourites() }, [])

  async function loadFavourites() {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    if (ids.length === 0) { setLoading(false); return }
    const { data } = await createClient().from('shops').select('*').in('id', ids).eq('is_active', true)
    setShops(data || []); setLoading(false)
  }

  function removeFavourite(shopId: string) {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    localStorage.setItem('welokl_favourites', JSON.stringify(ids.filter(id => id !== shopId)))
    setShops(shops.filter(s => s.id !== shopId))
  }

  const catIcon = (cat?: string | null) =>
    cat?.includes('Food') ? '🍔' : cat?.includes('Grocery') ? '🛒' :
    cat?.includes('Pharmacy') ? '💊' : cat?.includes('Electronics') ? '📱' : '🏪'

  const NAV = [
    { icon: '🏠', label: 'Home',   href: '/dashboard/customer', on: false },
    { icon: '🛍️', label: 'Shops',  href: '/stores',              on: false },
    { icon: '❤️', label: 'Saved',  href: '/favourites',          on: true  },
    { icon: '📦', label: 'Orders', href: '/orders/history',       on: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => window.history.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
        <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)' }}>Saved Shops ❤️</h1>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 88, borderRadius: 16 }} />)}
          </div>
        ) : shops.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>❤️</div>
            <p style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>No saved shops yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>Tap the heart icon on any shop to save it here</p>
            <Link href="/stores" style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
              Browse shops
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shops.map(shop => (
              <div key={shop.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Link href={`/stores/${shop.id}`} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
                  <div style={{ width: 52, height: 52, background: 'var(--bg-1)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                    {catIcon(shop.category_name)}
                  </div>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 3 }}>{shop.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{shop.category_name?.split(' ')[0]} · {shop.area} · ★ {shop.rating}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: shop.is_open ? '#16a34a' : 'var(--text-3)' }}>{shop.is_open ? 'Open' : 'Closed'}</span>
                      {shop.delivery_enabled && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>🛵 {shop.avg_delivery_time}min</span>}
                    </div>
                  </div>
                </Link>
                <button onClick={() => removeFavourite(shop.id)}
                  style={{ fontSize: 22, background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0, opacity: 0.8 }}>❤️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card-bg)', borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom,0)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '6px 0 8px', maxWidth: 480, margin: '0 auto' }}>
          {NAV.map(item => (
            <Link key={item.label} href={item.href}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 18px', borderRadius: 14, textDecoration: 'none', color: item.on ? '#ff3008' : 'var(--text-3)', WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.01em' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}