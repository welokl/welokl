$content = @'
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import FavouriteButton from '@/components/FavouriteButton'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; banner_url?: string | null
}
interface Product {
  id: string; name: string; description?: string | null
  price: number; original_price?: number | null
  image_url: string | null
  is_veg?: boolean | null
  is_available: boolean; category?: string | null; category_name?: string | null
  sort_order?: number; shop_id: string
}

export default function StorePage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cart    = useCart() as any
  const [shop,     setShop]     = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [diffWarn, setDiffWarn] = useState(false)
  const [activeCat, setActiveCat] = useState('all')

  useEffect(() => { load() }, [id])

  async function load() {
    const sb = createClient()
    const [{ data: s }, { data: p, error: pe }] = await Promise.all([
      sb.from('shops').select('*').eq('id', id).single(),
      sb.from('products')
        .select('*')
        .eq('shop_id', id)
        .order('sort_order'),
    ])
    if (pe) console.error('[store] products error:', pe.message)
    console.log('[store] products:', p?.map((x: any) => ({ name: x.name, image_url: x.image_url })))
    setShop(s)
    setProducts((p ?? []) as Product[])
    setLoading(false)
  }

  function handleAdd(product: Product) {
    if (cart.shop_id && cart.shop_id !== id && cart.count() > 0) { setDiffWarn(true); return }
    cart.addItem(product, id, shop?.name ?? '')
  }

  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const cat = p.category ?? p.category_name ?? 'Other'
    ;(acc[cat] ??= []).push(p)
    return acc
  }, {})
  const categories = Object.keys(grouped)
  const cartCount    = cart.count?.() ?? 0
  const cartSubtotal = cart.subtotal?.() ?? 0
  const showCartBar  = cartCount > 0 && cart.shop_id === id

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:14px;}`}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="sk" style={{ height: 220 }} />
        {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 88 }} />)}
      </div>
    </div>
  )

  if (!shop) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 14 }}>?</div>
        <p style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 10 }}>Shop not found</p>
        <Link href="/stores" style={{ color: '#ff3008', fontSize: 14, textDecoration: 'none', fontWeight: 700 }}>Browse all shops</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 120 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
        @keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;}
        .prow{transition:transform .15s,box-shadow .15s;}
        .prow:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(0,0,0,.13);}
        .tab-btn{padding:12px 18px;font-weight:700;font-size:13px;background:none;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;transition:color .15s;}
        @media(min-width:768px){.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}}
      `}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>&#8592;</button>
          <span style={{ fontWeight: 800, fontSize: 15, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{shop.name}</span>
          <FavouriteButton shopId={id} />
          {showCartBar && (
            <Link href="/cart" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
              Cart {cartCount}
            </Link>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, background: 'var(--bg-3)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {shop.image_url
              ? <img src={shop.image_url} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              : <span style={{ fontSize: 36 }}>&#127978;</span>}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 900, fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--text)', marginBottom: 4 }}>{shop.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12 }}>{shop.category_name} - {shop.area}</p>
            {shop.description && <p style={{ fontSize: 14, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6, maxWidth: 600 }}>{shop.description}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { v: shop.rating + ' stars', col: '#d97706', bg: 'rgba(217,119,6,.14)' },
                { v: shop.is_open ? 'Open' : 'Closed', col: shop.is_open ? '#16a34a' : '#ef4444', bg: shop.is_open ? 'rgba(22,163,74,.14)' : 'rgba(239,68,68,.14)' },
                ...(shop.delivery_enabled ? [{ v: shop.avg_delivery_time + ' min', col: '#2563eb', bg: 'rgba(37,99,235,.14)' }] : []),
                ...(shop.pickup_enabled ? [{ v: 'Pickup', col: '#d97706', bg: 'rgba(217,119,6,.14)' }] : []),
              ].map(b => <span key={b.v} style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: b.bg, color: b.col }}>{b.v}</span>)}
            </div>
          </div>
        </div>
      </div>

      {categories.length > 1 && (
        <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', overflowX: 'auto', position: 'sticky', top: 56, zIndex: 40 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '0 20px' }}>
            {['all', ...categories].map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)} className="tab-btn"
                style={{ color: activeCat === cat ? '#ff3008' : 'var(--text-3)', borderBottom: '2px solid ' + (activeCat === cat ? '#ff3008' : 'transparent') }}>
                {cat === 'all' ? 'All items' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>
        {products.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>&#128230;</div>
            <p style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>No products yet</p>
          </div>
        )}
        {(activeCat === 'all' ? Object.entries(grouped) : [[activeCat, grouped[activeCat] ?? []]] as [string, Product[]][]).map(([cat, items]) => (
          <div key={String(cat)} style={{ marginBottom: 40 }}>
            <h2 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
              {String(cat)} <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-3)' }}>({(items as Product[]).length})</span>
            </h2>
            <div className="prod-grid" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(items as Product[]).map(product => (
                <ProductRow key={product.id} product={product}
                  qty={(cart.items as Array<{ product: { id: string }; quantity: number }>).find(i => i.product.id === product.id)?.quantity ?? 0}
                  onAdd={() => handleAdd(product)}
                  onRemove={() => cart.removeItem(product.id)}
                  onUpdate={(q: number) => cart.updateQty(product.id, q)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCartBar && (
        <div style={{ position: 'fixed', bottom: 20, left: 20, right: 20, zIndex: 50 }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <Link href="/cart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ff3008', color: '#fff', borderRadius: 18, padding: '16px 22px', textDecoration: 'none', boxShadow: '0 8px 32px rgba(255,48,8,.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 12px', fontWeight: 900, fontSize: 15 }}>{cartCount}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>View cart</span>
              </div>
              <span style={{ fontWeight: 900, fontSize: 16 }}>Rs.{cartSubtotal}</span>
            </Link>
          </div>
        </div>
      )}

      {diffWarn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, maxWidth: 380, width: '100%', padding: '32px 28px' }}>
            <h3 style={{ fontWeight: 900, fontSize: 19, color: 'var(--text)', marginBottom: 8 }}>Replace cart?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>Your cart has items from another shop. Adding this item will clear it.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDiffWarn(false)} style={{ flex: 1, padding: 14, borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Keep cart</button>
              <button onClick={() => { cart.clear(); if (products[0]) cart.addItem(products[0], id, shop.name); setDiffWarn(false) }} style={{ flex: 1, padding: 14, borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }}>Clear and add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, qty, onAdd, onRemove, onUpdate }: {
  product: Product; qty: number
  onAdd: () => void; onRemove: () => void; onUpdate: (q: number) => void
}) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0

  return (
    <div className="prow" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 88, height: 88, borderRadius: 14, flexShrink: 0, overflow: 'hidden', background: 'var(--bg-3)', border: '2px solid var(--border)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { const el = e.currentTarget as HTMLImageElement; el.style.display = 'none' }} />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.25 }}>&#127869;</span>
        )}
        {disc > 0 && <div style={{ position: 'absolute', top: 5, left: 5, background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6 }}>{disc}% off</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {product.is_veg != null && (
          <div style={{ width: 14, height: 14, border: '2px solid ' + (product.is_veg ? '#16a34a' : '#ef4444'), borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: product.is_veg ? '#16a34a' : '#ef4444' }} />
          </div>
        )}
        <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>{product.name}</p>
        {product.description && <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>Rs.{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <><span style={{ fontSize: 13, color: 'var(--text-4)', textDecoration: 'line-through' }}>Rs.{product.original_price}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{disc}% off</span></>
          )}
        </div>
      </div>
      {qty === 0 ? (
        <button onClick={onAdd} style={{ flexShrink: 0, border: '2px solid #ff3008', color: '#ff3008', background: 'none', fontWeight: 800, fontSize: 14, padding: '8px 22px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ADD</button>
      ) : (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: '#ff3008', borderRadius: 12, overflow: 'hidden' }}>
          <button onClick={() => onUpdate(qty - 1)} style={{ color: '#fff', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 18 }}>-</button>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 15, minWidth: 24, textAlign: 'center' }}>{qty}</span>
          <button onClick={() => onUpdate(qty + 1)} style={{ color: '#fff', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 18 }}>+</button>
        </div>
      )}
    </div>
  )
}
'@

$path = "src\app\stores\[id]\page.tsx"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content)
Write-Host "DONE - file written successfully"
Write-Host "Lines: $($content.Split("`n").Length)"