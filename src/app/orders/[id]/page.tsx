'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, OrderStatus } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'

const STATUS_FLOW: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered']

export default function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel(`order:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => loadOrder()
      )
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
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf7] p-6">
      <div className="max-w-md mx-auto space-y-4">
        {Array.from({length:4}).map((_, i) => <div key={i} className="h-20 card shimmer" />)}
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
  const isCancelled = order.status === 'cancelled' || order.status === 'rejected'
  const isDelivered = order.status === 'delivered'

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl">←</button>
        <div>
          <h1 className="font-bold text-sm">Order #{order.order_number}</h1>
          <p className="text-xs text-gray-400">{order.shop?.name}</p>
        </div>
        <span className={`ml-auto badge status-${order.status}`}>
          {ORDER_STATUS_ICONS[order.status as OrderStatus]} {ORDER_STATUS_LABELS[order.status as OrderStatus]}
        </span>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">

        {/* Celebration / Cancel banner */}
        {isDelivered && (
          <div className="bg-green-500 text-white rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="font-bold text-lg">Order Delivered!</h2>
            <p className="text-green-100 text-sm mt-1">Enjoy your order from {order.shop?.name}</p>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="text-4xl mb-2">❌</div>
            <h2 className="font-bold text-lg text-red-700">Order {order.status === 'rejected' ? 'Rejected' : 'Cancelled'}</h2>
            <p className="text-red-500 text-sm mt-1">Refund will be processed if applicable</p>
          </div>
        )}

        {/* Status tracker */}
        {!isCancelled && (
          <div className="card p-5">
            <h3 className="font-bold text-sm mb-5">Live Tracking</h3>
            <div className="space-y-4">
              {STATUS_FLOW.map((status, i) => {
                const done = i <= currentStep
                const active = i === currentStep
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all ${
                      done ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
                    } ${active ? 'ring-2 ring-brand-500 ring-offset-2' : ''}`}>
                      {done ? (active ? ORDER_STATUS_ICONS[status] : '✓') : ORDER_STATUS_ICONS[status]}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${done ? 'text-ink' : 'text-gray-400'}`}>
                        {ORDER_STATUS_LABELS[status]}
                      </p>
                      {active && !isDelivered && (
                        <p className="text-xs text-brand-500 animate-pulse">In progress...</p>
                      )}
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`absolute left-[26px] mt-8 w-0.5 h-4 ${done && i < currentStep ? 'bg-brand-500' : 'bg-gray-200'}`} style={{position: 'relative', marginLeft: '-5.5rem'}} />
                    )}
                  </div>
                )
              })}
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
            <div className="flex justify-between text-gray-500"><span>Delivery</span><span>{order.delivery_fee === 0 ? 'FREE' : `₹${order.delivery_fee}`}</span></div>
            <div className="flex justify-between text-gray-500"><span>Platform fee</span><span>₹{order.platform_fee}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t border-gray-100 text-base"><span>Total</span><span>₹{order.total_amount}</span></div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
            <div>Payment: <span className="font-semibold capitalize">{order.payment_method === 'cod' ? '💵 Cash on Delivery' : '📲 UPI'}</span></div>
            {order.type === 'delivery' && order.delivery_address && (
              <div>Delivering to: <span className="font-semibold">{order.delivery_address}</span></div>
            )}
            {order.type === 'pickup' && <div>Type: <span className="font-semibold">🏪 Self Pickup</span></div>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/stores" className="btn-secondary flex-1 text-center text-sm py-3">Order again</Link>
          <Link href="/dashboard/customer" className="btn-primary flex-1 text-center text-sm py-3">My orders</Link>
        </div>
      </div>
    </div>
  )
}
