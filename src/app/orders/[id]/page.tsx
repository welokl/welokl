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
  const [order, setOrder] = useState<Order | null>(null)
  const [partner, setPartner] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showReview, setShowReview] = useState(false)
  const [hasReviewed, setHasReviewed] = useState(false)

  useEffect(() => {
    loadOrder()
    const supabase = createClient()
    const channel = supabase.channel(`order-track:${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}`
      }, () => loadOrder())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id])

  async function loadOrder() {
    const supabase = createClient()
    const { data } = await supabase
      .from('orders')
      .select('*, shop:shops(*), items:order_items(*)')
      .eq('id', id)
      .single()

    setOrder(data)

    // Load delivery partner info if assigned
    if (data?.delivery_partner_id) {
      const { data: partnerUser } = await supabase
        .from('users')
        .select('id, name, phone')
        .eq('id', data.delivery_partner_id)
        .single()

      const { data: partnerProfile } = await supabase
        .from('delivery_partners')
        .select('rating, total_deliveries, vehicle_type, current_lat, current_lng')
        .eq('user_id', data.delivery_partner_id)
        .single()

      if (partnerUser) {
        setPartner({ ...partnerUser, ...partnerProfile })
      }
    } else {
      setPartner(null)
    }

    // Check review
    if (data?.status === 'delivered') {
      const { data: review } = await supabase.from('reviews').select('id').eq('order_id', id).single()
      setHasReviewed(!!review)
    }
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf7] p-6">
      <div className="max-w-md mx-auto space-y-4">
        {Array.from({length:4}).map((_,i) => <div key={i} className="h-20 card shimmer" />)}
      </div>
    </div>
  )

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="font-bold mb-2">Order not found</p>
        <Link href="/dashboard/customer" className="text-brand-500 text-sm">Go to dashboard</Link>
      </div>
    </div>
  )

  const currentStep = STATUS_FLOW.indexOf(order.status as OrderStatus)
  const isCancelled = ['cancelled','rejected'].includes(order.status)
  const isDelivered = order.status === 'delivered'
  const isPickedUp = order.status === 'picked_up'
  const isActive = !isCancelled && !isDelivered

  return (
    <div className="min-h-screen bg-[#fafaf7] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-xl text-lg">←</button>
        <div>
          <h1 className="font-bold text-sm">#{order.order_number}</h1>
          <p className="text-xs text-gray-400">{(order as any).shop?.name}</p>
        </div>
        <span className={`ml-auto badge status-${order.status} text-xs`}>
          {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">

        {/* Delivered banner */}
        {isDelivered && (
          <div className="bg-green-500 text-white rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="font-bold text-lg">Order Delivered!</h2>
            <p className="text-green-100 text-sm mt-1">Enjoy your order from {(order as any).shop?.name}</p>
            {!hasReviewed && (
              <button onClick={() => setShowReview(true)}
                className="mt-3 bg-white text-green-600 font-bold text-sm px-5 py-2 rounded-xl">
                ⭐ Rate your experience
              </button>
            )}
          </div>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">❌</div>
            <h2 className="font-bold text-lg text-red-700">Order {order.status === 'rejected' ? 'Rejected' : 'Cancelled'}</h2>
            <p className="text-red-500 text-sm mt-1">No charge was made for this order</p>
          </div>
        )}

        {/* Live countdown */}
        {isPickedUp && order.picked_up_at && (
          <DeliveryCountdown pickedUpAt={order.picked_up_at} estimatedMinutes={order.estimated_delivery || 20} />
        )}

        {/* Delivery partner card - KEY FIX */}
        {partner && ['picked_up', 'delivered', 'ready', 'accepted', 'preparing'].includes(order.status) && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 bg-brand-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                {partner.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm">{partner.name}</p>
                  {order.status === 'picked_up' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                      On the way 🛵
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {partner.rating && (
                    <span className="text-xs text-amber-600 font-semibold">★ {partner.rating}</span>
                  )}
                  {partner.total_deliveries && (
                    <span className="text-xs text-gray-400">{partner.total_deliveries} deliveries</span>
                  )}
                  {partner.vehicle_type && (
                    <span className="text-xs text-gray-400 capitalize">
                      {partner.vehicle_type === 'bike' ? '🏍️' : partner.vehicle_type === 'cycle' ? '🚲' : '🛵'} {partner.vehicle_type}
                    </span>
                  )}
                </div>
              </div>
              {/* Call button */}
              {partner.phone && (
                <a href={`tel:${partner.phone}`}
                  className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center text-white text-xl shadow-md hover:bg-green-600 active:scale-95 transition-all flex-shrink-0">
                  📞
                </a>
              )}
            </div>

            {order.status === 'picked_up' && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                <span>📍</span>
                <span>{partner.name} has picked up your order and is heading your way</span>
              </div>
            )}
          </div>
        )}

        {/* Waiting for partner */}
        {!partner && ['accepted', 'preparing'].includes(order.status) && order.type === 'delivery' && (
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center animate-pulse">🛵</div>
            <div>
              <p className="font-semibold text-sm">Shop is preparing your order</p>
              <p className="text-xs text-gray-400">A rider will accept once order is ready for pickup</p>
            </div>
          </div>
        )}
        {!partner && order.status === 'ready' && order.type === 'delivery' && (
          <div className="card p-4 flex items-center gap-3" style={{border:'1.5px solid #fed7aa',background:'#fff7ed'}}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl animate-bounce" style={{background:'#fff3ef'}}>🛵</div>
            <div>
              <p className="font-bold text-sm" style={{color:'#c2410c'}}>Looking for a rider...</p>
              <p className="text-xs" style={{color:'#ea580c'}}>Your order is packed and ready. A rider is on their way to accept.</p>
            </div>
          </div>
        )}

        {/* Status tracker */}
        {!isCancelled && (
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-4">
              {isActive ? '📡 Live Tracking' : '✅ Order Journey'}
            </h3>
            <div className="space-y-1">
              {STATUS_FLOW.map((status, i) => {
                const done = i <= currentStep
                const active = i === currentStep && !isDelivered
                return (
                  <div key={status} className="flex items-center gap-3 py-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all ${
                      done ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
                    } ${active ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}>
                      {done && !active ? '✓' : ORDER_STATUS_ICONS[status]}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-gray-400'}`}>
                        {ORDER_STATUS_LABELS[status]}
                      </p>
                      {active && <p className="text-xs text-brand-500 animate-pulse">In progress...</p>}
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`w-0.5 h-4 mx-auto mt-1 ${done && i < currentStep ? 'bg-brand-500' : 'bg-gray-200'}`}
                        style={{position:'relative', left:'-100%', marginLeft:'-0.75rem'}} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Delivery address */}
        {order.delivery_address && (
          <div className="card p-4 flex items-start gap-3">
            <span className="text-xl mt-0.5">📍</span>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivering to</p>
              <p className="text-sm font-semibold mt-0.5">{order.delivery_address}</p>
              {order.delivery_instructions && (
                <p className="text-xs text-gray-400 mt-1">💬 {order.delivery_instructions}</p>
              )}
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="card p-5">
          <h3 className="font-bold text-sm mb-3">Order Details</h3>
          <div className="space-y-2">
            {order.items?.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.product_name} × {item.quantity}</span>
                <span>₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{order.subtotal}</span></div>
            <div className="flex justify-between text-gray-500">
              <span>Delivery</span>
              <span>{order.delivery_fee === 0 ? <span className="text-green-600">FREE 🎉</span> : `₹${order.delivery_fee}`}</span>
            </div>
            <div className="flex justify-between text-gray-500"><span>Platform fee</span><span>₹{order.platform_fee}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
              <span>Total</span><span>₹{order.total_amount}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-500">
            <span>{order.payment_method === 'cod' ? '💵 Cash on Delivery' : '📲 UPI'}</span>
            <span>·</span>
            <span>{order.type === 'delivery' ? '🛵 Delivery' : '🏪 Self Pickup'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isDelivered && order.items && (
            <OrderAgainButton
              shopId={order.shop_id}
              items={order.items.map(i => ({ product_id: i.product_id || '', quantity: i.quantity }))}
            />
          )}
          <Link href="/stores" className="btn-secondary flex-1 text-center text-sm py-3">Browse shops</Link>
          <Link href="/dashboard/customer" className="btn-primary flex-1 text-center text-sm py-3">My orders</Link>
        </div>
      </div>

      {showReview && order && (
        <ReviewModal
          orderId={order.id}
          shopId={order.shop_id}
          shopName={(order as any).shop?.name || 'Shop'}
          deliveryPartnerId={order.delivery_partner_id}
          onClose={() => { setShowReview(false); setHasReviewed(true) }}
        />
      )}
    </div>
  )
}
