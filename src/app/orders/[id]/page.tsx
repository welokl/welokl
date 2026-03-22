'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const STATUS_STEPS = [
  { key:'placed',    label:'Order placed' },
  { key:'accepted',  label:'Accepted by shop' },
  { key:'preparing', label:'Being prepared' },
  { key:'ready',     label:'Ready for pickup' },
  { key:'picked_up', label:'Out for delivery' },
  { key:'delivered', label:'Delivered!' },
]

export default function OrderPage() {
  const { id }      = useParams<{ id: string }>()
  const router      = useRouter()
  const mapRef      = useRef<HTMLDivElement>(null)
  const leafletRef  = useRef<any>(null)
  const markerRef   = useRef<any>(null)  // rider marker
  const destRef     = useRef<any>(null)  // customer pin
  const shopRef     = useRef<any>(null)  // shop pin

  const [order,      setOrder]      = useState<any>(null)
  const [partner,    setPartner]    = useState<any>(null)
  const [riderPos,   setRiderPos]   = useState<{lat:number;lng:number}|null>(null)
  const [loading,    setLoading]    = useState(true)
  const [shopRating,     setShopRating]     = useState(0)
  const [ratingDone,     setRatingDone]     = useState(false)
  const [ratingLoading,  setRatingLoading]  = useState(false)

  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')

  useEffect(() => {
    if (!isValidUUID) return
    loadOrder()

    const sb = createClient()
    // Realtime: order status updates
    const orderCh = sb.channel(`order-track:${id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`id=eq.${id}` },
        () => loadOrder())
      .subscribe()

    return () => { sb.removeChannel(orderCh) }
  }, [id])

  // Realtime: rider position updates
  useEffect(() => {
    if (!order?.delivery_partner_id) return
    const sb = createClient()
    const riderCh = sb.channel(`rider-pos:${order.delivery_partner_id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'delivery_partners',
        filter: `user_id=eq.${order.delivery_partner_id}`
      }, payload => {
        const { current_lat, current_long } = payload.new
        if (current_lat && current_long) setRiderPos({ lat: current_lat, lng: current_long })
      })
      .subscribe()
    return () => { sb.removeChannel(riderCh) }
  }, [order?.delivery_partner_id])

  // Update rider marker when position changes
  useEffect(() => {
    if (!riderPos || !leafletRef.current || !markerRef.current) return
    markerRef.current.setLatLng([riderPos.lat, riderPos.lng])
  }, [riderPos])

  // Init Leaflet map when order loads and is in delivery phase
  useEffect(() => {
    if (!order || !mapRef.current) return
    const showMap = ['ready', 'picked_up'].includes(order.status) && order.delivery_partner_id && riderPos
    if (!showMap) return
    if (leafletRef.current) return // already inited

    // Dynamically load Leaflet
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => {
      const L = (window as any).L
      if (!mapRef.current || !riderPos) return

      const center: [number,number] = [riderPos.lat, riderPos.lng]
      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 15)
      leafletRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(map)

      // Rider marker (red scooter)
      const riderIcon = L.divIcon({
        html: `<div style="width:36px;height:36px;background:#FF3008;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(255,48,8,.5);display:flex;align-items:center;justify-content:center;">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <circle cx="5" cy="17" r="2.5" stroke="white" strokeWidth="1.5"/>
            <circle cx="19" cy="17" r="2.5" stroke="white" strokeWidth="1.5"/>
            <path d="M7.5 17h9M5 11l2-4h5l3 4h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 11l1 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>`,
        className: '', iconSize: [36, 36], iconAnchor: [18, 18]
      })

      markerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon: riderIcon })
        .addTo(map)
        .bindPopup('Your rider')

      const points: [number, number][] = [[riderPos.lat, riderPos.lng]]

      // Shop pin — orange (where rider is coming from)
      if (order.shop?.latitude && order.shop?.longitude) {
        const shopIcon = L.divIcon({
          html: `<div style="width:38px;height:38px;background:#FF3008;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(255,48,8,.5);"></div>`,
          className: '', iconSize: [38, 38], iconAnchor: [19, 38],
        })
        shopRef.current = L.marker([order.shop.latitude, order.shop.longitude], { icon: shopIcon })
          .addTo(map)
          .bindPopup(order.shop?.name || 'Shop')
        points.push([order.shop.latitude, order.shop.longitude])
      }

      // Customer destination pin — green
      if (order.delivery_lat && order.delivery_lng) {
        const destIcon = L.divIcon({
          html: `<div style="width:34px;height:34px;background:#16a34a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(22,163,74,.5);"></div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 34],
        })
        destRef.current = L.marker([order.delivery_lat, order.delivery_lng], { icon: destIcon })
          .addTo(map)
          .bindPopup('Your location')
        points.push([order.delivery_lat, order.delivery_lng])
      }

      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
      }
    }
    document.head.appendChild(script)
  }, [order, riderPos])

  async function loadOrder() {
    const sb = createClient()
    const { data: raw, error } = await sb
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !raw) { setLoading(false); return }

    const bizId  = raw.business_id
    const shopId = raw.shop_id

    const [bizRes, shopRes, itemsRes] = await Promise.all([
      bizId  ? sb.from('businesses').select('id,name,address,image_url').eq('id', bizId).single() : Promise.resolve({ data: null }),
      shopId ? sb.from('shops').select('id,name,area,image_url,latitude,longitude').eq('id', shopId).single() : Promise.resolve({ data: null }),
      sb.from('order_items').select('id,product_name,quantity,price').eq('order_id', raw.id),
    ])

    const enriched = { ...raw, business: bizRes.data, shop: shopRes.data, order_items: itemsRes.data ?? [] }
    setOrder(enriched)

    // Load rider
    if (raw.delivery_partner_id) {
      const [{ data: u }, { data: dp }] = await Promise.all([
        sb.from('users').select('name,phone').eq('id', raw.delivery_partner_id).single(),
        sb.from('delivery_partners').select('vehicle_type,rating,current_lat,current_long').eq('user_id', raw.delivery_partner_id).single(),
      ])
      if (u) setPartner({ ...u, ...dp })
      if (dp?.current_lat && dp?.current_long) {
        setRiderPos({ lat: dp.current_lat, lng: dp.current_long })
      }
    }

    setLoading(false)
  }

  async function submitRating(stars: number) {
    if (ratingDone || ratingLoading || !order?.shop_id) return
    setShopRating(stars)
    setRatingLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    // Upsert rating (idempotent per order)
    await sb.from('order_ratings').upsert({
      order_id: id,
      shop_id: order.shop_id,
      customer_id: user?.id,
      rating: stars,
    }, { onConflict: 'order_id' })
    // Recalculate shop average
    const { data: ratings } = await sb.from('order_ratings').select('rating').eq('shop_id', order.shop_id)
    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length
      await sb.from('shops').update({ rating: Math.round(avg * 10) / 10 }).eq('id', order.shop_id)
    }
    setRatingDone(true)
    setRatingLoading(false)
  }

  if (!isValidUUID) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontWeight:800, color:'var(--text-primary)', marginBottom:12 }}>Page not found</p>
        <Link href="/orders/history" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>← Back to orders</Link>
      </div>
    </div>
  )

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', padding:16, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <style>{`@keyframes sk{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--chip-bg) 25%,var(--page-bg) 50%,var(--chip-bg) 75%);background-size:400px 100%;animation:sk 1.4s infinite;border-radius:16px;}`}</style>
      <div style={{ maxWidth:560, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
        {[56,320,120,160,120].map((h,i) => <div key={i} className="sk" style={{ height:h }} />)}
      </div>
    </div>
  )

  if (!order) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontWeight:800, color:'var(--text-primary)', marginBottom:12 }}>Order not found</p>
        <Link href="/orders/history" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>← Back to orders</Link>
      </div>
    </div>
  )

  const shopName = order.business?.name || order.shop?.name || 'Shop'
  const stepIdx  = STATUS_STEPS.findIndex(s => s.key === order.status)
  const isCancelled = ['cancelled','rejected'].includes(order.status)
  const isActive    = !isCancelled && order.status !== 'delivered'
  const showMap     = ['ready', 'picked_up'].includes(order.status) && !!order.delivery_partner_id && !!riderPos

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:40 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1 }}>
            Order #{order.order_number || order.id?.slice(-6).toUpperCase()}
          </h1>
          {isActive && (
            <div style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:999, background:'var(--green-light)' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', animation:'pulse 1.5s infinite' }} />
              <span style={{ fontSize:11, fontWeight:700, color:'#16a34a' }}>Live</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:560, margin:'0 auto', padding:'16px 12px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* 🗺 LIVE MAP — shows when rider is on the way */}
        {showMap && (
          <div style={{ background:'var(--card-white)', borderRadius:20, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px 10px', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#FF3008', animation:'pulse 1.5s infinite' }} />
              <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)' }}>
                {order.status === 'ready' ? 'Rider heading to shop' : 'Rider is on the way'}
              </p>
              {partner?.name && <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:'auto' }}>{partner.name}</span>}
            </div>
            {/* Leaflet map container */}
            <div ref={mapRef} style={{ height:240, width:'100%', background:'var(--chip-bg)' }} />
            <div style={{ padding:'10px 16px', fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>
              Map updates automatically · {riderPos ? `${riderPos.lat.toFixed(4)}, ${riderPos.lng.toFixed(4)}` : ''}
            </div>
          </div>
        )}

        {/* Status timeline */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'20px 18px' }}>
          <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:20 }}>Order status</p>

          {isCancelled ? (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', background:'var(--error-light)', borderRadius:14 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p style={{ fontWeight:800, fontSize:14, color:'#ef4444' }}>Order {order.status}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>Contact support if needed</p>
              </div>
            </div>
          ) : (
            <div>
              {STATUS_STEPS.map((step, idx) => {
                const done    = idx < stepIdx
                const active  = idx === stepIdx
                const pending = idx > stepIdx
                return (
                  <div key={step.key} style={{ display:'flex', gap:14 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: done ? '#16a34a' : active ? '#fff' : 'var(--chip-bg)', border:`2px solid ${done ? '#16a34a' : active ? '#FF3008' : 'var(--divider)'}`, boxShadow: active ? '0 0 0 4px rgba(255,48,8,.1)' : 'none', transition:'all .3s' }}>
                        {done
                          ? <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : active
                          ? <div style={{ width:10, height:10, borderRadius:'50%', background:'#FF3008', animation:'pulse 1.5s infinite' }} />
                          : <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--text-faint)' }} />
                        }
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div style={{ width:2, height:28, background: done ? '#16a34a' : 'var(--divider)', marginTop:2, borderRadius:1 }} />
                      )}
                    </div>
                    <div style={{ paddingTop:8, paddingBottom: idx < STATUS_STEPS.length - 1 ? 16 : 0, opacity: pending ? 0.38 : 1 }}>
                      <p style={{ fontWeight: active ? 800 : 600, fontSize:14, color: active ? '#FF3008' : done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {step.label}
                      </p>
                      {active && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>In progress…</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delivery partner — shown whenever assigned, until delivered */}
        {partner && order.status !== 'delivered' && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'16px 18px' }}>
            <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:12 }}>Delivery partner</p>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="#4f46e5" strokeWidth="2"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>{partner.name}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>{partner.vehicle_type || 'Bike'}{partner.rating ? ` · ★ ${Number(partner.rating).toFixed(1)}` : ''}</p>
              </div>
              {partner.phone && (
                <a href={`tel:${partner.phone}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 16px', borderRadius:14, background:'#16a34a', textDecoration:'none', flexShrink:0 }}>
                  <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.9 12.63 19.79 19.79 0 011.82 4.05 2 2 0 013.8 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{partner.phone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Shop + address */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'16px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom: order.delivery_address ? 14 : 0 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'var(--red-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="#FF3008" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:2 }}>FROM</p>
              <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)' }}>{shopName}</p>
            </div>
          </div>
          {order.delivery_address && (
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, paddingTop:14, borderTop:'1px solid var(--divider)' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#4f46e5" opacity=".8"/></svg>
              </div>
              <div>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:2 }}>DELIVERING TO</p>
                <p style={{ fontSize:14, color:'var(--text-primary)', lineHeight:1.5 }}>{order.delivery_address}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bill */}
        <div style={{ background:'var(--card-white)', borderRadius:20, padding:'16px 18px' }}>
          <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:14 }}>Bill summary</p>
          {(order.order_items || []).map((item:any) => (
            <div key={item.id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:14 }}>
              <span style={{ color:'var(--text-secondary)' }}>{item.product_name} × {item.quantity}</span>
              <span style={{ fontWeight:700, color:'var(--text-primary)' }}>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px dashed var(--divider)', paddingTop:10, marginTop:6 }}>
            {[
              { label:'Delivery', val: order.delivery_fee > 0 ? `₹${order.delivery_fee}` : 'FREE', green: !order.delivery_fee },
              { label:'Platform fee', val:`₹${order.platform_fee || 5}` },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
                <span style={{ color:'var(--text-muted)' }}>{r.label}</span>
                <span style={{ color: r.green ? '#16a34a' : 'var(--text-secondary)', fontWeight:600 }}>{r.val}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, paddingTop:8, borderTop:'1px solid var(--divider)' }}>
              <span style={{ fontWeight:900, fontSize:15, color:'var(--text-primary)' }}>Total</span>
              <span style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)' }}>₹{order.total_amount}</span>
            </div>
          </div>
          <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--divider)', display:'flex', justifyContent:'space-between', fontSize:13 }}>
            <span style={{ color:'var(--text-muted)' }}>Payment</span>
            <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{order.payment_method === 'cod' ? 'Cash on delivery' : 'UPI / Online'}</span>
          </div>
        </div>

        {/* Rate your order — shown once delivered */}
        {order.status === 'delivered' && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'20px 18px' }}>
            {ratingDone ? (
              <div style={{ textAlign:'center', padding:'8px 0' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🙏</div>
                <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>Thanks for rating!</p>
                <p style={{ fontSize:13, color:'var(--text-muted)' }}>Your feedback helps other customers</p>
                <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:12 }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ fontSize:26, color: s <= shopRating ? '#f59e0b' : 'var(--divider)' }}>★</span>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>Rate your experience</p>
                <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>How was your order from {shopName}?</p>
                <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:8 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => submitRating(s)} disabled={ratingLoading}
                      style={{ fontSize:36, background:'none', border:'none', cursor:'pointer', padding:'4px', lineHeight:1, color: s <= shopRating ? '#f59e0b' : '#ddd', transition:'color .15s, transform .1s', transform: s <= shopRating ? 'scale(1.15)' : 'scale(1)' }}>
                      ★
                    </button>
                  ))}
                </div>
                <p style={{ fontSize:12, color:'var(--text-faint)', textAlign:'center' }}>
                  {shopRating === 0 ? 'Tap a star' : shopRating === 5 ? 'Excellent!' : shopRating >= 4 ? 'Great!' : shopRating >= 3 ? 'Good' : shopRating >= 2 ? 'Could be better' : 'Poor experience'}
                </p>
              </>
            )}
          </div>
        )}

        {/* Order again */}
        {order.status === 'delivered' && (
          <Link href={`/stores/${order.shop_id || order.business_id}`}
            style={{ display:'block', padding:'14px', borderRadius:16, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none', textAlign:'center', boxShadow:'0 8px 24px rgba(255,48,8,.3)' }}>
            Order again →
          </Link>
        )}
      </div>
    </div>
  )
}