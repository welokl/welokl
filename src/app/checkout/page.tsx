'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { calculateFees } from '@/types'

type OrderType = 'delivery' | 'pickup'
type PaymentMethod = 'cod' | 'upi'

interface SavedAddress {
  label: string
  address: string
  area: string
  city: string
  lat?: number
  lng?: number
}

export default function CheckoutPage() {
  const cart = useCart()
  const [user, setUser] = useState<any>(null)
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [address, setAddress] = useState('')
  const [instructions, setInstructions] = useState('')
  const [upiId, setUpiId] = useState('')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [error, setError] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedLat, setSelectedLat] = useState<number | null>(null)
  const [selectedLng, setSelectedLng] = useState<number | null>(null)

  const subtotal = cart.subtotal()
  const fees = calculateFees(subtotal, 15, orderType)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)

      // Load saved addresses
      try {
        const saved = JSON.parse(localStorage.getItem('welokl_addresses') || '[]')
        setSavedAddresses(saved)
        // Auto-fill from saved location
        const current = JSON.parse(localStorage.getItem('welokl_location') || 'null')
        if (current) {
          const full = [current.address, current.area, current.city].filter(Boolean).join(', ')
          setAddress(full)
          setSelectedLat(current.lat)
          setSelectedLng(current.lng)
        }
      } catch {}
    }
    init()
  }, [])

  // Detect GPS and reverse geocode
  async function detectLocation() {
    if (!navigator.geolocation) { setError('Location not supported on this browser'); return }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setSelectedLat(lat)
        setSelectedLng(lng)
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, {
            headers: { 'Accept-Language': 'en' }
          })
          const data = await res.json()
          const a = data.address || {}
          const parts = [
            a.house_number, a.building, a.road,
            a.suburb || a.neighbourhood || a.quarter,
            a.city || a.town || a.village,
          ].filter(Boolean)
          setAddress(parts.join(', ') || data.display_name?.split(',').slice(0,4).join(',') || '')
        } catch {
          setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`)
        }
        setDetecting(false)
      },
      () => { setError('Could not detect location. Please type your address.'); setDetecting(false) },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  async function placeOrder() {
    if (orderType === 'delivery' && !address.trim()) { setError('Please enter or detect your delivery address'); return }
    if (paymentMethod === 'upi' && !upiId.trim()) { setError('Please enter your UPI transaction ID after paying'); return }
    if (cart.items.length === 0) { window.location.href = '/stores'; return }

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: shop } = await supabase.from('shops')
      .select('id, commission_percent, latitude, longitude')
      .eq('id', cart.shop_id!).single()
    const fee = calculateFees(subtotal, shop?.commission_percent || 15, orderType)

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      customer_id: user.id,
      shop_id: cart.shop_id,
      status: 'placed',
      type: orderType,
      subtotal: fee.subtotal,
      delivery_fee: fee.delivery_fee,
      platform_fee: fee.platform_fee,
      discount: 0,
      total_amount: fee.total_amount,
      payment_method: paymentMethod,
      payment_status: 'pending',
      upi_transaction_id: upiId || null,
      delivery_address: orderType === 'delivery' ? address.trim() : null,
      delivery_lat: selectedLat,
      delivery_lng: selectedLng,
      delivery_instructions: instructions.trim() || null,
      estimated_delivery: 30,
    }).select().single()

    if (orderError || !order) {
      setError('Could not place order. Please try again.')
      setLoading(false)
      return
    }

    await supabase.from('order_items').insert(
      cart.items.map(i => ({
        order_id: order.id,
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        price: i.product.price,
      }))
    )

    await supabase.from('order_status_log').insert({
      order_id: order.id,
      status: 'placed',
      message: `Order placed via ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}`,
      created_by: user.id,
    })

    cart.clear()
    window.location.href = `/orders/${order.id}`
  }

  if (!user) return (
    <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center">
      <div className="text-center"><div className="w-8 h-8 bg-brand-500 rounded-lg mx-auto mb-3 animate-pulse" /><p className="text-gray-400 text-sm">Loading...</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-10">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-xl text-lg">←</button>
        <h1 className="font-bold">Checkout</h1>
        <span className="ml-auto text-sm text-gray-400 truncate max-w-[140px]">{cart.shop_name}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Order type */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">How do you want it?</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { type: 'delivery' as OrderType, icon: '🛵', label: 'Home Delivery', sub: fees.delivery_fee === 0 ? 'Free delivery!' : `₹${fees.delivery_fee} delivery` },
              { type: 'pickup' as OrderType, icon: '🏪', label: 'Self Pickup', sub: 'Pick up from shop, free' },
            ].map(o => (
              <button key={o.type} onClick={() => setOrderType(o.type)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${orderType === o.type ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
                <div className="text-2xl mb-1.5">{o.icon}</div>
                <div className="font-bold text-sm">{o.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{o.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {orderType === 'delivery' && (
          <div className="card p-5 space-y-3">
            <h3 className="font-bold text-sm">Delivery Address</h3>

            {/* Saved addresses */}
            {savedAddresses.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {savedAddresses.map((addr, i) => (
                  <button key={i}
                    onClick={() => {
                      const full = [addr.address, addr.area, addr.city].filter(Boolean).join(', ')
                      setAddress(full)
                      if (addr.lat) setSelectedLat(addr.lat)
                      if (addr.lng) setSelectedLng(addr.lng)
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      address.includes(addr.area || addr.city)
                        ? 'border-brand-500 bg-brand-50 text-brand-600'
                        : 'border-gray-200 text-gray-600'
                    }`}>
                    {addr.label === 'home' ? '🏠' : addr.label === 'work' ? '💼' : '📌'}
                    {addr.label === 'home' ? 'Home' : addr.label === 'work' ? 'Work' : addr.label}
                  </button>
                ))}
                <Link href={`/location?return=${encodeURIComponent('/checkout')}`}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-gray-300 text-xs font-semibold text-gray-400 hover:border-brand-500 hover:text-brand-500 transition-all">
                  + Add new
                </Link>
              </div>
            )}

            {/* GPS detect button */}
            <button onClick={detectLocation} disabled={detecting}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                selectedLat ? 'border-green-500 bg-green-50 text-green-700' : 'border-brand-500 bg-brand-50 text-brand-600 hover:bg-brand-100'
              }`}>
              {detecting
                ? <><span className="animate-spin">⏳</span> Detecting location...</>
                : selectedLat
                ? <><span>✅</span> Location detected — tap to re-detect</>
                : <><span>📍</span> Detect my current location</>
              }
            </button>

            {/* Address text */}
            <div>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="input-field resize-none"
                rows={2}
                placeholder="Your full address — flat no., building, street, area..."
              />
              {!savedAddresses.length && (
                <Link href={`/location?return=${encodeURIComponent('/checkout')}`}
                  className="mt-1.5 flex items-center gap-1 text-xs text-brand-500 font-semibold hover:underline">
                  📍 Or pick location on map →
                </Link>
              )}
            </div>

            <input
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              className="input-field text-sm"
              placeholder="Delivery instructions — Ring bell, leave at door, call on arrival..."
            />
          </div>
        )}

        {/* Payment */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">Payment Method</h3>
          <div className="space-y-2">
            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              <input type="radio" name="pay" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="accent-brand-500" />
              <div className="text-2xl">💵</div>
              <div><p className="font-bold text-sm">Cash on Delivery</p><p className="text-xs text-gray-400">Pay when your order arrives</p></div>
            </label>
            <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'upi' ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>
              <input type="radio" name="pay" value="upi" checked={paymentMethod === 'upi'} onChange={() => setPaymentMethod('upi')} className="accent-brand-500" />
              <div className="text-2xl">📲</div>
              <div><p className="font-bold text-sm">UPI Payment</p><p className="text-xs text-gray-400">GPay, PhonePe, Paytm, any UPI</p></div>
            </label>
          </div>

          {paymentMethod === 'upi' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-blue-800">Pay ₹{fees.total_amount} via UPI</p>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-semibold">Test mode</span>
              </div>
              <div className="bg-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">UPI ID</p>
                  <p className="font-bold text-sm font-mono">welokl@upi</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText('welokl@upi') }}
                  className="text-xs bg-brand-50 text-brand-500 px-3 py-1.5 rounded-lg font-semibold">Copy</button>
              </div>
              <input
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                className="input-field text-sm"
                placeholder="Enter UPI transaction ID after paying"
              />
              <p className="text-xs text-blue-600">Pay first using any UPI app, then enter the transaction ID here</p>
            </div>
          )}
        </div>

        {/* Bill summary */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">Bill Summary</h3>
          <div className="space-y-2 text-sm">
            {cart.items.map(i => (
              <div key={i.product.id} className="flex justify-between text-gray-600">
                <span>{i.product.name} × {i.quantity}</span>
                <span>₹{i.product.price * i.quantity}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 space-y-1.5">
              <div className="flex justify-between text-gray-500"><span>Item total</span><span>₹{subtotal}</span></div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery{fees.delivery_fee === 0 && <span className="text-green-600 font-semibold ml-1">(FREE!)</span>}</span>
                <span className={fees.delivery_fee === 0 ? 'line-through text-gray-300' : ''}>₹{fees.delivery_fee === 0 ? '25' : fees.delivery_fee}</span>
              </div>
              <div className="flex justify-between text-gray-500"><span>Platform fee</span><span>₹{fees.platform_fee}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100"><span>Total</span><span>₹{fees.total_amount}</span></div>
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
