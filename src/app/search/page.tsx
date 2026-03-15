'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

interface Product {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; description: string | null; unit: string | null
  shop_id: string; shop_name: string; shop_is_open: boolean; shop_area: string | null
}

const TRENDING = ['milk','bread','eggs','rice','tea','biryani','paneer','atta','oil','chips','water','medicine']
const RECENT_KEY = 'welokl_recent_searches'

export default function SearchPage() {
  const router   = useRouter()
  const cart     = useCart()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<Product[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [conflict, setConflict] = useState<Product | null>(null)
  const [recents,  setRecents]  = useState<string[]>([])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
    try { setRecents(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch {}
    cart._hydrate?.()
  }, [])

  function saveRecent(q: string) {
    if (!q.trim()) return
    const updated = [q, ...recents.filter(r => r !== q)].slice(0, 6)
    setRecents(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  function removeRecent(q: string) {
    const updated = recents.filter(r => r !== q)
    setRecents(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    try {
      const sb = createClient()

      // Get all shops (include NULL is_active — some shops may not have it set)
      const { data: shops } = await sb
        .from('shops')
        .select('id,name,is_open,area,is_active')
        .or('is_active.is.null,is_active.eq.true')

      if (!shops?.length) { setResults([]); return }

      const shopMap: Record<string, { name: string; is_open: boolean; area: string | null }> = {}
      shops.forEach(s => { shopMap[s.id] = { name: s.name, is_open: s.is_open, area: s.area } })

      // Search products — don't filter is_available at DB level (NULL = available)
      const { data: products, error } = await sb
        .from('products')
        .select('id,name,price,original_price,image_url,description,unit,shop_id,is_available')
        .ilike('name', `%${q.trim()}%`)
        .in('shop_id', shops.map(s => s.id))
        .limit(80)

      if (error) {
        console.error('[search] error:', error.message)
        setResults([]); return
      }

      const mapped: Product[] = (products || [])
        .filter(p => p.is_available !== false && shopMap[p.shop_id]) // exclude only explicit false
        .map(p => ({
          id: p.id, name: p.name, price: p.price, original_price: p.original_price,
          image_url: p.image_url, description: p.description, unit: p.unit,
          shop_id: p.shop_id, shop_name: shopMap[p.shop_id].name,
          shop_is_open: shopMap[p.shop_id].is_open, shop_area: shopMap[p.shop_id].area,
        }))
        .sort((a, b) => Number(b.shop_is_open) - Number(a.shop_is_open))

      setResults(mapped)
      saveRecent(q.trim())
    } catch (e) {
      console.error('[search] crash:', e)
      setResults([])
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 350)
    return () => clearTimeout(t)
  }, [query, search])

  function addToCart(p: Product) {
    if (cart.shop_id && cart.shop_id !== p.shop_id && cart.items.length > 0) { setConflict(p); return }
    cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url }, p.shop_id, p.shop_name)
  }
  function getQty(id: string) { return cart.items.find(i => i.product.id === id)?.quantity || 0 }
  const cartCount = cart.count?.() ?? 0

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:100 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
        @keyframes sh { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:16px; }
        .sr-row { animation:fadeUp .18s ease forwards; background:#fff; border-radius:18px; display:flex; gap:0; overflow:hidden; }
        .sr-row:active { transform:scale(.99); }
      `}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'10px 16px 12px' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', gap:10, alignItems:'center' }}>
          {/* Back */}
          <button onClick={() => router.back()} style={{ width:40, height:40, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Search input */}
          <div style={{ flex:1, position:'relative' }}>
            <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
                <circle cx="11" cy="11" r="8" stroke="#aaa" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="#aaa" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <input
              ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search milk, bread, medicine…"
              style={{ width:'100%', height:44, borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--page-bg)', color:'var(--text-primary)', paddingLeft:40, paddingRight:query?36:14, fontSize:15, fontFamily:'inherit', outline:'none', boxSizing:'border-box', transition:'border .2s,background .2s' }}
              onFocus={e => { e.currentTarget.style.borderColor='#FF3008'; e.currentTarget.style.background='#fff' }}
              onBlur={e => { e.currentTarget.style.borderColor='#eee'; e.currentTarget.style.background='#F5F5F5' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'var(--text-faint)', border:'none', cursor:'pointer', width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width={12} height={12}>
                  <path d="M18 6L6 18M6 6l12 12" stroke="#666" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'16px 12px' }}>

        {/* Empty state — recents + trending */}
        {!query && (
          <>
            {/* Recent searches */}
            {recents.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <p style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>Recent searches</p>
                  <button onClick={() => { setRecents([]); localStorage.removeItem(RECENT_KEY) }} style={{ fontSize:12, fontWeight:700, color:'#FF3008', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Clear all</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {recents.map(r => (
                    <div key={r} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--card-white)', borderRadius:14 }}>
                      <svg viewBox="0 0 24 24" fill="none" width={16} height={16} style={{ flexShrink:0 }}>
                        <circle cx="12" cy="12" r="9" stroke="#bbb" strokeWidth="2"/>
                        <path d="M12 7v5l3 3" stroke="#bbb" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <button onClick={() => setQuery(r)} style={{ flex:1, textAlign:'left', background:'none', border:'none', cursor:'pointer', fontSize:14, color:'var(--text-secondary)', fontFamily:'inherit', fontWeight:600 }}>{r}</button>
                      <button onClick={() => removeRecent(r)} style={{ background:'none', border:'none', cursor:'pointer', padding:4 }}>
                        <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M18 6L6 18M6 6l12 12" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            <div>
              <p style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)', marginBottom:12 }}>
                <span style={{ marginRight:6 }}>🔥</span>Trending now
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {TRENDING.map(t => (
                  <button key={t} onClick={() => setQuery(t)}
                    style={{ padding:'8px 18px', borderRadius:999, border:'1.5px solid var(--divider)', background:'var(--card-white)', color:'var(--text-secondary)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Skeletons */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:90 }} />)}
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ width:80, height:80, background:'var(--page-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={36} height={36}>
                <circle cx="11" cy="11" r="8" stroke="#ccc" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', marginBottom:6 }}>Nothing found for "{query}"</p>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>Try different words or browse shops</p>
            <Link href="/stores" style={{ display:'inline-block', padding:'12px 28px', borderRadius:14, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, textDecoration:'none' }}>
              Browse shops →
            </Link>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <>
            <p style={{ fontSize:12, color:'var(--text-muted)', fontWeight:700, marginBottom:12 }}>
              {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {results.map((p, i) => {
                const qty = getQty(p.id)
                const disc = p.original_price && p.original_price > p.price
                  ? Math.round((1 - p.price / p.original_price) * 100) : 0
                return (
                  <div key={p.id} className="sr-row" style={{ animationDelay:`${i*0.025}s`, opacity: p.shop_is_open ? 1 : 0.55 }}>
                    {/* Image */}
                    <div style={{ width:90, height:90, flexShrink:0, background:'var(--chip-bg)', position:'relative', overflow:'hidden' }}>
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" width={32} height={32}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#ddd" strokeWidth="1.5"/><line x1="3" y1="6" x2="21" y2="6" stroke="#ddd" strokeWidth="1.5"/></svg>
                          </div>
                      }
                      {disc > 0 && <div style={{ position:'absolute', top:6, left:6, background:'#FF3008', color:'#fff', fontSize:9, fontWeight:900, padding:'2px 5px', borderRadius:5 }}>-{disc}%</div>}
                      {!p.shop_is_open && (
                        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:9, fontWeight:800, color:'#fff', background:'rgba(0,0,0,.6)', padding:'2px 6px', borderRadius:4 }}>CLOSED</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, padding:'12px 12px 12px 12px', minWidth:0, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                      <div>
                        <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</p>
                        <Link href={`/stores/${p.shop_id}`} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)', textDecoration:'none', marginBottom:6 }}>
                          <svg viewBox="0 0 24 24" fill="none" width={11} height={11}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#aaa" strokeWidth="2"/></svg>
                          {p.shop_name}{p.shop_area ? ` · ${p.shop_area}` : ''}
                        </Link>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontWeight:900, fontSize:15, color:'var(--text-primary)' }}>₹{p.price}</span>
                        {p.unit && <span style={{ fontSize:11, color:'var(--text-faint)' }}>{p.unit}</span>}
                        {disc > 0 && (
                          <>
                            <span style={{ fontSize:11, color:'var(--text-faint)', textDecoration:'line-through' }}>₹{p.original_price}</span>
                            <span style={{ fontSize:10, fontWeight:800, color:'#16a34a', background:'var(--green-light)', padding:'1px 6px', borderRadius:5 }}>{disc}% OFF</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    {p.shop_is_open && (
                      <div style={{ display:'flex', alignItems:'center', paddingRight:12 }}>
                        {qty === 0 ? (
                          <button onClick={() => addToCart(p)} style={{ padding:'8px 18px', borderRadius:12, border:'2px solid #FF3008', background:'var(--red-light)', color:'#FF3008', fontWeight:900, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                            ADD
                          </button>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', background:'#FF3008', borderRadius:12, overflow:'hidden' }}>
                            <button onClick={() => cart.updateQty(p.id, qty - 1)} style={{ width:34, height:36, border:'none', background:'none', color:'#fff', fontSize:18, fontWeight:900, cursor:'pointer', lineHeight:1 }}>−</button>
                            <span style={{ color:'#fff', fontWeight:900, fontSize:14, minWidth:20, textAlign:'center' }}>{qty}</span>
                            <button onClick={() => addToCart(p)} style={{ width:34, height:36, border:'none', background:'none', color:'#fff', fontSize:18, fontWeight:900, cursor:'pointer', lineHeight:1 }}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Cart conflict */}
      {conflict && (
        <div style={{ position:'fixed', inset:0, zIndex:999, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'var(--card-white)', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480, fontFamily:'inherit' }}>
            <div style={{ width:48, height:48, background:'var(--red-light)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={24} height={24}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#FF3008" strokeWidth="2"/><line x1="3" y1="6" x2="21" y2="6" stroke="#FF3008" strokeWidth="2"/><path d="M16 10a4 4 0 01-8 0" stroke="#FF3008" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <h3 style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', textAlign:'center', marginBottom:8 }}>Start a new cart?</h3>
            <p style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', marginBottom:24, lineHeight:1.6 }}>
              Your cart has items from <strong style={{ color:'var(--text-primary)' }}>{cart.shop_name}</strong>. Adding this will clear it.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConflict(null)} style={{ flex:1, padding:14, borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--page-bg)', color:'var(--text-primary)', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Keep cart</button>
              <button onClick={() => { cart.clear(); cart.addItem({ id:conflict.id, name:conflict.name, price:conflict.price, image_url:conflict.image_url }, conflict.shop_id, conflict.shop_name); setConflict(null) }}
                style={{ flex:1, padding:14, borderRadius:14, border:'none', background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                Start new
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating cart */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:24, left:12, right:12, zIndex:50, maxWidth:480, margin:'0 auto' }}>
          <Link href="/cart" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#FF3008', borderRadius:18, padding:'14px 20px', textDecoration:'none', boxShadow:'0 8px 24px rgba(255,48,8,.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ background:'rgba(255,255,255,.2)', borderRadius:10, padding:'3px 10px', fontWeight:900, fontSize:13, color:'#fff' }}>{cartCount}</span>
              <span style={{ fontWeight:800, fontSize:14, color:'#fff' }}>View cart</span>
            </div>
            <span style={{ fontWeight:900, fontSize:14, color:'#fff' }}>₹{cart.subtotal()}</span>
          </Link>
        </div>
      )}
    </div>
  )
}