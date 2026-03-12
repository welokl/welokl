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
  const [mounted, setMounted]       = useState(false)
  const [error, setError]           = useState('')
  const [savedAddresses, setSaved]  = useState<SavedAddress[]>([])
  const [selLat, setSelLat]         = useState<number | null>(null)
  const [selLng, setSelLng]         = useState<number | null>(null)
  const [copied, setCopied]         = useState(false)
  const [merchantUpi, setMerchantUpi] = useState('welokl@upi')
  const [saveLabel, setSaveLabel]   = useState('')
  const [addressSaved, setAddrSaved] = useState(false)

  function persistAddress(addr: string, lat: number | null, lng: number | null, label?: string) {
    try {
      const current = { address: addr, lat, lng, area: '', city: '' }
      localStorage.setItem('welokl_location', JSON.stringify(current))
      if (label) {
        const existing: SavedAddress[] = JSON.parse(localStorage.getItem('welokl_addresses') || '[]')
        const filtered = existing.filter(a => a.label !== label)
        filtered.unshift({ label, address: addr, area: '', city: '', lat: lat || undefined, lng: lng || undefined })
        localStorage.setItem('welokl_addresses', JSON.stringify(filtered.slice(0, 5)))
        setSaved(filtered.slice(0, 5))
        setAddrSaved(true)
        setTimeout(() => setAddrSaved(false), 2000)
      }
    } catch {}
  }

  const subtotal = cart.subtotal()
  const fees = calculateFees(subtotal, 15, orderType)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { window.location.href = '/auth/login'; return }
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
      setUser(profile)
      // Fetch merchant UPI ID set by admin
      const { data: cfg } = await supabase.from('platform_config').select('value').eq('key', 'upi_id').single()
      if (cfg?.value) setMerchantUpi(cfg.value)
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

  if (!mounted) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#ff3008', borderRadius: '50%', animation: 'sp .7s linear infinite' }} />
    </div>
  )

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
        const fullAddr = parts.join(', ') || data.display_name?.split(',').slice(0,4).join(',') || ''
        setAddress(fullAddr)
        persistAddress(fullAddr, lat, lng)
      } catch { setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`) }
      setDetecting(false)
    }, () => { setError('Could not detect location. Please type your address.'); setDetecting(false) }, { timeout: 10000, enableHighAccuracy: true })
  }

  async function placeOrder() {
    if (orderType === 'delivery' && !address.trim()) { setError('Please enter or detect your delivery address'); return }
    if (payMethod === 'upi') {
      if (!upiId.trim()) { setError('UTR / Transaction ID is required for UPI payment'); return }
      if (upiId.trim().length < 10) { setError('Please enter a valid UTR number (min 10 digits)'); return }
    }
    if (cart.items.length === 0) { window.location.href = '/stores'; return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data: shop } = await supabase.from('shops').select('id,commission_percent').eq('id', cart.shop_id!).single()
    const fee = calculateFees(subtotal, shop?.commission_percent || 15, orderType)

    // Generate a 4-digit code for pickup orders — customer shows this to shop on arrival
    const pickupCode = orderType === 'pickup'
      ? String(Math.floor(1000 + Math.random() * 9000))
      : null

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      customer_id: user.id, shop_id: cart.shop_id, status: 'placed', type: orderType,
      subtotal: fee.subtotal, delivery_fee: fee.delivery_fee, platform_fee: fee.platform_fee,
      discount: 0, total_amount: fee.total_amount, payment_method: payMethod,
      payment_status: 'pending', upi_transaction_id: upiId || null,
      delivery_address: orderType === 'delivery' ? address.trim() : null,
      delivery_lat: selLat, delivery_lng: selLng,
      delivery_instructions: instructions.trim() || null, estimated_delivery: 30,
      pickup_code: pickupCode,
    }).select().single()
    if (orderError || !order) { setError('Could not place order. Please try again.'); setLoading(false); return }
    await supabase.from('order_items').insert(cart.items.map(i => ({ order_id: order.id, product_id: i.product.id, product_name: i.product.name, quantity: i.quantity, price: i.product.price })))
    await supabase.from('order_status_log').insert({ order_id: order.id, status: 'placed', message: `Order placed via ${payMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}`, created_by: user.id })
    cart.clear()
    // Fire push notification to shopkeeper (best-effort, non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: 'order_placed', order_id: order.id, shop_id: cart.shop_id, customer_id: user.id })
    }).catch(() => {})
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
              </div>
            )}

            <button onClick={detectLocation} disabled={detecting}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 12, border: `2px solid ${selLat ? '#22c55e' : '#ff3008'}`, background: selLat ? 'rgba(34,197,94,0.08)' : 'var(--brand-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: selLat ? '#16a34a' : '#ff3008', marginBottom: 12 }}>
              {detecting ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Detecting…</>
               : selLat ? '✅ Location detected — tap to re-detect'
               : '📍 Detect my current location'}
            </button>

            <textarea value={address} onChange={e => { setAddress(e.target.value); persistAddress(e.target.value, selLat, selLng) }} rows={2} placeholder="Your full address — flat no., building, street, area…"
              style={{ ...s({ resize: 'none', marginBottom: 10 }), width: '100%' }} />

            {/* Save address shortcut */}
            {address.trim().length > 8 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>Save as:</span>
                {['home', 'work', 'other'].map(lbl => (
                  <button key={lbl} onClick={() => persistAddress(address, selLat, selLng, lbl)}
                    style={{ padding: '5px 14px', borderRadius: 999, border: `1.5px solid ${addressSaved && saveLabel === lbl ? '#16a34a' : 'var(--border)'}`, background: addressSaved && saveLabel === lbl ? 'rgba(22,163,74,.1)' : 'var(--card-bg)', color: addressSaved && saveLabel === lbl ? '#16a34a' : 'var(--text-2)', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    onClickCapture={() => setSaveLabel(lbl)}>
                    {lbl === 'home' ? '🏠 Home' : lbl === 'work' ? '💼 Work' : '📌 Other'}
                    {addressSaved && saveLabel === lbl ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            )}

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
            <UpiPaySection amount={fees.total_amount} merchantUpi={merchantUpi} upiId={upiId} setUpiId={setUpiId} copied={copied} setCopied={setCopied} />
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

// ── UPI Deep Link Payment Section ────────────────────────────────────────────
// Replace YOUR_UPI_ID below with your actual UPI ID (e.g. yourname@ybl)
const MERCHANT_NAME   = 'Welokl'

function UpiPaySection({ amount, merchantUpi, upiId, setUpiId, copied, setCopied }: {
  amount: number; merchantUpi: string; upiId: string; setUpiId: (v: string) => void
  copied: boolean; setCopied: (v: boolean) => void
}) {
  const note = encodeURIComponent('Welokl Order Payment')
  const name = encodeURIComponent(MERCHANT_NAME)
  const base = `pa=${merchantUpi}&pn=${name}&am=${amount}&cu=INR&tn=${note}`

  // Deep links — each app has its own scheme
  const links = [
    { label: 'GPay',     icon: '🟢', href: `gpay://upi/pay?${base}`,    fallback: `tez://upi/pay?${base}` },
    { label: 'PhonePe',  icon: '🟣', href: `phonepe://pay?${base}`,      fallback: `intent://pay?${base}#Intent;scheme=upi;package=com.phonepe.app;end` },
    { label: 'Paytm',    icon: '🔵', href: `paytmmp://pay?${base}`,      fallback: `intent://pay?${base}#Intent;scheme=upi;package=net.one97.paytm;end` },
    { label: 'Any UPI',  icon: '💳', href: `upi://pay?${base}`,          fallback: `upi://pay?${base}` },
  ]

  function openUpi(href: string, fallback: string) {
    // Try deep link — if app not installed browser will fail silently
    window.location.href = href
    // Fallback after 1.5s if app didn't open
    setTimeout(() => { window.location.href = fallback }, 1500)
  }

  return (
    <div style={{ background: 'rgba(37,99,235,.06)', border: '1px solid rgba(37,99,235,.15)', borderRadius: 14, padding: '16px' }}>
      {/* Amount + UPI ID */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 2 }}>Pay to</p>
          <p style={{ fontWeight: 900, fontSize: 15, fontFamily: 'monospace', color: 'var(--text)' }}>{merchantUpi}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, marginBottom: 2 }}>Amount</p>
          <p style={{ fontWeight: 900, fontSize: 20, color: '#1d4ed8' }}>₹{amount}</p>
        </div>
      </div>

      {/* App buttons */}
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 10 }}>OPEN YOUR UPI APP</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {links.map(l => (
          <button key={l.label} onClick={() => openUpi(l.href, l.fallback)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderRadius: 12, background: 'var(--card-bg)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: 'var(--text)', transition: 'border-color .15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#ff3008'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'}>
            <span style={{ fontSize: 18 }}>{l.icon}</span>
            {l.label}
          </button>
        ))}
      </div>

      {/* Copy UPI ID */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Can't open app? Copy UPI ID manually</span>
        <button onClick={() => { navigator.clipboard.writeText(merchantUpi); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 8, background: copied ? '#22c55e' : 'var(--brand-muted)', color: copied ? '#fff' : '#ff3008', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginLeft: 10 }}>
          {copied ? '✓ Copied' : 'Copy ID'}
        </button>
      </div>

      {/* Transaction ID input */}
      <div style={{ background: 'rgba(255,48,8,.05)', border: '1.5px solid rgba(255,48,8,.2)', borderRadius: 12, padding: '12px 14px', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>🔴</span>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#ff3008' }}>REQUIRED — Enter UTR after paying</p>
        </div>
        <input
          value={upiId}
          onChange={e => setUpiId(e.target.value.replace(/\D/g, ''))}
          placeholder="12-digit UTR number (e.g. 407311139279)"
          maxLength={22}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${upiId.trim().length >= 10 ? '#16a34a' : 'rgba(255,48,8,.3)'}`, background: 'var(--card-bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const, marginBottom: 8 }}
        />
        <p style={{ fontSize: 11, color: upiId.trim().length >= 10 ? '#16a34a' : 'var(--text-3)', fontWeight: 600 }}>
          {upiId.trim().length >= 10 ? '✓ UTR looks valid' : 'Open your UPI app → Payment history → copy the 12-digit UTR'}
        </p>
      </div>
    </div>
  )
}