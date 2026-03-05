'use client'
import { useEffect, useState } from 'react'
import { useCustomerOrderAlerts, requestNotificationPermission } from '@/hooks/useOrderAlerts'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import NotificationSetup from '@/components/NotificationSetup'

export default function CustomerDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [alertsEnabled, setAlertsEnabled] = useState(false)

  // 🔔 Sound alert — fires on every order status change for this customer
  useCustomerOrderAlerts(user?.id)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }
    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('orders')
        .select('*, shop:shops(name, category_name), items:order_items(*)')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setUser(profile)
    setOrders(orderData || [])
    setLoading(false)
  }

  const activeOrders = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const pastOrders = orders.filter(o => ['delivered','cancelled','rejected'].includes(o.status))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 96, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '14px 16px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>Welcome back</p>
            <h1 className="font-bold text-lg">{user?.name || 'Customer'} 👋</h1>
          </div>
          <div className="flex items-center gap-2">
            {!alertsEnabled && (
              <button
                onClick={() => {
                  try { const A = window.AudioContext||(window as any).webkitAudioContext; if(A){const c=new A();c.resume();c.close()} } catch{}
                  requestNotificationPermission()
                  setAlertsEnabled(true)
                }}
                className="text-xs font-bold px-3 py-1.5 rounded-full border"
                style={{ background: '#fff8e1', color: '#f57f17', borderColor: '#ffe082' }}>🔔 Alerts</button>
            )}
            <Link href="/stores" className="btn-primary text-sm py-2">Order now →</Link>
            <button onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/' }}
              style={{ fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: '🍔', label: 'Food', href: '/stores?category=food' },
            { icon: '🛒', label: 'Grocery', href: '/stores?category=grocery' },
            { icon: '💊', label: 'Pharmacy', href: '/stores?category=pharmacy' },
            { icon: '🔍', label: 'Search', href: '/search' },
            { icon: '❤️', label: 'Saved', href: '/favourites' },
          ].map(a => (
            <Link key={a.label} href={a.href}>
              <div className="card p-3 text-center hover:shadow-md transition-all active:scale-95">
                <div className="text-2xl mb-1">{a.icon}</div>
                <div className="text-xs font-semibold">{a.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div>
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Active Orders
            </h2>
            <div className="space-y-3">
              {activeOrders.map(o => <OrderCard key={o.id} order={o} active />)}
            </div>
          </div>
        )}

        {/* Past orders */}
        <div>
          <h2 className="font-bold mb-3">Order History</h2>
          {loading ? (
            <div className="space-y-3">{Array.from({length:3}).map((_,i) => <div key={i} className="h-20 card shimmer" />)}</div>
          ) : pastOrders.length === 0 && activeOrders.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="text-4xl mb-3">🛍️</div>
              <p className="font-bold mb-1">No orders yet</p>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 16 }}>Find your favourite local shops and start ordering!</p>
              <Link href="/stores" className="btn-primary">Explore shops</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pastOrders.map(o => <OrderCard key={o.id} order={o} />)}
            </div>
          )}
        </div>
      </div>

      {user?.id && <NotificationSetup userId={user.id} />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card-bg)', borderTop: '1px solid var(--border)', zIndex: 50, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { icon: '🏠', label: 'Home', href: '/' },
            { icon: '🛍️', label: 'Shops', href: '/stores' },
            { icon: '❤️', label: 'Saved', href: '/favourites' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer', active: true },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl ${item.active ? 'text-brand-500' : 'text-gray-400'}`}>
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  return (
    <Link href={`/orders/${order.id}`}>
      <div className={`card p-4 hover:shadow-md transition-all active:scale-95 ${active ? 'border-brand-500 border-2' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-sm">{(order as any).shop?.name || 'Shop'}</p>
              {active && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''} · ₹{order.total_amount} · #{order.order_number}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'} · {order.type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}
            </p>
          </div>
          <span className={`badge status-${order.status} flex-shrink-0 text-xs`}>
            {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
        </div>
      </div>
    </Link>
  )
}