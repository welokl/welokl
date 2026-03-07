'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import { calculateFees } from '@/types'

type OrderType = 'delivery' | 'pickup'
type PaymentMethod = 'cod' | 'upi'
interface SavedAddress { label: string; address: string; area: string; city: string; lat?: number; lng?: number }

const s = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid var(--border-2)',
  background: 'var(--input-bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', ...extra,
})

export default function CheckoutPage() {
  const cart = useCart()
  const [user, setUser]             = useState<any>(null)
  const [orderType, setOrderType]   = useState<OrderType>('delivery')
  const [payMethod, setPayMethod]   = useState<PaymentMethod>('cod')
  const [address, setAddress]       = useState('')
  const [instructions, setInstr]    = useState('')
  const [upiId, setUpiId]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [detecting, setDetecting]   = useState(false)
  const [error, setError]           = useState('')
  const [savedAddresses, setSaved]  = useState<SavedAddress[]>([])
  const [selLat, setSelLat]         = useState<number | null>(null)
  const [selLng, setSelLng]         = useState<number | null>(null)
  const [copied, setCopied]         = useState(false)

  const subtotal = cart.subtotal()
  const fees = calculateFees(subtotal, 15, orderType)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)
      try {
        const saved = JSON.parse(localStorage.getItem('welokl_addresses') || '[]')
        setSaved(saved)
        const current = JSON.parse(localStorage.getItem('welokl_location') || 'null')
        if (current) {
          setAddress([current.address, current.area, current.city].filter(Boolean).join(', '))
          setSelLat(current.lat); setSelLng(current.lng)
        }
      } catch {}
    }
    init()
  }, [])

  async function detectLocation() {
    if (!navigator.geolocation) { setError('Location not supported'); return }
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      setSelLat(lat); setSelLng(lng)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`, { headers: { 'Accept-Language': 'en' } })
        const data = await res.json()
        const a = data.address || {}
        const parts = [a.house_number, a.building, a.road, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean)
        setAddress(parts.join(', ') || data.display_name?.split(',').slice(0,4).join(',') || '')
      } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`) }
      setDetecting(false)
    }, () => { setError('Could not detect location. Please type your address.'); setDetecting(false) }, { timeout: 10000, enableHighAccuracy: true })
  }

  async function placeOrder() {
    if (orderType === 'delivery' && !address.trim()) { setError('Please enter or detect your delivery address'); return }
    if (payMethod === 'upi' && !upiId.trim()) { setError('Please enter your UPI transaction ID after paying'); return }
    if (cart.items.length === 0) { window.location.href = '/stores'; return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: shop } = await supabase.from('shops').select('id,commission_percent').eq('id', cart.shop_id!).single()
    const fee = calculateFees(subtotal, shop?.commission_percent || 15, orderType)
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      customer_id: user.id, shop_id: cart.shop_id, status: 'placed', type: orderType,
      subtotal: fee.subtotal, delivery_fee: fee.delivery_fee, platform_fee: fee.platform_fee,
      discount: 0, total_amount: fee.total_amount, payment_method: payMethod,
      payment_status: 'pending', upi_transaction_id: upiId || null,
      delivery_address: orderType === 'delivery' ? address.trim() : null,
      delivery_lat: selLat, delivery_lng: selLng,
      delivery_instructions: instructions.trim() || null, estimated_delivery: 30,
    }).select().single()
    if (orderError || !order) { setError('Could not place order. Please try again.'); setLoading(false); return }
    await supabase.from('order_items').insert(cart.items.map(i => ({ order_id: order.id, product_id: i.product.id, product_name: i.product.name, quantity: i.quantity, price: i.product.price })))
    await supabase.from('order_status_log').insert({ order_id: order.id, status: 'placed', message: `Order placed via ${payMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}`, created_by: user.id })
    cart.clear()
    window.location.href = `/orders/${order.id}`
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, background: '#ff3008', borderRadius: 9, margin: '0 auto 12px', opacity: 0.6 }} className="shimmer" />
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  )

  const card = { background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: '18px 16px', marginBottom: 14, boxShadow: 'var(--card-shadow)' } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => window.history.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
        <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', flex: 1 }}>Checkout</h1>
        <span style={{ fontSize: 12, color: 'var(--text-3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cart.shop_name}</span>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        {/* Order type */}
        <div style={card}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>How do you want it?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { type: 'delivery' as OrderType, icon: '🛵', label: 'Home Delivery', sub: fees.delivery_fee === 0 ? '🎉 Free delivery!' : `₹${fees.delivery_fee} delivery` },
              { type: 'pickup' as OrderType, icon: '🏪', label: 'Self Pickup', sub: 'Pick up from shop, free' },
            ].map(o => (
              <button key={o.type} onClick={() => setOrderType(o.type)}
                style={{ padding: '14px 12px', borderRadius: 14, border: `2px solid ${orderType === o.type ? '#ff3008' : 'var(--border-2)'}`, background: orderType === o.type ? 'var(--brand-muted)' : 'var(--bg-1)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{o.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{o.label}</div>
                <div style={{ fontSize: 11, color: orderType === o.type ? '#ff3008' : 'var(--text-3)', marginTop: 2 }}>{o.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {orderType === 'delivery' && (
          <div style={card}>
            <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Delivery Address</p>

            {savedAddresses.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
                {savedAddresses.map((addr, i) => (
                  <button key={i} onClick={() => { setAddress([addr.address, addr.area, addr.city].filter(Boolean).join(', ')); if (addr.lat) setSelLat(addr.lat); if (addr.lng) setSelLng(addr.lng) }}
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 10, border: `2px solid ${address.includes(addr.area || addr.city) ? '#ff3008' : 'var(--border-2)'}`, background: address.includes(addr.area || addr.city) ? 'var(--brand-muted)' : 'var(--bg-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: address.includes(addr.area || addr.city) ? '#ff3008' : 'var(--text-2)' }}>
                    {addr.label === 'home' ? '🏠' : addr.label === 'work' ? '💼' : '📌'} {addr.label === 'home' ? 'Home' : addr.label === 'work' ? 'Work' : addr.label}
                  </button>
                ))}
                <Link href={`/location?return=${encodeURIComponent('/checkout')}`}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 10, border: '2px dashed var(--border-2)', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textDecoration: 'none' }}>
                  + Add new
                </Link>
              </div>
            )}

            <button onClick={detectLocation} disabled={detecting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 12, border: `2px solid ${selLat ? '#22c55e' : '#ff3008'}`, background: selLat ? 'rgba(34,197,94,0.08)' : 'var(--brand-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: selLat ? '#16a34a' : '#ff3008', marginBottom: 12 }}>
              {detecting ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Detecting…</>
               : selLat ? '✅ Location detected — tap to re-detect'
               : '📍 Detect my current location'}
            </button>

            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Your full address — flat no., building, street, area…"
              style={{ ...s({ resize: 'none', marginBottom: 10 }), width: '100%' }} />
            <input value={instructions} onChange={e => setInstr(e.target.value)} placeholder="Delivery instructions — Ring bell, leave at door…"
              style={{ ...s(), width: '100%' }} />
          </div>
        )}

        {/* Payment */}
        <div style={card}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Payment Method</p>
          {[
            { val: 'cod' as PaymentMethod, icon: '💵', label: 'Cash on Delivery', sub: 'Pay when your order arrives' },
            { val: 'upi' as PaymentMethod, icon: '📲', label: 'UPI Payment', sub: 'GPay, PhonePe, Paytm, any UPI' },
          ].map(p => (
            <label key={p.val} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 12px', borderRadius: 14, border: `2px solid ${payMethod === p.val ? '#ff3008' : 'var(--border-2)'}`, background: payMethod === p.val ? 'var(--brand-muted)' : 'var(--bg-1)', cursor: 'pointer', marginBottom: 10 }}>
              <input type="radio" name="pay" value={p.val} checked={payMethod === p.val} onChange={() => setPayMethod(p.val)} style={{ accentColor: '#ff3008' }} />
              <span style={{ fontSize: 24 }}>{p.icon}</span>
              <div>
                <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{p.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.sub}</p>
              </div>
            </label>
          ))}

          {payMethod === 'upi' && (
            <div style={{ background: 'var(--blue-bg)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontWeight: 800, fontSize: 14, color: '#1d4ed8' }}>Pay ₹{fees.total_amount} via UPI</p>
                <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#2563eb', padding: '3px 8px', borderRadius: 8, fontWeight: 700 }}>Test mode</span>
              </div>
              <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>UPI ID</p>
                  <p style={{ fontWeight: 900, fontSize: 15, fontFamily: 'monospace', color: 'var(--text)' }}>welokl@upi</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText('welokl@upi'); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  style={{ fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: copied ? '#22c55e' : 'var(--brand-muted)', color: copied ? '#fff' : '#ff3008', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="Enter UPI transaction ID after paying" style={{ ...s({ marginBottom: 8 }), width: '100%' }} />
              <p style={{ fontSize: 12, color: '#2563eb' }}>Pay first using any UPI app, then enter the transaction ID here</p>
            </div>
          )}
        </div>

        {/* Bill */}
        <div style={card}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Bill Summary</p>
          {cart.items.map(i => (
            <div key={i.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
              <span>{i.product.name} × {i.quantity}</span><span>₹{i.product.price * i.quantity}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
            {[
              { l: 'Item total', v: `₹${subtotal}` },
              { l: `Delivery${fees.delivery_fee === 0 ? ' 🎉 FREE!' : ''}`, v: fees.delivery_fee === 0 ? '—' : `₹${fees.delivery_fee}`, fade: fees.delivery_fee === 0 },
              { l: 'Platform fee', v: `₹${fees.platform_fee}` },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: r.fade ? 'var(--text-4)' : 'var(--text-2)', marginBottom: 6 }}>
                <span>{r.l}</span><span style={{ textDecoration: r.fade ? 'line-through' : 'none' }}>{r.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, color: 'var(--text)', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 4 }}>
              <span>Total</span><span>₹{fees.total_amount}</span>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button onClick={placeOrder} disabled={loading}
          style={{ width: '100%', padding: '15px', borderRadius: 14, fontWeight: 900, fontSize: 16, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#ff3008', color: '#fff', boxShadow: '0 4px 16px rgba(255,48,8,0.3)', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Placing order…' : `Place Order — ₹${fees.total_amount} →`}
        </button>
      </div>
    </div>
  )
}