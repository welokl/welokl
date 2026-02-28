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
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="font-bold text-xl mb-2">Your cart is empty</h2>
          <p className="text-gray-400 text-sm mb-6">Browse shops and add items to get started</p>
          <Link href="/stores" className="btn-primary">Explore shops →</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl">←</button>
        <h1 className="font-bold">Your Cart</h1>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-auto">{cart.shop_name}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Items */}
        <div className="card divide-y divide-gray-100">
          {cart.items.map(item => (
            <div key={item.product.id} className="flex items-center gap-3 p-4">
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.product.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">₹{item.product.price} each</p>
              </div>
              <div className="flex items-center gap-2 bg-brand-500 rounded-xl overflow-hidden">
                <button onClick={() => cart.updateQty(item.product.id, item.quantity - 1)} className="text-white px-3 py-1.5 hover:bg-brand-600 font-bold">−</button>
                <span className="text-white font-bold text-sm min-w-[20px] text-center">{item.quantity}</span>
                <button onClick={() => cart.updateQty(item.product.id, item.quantity + 1)} className="text-white px-3 py-1.5 hover:bg-brand-600 font-bold">+</button>
              </div>
              <span className="font-bold text-sm w-16 text-right">₹{item.product.price * item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Free delivery progress */}
        {fees.delivery_fee > 0 && (
          <div className="card p-4">
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span>Add ₹{FREE_DELIVERY_THRESHOLD - subtotal} more for free delivery</span>
              <span>Free above ₹{FREE_DELIVERY_THRESHOLD}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Bill summary */}
        <div className="card p-5 space-y-3">
          <h3 className="font-bold text-sm">Bill Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Item total</span>
              <span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery fee {fees.delivery_fee === 0 && <span className="text-green-600 font-semibold">(FREE!)</span>}</span>
              <span className={fees.delivery_fee === 0 ? 'line-through text-gray-300' : ''}>₹{DELIVERY_FEE}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Platform fee</span>
              <span>₹{fees.platform_fee}</span>
            </div>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>₹{fees.total_amount}</span>
          </div>
        </div>

        <Link href="/checkout" className="btn-primary block text-center py-4 text-base">
          Proceed to checkout — ₹{fees.total_amount} →
        </Link>

        <button onClick={cart.clear} className="w-full text-center text-xs text-gray-400 hover:text-red-500 py-2">
          Clear cart
        </button>
      </div>
    </div>
  )
}
