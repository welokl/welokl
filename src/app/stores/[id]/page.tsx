'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import type { Shop, Product } from '@/types'

export default function StorePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const cart = useCart()

  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCartBar, setShowCartBar] = useState(false)
  const [differentShopWarning, setDifferentShopWarning] = useState(false)

  useEffect(() => {
    loadStore()
  }, [id])

  useEffect(() => {
    setShowCartBar(cart.count() > 0 && cart.shop_id === id)
  }, [cart.items, id])

  async function loadStore() {
    const supabase = createClient()
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('shops').select('*').eq('id', id).single(),
      supabase.from('products').select('*').eq('shop_id', id).eq('is_available', true).order('sort_order'),
    ])
    setShop(s)
    setProducts(p || [])
    setLoading(false)
  }

  function handleAdd(product: Product) {
    if (cart.shop_id && cart.shop_id !== id && cart.count() > 0) {
      setDifferentShopWarning(true)
      return
    }
    cart.addItem(product, id, shop?.name || '')
  }

  function confirmClearCart(product: Product) {
    cart.clear()
    cart.addItem(product, id, shop?.name || '')
    setDifferentShopWarning(false)
  }

  // Group products by category
  const grouped = products.reduce((acc, p) => {
    const cat = p.category || 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, Product[]>)

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf7] p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-48 card shimmer" />
        {Array.from({length:3}).map((_, i) => <div key={i} className="h-20 card shimmer" />)}
      </div>
    </div>
  )

  if (!shop) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🏪</div>
        <p className="font-bold">Shop not found</p>
        <Link href="/stores" className="text-brand-500 text-sm mt-2 block">Browse all shops</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-32">
      {/* Back nav */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">←</button>
        <span className="font-semibold text-sm flex-1 truncate">{shop.name}</span>
        {cart.count() > 0 && cart.shop_id === id && (
          <Link href="/cart" className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
            🛒 {cart.count()}
          </Link>
        )}
      </div>

      {/* Shop header */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl flex-shrink-0">
              {shop.category_name?.includes('Food') ? '🍔' :
               shop.category_name?.includes('Grocery') ? '🛒' :
               shop.category_name?.includes('Pharmacy') ? '💊' :
               shop.category_name?.includes('Electronics') ? '📱' :
               shop.category_name?.includes('Salon') ? '💇' : '🏪'}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold">{shop.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{shop.category_name} · {shop.area}</p>
              {shop.description && <p className="text-sm text-gray-600 mt-2">{shop.description}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="badge-green">★ {shop.rating} Rating</span>
                {shop.is_open ? <span className="badge-green">Open</span> : <span className="badge-red">Closed</span>}
                {shop.delivery_enabled && <span className="badge-blue">🛵 {shop.avg_delivery_time} min</span>}
                {shop.pickup_enabled && <span className="badge-orange">🏃 Pickup</span>}
                {shop.min_order_amount ? <span className="text-xs text-gray-500">Min order ₹{shop.min_order_amount}</span> : <span className="text-xs text-green-600 font-semibold">Free delivery eligible</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="font-bold text-base mb-3 text-gray-800">{cat}</h2>
            <div className="space-y-3">
              {items.map(product => (
                <ProductRow
                  key={product.id}
                  product={product}
                  qty={cart.items.find(i => i.product.id === product.id)?.quantity || 0}
                  onAdd={() => handleAdd(product)}
                  onRemove={() => cart.removeItem(product.id)}
                  onUpdate={(q) => cart.updateQty(product.id, q)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Floating cart bar */}
      {showCartBar && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-4xl mx-auto">
          <Link href="/cart" className="flex items-center justify-between bg-brand-500 text-white rounded-2xl px-5 py-4 shadow-xl">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">{cart.count()}</span>
              <span className="font-semibold">View cart</span>
            </div>
            <span className="font-bold">₹{cart.subtotal()}</span>
          </Link>
        </div>
      )}

      {/* Different shop warning modal */}
      {differentShopWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="card max-w-sm w-full p-6">
            <div className="text-3xl mb-3">🛒</div>
            <h3 className="font-bold text-lg mb-2">Replace cart?</h3>
            <p className="text-gray-500 text-sm mb-5">Your cart has items from another shop. Adding this item will clear the current cart.</p>
            <div className="flex gap-3">
              <button onClick={() => setDifferentShopWarning(false)} className="btn-secondary flex-1">Keep cart</button>
              <button onClick={() => confirmClearCart(products[0])} className="btn-primary flex-1">Clear & add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProductRow({ product, qty, onAdd, onRemove, onUpdate }: {
  product: Product
  qty: number
  onAdd: () => void
  onRemove: () => void
  onUpdate: (q: number) => void
}) {
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0

  return (
    <div className="card px-4 py-4 flex items-center gap-4">
      {/* Veg/non-veg indicator */}
      {product.is_veg !== null && product.is_veg !== undefined && (
        <div className={`w-4 h-4 border-2 flex-shrink-0 flex items-center justify-center rounded-sm ${product.is_veg ? 'border-green-600' : 'border-red-600'}`}>
          <div className={`w-2 h-2 rounded-full ${product.is_veg ? 'bg-green-600' : 'bg-red-600'}`} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{product.name}</p>
        {product.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="font-bold text-sm">₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <>
              <span className="text-xs text-gray-400 line-through">₹{product.original_price}</span>
              <span className="text-xs text-green-600 font-semibold">{discount}% off</span>
            </>
          )}
        </div>
      </div>

      {/* Add / Qty controls */}
      {qty === 0 ? (
        <button
          onClick={onAdd}
          className="flex-shrink-0 border-2 border-brand-500 text-brand-500 font-bold text-sm px-5 py-1.5 rounded-xl hover:bg-brand-50 transition-colors"
        >
          ADD
        </button>
      ) : (
        <div className="flex-shrink-0 flex items-center gap-2 bg-brand-500 rounded-xl overflow-hidden">
          <button onClick={() => onUpdate(qty - 1)} className="text-white px-3 py-1.5 hover:bg-brand-600 transition-colors text-base font-bold">−</button>
          <span className="text-white font-bold text-sm min-w-[20px] text-center">{qty}</span>
          <button onClick={() => onUpdate(qty + 1)} className="text-white px-3 py-1.5 hover:bg-brand-600 transition-colors text-base font-bold">+</button>
        </div>
      )}
    </div>
  )
}
