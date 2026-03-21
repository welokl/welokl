'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import type { Shop } from '@/types'

const CAT_COLOR: Record<string,string> = {
  food:'#FF3008', grocery:'#16a34a', pharmacy:'#4f46e5',
  electronics:'#7c3aed', salon:'#db2777', hardware:'#d97706', pet:'#ea580c', default:'#FF3008',
}
const CAT_ICON: Record<string,string> = {
  food:'🍔', grocery:'🛒', pharmacy:'💊', electronics:'📱',
  salon:'💇', hardware:'🔧', pet:'🐾', default:'🏪',
}

function getCatKey(cat?: string | null) {
  return Object.keys(CAT_ICON).find(k => cat?.toLowerCase().includes(k)) || 'default'
}

export default function FavouritesPage() {
  const [shops,   setShops]   = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadFavourites() }, [])

  async function loadFavourites() {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    if (!ids.length) { setLoading(false); return }
    const { data } = await createClient().from('shops').select('*').in('id', ids).eq('is_active', true)
    setShops(data || []); setLoading(false)
  }

  function removeFavourite(shopId: string) {
    const ids: string[] = JSON.parse(localStorage.getItem('welokl_favourites') || '[]')
    localStorage.setItem('welokl_favourites', JSON.stringify(ids.filter(id => id !== shopId)))
    setShops(shops.filter(s => s.id !== shopId))
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80 }}>
      <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:16px;}`}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:640, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => window.history.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1, letterSpacing:'-0.02em' }}>Saved Shops</h1>
          {shops.length > 0 && (
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', background:'var(--page-bg)', borderRadius:999, padding:'4px 12px' }}>
              {shops.length} saved
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 12px' }}>

        {/* Skeletons */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3].map(i => <div key={i} className="sk" style={{ height:90 }} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && shops.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ width:80, height:80, background:'var(--red-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={36} height={36}>
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                  stroke="#FF3008" strokeWidth="2" fill="rgba(255,48,8,.1)" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.02em' }}>No saved shops yet</p>
            <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24, lineHeight:1.6 }}>Tap the heart on any shop to save it here for quick access</p>
            <Link href="/stores" style={{ display:'inline-block', padding:'13px 28px', borderRadius:16, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none' }}>
              Browse shops →
            </Link>
          </div>
        )}

        {/* Shop cards */}
        {!loading && shops.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {shops.map(shop => {
              const catKey = getCatKey(shop.category_name)
              const color  = CAT_COLOR[catKey]
              const icon   = CAT_ICON[catKey]
              return (
                <div key={shop.id} style={{ background:'var(--card-white)', borderRadius:20, overflow:'hidden', display:'flex', alignItems:'center', boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
                  <Link href={`/stores/${shop.id}`} style={{ flex:1, display:'flex', alignItems:'center', gap:0, textDecoration:'none' }}>
                    {/* Image / icon */}
                    <div style={{ width:90, height:90, flexShrink:0, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
                      {(shop as any).image_url
                        ? <img src={(shop as any).image_url} alt={shop.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <span style={{ fontSize:36 }}>{icon}</span>
                      }
                      <div style={{ position:'absolute', bottom:5, left:5 }}>
                        <span style={{ fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:4, background: shop.is_open ? '#16a34a' : 'rgba(0,0,0,.55)', color:'#fff' }}>
                          {shop.is_open ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, padding:'12px 12px', minWidth:0 }}>
                      <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.name}</p>
                      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>{shop.category_name?.split(' ')[0]} · {(shop as any).area}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>
                          <span style={{ color:'#f59e0b' }}>★</span>{shop.rating?.toFixed(1) || '4.0'}
                        </span>
                        <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)' }} />
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>⏱ {(shop as any).avg_delivery_time}min</span>
                      </div>
                    </div>
                  </Link>

                  {/* Remove heart */}
                  <button onClick={() => removeFavourite(shop.id)}
                    style={{ width:48, height:90, border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
                      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                        stroke="#FF3008" strokeWidth="2" fill="rgba(255,48,8,.15)" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav active="shops" />
    </div>
  )
}