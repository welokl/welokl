'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import NotificationSetup from '@/components/NotificationSetup'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'

export default function CustomerDashboard() {
  const [user, setUser]       = useState<User | null>(null)
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('Welcome back')

  // 🔔 Sound + push notifications for order status changes
  useCustomerOrderAlerts(user?.id)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }

    // Role guard — non-customers must not use this dashboard
    const role = authUser.user_metadata?.role || 'customer'
    if (role === 'shopkeeper' || role === 'business') { window.location.replace('/dashboard/business'); return }
    if (role === 'delivery') { window.location.replace('/dashboard/delivery'); return }
    if (role === 'admin')    { window.location.replace('/dashboard/admin');    return }
    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('orders')
        .select('*, shop:shops(name,category_name), items:order_items(*)')
        .eq('customer_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setUser(profile); setOrders(orderData || []); setLoading(false)
  }, [])

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    loadData()
    const supabase = createClient()
    // Realtime: auto-refresh whenever any of the customer's orders change
    let customerId: string | null = null
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      customerId = u.id
      supabase
        .channel(`cust-rt-${u.id}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${u.id}` },
          () => loadData()
        )
        .subscribe()
    })
    return () => {
      if (customerId) {
        const sb = createClient()
        sb.channel(`cust-rt-${customerId}`).unsubscribe()
      }
    }
  }, [loadData])

  const activeOrders = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const pastOrders   = orders.filter(o => ['delivered','cancelled','rejected'].includes(o.status))
  const totalSpent   = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total_amount || 0), 0)

  const quickActions = [
    { icon: '🍔', label: 'Food',     href: '/stores?category=food',      color: '#fff1f0' },
    { icon: '🛒', label: 'Grocery',  href: '/stores?category=grocery',   color: '#f0fdf4' },
    { icon: '💊', label: 'Pharmacy', href: '/stores?category=pharmacy',  color: '#eff6ff' },
    { icon: '📱', label: 'Electr.',  href: '/stores?category=electronics', color: '#f5f3ff' },
    { icon: '❤️', label: 'Saved',    href: '/favourites',                 color: '#fdf2f8' },
    { icon: '🔍', label: 'Search',   href: '/search',                     color: 'var(--bg-1)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)', padding: '20px 16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: 2 }}>{greeting.toUpperCase()}</p>
              <h1 style={{ fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1 }}>{user?.name?.split(' ')[0] || 'Customer'} 👋</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link href="/stores" style={{ padding: '9px 18px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', boxShadow: '0 4px 14px rgba(255,48,8,0.35)' }}>
                Order now →
              </Link>
              <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Logout</button>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Orders',  value: orders.length },
              { label: 'Active',  value: activeOrders.length },
              { label: 'Spent',   value: `₹${totalSpent}` },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 8px', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>

        {/* Quick actions */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Quick Order</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            {quickActions.map(a => (
              <Link key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 6px', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 22, marginBottom: 5 }}>{a.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-2)' }}>{a.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />
              <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>Active Orders</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeOrders.map(o => <OrderCard key={o.id} order={o} active />)}
            </div>
          </div>
        )}

        {/* Order history */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 12 }}>Order History</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: 76, borderRadius: 16 }} />)}
            </div>
          ) : pastOrders.length === 0 && activeOrders.length === 0 ? (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 18, padding: '48px 20px', textAlign: 'center', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
              <p style={{ fontWeight: 900, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>No orders yet</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>Find your favourite local shops and start ordering!</p>
              <Link href="/stores" style={{ display: 'inline-block', padding: '10px 28px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                Explore shops
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pastOrders.map(o => <OrderCard key={o.id} order={o} />)}
            </div>
          )}
        </div>
      </div>

      {user?.id && <NotificationSetup userId={user.id} />}

      {/* Bottom nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--card-bg)', borderTop: '1px solid var(--border)', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', maxWidth: 480, margin: '0 auto' }}>
          {[
            { icon: '🏠', label: 'Home',   href: '/' },
            { icon: '🛍️', label: 'Shops',  href: '/stores' },
            { icon: '❤️', label: 'Saved',  href: '/favourites' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer', active: true },
          ].map(item => (
            <Link key={item.label} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 16px', borderRadius: 12, textDecoration: 'none', color: item.active ? '#ff3008' : 'var(--text-3)' }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  const statusCol = ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]
  return (
    <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--card-bg)', border: `${active ? '2px solid #ff3008' : '1px solid var(--border)'}`, borderRadius: 16, padding: '14px 16px', boxShadow: 'var(--card-shadow)', transition: 'all 0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{(order as any).shop?.name || 'Shop'}</p>
              {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulseDot 2s infinite' }} />}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''} · ₹{order.total_amount} · #{order.order_number}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'} · {order.type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}
            </p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, flexShrink: 0, background: active ? 'rgba(255,48,8,0.12)' : 'var(--bg-3)', color: active ? '#ff3008' : 'var(--text-2)' }}>
            {statusCol} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
        </div>
      </div>
    </Link>
  )
}