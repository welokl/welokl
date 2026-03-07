'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import FavouriteButton from '@/components/FavouriteButton'
import type { Shop, Product } from '@/types'

export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const cart = useCart()
  const [shop, setShop]   = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [showCartBar, setShowCartBar]   = useState(false)
  const [diffShopWarn, setDiffShopWarn] = useState(false)
  const [activeCategory, setActiveCat]  = useState('all')

  useEffect(() => { loadStore() }, [id])
  useEffect(() => { setShowCartBar(cart.count() > 0 && cart.shop_id === id) }, [cart.items, id])

  async function loadStore() {
    const supabase = createClient()
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('shops').select('*').eq('id', id).single(),
      supabase.from('products').select('*').eq('shop_id', id).eq('is_available', true).order('sort_order'),
    ])
    setShop(s); setProducts(p || []); setLoading(false)
  }

  function handleAdd(product: Product) {
    if (cart.shop_id && cart.shop_id !== id && cart.count() > 0) { setDiffShopWarn(true); return }
    cart.addItem(product, id, shop?.name || '')
  }

  const grouped = products.reduce((acc, p) => {
    const cat = p.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Product[]>)

  const categories = Object.keys(grouped)

  const catIcon = (cat?: string | null) =>
    cat?.includes('Food') ? '🍔' : cat?.includes('Grocery') ? '🛒' : cat?.includes('Pharmacy') ? '💊' :
    cat?.includes('Electronics') ? '📱' : cat?.includes('Salon') ? '💇' : '🏪'

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="shimmer" style={{ height: 200, borderRadius: 18 }} />
        {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16 }} />)}
      </div>
    </div>
  )
  if (!shop) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
        <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Shop not found</p>
        <Link href="/stores" style={{ color: '#ff3008', fontSize: 14, textDecoration: 'none' }}>Browse all shops</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 120 }}>
      {/* Back nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{shop.name}</span>
        <FavouriteButton shopId={id} />
        {cart.count() > 0 && cart.shop_id === id && (
          <Link href="/cart" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>
            🛒 {cart.count()}
          </Link>
        )}
      </div>

      {/* Shop hero */}
      <div style={{ background: 'var(--bg-1)', borderBottom: '1px solid var(--border)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          <div style={{ width: 68, height: 68, background: 'var(--card-bg)', borderRadius: 18, boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>
            {catIcon(shop.category_name)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontWeight: 900, fontSize: 22, color: 'var(--text)', marginBottom: 4 }}>{shop.name}</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 10 }}>{shop.category_name} · {shop.area}</p>
            {shop.description && <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>{shop.description}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { v: `★ ${shop.rating}`, col: '#d97706', bg: 'var(--amber-bg)' },
                { v: shop.is_open ? 'Open' : 'Closed', col: shop.is_open ? '#16a34a' : '#ef4444', bg: shop.is_open ? 'var(--green-bg)' : 'var(--red-bg)' },
                ...(shop.delivery_enabled ? [{ v: `🛵 ${shop.avg_delivery_time} min`, col: '#2563eb', bg: 'var(--blue-bg)' }] : []),
                ...(shop.pickup_enabled ? [{ v: '🏃 Pickup', col: '#d97706', bg: 'var(--amber-bg)' }] : []),
              ].map(b => (
                <span key={b.v} style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: b.bg, color: b.col }}>{b.v}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs if multiple */}
      {categories.length > 1 && (
        <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '0 16px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: 0, maxWidth: 760, margin: '0 auto' }}>
            {['all', ...categories].map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)}
                style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                  color: activeCategory === cat ? '#ff3008' : 'var(--text-3)',
                  borderBottom: `2px solid ${activeCategory === cat ? '#ff3008' : 'transparent'}` }}>
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
        {(activeCategory === 'all' ? Object.entries(grouped) : [[activeCategory, grouped[activeCategory] || []]]).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 32 }}>
            <h2 style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)', marginBottom: 12 }}>{cat}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(items as Product[]).map(product => (
                <ProductRow key={product.id} product={product}
                  qty={cart.items.find(i => i.product.id === product.id)?.quantity || 0}
                  onAdd={() => handleAdd(product)}
                  onRemove={() => cart.removeItem(product.id)}
                  onUpdate={q => cart.updateQty(product.id, q)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating cart bar */}
      {showCartBar && (
        <div style={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 50, maxWidth: 760, margin: '0 auto' }}>
          <Link href="/cart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ff3008', color: '#fff', borderRadius: 18, padding: '16px 20px', textDecoration: 'none', boxShadow: '0 8px 28px rgba(255,48,8,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '2px 10px', fontWeight: 900, fontSize: 15 }}>{cart.count()}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>View cart</span>
            </div>
            <span style={{ fontWeight: 900, fontSize: 16 }}>₹{cart.subtotal()}</span>
          </Link>
        </div>
      )}

      {/* Different shop modal */}
      {diffShopWarn && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 20, maxWidth: 360, width: '100%', padding: '28px 24px', boxShadow: 'var(--card-shadow-lg)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
            <h3 style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>Replace cart?</h3>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24, lineHeight: 1.5 }}>Your cart has items from another shop. Adding this will clear the current cart.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDiffShopWarn(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Keep cart
              </button>
              <button onClick={() => { cart.clear(); cart.addItem(products[0], id, shop?.name || ''); setDiffShopWarn(false) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }}>
                Clear & add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, qty, onAdd, onRemove, onUpdate }: { product: Product; qty: number; onAdd: ()=>void; onRemove: ()=>void; onUpdate: (q:number)=>void }) {
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: 'var(--card-shadow)' }}>
      {product.is_veg !== null && product.is_veg !== undefined && (
        <div style={{ width: 16, height: 16, border: `2px solid ${product.is_veg ? '#16a34a' : '#ef4444'}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: product.is_veg ? '#16a34a' : '#ef4444' }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>{product.name}</p>
        {product.description && <p style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{product.description}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-4)', textDecoration: 'line-through' }}>₹{product.original_price}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{discount}% off</span>
            </>
          )}
        </div>
      </div>
      {qty === 0 ? (
        <button onClick={onAdd}
          style={{ border: '2px solid #ff3008', color: '#ff3008', background: 'none', fontWeight: 800, fontSize: 13, padding: '7px 18px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          ADD
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', background: '#ff3008', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
          <button onClick={() => onUpdate(qty - 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>−</button>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, minWidth: 22, textAlign: 'center' }}>{qty}</span>
          <button onClick={() => onUpdate(qty + 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>+</button>
        </div>
      )}
    </div>
  )
}