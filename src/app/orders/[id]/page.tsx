'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const STATUS_STEPS = [
  { key:'placed',    label:'Order placed',        color:'#2563eb' },
  { key:'accepted',  label:'Accepted by shop',    color:'#7c3aed' },
  { key:'preparing', label:'Being prepared',      color:'#d97706' },
  { key:'ready',     label:'Ready for pickup',    color:'#0891b2' },
  { key:'picked_up', label:'Out for delivery',    color:'#059669' },
  { key:'delivered', label:'Delivered!',          color:'#16a34a' },
]

export default function OrderPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [order,     setOrder]   = useState<any>(null)
  const [partner,   setPartner] = useState<any>(null)
  const [loading,   setLoading] = useState(true)
  const [cancelling,setCancelling] = useState(false)

  // UUID validation — prevents Supabase query when id is 'history' or any non-UUID
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? '')

  useEffect(() => {
    if (!isValidUUID) return   // don't query Supabase with a non-UUID
    loadOrder()
    const sb = createClient()
    const ch = sb.channel(`order-track:${id}`)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders', filter:`id=eq.${id}` },
        () => loadOrder())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [id])

  async function loadOrder() {
    const sb = createClient()

    // Fetch order raw first — no joins that might fail
    const { data: raw, error } = await sb
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    console.log('[order-detail] raw:', raw?.id, error?.message)

    if (error || !raw) {
      console.error('[order-detail]', error)
      setOrder(null)
      setLoading(false)
      return
    }

    // Fetch related data separately
    const bizId  = raw.business_id
    const shopId = raw.shop_id

    const [bizRes, shopRes, itemsRes] = await Promise.all([
      bizId  ? sb.from('businesses').select('id,name,address,image_url,phone').eq('id', bizId).single()  : Promise.resolve({ data: null }),
      shopId ? sb.from('shops').select('id,name,area,image_url').eq('id', shopId).single() : Promise.resolve({ data: null }),
      sb.from('order_items').select('id,product_id,product_name,quantity,price').eq('order_id', raw.id),
    ])

    const enriched = {
      ...raw,
      business:    bizRes.data,
      shop:        shopRes.data,
      order_items: itemsRes.data ?? [],
    }

    console.log('[order-detail] enriched shop:', enriched.business?.name ?? enriched.shop?.name)
    setOrder(enriched)

    // Load delivery partner if assigned
    if (raw?.delivery_partner_id) {
      const [{ data: u }, { data: dp }] = await Promise.all([
        sb.from('users').select('name,phone').eq('id', raw.delivery_partner_id).single(),
        sb.from('delivery_partners').select('vehicle_type,rating').eq('user_id', raw.delivery_partner_id).single(),
      ])
      if (u) setPartner({ ...u, ...dp })
    }

    setLoading(false)
  }

  async function cancelOrder() {
    setCancelling(true)
    const sb = createClient()
    await sb.from('orders').update({ status:'cancelled' }).eq('id', id)
    loadOrder()
    setCancelling(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", padding:16 }}>
      <style>{`@keyframes sk{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--chip-bg) 25%,var(--page-bg) 50%,var(--chip-bg) 75%);background-size:400px 100%;animation:sk 1.4s infinite;border-radius:16px;}`}</style>
      <div style={{ maxWidth:560, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
        {[80,200,120,160,120].map((h,i) => <div key={i} className="sk" style={{ height:h }} />)}
      </div>
    </div>
  )

  if (!isValidUUID) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontWeight:800, fontSize:17, color:'var(--text-primary)', marginBottom:12 }}>Page not found</p>
        <a href="/orders/history" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>← Back to orders</a>
      </div>
    </div>
  )

  if (!order) return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontWeight:800, fontSize:17, color:'var(--text-primary)', marginBottom:12 }}>Order not found</p>
        <Link href="/orders/history" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>← Back to orders</Link>
      </div>
    </div>
  )

  const shopName  = order.business?.name || order.shop?.name || 'Shop'
  const shopArea  = order.shop?.area || order.business?.address || ''
  const stepIdx   = STATUS_STEPS.findIndex(s => s.key === order.status)
  const isCancelled = ['cancelled','rejected'].includes(order.status)
  const isActive    = !isCancelled && order.status !== 'delivered'
  const canCancel   = ['placed','accepted'].includes(order.status)

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
          {/* Live pulse for active orders */}
          {isActive && (
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:999, background:'var(--green-light)' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#16a34a', animation:'pulse 1.5s infinite' }} />
              <span style={{ fontSize:12, fontWeight:700, color:'#16a34a' }}>Live</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:560, margin:'0 auto', padding:'16px 12px', display:'flex', flexDirection:'column', gap:12 }}>

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
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>Contact support if you need help</p>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {STATUS_STEPS.map((step, idx) => {
                const done   = idx < stepIdx
                const active = idx === stepIdx
                const pending = idx > stepIdx
                return (
                  <div key={step.key} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                    {/* Dot + line */}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: done ? '#16a34a' : active ? '#fff' : 'var(--chip-bg)', border:`2px solid ${done ? '#16a34a' : active ? '#FF3008' : 'var(--divider)'}`, boxShadow: active ? '0 0 0 4px rgba(255,48,8,.12)' : 'none', transition:'all .3s' }}>
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
                    {/* Label */}
                    <div style={{ paddingTop:8, paddingBottom: idx < STATUS_STEPS.length - 1 ? 16 : 0, opacity: pending ? 0.38 : 1 }}>
                      <p style={{ fontWeight: active ? 800 : 600, fontSize:14, color: active ? '#FF3008' : done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {step.label}
                      </p>
                      {active && (
                        <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>In progress…</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Delivery partner */}
        {partner && (
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'16px 18px' }}>
            <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:12 }}>Delivery partner</p>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--blue-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="none" width={22} height={22}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke="#4f46e5" strokeWidth="2"/></svg>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)' }}>{partner.name}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)' }}>{partner.vehicle_type || 'Bike'} · ★ {partner.rating?.toFixed(1) || '4.5'}</p>
              </div>
              {partner.phone && (
                <a href={`tel:${partner.phone}`} style={{ width:40, height:40, borderRadius:12, background:'var(--green-light)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
                  <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginBottom:2 }}>ORDER FROM</p>
              <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)' }}>{shopName}</p>
              {shopArea && <p style={{ fontSize:12, color:'var(--text-muted)' }}>{shopArea}</p>}
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
          {(order.order_items || []).map((item: any) => (
            <div key={item.id || item.product_id} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:14 }}>
              <span style={{ color:'var(--text-secondary)' }}>{item.product_name} × {item.quantity}</span>
              <span style={{ fontWeight:700, color:'var(--text-primary)' }}>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px dashed var(--divider)', paddingTop:10, marginTop:6 }}>
            {[
              { label:'Delivery', val: order.delivery_fee > 0 ? `₹${order.delivery_fee}` : 'FREE', green: !order.delivery_fee },
              { label:'Platform fee', val:`₹${order.platform_fee || 0}` },
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

        {/* Cancel button */}
        {canCancel && (
          <button onClick={cancelOrder} disabled={cancelling}
            style={{ width:'100%', padding:'14px', borderRadius:16, border:'1.5px solid rgba(239,68,68,.3)', background:'var(--error-light)', color:'#ef4444', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
            {cancelling ? 'Cancelling…' : 'Cancel order'}
          </button>
        )}

        {/* Reorder */}
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