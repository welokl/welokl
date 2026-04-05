'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { computeIsOpen } from '@/lib/shopHours'
import { useCart } from '@/store/cart'
import FavouriteButton from '@/components/FavouriteButton'
import BottomNav from '@/components/BottomNav'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; banner_url?: string | null
  offer_text?: string | null; free_delivery_above?: number | null
  opening_time?: string | null; closing_time?: string | null; manually_closed?: boolean | null
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
  const [plans,      setPlans]     = useState<any[]>([])
  const [userId,     setUserId]    = useState<string | null>(null)
  const [mySubIds,   setMySubIds]  = useState<Set<string>>(new Set())
  const [subModal,   setSubModal]  = useState<any | null>(null)  // plan being subscribed to
  const [subAddr,    setSubAddr]   = useState('')
  const [subSaving,  setSubSaving] = useState(false)
  const [loading,    setLoading]   = useState(true)
  const [diffWarn,   setDiffWarn]  = useState(false)
  const [activeCat,  setActiveCat] = useState('all')
  const [search,     setSearch]    = useState('')
  const [lastOrder,  setLastOrder] = useState<any | null>(null)

  useEffect(() => { cart._hydrate?.() }, [])
  useEffect(() => { load() }, [id])

  async function load() {
    if (!id) return
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    setUserId(user?.id ?? null)

    const [{ data: s }, { data: p, error: pe }, { data: planRows }, { data: subRows }, { data: prevOrder }] = await Promise.all([
      sb.from('shops').select('*').eq('id', id).single(),
      sb.from('products').select('id,name,description,price,original_price,image_url,is_veg,is_available,shop_id,category,category_name').eq('shop_id', id).order('name'),
      sb.from('subscription_plans').select('*').eq('shop_id', id).order('price'),
      user ? sb.from('customer_subscriptions').select('plan_id').eq('customer_id', user.id).eq('shop_id', id).neq('status', 'cancelled') : Promise.resolve({ data: [] }),
      user ? sb.from('orders').select('id, shop_id, total_amount, items:order_items(product_id, product_name, product_image, price, quantity)').eq('customer_id', user.id).eq('shop_id', id).eq('status', 'delivered').order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (pe) {
      const { data: p2 } = await sb.from('products').select('*').eq('shop_id', id)
      setProducts((p2 ?? []) as Product[])
    } else {
      setProducts((p ?? []) as Product[])
    }
    setShop(s)
    setPlans((planRows ?? []).filter((p: any) => p.is_active !== false))
    setMySubIds(new Set((subRows ?? []).map((r: any) => r.plan_id)))
    setLastOrder(prevOrder ?? null)
    setLoading(false)
  }

  function reorderFromStore(order: any) {
    cart.clear()
    order.items?.forEach((item: any) => {
      if (!item.product_id) return
      cart.addItem(
        { id: item.product_id, name: item.product_name, price: item.price, image_url: item.product_image || null, shop_id: id },
        id,
        shop?.name || ''
      )
    })
    router.push('/cart')
  }

  async function subscribeToPlan(plan: any) {
    if (!userId) { window.location.href = '/auth/login'; return }
    if (!subAddr.trim()) { alert('Please enter your delivery address'); return }
    setSubSaving(true)
    const sb = createClient()
    await sb.from('customer_subscriptions').upsert({
      customer_id:      userId,
      shop_id:          id,
      plan_id:          plan.id,
      status:           'active',
      delivery_address: subAddr.trim(),
      delivery_time:    plan.delivery_time,
    }, { onConflict: 'customer_id,plan_id' })
    setMySubIds(prev => new Set(Array.from(prev).concat(plan.id)))
    setSubModal(null)
    setSubAddr('')
    setSubSaving(false)
  }

  function handleAdd(product: Product) {
    if (!computeIsOpen(shop ?? { is_open: false })) { alert('This shop is currently closed and not accepting orders.'); return }
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
    <div style={{ minHeight:'100vh', background:'#F5F5F5', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(140px + env(safe-area-inset-bottom, 0px))' }}>
      <style>{`
        @keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;}
        .pcard{background:#fff;border-radius:20px;display:flex;gap:0;transition:box-shadow .18s,transform .15s;border:1px solid #f0f0f0;}
        .pcard:hover{box-shadow:0 4px 18px rgba(0,0,0,.07);}
        .pcard:active{transform:scale(.985);}
        .cat-tab{padding:11px 18px;font-weight:700;font-size:13px;background:none;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;transition:color .15s,border-color .15s;border-bottom:2.5px solid transparent;}
        .tab-scroll::-webkit-scrollbar{display:none;}
        .add-btn{padding:6px 18px;border-radius:10px;border:2px solid #FF3008;color:#FF3008;background:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;transition:background .15s,transform .1s;box-shadow:0 2px 8px rgba(0,0,0,.1);}
        .add-btn:hover{background:#FF3008;color:#fff;}
        .add-btn:active{transform:scale(.94);}
        .img-stepper{display:flex;align-items:center;background:#FF3008;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.15);}
        .img-stepper button{color:#fff;padding:6px 11px;border:none;background:none;cursor:pointer;font-weight:900;font-size:16px;line-height:1;}
        .img-stepper span{color:#fff;font-weight:900;font-size:13px;min-width:20px;text-align:center;}
      `}</style>

      {/* Sticky header */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'#fff', borderBottom:'1px solid #eee' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', alignItems:'center', gap:10, height:56, padding:'0 16px' }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'#F5F5F5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span style={{ fontWeight:800, fontSize:15, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#111', minWidth:0 }}>{shop.name}</span>
          <FavouriteButton shopId={id} />
          {showCartBar && (
            <Link href="/cart" style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:12, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, textDecoration:'none', flexShrink:0, whiteSpace:'nowrap' }}>
              <svg viewBox="0 0 24 24" fill="none" width={15} height={15}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#fff" strokeWidth="2"/><line x1="3" y1="6" x2="21" y2="6" stroke="#fff" strokeWidth="2"/></svg>
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
          {(() => {
            let opensLabel: string | null = null
            if (!computeIsOpen(shop) && shop.opening_time) {
              const [oh, om] = shop.opening_time.split(':').map(Number)
              const now = new Date()
              const cur = now.getHours() * 60 + now.getMinutes()
              const openMin = oh * 60 + om
              const ampm = oh >= 12 ? 'PM' : 'AM'
              const label = `${oh % 12 || 12}:${String(om).padStart(2, '0')} ${ampm}`
              opensLabel = cur < openMin ? `Opens at ${label}` : `Opens tomorrow ${label}`
            }
            return (
              <div style={{ position:'absolute', bottom:14, right:14, display:'flex', alignItems:'center', gap:5, background: computeIsOpen(shop) ? 'rgba(22,163,74,.9)' : 'rgba(30,30,30,.88)', borderRadius:999, padding:'6px 14px', backdropFilter:'blur(6px)' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: computeIsOpen(shop) ? '#fff' : '#ef4444', display:'block', flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:800, color:'#fff' }}>
                  {computeIsOpen(shop) ? 'Open now' : opensLabel ?? 'Closed'}
                </span>
              </div>
            )
          })()}
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
              {shop.rating
                ? <span style={{ fontSize:13, fontWeight:900, color:'#d97706' }}>★ {shop.rating.toFixed(1)}</span>
                : <span style={{ fontSize:12, fontWeight:600, color:'#9ca3af' }}>No reviews yet</span>
              }
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

      {/* Welcome back — returning customer reorder */}
      {lastOrder && (
        <div style={{ margin:'0 12px 10px', background:'rgba(255,48,8,.04)', border:'1.5px solid rgba(255,48,8,.18)', borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#FF3008', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:2 }}>Welcome back!</p>
            <p style={{ fontSize:13, fontWeight:800, color:'#111', marginBottom:2 }}>Order your usual?</p>
            {lastOrder.items?.length > 0 && (
              <p style={{ fontSize:12, color:'#888', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {lastOrder.items.slice(0,2).map((i: any) => i.product_name).filter(Boolean).join(', ')}
                {lastOrder.items.length > 2 ? ` +${lastOrder.items.length - 2} more` : ''}
              </p>
            )}
          </div>
          <button onClick={() => reorderFromStore(lastOrder)}
            style={{ padding:'10px 16px', borderRadius:12, background:'#FF3008', color:'#fff', border:'none', fontWeight:800, fontSize:13, cursor:'pointer', flexShrink:0, fontFamily:'inherit' }}>
            Reorder
          </button>
        </div>
      )}

      {/* Subscription plans — shown if shop has active plans */}
      {plans.length > 0 && (
        <div style={{ background:'#fff', padding:'18px 16px', marginBottom:10, borderBottom:'1px solid #f0eeec' }}>
          <div style={{ maxWidth:760, margin:'0 auto' }}>
            <p style={{ fontSize:12, fontWeight:800, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 }}>Subscribe & Save</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {plans.map(plan => {
                const subscribed = mySubIds.has(plan.id)
                return (
                  <div key={plan.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', background:'#fafaf9', borderRadius:16, border:`1.5px solid ${subscribed ? 'rgba(22,163,74,.35)' : '#ebebeb'}` }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:2 }}>{plan.name}</p>
                      {plan.description && <p style={{ fontSize:12, color:'#888', marginBottom:4 }}>{plan.description}</p>}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontSize:14, fontWeight:900, color:'#FF3008' }}>₹{plan.price}<span style={{ fontSize:11, color:'#aaa', fontWeight:600 }}>/day</span></span>
                        <span style={{ fontSize:11, color:'#888', background:'#f0eeec', padding:'2px 8px', borderRadius:999 }}>Delivery by {plan.delivery_time}</span>
                        <span style={{ fontSize:11, color:'#888', background:'#f0eeec', padding:'2px 8px', borderRadius:999, textTransform:'capitalize' }}>{plan.frequency}</span>
                      </div>
                    </div>
                    {subscribed ? (
                      <span style={{ fontSize:12, fontWeight:800, color:'#16a34a', background:'rgba(22,163,74,.1)', padding:'7px 14px', borderRadius:10, whiteSpace:'nowrap' }}>Subscribed</span>
                    ) : (
                      <button onClick={() => setSubModal(plan)}
                        style={{ padding:'9px 18px', borderRadius:12, border:'none', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', boxShadow:'0 3px 10px rgba(255,48,8,.25)' }}>
                        Subscribe
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Subscribe modal */}
      {subModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={e => { if (e.target === e.currentTarget) setSubModal(null) }}>
          <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480 }}>
            <p style={{ fontWeight:900, fontSize:17, color:'#111', marginBottom:4 }}>Subscribe to {subModal.name}</p>
            <p style={{ fontSize:13, color:'#888', marginBottom:18 }}>₹{subModal.price}/day · Delivered by {subModal.delivery_time}</p>
            <p style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6 }}>Delivery address</p>
            <textarea
              value={subAddr} onChange={e => setSubAddr(e.target.value)}
              placeholder="Enter your full delivery address..."
              rows={3}
              style={{ width:'100%', padding:'12px 14px', borderRadius:14, border:'1.5px solid #e0ded9', fontSize:14, fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box', color:'#111' }}
            />
            <button onClick={() => subscribeToPlan(subModal)} disabled={subSaving || !subAddr.trim()}
              style={{ marginTop:14, width:'100%', padding:'15px', borderRadius:16, border:'none', background: subAddr.trim() ? '#FF3008' : '#f0eeec', color: subAddr.trim() ? '#fff' : '#bbb', fontWeight:900, fontSize:16, cursor:'pointer', fontFamily:'inherit', boxShadow: subAddr.trim() ? '0 6px 20px rgba(255,48,8,.3)' : 'none' }}>
              {subSaving ? 'Subscribing...' : 'Confirm Subscription'}
            </button>
            <button onClick={() => setSubModal(null)} style={{ marginTop:10, width:'100%', padding:'11px', borderRadius:14, border:'none', background:'none', color:'#aaa', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
          <>
            {!computeIsOpen(shop ?? { is_open: false }) && (
              <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:18 }}>🔒</span>
                <div>
                  <p style={{ fontWeight:800, fontSize:13, color:'#dc2626' }}>Shop is currently closed</p>
                  <p style={{ fontSize:12, color:'#dc2626', opacity:.8, marginTop:1 }}>
                    {shop?.opening_time ? (() => {
                      const [oh, om] = shop.opening_time!.split(':').map(Number)
                      const now = new Date()
                      const cur = now.getHours() * 60 + now.getMinutes()
                      const openMin = oh * 60 + om
                      const ampm = oh >= 12 ? 'PM' : 'AM'
                      const label = `${oh % 12 || 12}:${String(om).padStart(2, '0')} ${ampm}`
                      return cur < openMin ? `Opens today at ${label}` : `Opens tomorrow at ${label}`
                    })() : 'You can browse the menu but cannot place orders right now.'}
                  </p>
                </div>
              </div>
            )}
            {Object.entries(filteredGroups).map(([cat, items]) => (
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
                      shopClosed={!computeIsOpen(shop ?? { is_open: false })}
                      qty={cart.items?.find((i: any) => i.product.id === product.id)?.quantity ?? 0}
                      note={cart.items?.find((i: any) => i.product.id === product.id)?.note ?? ''}
                      onAdd={() => handleAdd(product)}
                      onRemove={() => cart.removeItem(product.id)}
                      onUpdate={(q: number) => cart.updateQty(product.id, q)}
                      onNote={(n: string) => cart.setNote(product.id, n)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Floating cart */}
      {showCartBar && (
        <div style={{ position:'fixed', bottom:'calc(72px + env(safe-area-inset-bottom, 0px))', left:12, right:12, zIndex:50 }}>
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
      <BottomNav active="shops" />
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────
function ProductCard({ product, qty, shopClosed, onAdd, onRemove, onUpdate, note, onNote }: {
  product: Product; qty: number; shopClosed?: boolean
  onAdd: () => void; onRemove: () => void; onUpdate: (q: number) => void
  note?: string; onNote?: (n: string) => void
}) {
  const [showNote, setShowNote] = useState(false)
  const disc = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0
  const unavailable = product.is_available === false || !!shopClosed

  return (
    <div className="pcard" style={{ opacity: unavailable ? 0.55 : 1 }}>
      {/* Info — left */}
      <div style={{ flex:1, padding:'14px 8px 14px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
        <div>
          {product.is_veg != null && (
            <div style={{ width:14, height:14, border:`2px solid ${product.is_veg ? '#16a34a' : '#ef4444'}`, borderRadius:3, display:'inline-flex', alignItems:'center', justifyContent:'center', marginBottom:6, flexShrink:0 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background: product.is_veg ? '#16a34a' : '#ef4444' }} />
            </div>
          )}
          <p style={{ fontWeight:800, fontSize:14, color:'#111', marginBottom:4, lineHeight:1.3 }}>{product.name}</p>
          {product.description && (
            <p style={{ fontSize:12, color:'#999', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any }}>{product.description}</p>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'baseline', gap:5, marginTop:10 }}>
          <span style={{ fontWeight:900, fontSize:15, color:'#111' }}>₹{product.price}</span>
          {disc > 0 && <span style={{ fontSize:11, color:'#bbb', textDecoration:'line-through' }}>₹{product.original_price}</span>}
        </div>
        {product.is_available === false && !shopClosed && (
          <span style={{ fontSize:11, color:'#bbb', fontWeight:700, marginTop:4 }}>Unavailable</span>
        )}
        {/* Per-item note — visible when item is in cart */}
        {qty > 0 && !unavailable && (
          <div style={{ marginTop:8 }}>
            {!showNote && !note ? (
              <button onClick={() => setShowNote(true)}
                style={{ fontSize:11, color:'#FF3008', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
                + Add cooking instructions
              </button>
            ) : (
              <input
                autoFocus={showNote && !note}
                value={note || ''}
                onChange={e => onNote?.(e.target.value)}
                onBlur={() => { if (!note) setShowNote(false) }}
                placeholder="e.g. No onions, extra spicy…"
                style={{ fontSize:11, width:'100%', border:'1px solid #e0e0e0', borderRadius:8, padding:'5px 8px', outline:'none', fontFamily:'inherit', background:'var(--page-bg)', color:'var(--text-primary)', boxSizing:'border-box' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Image — right side with ADD button overlaid */}
      <div style={{ width:110, flexShrink:0, position:'relative', margin:'10px 10px 10px 0', paddingBottom:16 }}>
        <div style={{ width:110, height:110, background:'#F8F8F8', borderRadius:14, overflow:'hidden', position:'relative' }}>
          {product.image_url
            ? <Image src={product.image_url} alt={product.name} fill sizes="110px" className="object-cover" />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, opacity:.15 }}>🛍️</div>
          }
          {disc > 0 && (
            <div style={{ position:'absolute', top:5, left:5, background:'#FF3008', color:'#fff', fontSize:9, fontWeight:900, padding:'2px 6px', borderRadius:6 }}>-{disc}%</div>
          )}
        </div>

        {/* ADD / stepper overlaid at bottom-center of image */}
        {!unavailable && (
          <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', zIndex:2 }}>
            {qty === 0 ? (
              <button onClick={onAdd} className="add-btn">+ ADD</button>
            ) : (
              <div className="img-stepper">
                <button onClick={() => onUpdate(qty - 1)}>−</button>
                <span>{qty}</span>
                <button onClick={() => onUpdate(qty + 1)}>+</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}