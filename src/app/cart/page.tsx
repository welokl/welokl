'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/store/cart'
import { calculateFees, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from '@/types'

export default function CartPage() {
  const router = useRouter()
  const cart = useCart()
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
            Explore shops →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
        <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', flex: 1 }}>Your Cart</h1>
        <span style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg-3)', borderRadius: 999, padding: '3px 10px', fontWeight: 600 }}>{cart.shop_name}</span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Items */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14, boxShadow: 'var(--card-shadow)' }}>
          {cart.items.map((item, i) => (
            <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{item.product.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>₹{item.product.price} each</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', background: '#ff3008', borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity - 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>−</button>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, minWidth: 22, textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity + 1)} style={{ color: '#fff', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 16 }}>+</button>
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', minWidth: 56, textAlign: 'right' }}>₹{item.product.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Free delivery progress */}
        {fees.delivery_fee > 0 && (
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border)', padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
              <span>Add ₹{FREE_DELIVERY_THRESHOLD - subtotal} more for free delivery</span>
              <span>Free above ₹{FREE_DELIVERY_THRESHOLD}</span>
            </div>
            <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#ff3008', borderRadius: 999, width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Bill summary */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '18px 16px', marginBottom: 14, boxShadow: 'var(--card-shadow)' }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Bill Summary</p>
          {[
            { label: 'Item total', val: `₹${subtotal}` },
            { label: `Delivery fee${fees.delivery_fee === 0 ? ' 🎉 FREE!' : ''}`, val: fees.delivery_fee === 0 ? '—' : `₹${DELIVERY_FEE}`, strike: fees.delivery_fee === 0 },
            { label: 'Platform fee', val: `₹${fees.platform_fee}` },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
              <span>{r.label}</span>
              <span style={{ textDecoration: r.strike ? 'line-through' : 'none', color: r.strike ? 'var(--text-4)' : 'var(--text-2)' }}>{r.val}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, color: 'var(--text)', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
            <span>Total</span><span>₹{fees.total_amount}</span>
          </div>
        </div>

        <Link href="/checkout" style={{ display: 'block', textAlign: 'center', padding: '15px', borderRadius: 14, background: '#ff3008', color: '#fff', fontWeight: 900, fontSize: 16, textDecoration: 'none', boxShadow: '0 4px 16px rgba(255,48,8,0.3)' }}>
          Proceed to checkout — ₹{fees.total_amount} →
        </Link>
        <button onClick={cart.clear} style={{ width: '100%', marginTop: 12, fontSize: 12, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          Clear cart
        </button>
      </div>
    </div>
  )
}