'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import Link from 'next/link'

const FREE_DELIVERY    = 299
const DELIVERY_FEE     = 30
const PLATFORM_FEE     = 5
const WELOKL_UPI_ID    = 'welokl@upi'   // ← replace with your real UPI ID
const WELOKL_UPI_NAME  = 'Welokl'

export default function CheckoutPage() {
  const router = useRouter()
  const cart   = useCart() as any

  const [address,       setAddress]       = useState('')
  const [savedAddrs,    setSavedAddrs]    = useState<{label:string;address:string}[]>([])
  const [note,          setNote]          = useState('')
  const [payment,       setPayment]       = useState<'cod'|'upi'>('cod')
  const [type,          setType]          = useState<'delivery'|'pickup'>('delivery')
  const [loading,       setLoading]       = useState(false)
  const [userId,        setUserId]        = useState<string|null>(null)
  const [shopInfo,      setShopInfo]      = useState<{delivery_enabled:boolean;pickup_enabled:boolean;min_order_amount:number;commission_percent:number}|null>(null)
  const [mounted,       setMounted]       = useState(false)
  const [locStatus,     setLocStatus]     = useState<'idle'|'detecting'|'done'|'denied'>('idle')
  const [upiStep,       setUpiStep]       = useState<'select'|'pay'|'confirm'>('select')
  const [placedOrderId, setPlacedOrderId] = useState<string|null>(null)

  useEffect(() => {
    cart._hydrate?.()
    setMounted(true)

    const sb = createClient()
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUserId(data.user.id)
    })

    // ── Auto-fill address from saved location ──────────────────
    try {
      const saved = JSON.parse(localStorage.getItem(`welokl_addresses_${userId}`) || '[]')
      setSavedAddrs(saved)
      // Pre-fill with first saved address
      if (saved.length > 0 && !address) setAddress(saved[0].address)
    } catch {}

    // ── Try to get readable address from saved GPS coords ──────
    try {
      const loc = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (loc?.lat && loc?.lng) {
        setLocStatus('detecting')
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json())
          .then(d => {
            const a = d.address || {}
            // Build a readable address from components
            const parts = [
              a.house_number,
              a.road || a.pedestrian || a.footway,
              a.suburb || a.neighbourhood || a.village,
              a.city_district || a.town || a.city,
              a.state_district || a.state,
            ].filter(Boolean)
            if (parts.length >= 2) {
              const fullAddr = parts.join(', ')
              // Only auto-fill if textarea is empty
              setAddress(prev => prev ? prev : fullAddr)
            }
            setLocStatus('done')
          })
          .catch(() => setLocStatus('denied'))
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted || !cart.shop_id) return
    createClient()
      .from('shops')
      .select('delivery_enabled,pickup_enabled,min_order_amount,commission_percent')
      .eq('id', cart.shop_id)
      .single()
      .then(({ data }) => { if (data) setShopInfo(data) })
  }, [mounted, cart.shop_id])

  if (!mounted) return null

  const items    = cart.items || []
  const subtotal = cart.subtotal?.() ?? 0

  if (!items.length) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center', padding:24 }}>
        <div style={{ width:72, height:72, background:'var(--chip-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg viewBox="0 0 24 24" fill="none" width={34} height={34}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="var(--text-faint)" strokeWidth="2"/><line x1="3" y1="6" x2="21" y2="6" stroke="var(--text-faint)" strokeWidth="2"/><path d="M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <p style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', marginBottom:8 }}>Cart is empty</p>
        <Link href="/stores" style={{ display:'inline-block', padding:'12px 28px', borderRadius:14, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:14, textDecoration:'none' }}>Browse shops</Link>
      </div>
    </div>
  )

  const delivery_fee = type === 'pickup' ? 0 : subtotal >= FREE_DELIVERY ? 0 : DELIVERY_FEE
  const total        = subtotal + delivery_fee + PLATFORM_FEE
  const minOrder     = 0   // minimum order check disabled
  const belowMin     = false

  // ── Create the order in DB ──────────────────────────────────
  async function createOrder(paymentStatus: 'pending' | 'paid') {
    const sb = createClient()

    // Fresh auth — never rely on stale state
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser) throw new Error('Not logged in. Please sign in again.')
    const uid = authUser.id

    // Exact columns from live orders table
    const orderPayload: Record<string, any> = {
      customer_id:           uid,
      shop_id:               cart.shop_id,
      order_number:          'WLK-' + Date.now().toString().slice(-6),
      status:                'placed',
      type:                  type,
      delivery_address:      type === 'pickup' ? 'Pickup' : (address?.trim() || ''),
      delivery_instructions: note?.trim() || null,
      subtotal:              subtotal,
      delivery_fee:          delivery_fee,
      platform_fee:          PLATFORM_FEE,
      discount:              0,
      total_amount:          total,
      payment_method:        payment === 'upi' ? 'online' : 'cod',
      payment_status:        paymentStatus,
    }

    console.log('[welokl] inserting order:', JSON.stringify(orderPayload, null, 2))

    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (orderErr) {
      const errDetail = `code:${orderErr.code} msg:${orderErr.message} detail:${orderErr.details} hint:${orderErr.hint}`
      console.error('[welokl] order insert FAILED:', errDetail, orderErr)
      throw new Error(errDetail)
    }
    console.log('[welokl] order created:', order.id)

    // Insert order items
    const { error: itemsErr } = await sb.from('order_items').insert(
      items.map((item: any) => ({
        order_id:     order.id,
        product_id:   item.product.id,
        product_name: item.product.name,
        quantity:     item.quantity,
        price:        item.product.price,
      }))
    )

    if (itemsErr) {
      console.error('[checkout] order_items error:', itemsErr)
      // Don't throw — order was placed, items error is non-fatal
    }

    // Save address
    if (address.trim()) {
      try {
        const addrKey = `welokl_addresses_${uid}`
        const addrs = JSON.parse(localStorage.getItem(addrKey) || '[]')
        if (!addrs.find((a:any) => a.address === address)) {
          addrs.unshift({ label:'other', address: address.trim() })
          localStorage.setItem(addrKey, JSON.stringify(addrs.slice(0, 5)))
        }
      } catch {}
    }

    return order.id
  }

  // ── COD flow ────────────────────────────────────────────────
  async function handleCOD() {
    if (type === 'delivery' && !address.trim()) { alert('Please enter a delivery address'); return }
    setLoading(true)
    try {
      const id = await createOrder('pending')
      cart.clear?.()
      router.push(`/orders/${id}`)
    } catch (e: any) {
      const msg = e?.message || e?.details || e?.hint || JSON.stringify(e)
      console.error('[welokl] order error:', e)
      alert('Error: ' + msg)
    } finally { setLoading(false) }
  }

  // ── UPI Step 1: create order, open UPI deep link ────────────
  async function handleUPIStart() {
    if (type === 'delivery' && !address.trim()) { alert('Please enter a delivery address'); return }
    setLoading(true)
    try {
      const id = await createOrder('pending')
      setPlacedOrderId(id)

      // Build UPI deep link
      const upiNote = encodeURIComponent(`Welokl order - ${cart.shop_name}`)
      const upiUrl  = `upi://pay?pa=${WELOKL_UPI_ID}&pn=${encodeURIComponent(WELOKL_UPI_NAME)}&am=${total}&cu=INR&tn=${upiNote}`

      // Open UPI app
      window.location.href = upiUrl

      // Show confirm step after a short delay (user returns from UPI app)
      setTimeout(() => setUpiStep('confirm'), 1000)
    } catch (e: any) {
      alert('Failed to initiate payment. Please try again.')
    } finally { setLoading(false) }
  }

  // ── UPI Step 2: user confirms payment done ──────────────────
  async function handleUPIConfirm() {
    if (!placedOrderId) return
    setLoading(true)
    try {
      await createClient().from('orders').update({ payment_status: 'paid' }).eq('id', placedOrderId)
      cart.clear?.()
      router.push(`/orders/${placedOrderId}`)
    } catch {
      alert('Could not confirm payment. Please contact support.')
    } finally { setLoading(false) }
  }

  // ── UPI Step 2: user says payment failed ────────────────────
  async function handleUPIFailed() {
    if (!placedOrderId) return
    await createClient().from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', placedOrderId)
    setPlacedOrderId(null)
    setUpiStep('select')
    setPayment('cod')
  }

  function handlePlaceOrder() {
    if (payment === 'cod') { handleCOD(); return }
    if (payment === 'upi') { handleUPIStart(); return }
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:14,
    border:'1.5px solid var(--divider)', background:'var(--input-bg)',
    color:'var(--text-primary)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box', transition:'border .2s',
  }

  // ── UPI payment screen ──────────────────────────────────────
  if (upiStep === 'confirm') return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'var(--card-white)', borderRadius:24, padding:32, maxWidth:400, width:'100%', textAlign:'center' }}>
        {/* UPI icon */}
        <div style={{ width:72, height:72, background:'var(--blue-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <svg viewBox="0 0 24 24" fill="none" width={36} height={36}>
            <rect x="2" y="5" width="20" height="14" rx="2" stroke="#4f46e5" strokeWidth="2"/>
            <path d="M2 10h20M6 15h2M10 15h4" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <p style={{ fontWeight:900, fontSize:20, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.02em' }}>Complete your payment</p>
        <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:6 }}>Pay <strong style={{ color:'var(--text-primary)' }}>₹{total}</strong> to</p>
        <div style={{ background:'var(--page-bg)', borderRadius:14, padding:'12px 20px', marginBottom:6, display:'inline-block' }}>
          <p style={{ fontSize:16, fontWeight:800, color:'#4f46e5', letterSpacing:'0.01em' }}>{WELOKL_UPI_ID}</p>
        </div>
        <p style={{ fontSize:12, color:'var(--text-faint)', marginBottom:28 }}>via Google Pay, PhonePe, Paytm or any UPI app</p>

        {/* Retry open UPI */}
        <button
          onClick={() => {
            const upiNote = encodeURIComponent(`Welokl order - ${cart.shop_name}`)
            window.location.href = `upi://pay?pa=${WELOKL_UPI_ID}&pn=${encodeURIComponent(WELOKL_UPI_NAME)}&am=${total}&cu=INR&tn=${upiNote}`
          }}
          style={{ width:'100%', padding:'14px', borderRadius:16, border:'2px solid #4f46e5', background:'var(--blue-light)', color:'#4f46e5', fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'inherit', marginBottom:10 }}>
          Open UPI app →
        </button>

        {/* Confirm paid */}
        <button onClick={handleUPIConfirm} disabled={loading}
          style={{ width:'100%', padding:'16px', borderRadius:16, border:'none', background:'#FF3008', color:'#fff', fontWeight:900, fontSize:16, cursor:'pointer', fontFamily:'inherit', marginBottom:10, boxShadow:'0 8px 24px rgba(255,48,8,.3)' }}>
          {loading ? 'Confirming…' : '✓ I have paid ₹' + total}
        </button>

        {/* Payment failed */}
        <button onClick={handleUPIFailed}
          style={{ width:'100%', padding:'12px', borderRadius:16, border:'1.5px solid var(--divider)', background:'transparent', color:'var(--text-muted)', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
          Payment failed — try again
        </button>
      </div>
    </div>
  )

  // ── Main checkout screen ────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:100 }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--chip-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1, letterSpacing:'-0.02em' }}>Checkout</h1>
          <span style={{ fontSize:12, color:'var(--text-muted)', background:'var(--chip-bg)', borderRadius:999, padding:'4px 12px', fontWeight:700 }}>{cart.shop_name}</span>
        </div>
      </div>

      <div style={{ maxWidth:560, margin:'0 auto', padding:'16px 12px' }}>

        {/* Order type */}
        {shopInfo?.pickup_enabled && shopInfo?.delivery_enabled && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
            <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:12 }}>Order type</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {([
                { id:'delivery' as const, label:'Delivery', sub:'Delivered to you',
                  icon:<svg viewBox="0 0 24 24" fill="none" width={20} height={20}><circle cx="5.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/><circle cx="18.5" cy="18.5" r="2.5" stroke="currentColor" strokeWidth="2"/><path d="M8 18H3V7l3-4h5v5M16 18h-3.5M8 7h5l3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M13 11h5l1.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                { id:'pickup'   as const, label:'Pickup',   sub:'Collect from shop',
                  icon:<svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
              ]).map(opt => (
                <button key={opt.id} onClick={() => setType(opt.id)}
                  style={{ padding:'14px', borderRadius:16, border:`2px solid ${type===opt.id ? '#FF3008' : 'var(--divider)'}`, background:type===opt.id ? 'var(--red-light)' : 'var(--page-bg)', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .15s' }}>
                  <div style={{ color:type===opt.id ? '#FF3008' : 'var(--text-muted)', marginBottom:6 }}>{opt.icon}</div>
                  <p style={{ fontWeight:800, fontSize:14, color:type===opt.id ? '#FF3008' : 'var(--text-primary)', marginBottom:2 }}>{opt.label}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)' }}>{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Delivery address */}
        {type === 'delivery' && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/></svg>
                <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)' }}>Delivery address</p>
              </div>
              {/* Location status indicator */}
              {locStatus === 'detecting' && (
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Detecting location…</span>
              )}
              {locStatus === 'done' && (
                <span style={{ fontSize:11, color:'#16a34a', fontWeight:700 }}>✓ Location detected</span>
              )}
            </div>

            {/* Saved address pills */}
            {savedAddrs.length > 0 && (
              <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:10, paddingBottom:2, scrollbarWidth:'none' }}>
                {savedAddrs.map(a => (
                  <button key={a.label+a.address} onClick={() => setAddress(a.address)}
                    style={{ flexShrink:0, padding:'7px 14px', borderRadius:999, border:`1.5px solid ${address===a.address ? '#FF3008' : 'var(--divider)'}`, background:address===a.address ? 'var(--red-light)' : 'var(--chip-bg)', color:address===a.address ? '#FF3008' : 'var(--text-muted)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <textarea value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Full delivery address — building, street, landmark…"
              rows={3} style={{ ...inp, resize:'none' }}
              onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
              onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
            />
          </div>
        )}

        {/* Order items */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>
            {cart.shop_name} · {items.length} item{items.length!==1?'s':''}
          </p>
          {items.map((item: any, i: number) => (
            <div key={item.product.id} style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:i<items.length-1?10:0, marginBottom:i<items.length-1?10:0, borderBottom:i<items.length-1?'1px solid var(--divider)':'none' }}>
              {item.product.image_url && (
                <div style={{ width:40, height:40, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--chip-bg)' }}>
                  <img src={item.product.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                </div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.product.name}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>₹{item.product.price} × {item.quantity}</p>
              </div>
              <span style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', flexShrink:0 }}>₹{item.product.price*item.quantity}</span>
            </div>
          ))}
        </div>

        {/* Special note */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:10 }}>Special instructions</p>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Allergies, preferences, instructions for rider…" style={inp}
            onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
            onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
          />
        </div>

        {/* Payment */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:12 }}>Payment method</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {([
              { id:'cod' as const, label:'Cash on delivery', sub:'Pay at doorstep',
                icon:<svg viewBox="0 0 24 24" fill="none" width={20} height={20}><rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M2 10h20M6 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
              { id:'upi' as const, label:'UPI / Online',     sub:'GPay, PhonePe, Paytm',
                icon:<svg viewBox="0 0 24 24" fill="none" width={20} height={20}><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M2 10h20M6 15h2M10 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
            ]).map(opt => (
              <button key={opt.id} onClick={() => setPayment(opt.id)}
                style={{ padding:'14px', borderRadius:16, border:`2px solid ${payment===opt.id ? '#FF3008' : 'var(--divider)'}`, background:payment===opt.id ? 'var(--red-light)' : 'var(--page-bg)', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .15s' }}>
                <div style={{ color:payment===opt.id ? '#FF3008' : 'var(--text-muted)', marginBottom:6 }}>{opt.icon}</div>
                <p style={{ fontWeight:800, fontSize:13, color:payment===opt.id ? '#FF3008' : 'var(--text-primary)', marginBottom:2 }}>{opt.label}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)' }}>{opt.sub}</p>
              </button>
            ))}
          </div>
          {payment === 'upi' && (
            <div style={{ marginTop:10, padding:'10px 14px', background:'var(--blue-light)', borderRadius:12 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#4f46e5' }}>
                You'll be redirected to your UPI app to pay ₹{total}. Return here to confirm.
              </p>
            </div>
          )}
        </div>

        {/* Bill summary */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:800, color:'var(--text-faint)', letterSpacing:'0.08em', marginBottom:14 }}>BILL SUMMARY</p>
          {[
            { label:'Item total', val:`₹${subtotal}`, green:false },
            { label:`Delivery${delivery_fee===0&&type==='delivery'?' (Free!)':type==='pickup'?' (Pickup)':''}`, val:delivery_fee===0?'FREE':`₹${delivery_fee}`, green:delivery_fee===0 },
            { label:'Platform fee', val:`₹${PLATFORM_FEE}`, green:false },
          ].map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:10, fontSize:14 }}>
              <span style={{ color:'var(--text-secondary)' }}>{r.label}</span>
              <span style={{ fontWeight:700, color:r.green ? '#16a34a' : 'var(--text-primary)' }}>{r.val}</span>
            </div>
          ))}
          {belowMin && (
            <div style={{ background:'var(--yellow-light)', borderRadius:12, padding:'10px 14px', marginBottom:10 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'#854d0e' }}>Minimum order ₹{minOrder} — add ₹{minOrder-subtotal} more</p>
            </div>
          )}
          <div style={{ borderTop:'1.5px dashed var(--divider)', paddingTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)' }}>To pay</span>
            <span style={{ fontWeight:900, fontSize:20, color:'var(--text-primary)' }}>₹{total}</span>
          </div>
        </div>
      </div>

      {/* Place order bar */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 12px 20px', background:'var(--card-white)', borderTop:'1px solid var(--divider)', zIndex:50 }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <button onClick={handlePlaceOrder} disabled={loading || belowMin}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderRadius:18, border:'none', background:loading||belowMin ? 'var(--chip-bg)' : '#FF3008', color:loading||belowMin ? 'var(--text-muted)' : '#fff', fontWeight:900, fontSize:16, cursor:loading||belowMin ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'background .2s', boxShadow:loading||belowMin ? 'none' : '0 8px 24px rgba(255,48,8,.3)' }}>
            <span>{loading ? 'Please wait…' : belowMin ? `Add ₹${minOrder-subtotal} more` : payment==='upi' ? 'Pay with UPI' : 'Place order'}</span>
            {!loading && !belowMin && <span>₹{total}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}