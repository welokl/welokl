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

export default function SearchPage() {
  const router = useRouter()
  const cart = useCart()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery]             = useState('')
  const [results, setResults]         = useState<Product[]>([])
  const [loading, setLoading]         = useState(false)
  const [searched, setSearched]       = useState(false)
  const [cartConflict, setCartConflict] = useState<{ product: Product } | null>(null)

  useEffect(() => {
    cart._hydrate?.()
    inputRef.current?.focus()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true); setSearched(true)
    try {
      const sb = createClient()

      // Step 1 — get active shop IDs
      const { data: activeShops } = await sb
        .from('shops')
        .select('id, name, is_open, area')
        .eq('is_active', true)

      if (!activeShops || activeShops.length === 0) { setResults([]); return }

      const shopMap: Record<string, { name: string; is_open: boolean; area: string | null }> = {}
      activeShops.forEach(s => { shopMap[s.id] = { name: s.name, is_open: s.is_open, area: s.area } })
      const activeIds = activeShops.map(s => s.id)

      // Step 2 — search products in those shops
      const { data: products, error } = await sb
        .from('products')
        .select('id, name, price, original_price, image_url, description, unit, shop_id')
        .ilike('name', `%${q.trim()}%`)
        .in('shop_id', activeIds)
        .limit(50)

      if (error) { console.error('[search]', error.message); setResults([]); return }

      const mapped: Product[] = (products || [])
        .filter(p => shopMap[p.shop_id])
        .map(p => ({
          id: p.id, name: p.name, price: p.price,
          original_price: p.original_price, image_url: p.image_url,
          description: p.description, unit: p.unit,
          shop_id: p.shop_id,
          shop_name: shopMap[p.shop_id]?.name || '',
          shop_is_open: shopMap[p.shop_id]?.is_open ?? false,
          shop_area: shopMap[p.shop_id]?.area || null,
        }))

      // Open shops first
      mapped.sort((a, b) => Number(b.shop_is_open) - Number(a.shop_is_open))
      setResults(mapped)
    } catch (e) {
      console.error('[search] unexpected:', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 400)
    return () => clearTimeout(t)
  }, [query, search])

  function addToCart(product: Product) {
    if (cart.shop_id && cart.shop_id !== product.shop_id && cart.items.length > 0) {
      setCartConflict({ product }); return
    }
    cart.addItem(
      { id: product.id, name: product.name, price: product.price, image_url: product.image_url },
      product.shop_id, product.shop_name
    )
  }

  function getQty(productId: string) {
    return cart.items.find(i => i.product.id === productId)?.quantity || 0
  }

  const TRENDING = ['milk','bread','eggs','rice','medicine','chai','biryani','paneer','atta','oil']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 100 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.sr-item{animation:fadeUp .18s ease forwards}`}</style>

      {/* Sticky search header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px 12px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>←</button>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search milk, bread, medicine…"
              style={{ width: '100%', height: 44, borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', paddingLeft: 40, paddingRight: query ? 36 : 14, fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {query && (
              <button onClick={() => { setQuery(''); inputRef.current?.focus() }}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-3)', display: 'flex', alignItems: 'center' }}>✕</button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '16px' }}>

        {/* Trending */}
        {!query && (
          <>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 12 }}>🔥 Trending searches</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              {TRENDING.map(t => (
                <button key={t} onClick={() => setQuery(t)}
                  style={{ padding: '8px 16px', borderRadius: 999, border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text-2)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:14px;}`}</style>
            {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 82 }} />)}
          </div>
        )}

        {/* No results */}
        {!loading && searched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
            <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>No results for "{query}"</p>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>Try a shorter word, or browse shops directly</p>
            <Link href="/stores" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 14, background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Browse shops →</Link>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700, marginBottom: 12 }}>{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map((p, i) => {
                const qty = getQty(p.id)
                const disc = p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : 0
                return (
                  <div key={p.id} className="sr-item" style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s`, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '14px', display: 'flex', gap: 12, alignItems: 'center', opacity: p.shop_is_open ? 1 : 0.6 }}>
                    {/* Image */}
                    <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--bg-3)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🛍️</span>}
                      {!p.shop_is_open && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.7)', padding: '2px 6px', borderRadius: 6 }}>CLOSED</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                      <Link href={`/stores/${p.shop_id}`} style={{ fontSize: 11, color: 'var(--text-3)', textDecoration: 'none', display: 'block', marginBottom: 6 }}>
                        🏪 {p.shop_name}{p.shop_area ? ` · ${p.shop_area}` : ''}
                      </Link>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>₹{p.price}</span>
                        {p.unit && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.unit}</span>}
                        {disc > 0 && <>
                          <span style={{ fontSize: 11, color: 'var(--text-4)', textDecoration: 'line-through' }}>₹{p.original_price}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#16a34a', background: 'rgba(22,163,74,.1)', padding: '1px 6px', borderRadius: 6 }}>{disc}% OFF</span>
                        </>}
                      </div>
                    </div>

                    {/* Add/qty button */}
                    {p.shop_is_open && (
                      qty === 0 ? (
                        <button onClick={() => addToCart(p)}
                          style={{ flexShrink: 0, padding: '8px 18px', borderRadius: 12, border: '2px solid #FF3008', background: 'rgba(255,48,8,.06)', color: '#FF3008', fontWeight: 900, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Add
                        </button>
                      ) : (
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: '#FF3008', borderRadius: 12, overflow: 'hidden' }}>
                          <button onClick={() => cart.updateQty(p.id, qty - 1)} style={{ width: 34, height: 36, border: 'none', background: 'none', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>−</button>
                          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                          <button onClick={() => addToCart(p)} style={{ width: 34, height: 36, border: 'none', background: 'none', color: '#fff', fontSize: 18, fontWeight: 900, cursor: 'pointer' }}>+</button>
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Cart conflict modal */}
      {cartConflict && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '24px 24px 0 0', padding: '28px 20px 40px', width: '100%', maxWidth: 480, fontFamily: 'inherit' }}>
            <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center' }}>🛒</div>
            <h3 style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>Start a new cart?</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', marginBottom: 24 }}>
              Your cart has items from <strong>{cart.shop_name}</strong>. Adding this will clear it.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCartConflict(null)}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Keep cart
              </button>
              <button onClick={() => {
                const p = cartConflict.product
                cart.clear()
                cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url }, p.shop_id, p.shop_name)
                setCartConflict(null)
              }} style={{ flex: 1, padding: '14px', borderRadius: 14, border: 'none', background: '#FF3008', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Start new cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating cart bar */}
      {cart.count() > 0 && (
        <div style={{ position: 'fixed', bottom: 24, left: 16, right: 16, zIndex: 50, maxWidth: 480, margin: '0 auto' }}>
          <Link href="/cart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FF3008', borderRadius: 18, padding: '14px 20px', textDecoration: 'none', boxShadow: '0 8px 24px rgba(255,48,8,.35)' }}>
            <span style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>{cart.count()} item{cart.count() !== 1 ? 's' : ''} · ₹{cart.subtotal()}</span>
            <span style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>View cart →</span>
          </Link>
        </div>
      )}
    </div>
  )
}