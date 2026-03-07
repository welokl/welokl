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
const CAT_ICONS: Record<string,string> = { food:'🍔', grocery:'🛒', pharmacy:'💊', electronics:'📱', salon:'💇', fashion:'👗', stationery:'📚', hardware:'🔧', pet:'🐾', flower:'🌸' }

export default function StoresPage() {
  const [shops, setShops]             = useState<Shop[]>([])
  const [categories, setCategories]   = useState<Category[]>([])
  const [activeCategory, setActiveCat] = useState('all')
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [userLat, setUserLat]         = useState<number|null>(null)
  const [userLng, setUserLng]         = useState<number|null>(null)
  const [locStatus, setLocStatus]     = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [radius, setRadius]           = useState(10)

  useEffect(() => {
    loadData()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) { setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted') }
      else askLocation()
    } catch { askLocation() }
  }, [])

  function askLocation() {
    if (!navigator.geolocation) return
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocStatus('granted') },
      () => setLocStatus('denied'),
      { timeout: 6000, enableHighAccuracy: false }
    )
  }

  async function loadData() {
    const supabase = createClient()
    const [{ data: sd }, { data: cd }] = await Promise.all([
      supabase.from('shops').select('*').eq('is_active', true).order('rating', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order'),
    ])
    setShops(sd || []); setCategories(cd || []); setLoading(false)
  }

  const shopsWithDist = shops.map(s => ({ ...s,
    distance: (userLat && userLng && s.latitude && s.longitude) ? haversine(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null
  }))
  const filtered = shopsWithDist
    .filter(s => {
      const mc = activeCategory === 'all' || s.category_name?.toLowerCase().includes(activeCategory.toLowerCase())
      const ms = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.area?.toLowerCase().includes(search.toLowerCase())
      const mr = !userLat || s.distance === null || s.distance <= radius
      return mc && ms && mr
    })
    .sort((a,b) => (a.distance !== null && b.distance !== null) ? a.distance - b.distance : 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 14px' }}>

          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, background: '#ff3008', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 16 }}>W</div>
            </Link>
            <Link href="/location?return=/stores" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1.5px solid var(--border-2)', borderRadius: 12, padding: '8px 12px', textDecoration: 'none' }}>
              <span style={{ color: '#ff3008', fontSize: 14 }}>📍</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: locStatus === 'granted' ? 'var(--text)' : 'var(--text-3)', flex: 1 }}>
                {locStatus === 'granted' ? 'Delivery here' : 'Set your location'}
              </span>
              <span style={{ color: 'var(--text-3)', fontSize: 11 }}>▼</span>
            </Link>
            <Link href="/search" style={{ width: 38, height: 38, background: 'var(--card-bg)', border: '1.5px solid var(--border-2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, textDecoration: 'none', flexShrink: 0 }}>🔍</Link>
            <Link href="/auth/login" style={{ padding: '7px 14px', borderRadius: 12, background: 'var(--brand-muted)', color: '#ff3008', fontSize: 12, fontWeight: 800, textDecoration: 'none', flexShrink: 0 }}>Login</Link>
          </div>

          {/* Radius pills */}
          {locStatus === 'granted' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Within:</span>
              {[1,2,5,10,25,999].map(r => (
                <button key={r} onClick={() => setRadius(r)}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: radius === r ? '#ff3008' : 'var(--bg-3)', color: radius === r ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}>
                  {r === 999 ? 'All' : `${r}km`}
                </button>
              ))}
            </div>
          )}

          {locStatus === 'denied' && (
            <button onClick={askLocation} style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 999, background: 'var(--brand-muted)', color: '#ff3008', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              📍 Allow location for nearby shops
            </button>
          )}

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {[{ id: 'all', name: 'All', icon: '🏪' }, ...categories.map(c => ({ id: c.name, name: c.name.split(' ')[0], icon: c.icon }))].map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                  background: activeCategory === cat.id ? '#ff3008' : 'var(--bg-3)', color: activeCategory === cat.id ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
            {filtered.length} shops {locStatus === 'granted' && radius !== 999 ? `within ${radius}km` : 'available'}
          </p>
          {locStatus === 'asking' && <p style={{ fontSize: 12, color: '#d97706', fontWeight: 700 }}>📍 Detecting location…</p>}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="shimmer" style={{ height: 190 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>🏪</div>
            <p style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>No shops found</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 20 }}>{userLat ? 'Try increasing radius or browse all shops' : 'Try a different search'}</p>
            {userLat && <button onClick={() => setRadius(999)} style={{ padding: '11px 28px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Show all shops</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {filtered.map(shop => {
              const catKey = Object.keys(CAT_ICONS).find(k => shop.category_name?.toLowerCase().includes(k)) || 'food'
              return (
                <Link key={shop.id} href={`/stores/${shop.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--card-shadow)', transition: 'all 0.15s', cursor: 'pointer' }}
                    className="shop-card">
                    {/* Image area */}
                    <div style={{ height: 110, background: 'var(--bg-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <span style={{ fontSize: 40 }}>{CAT_ICONS[catKey]}</span>
                      <div style={{ position: 'absolute', top: 8, left: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: shop.is_open ? 'rgba(34,197,94,0.15)' : 'var(--bg-3)', color: shop.is_open ? '#16a34a' : 'var(--text-3)' }}>
                          {shop.is_open ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--card-bg)', borderRadius: 8, padding: '2px 6px', fontSize: 11, fontWeight: 900, color: '#d97706' }}>
                        ★ {shop.rating}
                      </div>
                      {(shop as any).distance !== null && (shop as any).distance !== undefined && (
                        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'var(--card-bg)', borderRadius: 8, padding: '2px 7px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
                          {(shop as any).distance < 1 ? `${Math.round((shop as any).distance*1000)}m` : `${(shop as any).distance.toFixed(1)}km`}
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div style={{ padding: '12px 12px 10px' }}>
                      <p style={{ fontWeight: 900, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{shop.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.category_name?.split(' ')[0]} · {shop.area}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        {shop.delivery_enabled && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>🛵 {shop.avg_delivery_time}m</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>{shop.min_order_amount ? `₹${shop.min_order_amount}+` : 'No min'}</span>
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
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', borderTop: '1px solid var(--border)', zIndex: 50, WebkitBackdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', maxWidth: 480, margin: '0 auto' }}>
          {[
            { icon: '🏠', label: 'Home', href: '/' },
            { icon: '🛍️', label: 'Shops', href: '/stores', active: true },
            { icon: '🛒', label: 'Cart', href: '/cart' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer' },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 16px', borderRadius: 12, textDecoration: 'none', color: item.active ? '#ff3008' : 'var(--text-3)' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}