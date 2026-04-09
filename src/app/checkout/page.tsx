'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import Link from 'next/link'

// Fallback constants — overridden at runtime by platform_config table values
const DEFAULT_DELIVERY_FEE  = 30
const DEFAULT_FREE_DELIVERY = 299

export default function CheckoutPage() {
  const router = useRouter()
  const cart   = useCart() as any

  const [platformCfg, setPlatformCfg] = useState({
    delivery_fee: DEFAULT_DELIVERY_FEE,
    free_delivery_threshold: DEFAULT_FREE_DELIVERY,
  })
  const [address,       setAddress]       = useState('')
  const [savedAddrs,    setSavedAddrs]    = useState<{id:string;label:string;address:string}[]>([])
  const [saveLabel,     setSaveLabel]     = useState('')
  const [note,          setNote]          = useState('')
  const [type,          setType]          = useState<'delivery'|'pickup'>('delivery')
  const [loading,       setLoading]       = useState(false)
  const [userId,        setUserId]        = useState<string|null>(null)
  const [shopInfo,      setShopInfo]      = useState<{delivery_enabled:boolean;pickup_enabled:boolean;min_order_amount:number;commission_percent:number}|null>(null)
  const [mounted,       setMounted]       = useState(false)
  const [locStatus,     setLocStatus]     = useState<'idle'|'detecting'|'done'|'denied'>('idle')
  const [deliveryLat,   setDeliveryLat]   = useState<number|null>(null)
  const [deliveryLng,   setDeliveryLng]   = useState<number|null>(null)
  const [tip,           setTip]           = useState(0)
  const [isPriority,    setIsPriority]    = useState(false)
  const PRIORITY_FEE = 25
  const [promoInput,    setPromoInput]    = useState('')
  const [promo,         setPromo]         = useState<{code:string;discount:number;id:string;min_order:number}|null>(null)
  const [promoLoading,  setPromoLoading]  = useState(false)
  const [promoError,    setPromoError]    = useState('')
  const [orderError,    setOrderError]    = useState('')
  const [userPhone,     setUserPhone]     = useState('')
  const [deviceId,      setDeviceId]      = useState('')

  // Generate/restore a stable device fingerprint stored in localStorage
  function getOrCreateDeviceId(): string {
    try {
      const stored = localStorage.getItem('welokl_device_id')
      if (stored) return stored
      const components = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}`,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency ?? 0,
        (navigator as any).deviceMemory ?? 0,
      ].join('|')
      let hash = 0
      for (let i = 0; i < components.length; i++) {
        hash = Math.imul(31, hash) + components.charCodeAt(i) | 0
      }
      const id = Math.abs(hash).toString(36) + '-' + Date.now().toString(36)
      localStorage.setItem('welokl_device_id', id)
      return id
    } catch { return '' }
  }

  useEffect(() => {
    setMounted(true)

    const sb = createClient()

    // ── Load platform config (pricing) from DB ─────────────────
    sb.from('platform_config').select('key,value').then(({ data: cfg }) => {
      if (!cfg?.length) return
      const get = (key: string, fb: number) => Number(cfg.find(c => c.key === key)?.value ?? fb)
      setPlatformCfg({
        delivery_fee:            get('delivery_fee_base', DEFAULT_DELIVERY_FEE),
        free_delivery_threshold: get('free_delivery_above', DEFAULT_FREE_DELIVERY),
      })
    })

    setDeviceId(getOrCreateDeviceId())

    sb.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      // Hydrate cart with the correct user-keyed localStorage entry
      cart._setUserId?.(data.user.id)
      setUserId(data.user.id)
      // ── Load saved addresses + phone from DB ─────────────────
      Promise.all([
        sb.from('user_addresses').select('id,label,address').eq('user_id', data.user.id).order('created_at', { ascending: false }),
        sb.from('users').select('phone').eq('id', data.user.id).maybeSingle(),
      ]).then(([addrRes, userRes]) => {
        if (addrRes.data?.length) {
          setSavedAddrs(addrRes.data as any)
          setAddress(prev => prev || addrRes.data![0].address)
        }
        if (userRes.data?.phone) setUserPhone(userRes.data.phone)
      })
    })

    // ── Try to get readable address from saved GPS coords ──────
    try {
      const loc = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (loc?.lat && loc?.lng) {
        setDeliveryLat(loc.lat)
        setDeliveryLng(loc.lng)
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

  const delivery_fee   = type === 'pickup' ? 0 : subtotal >= platformCfg.free_delivery_threshold ? 0 : platformCfg.delivery_fee
  const promoDiscount  = promo?.discount ?? 0
  const priorityFee    = isPriority ? PRIORITY_FEE : 0
  const total          = subtotal + delivery_fee + tip + priorityFee - promoDiscount
  const minOrder       = 0
  const belowMin       = false

  // Auto-invalidate promo if subtotal drops below its minimum
  if (promo && promo.min_order > 0 && subtotal < promo.min_order) {
    setPromo(null)
    setPromoInput('')
    setPromoError(`Promo removed — min order ₹${promo.min_order} not met`)
  }

  async function applyPromo() {
    if (!promoInput.trim()) return
    setPromoLoading(true)
    setPromoError('')
    const sb = createClient()

    // Get current user
    const { data: { user: authUser } } = await sb.auth.getUser()
    if (!authUser) { setPromoError('Please sign in to use a promo code'); setPromoLoading(false); return }

    // Fetch promo code
    const { data } = await sb.from('promo_codes')
      .select('*')
      .eq('code', promoInput.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()

    if (!data) { setPromoError('Invalid or expired code'); setPromoLoading(false); return }
    if (data.expires_at && new Date(data.expires_at) < new Date()) { setPromoError('This code has expired'); setPromoLoading(false); return }
    if (data.usage_limit && data.used_count >= data.usage_limit) { setPromoError('Code usage limit reached'); setPromoLoading(false); return }
    if (data.min_order_amount && subtotal < data.min_order_amount) { setPromoError(`Min order ₹${data.min_order_amount} required`); setPromoLoading(false); return }

    // ── Multi-signal abuse check ──────────────────────────────
    // Block if: same user_id OR same device OR same phone number already used this code
    const checks = [
      sb.from('promo_code_usages').select('id').eq('promo_code_id', data.id).eq('user_id', authUser.id).maybeSingle(),
      deviceId ? sb.from('promo_code_usages').select('id').eq('promo_code_id', data.id).eq('device_fingerprint', deviceId).maybeSingle() : Promise.resolve({ data: null }),
      userPhone ? sb.from('promo_code_usages').select('id').eq('promo_code_id', data.id).eq('phone', userPhone).maybeSingle() : Promise.resolve({ data: null }),
    ]
    const [byUser, byDevice, byPhone] = await Promise.all(checks)
    if (byUser.data || byDevice.data || byPhone.data) {
      setPromoError('You have already used this code')
      setPromoLoading(false)
      return
    }

    const raw = data.discount_type === 'percent'
      ? (data.discount_value / 100) * subtotal
      : data.discount_value
    const discount = Math.min(raw, data.max_discount ?? raw, subtotal)
    setPromo({ code: data.code, discount: Math.round(discount), id: data.id, min_order: data.min_order_amount || 0 })
    setPromoLoading(false)
  }

  // ── Create the order in DB ──────────────────────────────────
  async function createOrder(paymentStatus: 'pending' | 'paid') {
    const sb = createClient()

    // Re-validate promo minimum before writing to DB
    if (promo && promo.min_order > 0 && subtotal < promo.min_order) {
      setPromo(null)
      setPromoInput('')
      throw new Error(`Promo code requires a minimum order of ₹${promo.min_order}. Please add more items.`)
    }

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
      delivery_lat:          type === 'delivery' ? deliveryLat : null,
      delivery_lng:          type === 'delivery' ? deliveryLng : null,
      delivery_instructions: note?.trim() || null,
      subtotal:              subtotal,
      delivery_fee:          delivery_fee,
      platform_fee:          0,
      discount:              promoDiscount,
      tip_amount:            tip,
      promo_code:            promo?.code || null,
      is_priority:           isPriority,
      priority_fee:          priorityFee,
      total_amount:          total,
      payment_method:        'cod',
      payment_status:        paymentStatus,
    }

    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single()

    if (orderErr) {
      throw new Error(orderErr.message || 'Failed to place order. Please try again.')
    }

    // Insert order items (non-fatal if fails — order is already created)
    await sb.from('order_items').insert(
      items.map((item: any) => ({
        order_id:     order.id,
        product_id:   item.product.id,
        product_name: item.product.name,
        quantity:     item.quantity,
        price:        item.product.price,
        note:         item.note || null,
      }))
    )

    // Record promo usage — blocks same user, device, or phone from reusing
    if (promo?.id) {
      sb.from('promo_code_usages').insert({
        promo_code_id:      promo.id,
        user_id:            uid,
        order_id:           order.id,
        device_fingerprint: deviceId || null,
        phone:              userPhone || null,
      }).then(() => {})
    }

    // Save address to DB if it's new
    if (address.trim() && !savedAddrs.find(a => a.address === address.trim())) {
      sb.from('user_addresses').insert({
        user_id: uid,
        label:   saveLabel.trim() || 'Home',
        address: address.trim(),
      }).then(({ data: newRow }) => {
        if (newRow) setSavedAddrs(prev => [newRow[0], ...prev])
      })
    }

    // Notify shop owner — push notification even when their app is closed
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        type:        'order_placed',
        order_id:    order.id,
        shop_id:     cart.shop_id,
        customer_id: uid,
      }),
    }).catch(() => {}) // fire and forget — don't block order flow

    return order.id
  }

  // ── COD flow ────────────────────────────────────────────────
  async function handleCOD() {
    if (type === 'delivery' && !address.trim()) { setOrderError('Please enter a delivery address'); return }
    setLoading(true)
    setOrderError('')
    try {
      const id = await createOrder('pending')
      cart.clear?.()
      router.push(`/orders/${id}`)
    } catch (e: any) {
      setOrderError(e?.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:14,
    border:'1.5px solid var(--divider)', background:'var(--input-bg)',
    color:'var(--text-primary)', fontSize:15, fontFamily:'inherit',
    outline:'none', boxSizing:'border-box', transition:'border .2s',
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(120px + env(safe-area-inset-bottom, 0px))' }}>

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
                  <div key={a.id} style={{ display:'flex', alignItems:'center', flexShrink:0, borderRadius:999, border:`1.5px solid ${address===a.address ? '#FF3008' : 'var(--divider)'}`, background:address===a.address ? 'var(--red-light)' : 'var(--chip-bg)', overflow:'hidden' }}>
                    <button onClick={() => setAddress(a.address)}
                      style={{ padding:'7px 10px 7px 14px', border:'none', background:'transparent', color:address===a.address ? '#FF3008' : 'var(--text-muted)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {a.label}
                    </button>
                    <button onClick={() => {
                      createClient().from('user_addresses').delete().eq('id', a.id).then(() => {
                        setSavedAddrs(prev => prev.filter(x => x.id !== a.id))
                        if (address === a.address) setAddress('')
                      })
                    }} style={{ padding:'7px 10px 7px 4px', border:'none', background:'transparent', color:address===a.address ? '#FF3008' : 'var(--text-muted)', fontSize:13, cursor:'pointer', lineHeight:1, opacity:0.6 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <textarea value={address} onChange={e => { setAddress(e.target.value); setSaveLabel('') }}
              placeholder="Full delivery address — building, street, landmark…"
              rows={3} style={{ ...inp, resize:'none' }}
              onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
              onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
            />

            {/* Save label — only shown when typing a new address */}
            {address.trim() && !savedAddrs.find(a => a.address === address.trim()) && (
              <div style={{ marginTop:8, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>Save as:</span>
                {['Home','Work','Other'].map(l => (
                  <button key={l} onClick={() => setSaveLabel(l)}
                    style={{ padding:'5px 12px', borderRadius:999, border:`1.5px solid ${saveLabel===l ? '#FF3008' : 'var(--divider)'}`, background:saveLabel===l ? 'var(--red-light)' : 'transparent', color:saveLabel===l ? '#FF3008' : 'var(--text-muted)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {l}
                  </button>
                ))}
                <input value={!['Home','Work','Other'].includes(saveLabel) ? saveLabel : ''}
                  onChange={e => setSaveLabel(e.target.value)}
                  placeholder="Custom…"
                  style={{ width:80, padding:'5px 10px', borderRadius:999, border:'1.5px solid var(--divider)', background:'transparent', color:'var(--text-primary)', fontSize:11, fontFamily:'inherit', outline:'none' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Order items */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>
            {cart.shop_name} · {items.length} item{items.length!==1?'s':''}
          </p>
          {items.map((item: any, i: number) => (
            <div key={item.product.id} style={{ display:'flex', alignItems:'center', gap:12, paddingBottom:i<items.length-1?12:0, marginBottom:i<items.length-1?12:0, borderBottom:i<items.length-1?'1px solid var(--divider)':'none' }}>
              {item.product.image_url && (
                <div style={{ width:44, height:44, borderRadius:10, overflow:'hidden', flexShrink:0, background:'var(--chip-bg)' }}>
                  <img src={item.product.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
                </div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.product.name}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>₹{item.product.price} each</p>
              </div>
              {/* Blinkit-style stepper */}
              <div style={{ display:'flex', alignItems:'center', gap:0, background:'var(--page-bg)', borderRadius:12, border:'1.5px solid var(--divider)', overflow:'hidden', flexShrink:0 }}>
                <button
                  onClick={() => cart.updateQty?.(item.product.id, item.quantity - 1)}
                  style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'transparent', color:'#FF3008', fontSize:20, fontWeight:900, cursor:'pointer', lineHeight:1 }}>
                  −
                </button>
                <span style={{ minWidth:22, textAlign:'center', fontSize:14, fontWeight:900, color:'var(--text-primary)', padding:'0 2px' }}>
                  {item.quantity}
                </span>
                <button
                  onClick={() => cart.addItem?.(item.product, cart.shop_id, cart.shop_name)}
                  style={{ width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', border:'none', background:'#FF3008', color:'#fff', fontSize:20, fontWeight:900, cursor:'pointer', lineHeight:1, borderRadius:'0 9px 9px 0' }}>
                  +
                </button>
              </div>
              <span style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', flexShrink:0, minWidth:44, textAlign:'right' }}>₹{item.product.price*item.quantity}</span>
            </div>
          ))}

          {/* Add more items */}
          {cart.shop_id && (
            <div style={{ borderTop:'1px dashed var(--divider)', marginTop:14, paddingTop:14 }}>
              <Link href={`/stores/${cart.shop_id}`}
                style={{ display:'flex', alignItems:'center', gap:8, textDecoration:'none' }}>
                <div style={{ width:32, height:32, borderRadius:10, border:'1.5px dashed #FF3008', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M12 5v14M5 12h14" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </div>
                <span style={{ fontSize:14, fontWeight:800, color:'#FF3008' }}>Add more items</span>
              </Link>
            </div>
          )}
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

        {/* Promo code */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:10 }}>Promo code</p>
          {promo ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(22,163,74,.08)', borderRadius:12, border:'1.5px solid rgba(22,163,74,.25)' }}>
              <div>
                <p style={{ fontWeight:800, fontSize:13, color:'#16a34a' }}>🎉 "{promo.code}" applied</p>
                <p style={{ fontSize:12, color:'#16a34a', marginTop:2 }}>You save ₹{promo.discount}</p>
              </div>
              <button onClick={() => { setPromo(null); setPromoInput('') }}
                style={{ fontSize:12, color:'#ef4444', fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Remove</button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:8 }}>
              <input value={promoInput} onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError('') }}
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
                placeholder="Enter promo code" style={{ ...inp, flex:1, fontSize:13 }}
                onFocus={e => e.currentTarget.style.borderColor='#FF3008'}
                onBlur={e => e.currentTarget.style.borderColor='var(--divider)'}
              />
              <button onClick={applyPromo} disabled={promoLoading || !promoInput.trim()}
                style={{ padding:'0 18px', borderRadius:14, border:'none', background: promoInput.trim() ? '#FF3008' : 'var(--chip-bg)', color: promoInput.trim() ? '#fff' : 'var(--text-muted)', fontWeight:800, fontSize:13, cursor: promoInput.trim() ? 'pointer' : 'default', fontFamily:'inherit', flexShrink:0 }}>
                {promoLoading ? '…' : 'Apply'}
              </button>
            </div>
          )}
          {promoError && <p style={{ fontSize:12, color:'#ef4444', marginTop:8, fontWeight:600 }}>{promoError}</p>}
        </div>

        {/* Priority order */}
        {type === 'delivery' && (
          <div
            onClick={() => setIsPriority(p => !p)}
            style={{ background: isPriority ? 'linear-gradient(135deg,#fff3e0,#ffe8cc)' : 'var(--card-white)', borderRadius:20, padding:'16px 18px', marginBottom:12, cursor:'pointer', border:`2px solid ${isPriority ? '#f97316' : 'var(--divider)'}`, transition:'all .2s' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:14, background: isPriority ? '#f97316' : 'var(--chip-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .2s' }}>
                <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={isPriority ? '#fff' : '#f97316'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:900, fontSize:14, color: isPriority ? '#c2410c' : 'var(--text-primary)', marginBottom:2 }}>
                  Priority Order {isPriority ? '🔥' : ''}
                </p>
                <p style={{ fontSize:12, color: isPriority ? '#ea580c' : 'var(--text-muted)' }}>
                  Jump to top of queue · faster prep & pickup
                </p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                <span style={{ fontWeight:900, fontSize:15, color: isPriority ? '#c2410c' : '#f97316' }}>+₹{PRIORITY_FEE}</span>
                {/* Toggle pill */}
                <div style={{ width:44, height:24, borderRadius:999, background: isPriority ? '#f97316' : 'var(--chip-bg)', position:'relative', transition:'background .2s', border:`1.5px solid ${isPriority ? '#f97316' : 'var(--divider)'}` }}>
                  <div style={{ position:'absolute', top:2, left: isPriority ? 22 : 2, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,.2)', transition:'left .2s' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tip for rider */}
        {type === 'delivery' && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)' }}>Tip your delivery partner</p>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>100% goes to them</span>
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {[0, 10, 20, 30, 50].map(amt => (
                <button key={amt} onClick={() => setTip(amt)}
                  style={{ padding:'8px 16px', borderRadius:999, border:`2px solid ${tip===amt ? '#FF3008' : 'var(--divider)'}`, background: tip===amt ? 'var(--red-light)' : 'transparent', color: tip===amt ? '#FF3008' : 'var(--text-secondary)', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {amt === 0 ? 'No tip' : `₹${amt}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Payment */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12, display:'flex', alignItems:'center', gap:12 }}>
          <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><rect x="2" y="6" width="20" height="12" rx="2" stroke="#FF3008" strokeWidth="2"/><path d="M2 10h20M6 14h4" stroke="#FF3008" strokeWidth="2" strokeLinecap="round"/></svg>
          <div>
            <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)' }}>Cash on delivery</p>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>Pay at doorstep</p>
          </div>
          <span style={{ marginLeft:'auto', fontSize:11, fontWeight:800, color:'#16a34a', background:'rgba(22,163,74,.1)', borderRadius:8, padding:'3px 10px' }}>Selected</span>
        </div>

        {/* Bill summary */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
          <p style={{ fontSize:12, fontWeight:800, color:'var(--text-faint)', letterSpacing:'0.08em', marginBottom:14 }}>BILL SUMMARY</p>
          {[
            { label:'Item total', val:`₹${subtotal}`, green:false },
            { label:`Delivery${delivery_fee===0&&type==='delivery'?' (Free!)':type==='pickup'?' (Pickup)':''}`, val:delivery_fee===0?'FREE':`₹${delivery_fee}`, green:delivery_fee===0 },
            ...(tip > 0 ? [{ label:'Tip for rider', val:`₹${tip}`, green:false }] : []),
            ...(priorityFee > 0 ? [{ label:'🔥 Priority fee', val:`₹${priorityFee}`, green:false }] : []),
            ...(promoDiscount > 0 ? [{ label:`Promo (${promo?.code})`, val:`-₹${promoDiscount}`, green:true }] : []),
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
      <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 12px', paddingBottom:'calc(16px + env(safe-area-inset-bottom, 0px))', background:'var(--card-white)', borderTop:'1px solid var(--divider)', zIndex:50 }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          {orderError && (
            <div style={{ marginBottom:10, padding:'10px 14px', borderRadius:12, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)' }}>
              <p style={{ fontSize:13, color:'#ef4444', fontWeight:600, margin:0 }}>{orderError}</p>
            </div>
          )}
          <button onClick={handleCOD} disabled={loading || belowMin}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderRadius:18, border:'none', background: loading || belowMin ? 'var(--chip-bg)' : '#FF3008', color: loading || belowMin ? 'var(--text-muted)' : '#fff', fontWeight:900, fontSize:16, cursor: loading || belowMin ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'background .2s', boxShadow: loading || belowMin ? 'none' : '0 8px 24px rgba(255,48,8,.3)' }}>
            <span>{loading ? 'Placing order…' : belowMin ? `Add ₹${minOrder - subtotal} more` : 'Place order'}</span>
            {!loading && !belowMin && <span>₹{Math.max(0, total)}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}