'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { calculateFees } from '@/types'

type OrderType = 'delivery' | 'pickup'
type PaymentMethod = 'cod' | 'upi'

export default function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()

  const [user, setUser] = useState<{ id: string; name: string; email: string; phone?: string } | null>(null)
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [address, setAddress] = useState('')
  const [instructions, setInstructions] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const subtotal = cart.subtotal()
  const fees = calculateFees(subtotal, 15, orderType)

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)
    }
    getUser()
  }, [])

  async function placeOrder() {
    if (orderType === 'delivery' && !address.trim()) { setError('Please enter your delivery address'); return }
    if (paymentMethod === 'upi' && !upiId.trim()) { setError('Please enter your UPI ID'); return }
    if (cart.items.length === 0) { router.push('/stores'); return }

    setLoading(true)
    setError('')

    const supabase = createClient()

    // Fetch shop for commission
    const { data: shop } = await supabase.from('shops').select('id, commission_percent, latitude, longitude').eq('id', cart.shop_id!).single()
    const fee = calculateFees(subtotal, shop?.commission_percent || 15, orderType)

    // Create order
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      customer_id: user!.id,
      shop_id: cart.shop_id,
      status: 'placed',
      type: orderType,
      subtotal: fee.subtotal,
      delivery_fee: fee.delivery_fee,
      platform_fee: fee.platform_fee,
      discount: 0,
      total_amount: fee.total_amount,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'upi' ? 'pending' : 'pending',
      upi_transaction_id: upiId || null,
      delivery_address: orderType === 'delivery' ? address : null,
      delivery_instructions: instructions || null,
      estimated_delivery: shop?.commission_percent ? 30 : 30,
    }).select().single()

    if (orderError || !order) {
      setError('Could not place order. Please try again.')
      setLoading(false)
      return
    }

    // Insert order items
    const items = cart.items.map(i => ({
      order_id: order.id,
      product_id: i.product.id,
      product_name: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
    }))

    await supabase.from('order_items').insert(items)

    // Log status
    await supabase.from('order_status_log').insert({
      order_id: order.id,
      status: 'placed',
      message: `Order placed via ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}`,
      created_by: user!.id,
    })

    cart.clear()
    router.push(`/orders/${order.id}`)
  }

  if (cart.items.length === 0) {
    router.push('/stores')
    return null
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl">←</button>
        <h1 className="font-bold">Checkout</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Order type */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">How do you want it?</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { type: 'delivery' as OrderType, icon: '🛵', label: 'Home Delivery', sub: `₹${fees.delivery_fee === 0 ? '0 (Free!)' : fees.delivery_fee} delivery` },
              { type: 'pickup' as OrderType, icon: '🏪', label: 'Self Pickup', sub: 'Pick up from shop, free' },
            ].map(o => (
              <button key={o.type} onClick={() => setOrderType(o.type)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${orderType === o.type ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}
              >
                <div className="text-2xl mb-1.5">{o.icon}</div>
                <div className="font-bold text-sm">{o.label}</div>
                <div className="text-xs text-gray-500">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {orderType === 'delivery' && (
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-3">Delivery Address</h3>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Enter your full address — flat, building, street, area..."
            />
            <input
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="input-field mt-3 text-sm"
              placeholder="Delivery instructions (optional) — e.g. Ring bell twice"
            />
          </div>
        )}

        {/* Payment method */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="accent-brand-500" />
              <div className="text-2xl">💵</div>
              <div>
                <p className="font-bold text-sm">Cash on Delivery</p>
                <p className="text-xs text-gray-400">Pay when your order arrives</p>
              </div>
            </label>

            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'upi' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              <input type="radio" name="payment" value="upi" checked={paymentMethod === 'upi'} onChange={() => setPaymentMethod('upi')} className="accent-brand-500" />
              <div className="text-2xl">📲</div>
              <div>
                <p className="font-bold text-sm">UPI Payment</p>
                <p className="text-xs text-gray-400">GPay, PhonePe, Paytm, any UPI app</p>
              </div>
            </label>
          </div>

          {paymentMethod === 'upi' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-semibold text-blue-800 mb-2">Pay via UPI</p>
              <p className="text-sm text-blue-600 mb-3">Amount to pay: <strong>₹{fees.total_amount}</strong></p>
              <p className="text-xs text-blue-600 mb-3">Send payment to UPI ID: <strong className="font-mono">welokl@upi</strong></p>
              <input
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                className="input-field text-sm"
                placeholder="Enter your UPI transaction ID after paying"
              />
              <p className="text-xs text-gray-400 mt-2">Enter transaction ID so we can confirm your payment</p>
            </div>
          )}
        </div>

        {/* Order summary */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-4">Order Summary</h3>
          <div className="space-y-2">
            {cart.items.map(i => (
              <div key={i.product.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{i.product.name} × {i.quantity}</span>
                <span>₹{i.product.price * i.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>₹{subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery</span>
              <span>{fees.delivery_fee === 0 ? <span className="text-green-600">FREE</span> : `₹${fees.delivery_fee}`}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Platform fee</span><span>₹{fees.platform_fee}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100">
              <span>Total</span><span>₹{fees.total_amount}</span>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

        <button onClick={placeOrder} disabled={loading} className="btn-primary w-full py-4 text-base">
          {loading ? 'Placing order...' : `Place Order — ₹${fees.total_amount} →`}
        </button>
      </div>
    </div>
  )
}
