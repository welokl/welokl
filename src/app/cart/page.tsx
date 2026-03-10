'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/store/cart'
import { calculateFees, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '@/types'

export default function CartPage() {
  const router = useRouter()
  const cart = useCart()
  // Hydration guard — cart is in zustand/localStorage, avoid SSR mismatch
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#ff3008', borderRadius: '50%', animation: 'sp .7s linear infinite' }} />
    </div>
  )

  const subtotal = cart.subtotal()
  const fees = calculateFees(subtotal)

  if (cart.items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🛒</div>
          <h2 style={{ fontWeight: 900, fontSize: 20, color: 'var(--text)', marginBottom: 8 }}>Your cart is empty</h2>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 24 }}>Browse shops and add items to get started</p>
          <Link href="/stores" style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            Explore shops
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>&#8592;</button>
        <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', flex: 1 }}>Your Cart</h1>
        <span style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>{cart.shop_name}</span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 120px' }}>
        {/* Items */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
          {cart.items.map((item, i) => (
            <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              {/* Product thumbnail */}
              {(item.product as any).image_url && (
                <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-3)' }}>
                  <img src={(item.product as any).image_url} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>&#8377;{item.product.price} each</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#ff3008', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity - 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>-</button>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, minWidth: 22, textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity + 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>+</button>
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', minWidth: 56, textAlign: 'right' }}>&#8377;{item.product.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Free delivery progress */}
        {fees.delivery_fee > 0 && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              <span>Add &#8377;{FREE_DELIVERY_THRESHOLD - subtotal} more for free delivery</span>
              <span>&#8377;{subtotal}/&#8377;{FREE_DELIVERY_THRESHOLD}</span>
            </div>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%`, background: '#ff3008', borderRadius: 999, transition: 'width .3s' }} />
            </div>
          </div>
        )}

        {/* Price breakdown */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: '16px', marginBottom: 14 }}>
          <h3 style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-3)', marginBottom: 12, letterSpacing: '0.05em' }}>BILL SUMMARY</h3>
          {[
            { label: 'Subtotal', value: subtotal },
            { label: `Delivery fee${fees.delivery_fee === 0 ? ' (FREE!)' : ''}`, value: fees.delivery_fee },
            { label: 'Platform fee', value: fees.platform_fee },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
              <span style={{ color: r.label.includes('FREE') ? '#16a34a' : 'var(--text-2)' }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: r.value === 0 ? '#16a34a' : 'var(--text)' }}>{r.value === 0 ? 'FREE' : `&#8377;${r.value}`}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>Total</span>
            <span style={{ fontWeight: 900, fontSize: 15, color: 'var(--text)' }}>&#8377;{fees.total}</span>
          </div>
        </div>

        {/* Tip */}
        <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', marginBottom: 80 }}>
          Taxes included where applicable
        </p>
      </div>

      {/* Checkout button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 20px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)', zIndex: 40 }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <Link href="/checkout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ff3008', color: '#fff', borderRadius: 16, padding: '16px 20px', textDecoration: 'none', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Proceed to checkout</span>
            <span style={{ fontWeight: 900, fontSize: 15 }}>&#8377;{fees.total}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}