'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'

export default function CustomerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/auth/login'); return }

    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('orders').select('*, shop:shops(name, category_name), items:order_items(*)')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setUser(profile)
    setOrders(orderData || [])
    setLoading(false)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const activeOrders = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status))
  const pastOrders = orders.filter(o => ['delivered', 'cancelled', 'rejected'].includes(o.status))

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Welcome back</p>
            <h1 className="font-bold text-lg">{user?.name || 'Customer'} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/stores" className="btn-primary text-sm py-2">Order now →</Link>
            <button onClick={logout} className="btn-ghost text-sm text-gray-400">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: '🍔', label: 'Food', href: '/stores?category=food' },
            { icon: '🛒', label: 'Grocery', href: '/stores?category=grocery' },
            { icon: '💊', label: 'Pharmacy', href: '/stores?category=pharmacy' },
            { icon: '📱', label: 'Electronics', href: '/stores?category=electronics' },
          ].map(a => (
            <Link key={a.label} href={a.href}>
              <div className="card p-3 text-center hover:shadow-md transition-all cursor-pointer">
                <div className="text-2xl mb-1">{a.icon}</div>
                <div className="text-xs font-semibold">{a.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div>
            <h2 className="font-bold mb-3">Active Orders</h2>
            <div className="space-y-3">
              {activeOrders.map(order => <OrderCard key={order.id} order={order} active />)}
            </div>
          </div>
        )}

        {/* Past orders */}
        <div>
          <h2 className="font-bold mb-3">Order History</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({length:3}).map((_, i) => <div key={i} className="h-24 card shimmer" />)}
            </div>
          ) : pastOrders.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">🛍️</div>
              <p className="font-bold mb-1">No orders yet</p>
              <p className="text-gray-400 text-sm mb-4">Find your favourite local shops and start ordering!</p>
              <Link href="/stores" className="btn-primary">Explore shops</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pastOrders.map(order => <OrderCard key={order.id} order={order} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  const statusClass = `status-${order.status}`
  return (
    <Link href={`/orders/${order.id}`}>
      <div className={`card p-4 hover:shadow-md transition-all cursor-pointer ${active ? 'border-brand-500 border-2' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-sm">{(order as Order & { shop?: { name: string } }).shop?.name || 'Shop'}</p>
              {active && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </div>
            <p className="text-xs text-gray-400">
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''} · ₹{order.total_amount}
              · #{order.order_number}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'}
              · {order.type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}
            </p>
          </div>
          <span className={`badge ${statusClass} flex-shrink-0`}>
            {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
        </div>
      </div>
    </Link>
  )
}
