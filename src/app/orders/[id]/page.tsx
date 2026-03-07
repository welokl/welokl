'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import ReviewModal from '@/components/ReviewModal'
import { DeliveryCountdown, OrderAgainButton } from '@/components/helpers'

const STATUS_FLOW: OrderStatus[] = ['placed','accepted','preparing','ready','picked_up','delivered']

export default function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder]         = useState<Order | null>(null)
  const [partner, setPartner]     = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)

  useEffect(() => {
    loadOrder()
    const supabase = createClient()
    const ch = supabase.channel(`order-track:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => loadOrder())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [id])

  async function loadOrder() {
    const supabase = createClient()
    const { data } = await supabase.from('orders').select('*, shop:shops(*), items:order_items(*)').eq('id', id).single()
    setOrder(data)
    if (data?.delivery_partner_id) {
      const [{ data: pu }, { data: pp }] = await Promise.all([
        supabase.from('users').select('id,name,phone').eq('id', data.delivery_partner_id).single(),
        supabase.from('delivery_partners').select('rating,total_deliveries,vehicle_type,current_lat,current_lng').eq('user_id', data.delivery_partner_id).single(),
      ])
      if (pu) setPartner({ ...pu, ...pp })
    } else { setPartner(null) }
    if (data?.status === 'delivered') {
      const { data: review } = await supabase.from('reviews').select('id').eq('order_id', id).single()
      setHasReviewed(!!review)
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16 }} />)}
      </div>
    </div>
  )
  if (!order) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Order not found</p>
        <Link href="/dashboard/customer" style={{ color: '#ff3008', fontSize: 14, textDecoration: 'none' }}>Go to dashboard</Link>
      </div>
    </div>
  )

  const currentStep = STATUS_FLOW.indexOf(order.status as OrderStatus)
  const isCancelled = ['cancelled','rejected'].includes(order.status)
  const isDelivered = order.status === 'delivered'
  const isPickedUp  = order.status === 'picked_up'
  const isActive    = !isCancelled && !isDelivered

  const card = { background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => window.history.back()} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)' }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>#{order.order_number}</h1>
          <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{(order as any).shop?.name}</p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: isDelivered ? 'rgba(34,197,94,0.15)' : isCancelled ? 'var(--red-bg)' : 'var(--brand-muted)', color: isDelivered ? '#16a34a' : isCancelled ? '#ef4444' : '#ff3008' }}>
          {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
        </span>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px' }}>

        {/* Delivered banner */}
        {isDelivered && (
          <div style={{ background: '#16a34a', borderRadius: 18, padding: '24px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontWeight: 900, fontSize: 18, color: '#fff', marginBottom: 4 }}>Order Delivered!</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Enjoy your order from {(order as any).shop?.name}</p>
            {!hasReviewed && (
              <button onClick={() => setShowReview(true)}
                style={{ marginTop: 14, background: '#fff', color: '#16a34a', fontWeight: 800, fontSize: 13, padding: '8px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                ⭐ Rate your experience
              </button>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div style={{ background: 'var(--red-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 18, padding: '24px 20px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>❌</div>
            <h2 style={{ fontWeight: 900, fontSize: 18, color: '#ef4444', marginBottom: 4 }}>Order {order.status === 'rejected' ? 'Rejected' : 'Cancelled'}</h2>
            <p style={{ fontSize: 13, color: '#ef4444', opacity: 0.8 }}>No charge was made for this order</p>
          </div>
        )}

        {/* Countdown */}
        {isPickedUp && order.picked_up_at && (
          <DeliveryCountdown pickedUpAt={order.picked_up_at} estimatedMinutes={order.estimated_delivery || 20} />
        )}

        {/* Partner card */}
        {partner && ['picked_up','delivered','ready','accepted','preparing'].includes(order.status) && (
          <div style={{ ...card, padding: '16px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, background: '#ff3008', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
                {partner.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{partner.name}</p>
                  {order.status === 'picked_up' && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.15)', color: '#16a34a', padding: '2px 8px', borderRadius: 999, animation: 'pulseDot 2s infinite' }}>On the way 🛵</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-3)' }}>
                  {partner.rating && <span>★ {partner.rating}</span>}
                  {partner.total_deliveries && <span>{partner.total_deliveries} deliveries</span>}
                  {partner.vehicle_type && <span>{partner.vehicle_type === 'bike' ? '🏍️' : '🛵'} {partner.vehicle_type}</span>}
                </div>
              </div>
              {partner.phone && (
                <a href={`tel:${partner.phone}`}
                  style={{ width: 44, height: 44, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, textDecoration: 'none', flexShrink: 0, boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}>
                  📞
                </a>
              )}
            </div>
            {order.status === 'picked_up' && (
              <p style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
                📍 {partner.name} has picked up your order and is heading your way
              </p>
            )}
          </div>
        )}

        {/* Waiting states */}
        {!partner && ['accepted','preparing'].includes(order.status) && order.type === 'delivery' && (
          <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, background: 'var(--bg-3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛵</div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Shop is preparing your order</p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>A rider will accept once order is ready for pickup</p>
            </div>
          </div>
        )}
        {!partner && order.status === 'ready' && order.type === 'delivery' && (
          <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, border: '2px solid rgba(234,88,12,0.3)', background: 'rgba(234,88,12,0.06)' }}>
            <div style={{ width: 40, height: 40, background: 'rgba(234,88,12,0.12)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🛵</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 14, color: '#c2410c' }}>Looking for a rider…</p>
              <p style={{ fontSize: 12, color: '#ea580c', opacity: 0.8, marginTop: 2 }}>Your order is packed and ready</p>
            </div>
          </div>
        )}

        {/* Status tracker */}
        {!isCancelled && (
          <div style={{ ...card, padding: '18px 16px', marginBottom: 14 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>
              {isActive ? '📡 Live Tracking' : '✅ Order Journey'}
            </p>
            {STATUS_FLOW.map((status, i) => {
              const done   = i <= currentStep
              const active = i === currentStep && !isDelivered
              return (
                <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: i < STATUS_FLOW.length - 1 ? 14 : 0, position: 'relative' }}>
                  {i < STATUS_FLOW.length - 1 && (
                    <div style={{ position: 'absolute', left: 14, top: 34, width: 2, height: 'calc(100% - 6px)', background: done && i < currentStep ? '#ff3008' : 'var(--border-2)', borderRadius: 99 }} />
                  )}
                  <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, zIndex: 1,
                    background: done ? '#ff3008' : 'var(--bg-3)', color: done ? '#fff' : 'var(--text-3)',
                    outline: active ? '3px solid rgba(255,48,8,0.25)' : 'none', outlineOffset: 2 }}>
                    {done && !active ? '✓' : ORDER_STATUS_ICONS[status]}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: done ? 'var(--text)' : 'var(--text-4)' }}>{ORDER_STATUS_LABELS[status]}</p>
                    {active && <p style={{ fontSize: 11, color: '#ff3008', fontWeight: 700, animation: 'pulseDot 2s infinite' }}>In progress…</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Delivery address */}
        {order.delivery_address && (
          <div style={{ ...card, padding: '16px', display: 'flex', gap: 14, marginBottom: 14 }}>
            <span style={{ fontSize: 20, marginTop: 2 }}>📍</span>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Delivering to</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{order.delivery_address}</p>
              {order.delivery_instructions && <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>💬 {order.delivery_instructions}</p>}
            </div>
          </div>
        )}

        {/* Order details */}
        <div style={{ ...card, padding: '18px 16px', marginBottom: 14 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 14 }}>Order Details</p>
          {order.items?.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>
              <span>{item.product_name} × {item.quantity}</span><span>₹{item.price * item.quantity}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 10 }}>
            {[
              { l: 'Subtotal', v: `₹${order.subtotal}` },
              { l: 'Delivery', v: order.delivery_fee === 0 ? 'FREE 🎉' : `₹${order.delivery_fee}`, green: order.delivery_fee === 0 },
              { l: 'Platform fee', v: `₹${order.platform_fee}` },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: r.green ? '#16a34a' : 'var(--text-3)', marginBottom: 6 }}>
                <span>{r.l}</span><span style={{ fontWeight: r.green ? 700 : 400 }}>{r.v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16, color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
              <span>Total</span><span>₹{order.total_amount}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-3)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <span>{order.payment_method === 'cod' ? '💵 Cash on Delivery' : '📲 UPI'}</span>
            <span>·</span>
            <span>{order.type === 'delivery' ? '🛵 Delivery' : '🏪 Self Pickup'}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          {isDelivered && order.items && (
            <OrderAgainButton shopId={order.shop_id} items={order.items.map(i => ({ product_id: i.product_id || '', quantity: i.quantity }))} />
          )}
          <Link href="/stores" style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: 13, background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            Browse shops
          </Link>
          <Link href="/dashboard/customer" style={{ flex: 1, textAlign: 'center', padding: '12px', borderRadius: 13, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
            My orders
          </Link>
        </div>
      </div>

      {showReview && order && (
        <ReviewModal orderId={order.id} shopId={order.shop_id} shopName={(order as any).shop?.name || 'Shop'} deliveryPartnerId={order.delivery_partner_id} onClose={() => { setShowReview(false); setHasReviewed(true) }} />
      )}
    </div>
  )
}