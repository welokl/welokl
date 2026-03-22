'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import FavouriteButton from '@/components/FavouriteButton'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; banner_url?: string | null
  offer_text?: string | null; free_delivery_above?: number | null
}
interface Product {
  id: string; name: string; description?: string | null
  price: number; original_price?: number | null
  image_url?: string | null; is_veg?: boolean | null
  is_available?: boolean; category?: string | null; category_name?: string | null
  shop_id?: string; [key: string]: unknown
}

export default function StorePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const cart     = useCart() as any
  const [shop,       setShop]      = useState<Shop | null>(null)
  const [products,   setProducts]  = useState<Product[]>([])
  const [loading,    setLoading]   = useState(true)
  const [diffWarn,   setDiffWarn]  = useState(false)
  const [activeCat,  setActiveCat] = useState('all')
  const [search,     setSearch]    = useState('')

  useEffect(() => { cart._hydrate?.() }, [])
  useEffect(() => { load() }, [id])

  async function load() {
    if (!id) return
    const sb = createClient()
    const [{ data: s }, { data: p, error: pe }] = await Promise.all([
      sb.from('shops').select('*').eq('id', id).single(),
      sb.from('products').select('id,name,description,price,original_price,image_url,is_veg,is_available,shop_id,category,category_name').eq('shop_id', id).order('name'),
    ])
    if (pe) {
      const { data: p2 } = await sb.from('products').select('*').eq('shop_id', id)
      setProducts((p2 ?? []) as Product[])
    } else {
      setProducts((p ?? []) as Product[])
    }
    setShop(s)
    setLoading(false)
  }

  function handleAdd(product: Product) {
    if (cart.shop_id && cart.shop_id !== id && cart.count() > 0) { setDiffWarn(true); return }
    cart.addItem(product, id, shop?.name ?? '')
  }

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = (p as any).category ?? (p as any).category_name ?? 'Items'
    ;(acc[cat] ??= []).push(p)
    return acc
  }, {})
  const categories  = Object.keys(grouped)
  const cartCount   = cart.count?.() ?? 0
  const cartTotal   = cart.subtotal?.() ?? 0
  const showCartBar = cartCount > 0 && cart.shop_id === id

  const filteredGroups = Object.entries(grouped).reduce<Record<string, Product[]>>((acc, [cat, items]) => {
    if (activeCat !== 'all' && cat !== activeCat) return acc
    const filtered = search ? items.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : items
    if (filtered.length) acc[cat] = filtered
    return acc
  }, {})

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#F5F5F5', padding:16 }}>
      <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:16px;}`}</style>
      <div style={{ maxWidth:760, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
        <div className="sk" style={{ height:200, borderRadius:24 }} />
        {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:90 }} />)}
      </div>
    </div>
  )

  if (!shop) return (
    <div style={{ minHeight:'100vh', background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:14 }}>🏪</div>
        <p style={{ fontWeight:800, fontSize:17, color:'#111', marginBottom:10 }}>Shop not found</p>
        <Link href="/stores" style={{ color:'#FF3008', fontSize:14, textDecoration:'none', fontWeight:700 }}>Browse all shops →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F5F5F5', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:120 }}>
      <style>{`
        @keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;}
        .pcard{background:#fff;border-radius:20px;overflow:hidden;display:flex;gap:0;transition:box-shadow .18s,transform .15s;border:1px solid #f0f0f0;}
        .pcard:hover{box-shadow:0 4px 18px rgba(0,0,0,.07);}
        .pcard:active{transform:scale(.985);}
        .cat-tab{padding:11px 18px;font-weight:700;font-size:13px;background:none;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;transition:color .15s,border-color .15s;border-bottom:2.5px solid transparent;}
        .tab-scroll::-webkit-scrollbar{display:none;}
        .add-btn{padding:8px 22px;border-radius:12px;border:2px solid #FF3008;color:#FF3008;background:#fff5f5;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;transition:background .15s,transform .1s;}
        .add-btn:hover{background:#FF3008;color:#fff;}
        .add-btn:active{transform:scale(.94);}
      `}</style>

      {/* Sticky header */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'#fff', borderBottom:'1px solid #eee' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', alignItems:'center', gap:10, height:56, padding:'0 16px' }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'#F5F5F5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontWeight:800, fontSize:15, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#111' }}>{shop.name}</span>
          <FavouriteButton shopId={id} />
          {showCartBar && (
            <Link href="/cart" style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="2"/><line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2"/></svg>
              {cartCount} · ₹{cartTotal}
            </Link>
          )}
        </div>
      </div>

      {/* Shop hero */}
      <div style={{ background:'#fff', marginBottom:10 }}>
        {/* Banner — DP anchored to bottom so it's never hidden */}
        <div style={{ position:'relative', height: shop.banner_url ? 180 : 130, overflow:'visible' }}>
          {shop.banner_url ? (
            <div style={{ height:180, overflow:'hidden', borderRadius:0, position:'relative' }}>
              <Image src={shop.banner_url} alt="" fill sizes="100vw" className="object-cover" />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 55%)' }} />
            </div>
          ) : (
            <div style={{ height:130, background:`linear-gradient(135deg, #FF3008 0%, #ff6b35 100%)`, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:-30, right:-30, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,.06)' }} />
              <div style={{ position:'absolute', bottom:-40, left:-20, width:140, height:140, borderRadius:'50%', background:'rgba(255,255,255,.04)' }} />
            </div>
          )}
          {/* DP — absolute at bottom of banner, fully visible below it */}
          <div style={{ position:'absolute', bottom:-38, left:16, width:80, height:80, borderRadius:22, background:'#fff', border:'4px solid #fff', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,.15)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10 }}>
            {shop.image_url
              ? <Image src={shop.image_url} alt={shop.name} fill sizes="80px" className="object-cover" />
              : <span style={{ fontSize:36 }}>🏪</span>
            }
          </div>
          {/* Open/Closed badge on banner */}
          <div style={{ position:'absolute', bottom:14, right:14, display:'flex', alignItems:'center', gap:5, background: shop.is_open ? 'rgba(22,163,74,.9)' : 'rgba(60,60,60,.85)', borderRadius:999, padding:'6px 14px', backdropFilter:'blur(6px)' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', display:'block', flexShrink:0 }} />
            <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>{shop.is_open ? 'Open now' : 'Closed'}</span>
          </div>
        </div>

        {/* Info section — paddingTop clears the overlapping DP */}
        <div style={{ padding:'52px 16px 20px', maxWidth:760, margin:'0 auto' }}>
          <h1 style={{ fontWeight:900, fontSize:24, color:'#111', marginBottom:3, letterSpacing:'-0.03em', lineHeight:1.1 }}>{shop.name}</h1>
          <p style={{ fontSize:13, color:'#888', marginBottom:14, fontWeight:500 }}>{shop.category_name}{shop.area ? ` · ${shop.area}` : ''}</p>
          {shop.description && (
            <p style={{ fontSize:13.5, color:'#555', lineHeight:1.65, marginBottom:16, maxWidth:520 }}>{shop.description}</p>
          )}

          {/* Stats row */}
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ fontSize:13, fontWeight:900, color:'#d97706' }}>★ {(shop.rating ?? 0).toFixed(1)}</span>
            </div>
            {shop.delivery_enabled && (
              <>
                <span style={{ color:'#ddd' }}>|</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#555' }}>🛵 {shop.avg_delivery_time} min</span>
              </>
            )}
            {shop.min_order_amount > 0 && (
              <>
                <span style={{ color:'#ddd' }}>|</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#555' }}>Min ₹{shop.min_order_amount}</span>
              </>
            )}
            {shop.pickup_enabled && (
              <>
                <span style={{ color:'#ddd' }}>|</span>
                <span style={{ fontSize:13, fontWeight:600, color:'#555' }}>🏪 Pickup</span>
              </>
            )}
          </div>

          {/* Offer banners */}
          {(shop.offer_text || shop.free_delivery_above) && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {shop.offer_text && (
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#FF3008', background:'#FFF0EE', padding:'7px 14px', borderRadius:12, border:'1px solid rgba(255,48,8,.12)' }}>
                  🏷️ {shop.offer_text}
                </div>
              )}
              {shop.free_delivery_above && (
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:'#16a34a', background:'#EEFAF4', padding:'7px 14px', borderRadius:12, border:'1px solid rgba(22,163,74,.15)' }}>
                  🚚 Free delivery above ₹{shop.free_delivery_above}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ padding:'0 12px', marginBottom:10 }}>
        <div style={{ background:'#fff', borderRadius:16, display:'flex', alignItems:'center', gap:10, padding:'11px 16px', border:'1.5px solid #ebebeb', boxShadow:'0 1px 6px rgba(0,0,0,.04)' }}>
          <svg viewBox="0 0 24 24" fill="none" width={18} height={18} style={{ flexShrink:0 }}><circle cx="11" cy="11" r="8" stroke="#bbb" strokeWidth="2"/><path d="m21 21-4.35-4.35" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search in ${shop.name}…`}
            style={{ flex:1, border:'none', outline:'none', fontSize:14, color:'#111', background:'transparent', fontFamily:'inherit' }} />
          {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:18, lineHeight:1 }}>✕</button>}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <div style={{ background:'#fff', position:'sticky', top:56, zIndex:40, borderBottom:'1px solid #f0f0f0' }}>
          <div className="tab-scroll" style={{ display:'flex', overflowX:'auto', padding:'0 12px', scrollbarWidth:'none' }}>
            {['all', ...categories].map(cat => (
              <button key={cat} className="cat-tab" onClick={() => setActiveCat(cat)}
                style={{ color: activeCat === cat ? '#FF3008' : '#888', borderBottomColor: activeCat === cat ? '#FF3008' : 'transparent' }}>
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div style={{ maxWidth:760, margin:'0 auto', padding:'12px' }}>
        {products.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:24, padding:'56px 20px', textAlign:'center', border:'1px solid #f0f0f0' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>📦</div>
            <p style={{ fontWeight:900, fontSize:17, color:'#111', marginBottom:6 }}>No products yet</p>
            <p style={{ fontSize:14, color:'#aaa', lineHeight:1.6 }}>This shop hasn't added any products.</p>
          </div>
        ) : Object.entries(filteredGroups).length === 0 ? (
          <div style={{ background:'#fff', borderRadius:24, padding:'48px 20px', textAlign:'center', border:'1px solid #f0f0f0' }}>
            <div style={{ fontSize:38, marginBottom:12 }}>🔍</div>
            <p style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:8 }}>No results for "{search}"</p>
            <button onClick={() => setSearch('')} style={{ color:'#FF3008', fontWeight:800, fontSize:14, background:'#fff5f5', border:'none', cursor:'pointer', fontFamily:'inherit', padding:'8px 20px', borderRadius:11 }}>Clear search</button>
          </div>
        ) : (
          Object.entries(filteredGroups).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom:24 }}>
              {categories.length > 1 && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, paddingLeft:4 }}>
                  <p style={{ fontWeight:900, fontSize:15, color:'#111', letterSpacing:'-0.01em' }}>{cat}</p>
                  <span style={{ fontSize:12, color:'#ccc', fontWeight:700 }}>{items.length}</span>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {items.map(product => (
                  <ProductCard key={product.id}
                    product={product}
                    qty={cart.items?.find((i: any) => i.product.id === product.id)?.quantity ?? 0}
                    onAdd={() => handleAdd(product)}
                    onRemove={() => cart.removeItem(product.id)}
                    onUpdate={(q: number) => cart.updateQty(product.id, q)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating cart */}
      {showCartBar && (
        <div style={{ position:'fixed', bottom:20, left:12, right:12, zIndex:50 }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>
            <Link href="/cart" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FF3008', color:'#fff', borderRadius:18, padding:'16px 22px', textDecoration:'none', boxShadow:'0 8px 32px rgba(255,48,8,.4)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ background:'rgba(255,255,255,.2)', borderRadius:10, padding:'4px 12px', fontWeight:900, fontSize:14 }}>{cartCount}</span>
                <span style={{ fontWeight:800, fontSize:15 }}>View cart</span>
              </div>
              <span style={{ fontWeight:900, fontSize:16 }}>₹{cartTotal}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Different shop warning */}
      {diffWarn && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480, fontFamily:'inherit' }}>
            <div style={{ fontSize:40, textAlign:'center', marginBottom:12 }}>🛒</div>
            <h3 style={{ fontWeight:900, fontSize:18, color:'#111', textAlign:'center', marginBottom:8 }}>Start a new cart?</h3>
            <p style={{ fontSize:14, color:'#888', textAlign:'center', marginBottom:24, lineHeight:1.6 }}>
              Your cart has items from <strong style={{ color:'#111' }}>{cart.shop_name}</strong>. Adding this will clear it.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDiffWarn(false)} style={{ flex:1, padding:14, borderRadius:14, border:'1.5px solid #eee', background:'#F5F5F5', color:'#111', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Keep cart</button>
              <button onClick={() => { cart.clear(); setDiffWarn(false) }} style={{ flex:1, padding:14, borderRadius:14, border:'none', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Start new cart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────
function ProductCard({ product, qty, onAdd, onRemove, onUpdate }: {
  product: Product; qty: number
  onAdd: () => void; onRemove: () => void; onUpdate: (q: number) => void
}) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0
  const unavailable = product.is_available === false

  return (
    <div className="pcard" style={{ opacity: unavailable ? 0.55 : 1 }}>
      {/* Info */}
      <div style={{ flex:1, padding:'16px 14px 16px 16px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
        <div>
          {product.is_veg != null && (
            <div style={{ width:14, height:14, border:`2px solid ${product.is_veg ? '#16a34a' : '#ef4444'}`, borderRadius:3, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:6, flexShrink:0 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: product.is_veg ? '#16a34a' : '#ef4444' }} />
            </div>
          )}
          <p style={{ fontWeight:800, fontSize:14.5, color:'#111', marginBottom:4, lineHeight:1.3 }}>{product.name}</p>
          {product.description && (
            <p style={{ fontSize:12.5, color:'#999', lineHeight:1.55, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{product.description}</p>
          )}
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, gap:8 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
            <span style={{ fontWeight:900, fontSize:16, color:'#111' }}>₹{product.price}</span>
            {disc > 0 && <span style={{ fontSize:12, color:'#bbb', textDecoration:'line-through' }}>₹{product.original_price}</span>}
            {disc > 0 && <span style={{ fontSize:11, fontWeight:800, color:'#FF3008', background:'#fff0ee', padding:'2px 6px', borderRadius:6 }}>{disc}% off</span>}
          </div>

          {unavailable ? (
            <span style={{ fontSize:12, color:'#bbb', fontWeight:700, flexShrink:0 }}>Unavailable</span>
          ) : qty === 0 ? (
            <button onClick={onAdd} className="add-btn" style={{ flexShrink:0 }}>ADD</button>
          ) : (
            <div style={{ display:'flex', alignItems:'center', background:'#FF3008', borderRadius:12, overflow:'hidden', flexShrink:0 }}>
              <button onClick={() => onUpdate(qty - 1)} style={{ color:'#fff', padding:'8px 13px', border:'none', background:'none', cursor:'pointer', fontWeight:900, fontSize:17, lineHeight:1 }}>−</button>
              <span style={{ color:'#fff', fontWeight:900, fontSize:14, minWidth:24, textAlign:'center' }}>{qty}</span>
              <button onClick={() => onUpdate(qty + 1)} style={{ color:'#fff', padding:'8px 13px', border:'none', background:'none', cursor:'pointer', fontWeight:900, fontSize:17, lineHeight:1 }}>+</button>
            </div>
          )}
        </div>
      </div>

      {/* Image — right side */}
      <div style={{ width:120, height:120, flexShrink:0, background:'#F8F8F8', position:'relative', overflow:'hidden', margin:10, borderRadius:14 }}>
        {product.image_url
          ? <Image src={product.image_url} alt={product.name} fill sizes="120px" className="object-cover" />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:38, opacity:.15 }}>🛍️</div>
        }
        {disc > 0 && <div style={{ position:'absolute', top:6, left:6, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'2px 7px', borderRadius:7 }}>-{disc}%</div>}
      </div>
    </div>
  )
}