// src/components/helpers.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'

// ── DeliveryCountdown ────────────────────────────────────────────────────────
export function DeliveryCountdown({ pickedUpAt, estimatedMinutes }: { pickedUpAt: string; estimatedMinutes: number }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    function calc() {
      const elapsed = (Date.now() - new Date(pickedUpAt).getTime()) / 60000
      const left = Math.max(0, Math.round(estimatedMinutes - elapsed))
      setRemaining(left)
    }
    calc()
    const t = setInterval(calc, 30000)
    return () => clearInterval(t)
  }, [pickedUpAt, estimatedMinutes])

  if (remaining === null) return null

  return (
    <div style={{ background: 'linear-gradient(135deg, #0891B2, #0e7490)', borderRadius: 18, padding: '18px 20px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        🛵
      </div>
      <div>
        <p style={{ fontWeight: 900, fontSize: 16, color: '#fff', marginBottom: 2 }}>
          {remaining === 0 ? 'Arriving now!' : `~${remaining} min away`}
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
          Rider is on the way to you
        </p>
      </div>
    </div>
  )
}

// ── OrderAgainButton ─────────────────────────────────────────────────────────
export function OrderAgainButton({ shopId, items }: { shopId: string; items: { product_id: string; quantity: number }[] }) {
  const router   = useRouter()
  const cart     = useCart()
  const [loading, setLoading] = useState(false)

  async function handleReorder() {
    if (!items?.length) return
    setLoading(true)
    try {
      const sb = createClient()
      const { data: shop }     = await sb.from('shops').select('id, name').eq('id', shopId).single()
      const productIds          = items.map(i => i.product_id).filter(Boolean)
      const { data: products }  = await sb.from('products').select('id, name, price, image_url, is_available').in('id', productIds)

      if (!shop || !products?.length) { setLoading(false); return }

      cart.clear()
      for (const item of items) {
        const p = products.find(p => p.id === item.product_id)
        if (p && p.is_available !== false) {
          for (let q = 0; q < item.quantity; q++) {
            cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url }, shop.id, shop.name)
          }
        }
      }
      router.push('/cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleReorder} disabled={loading}
      style={{ flex: 1, padding: '12px', borderRadius: 13, border: '1.5px solid rgba(8,145,178,.3)', background: 'rgba(8,145,178,.07)', color: '#0891B2', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
      {loading ? '⏳ Adding…' : '🔁 Order again'}
    </button>
  )
}