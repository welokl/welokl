'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  placed:    { bg: 'var(--blue-dim)',   color: 'var(--blue)' },
  accepted:  { bg: 'var(--green-dim)',  color: 'var(--green)' },
  preparing: { bg: 'var(--amber-dim)',  color: 'var(--amber)' },
  ready:     { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  picked_up: { bg: 'var(--brand-muted)', color: 'var(--brand)' },
  delivered: { bg: 'var(--green-dim)',  color: 'var(--green)' },
  cancelled: { bg: 'var(--red-dim)',    color: 'var(--red)' },
  rejected:  { bg: 'var(--red-dim)',    color: 'var(--red)' },
}

export default function CustomerDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  useEffect(() => {
    window.history.replaceState(null, '', '/dashboard/customer')
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { window.location.href = '/auth/login'; return }
      if (session?.user) loadData(session.user.id)
    })
    const channel = supabase.channel('customer-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
      .subscribe()
    return () => { subscription.unsubscribe(); supabase.removeChannel(channel) }
  }, [])

  async function loadData(userId?: string) {
    const supabase = createClient()
    const uid = userId || (await supabase.auth.getUser()).data.user?.id
    if (!uid) return
    const [{ data: profile }, { data: orderData }] = await Promise.all([
      supabase.from('users').select('*').eq('id', uid).single(),
      supabase.from('orders')
        .select('*, shop:shops(name, category_name, image_url), items:order_items(*)')
        .eq('customer_id', uid)
        .order('created_at', { ascending: false })
        .limit(30),
    ])
    setUser(profile)
    setOrders(orderData || [])
    setLoading(false)
  }

  const activeOrders = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const pastOrders = orders.filter(o => ['delivered','cancelled','rejected'].includes(o.status))

  const totalSpent = pastOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_amount, 0)
  const totalOrders = orders.filter(o => o.status === 'delivered').length

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>

      {/* ── HEADER ── */}
      <div className="glass sticky top-0 z-40" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm text-white"
              style={{ background: 'var(--brand)', boxShadow: '0 0 12px var(--brand-glow)' }}>W</Link>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-3)' }}>Welcome back</p>
              <h1 className="font-black text-base leading-none" style={{ color: 'var(--text)' }}>
                {user?.name || '...'} 👋
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/stores" className="btn-primary text-sm py-2 px-4">Order now →</Link>
            <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
              className="text-xs px-2 py-1.5 rounded-lg" style={{ color: 'var(--text-3)', background: 'var(--bg-3)' }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

        {/* ── STATS STRIP ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="font-black text-2xl gradient-text">{totalOrders}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Orders</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-black text-2xl gradient-text">₹{totalSpent}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Spent</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-black text-2xl" style={{ color: 'var(--green)' }}>
              {activeOrders.length > 0 ? activeOrders.length : '—'}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>Active</div>
          </div>
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div>
          <p className="text-xs font-black mb-3 uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Quick order</p>
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: '🍔', label: 'Food',     href: '/stores?category=food' },
              { icon: '🛒', label: 'Grocery',  href: '/stores?category=grocery' },
              { icon: '💊', label: 'Pharmacy', href: '/stores?category=pharmacy' },
              { icon: '🔍', label: 'Search',   href: '/search' },
              { icon: '❤️', label: 'Saved',    href: '/favourites' },
            ].map(a => (
              <Link key={a.label} href={a.href}>
                <div className="card p-3 text-center transition-all active:scale-95 cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <div className="text-xs font-bold" style={{ color: 'var(--text-2)' }}>{a.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── ACTIVE ORDERS BANNER ── */}
        {activeOrders.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,69,0,0.3)', background: 'var(--brand-muted)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,69,0,0.2)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
              <span className="text-sm font-black" style={{ color: 'var(--brand)' }}>{activeOrders.length} order{activeOrders.length > 1 ? 's' : ''} in progress</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'rgba(255,69,0,0.15)' }}>
              {activeOrders.map(o => <OrderCard key={o.id} order={o} active />)}
            </div>
          </div>
        )}

        {/* ── ORDER TABS ── */}
        <div>
          <div className="flex gap-1 mb-4 p-1 rounded-2xl" style={{ background: 'var(--bg-2)' }}>
            {(['active', 'history'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="flex-1 py-2 text-sm font-black rounded-xl capitalize transition-all"
                style={activeTab === t
                  ? { background: 'var(--bg-4)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }
                  : { color: 'var(--text-3)' }}>
                {t === 'active' ? `Active (${activeOrders.length})` : `History (${pastOrders.length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 shimmer rounded-2xl" />)}</div>
          ) : activeTab === 'active' ? (
            activeOrders.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-5xl mb-3">🛵</div>
                <p className="font-black mb-1">No active orders</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>Your live orders will appear here</p>
                <Link href="/stores" className="btn-primary text-sm px-6">Browse shops →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activeOrders.map(o => <OrderCard key={o.id} order={o} active />)}
              </div>
            )
          ) : (
            pastOrders.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-5xl mb-3">🛍️</div>
                <p className="font-black mb-1">No orders yet</p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>Find your favourite local shops</p>
                <Link href="/stores" className="btn-primary text-sm px-6">Explore shops →</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {pastOrders.map(o => <OrderCard key={o.id} order={o} />)}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
          {[
            { icon: '🏠', label: 'Home',   href: '/' },
            { icon: '🛍️', label: 'Shops',  href: '/stores' },
            { icon: '❤️', label: 'Saved',  href: '/favourites' },
            { icon: '📦', label: 'Orders', href: '/dashboard/customer', active: true },
          ].map(item => (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all">
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-bold" style={{ color: item.active ? 'var(--brand)' : 'var(--text-3)' }}>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ order, active }: { order: Order; active?: boolean }) {
  const sc = STATUS_COLORS[order.status] || STATUS_COLORS.placed
  const shop = (order as any).shop

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={`p-4 transition-all active:scale-[0.98] cursor-pointer ${active ? '' : 'card hover:border-white/10'}`}>
        <div className="flex items-start gap-3">
          {/* Shop icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ background: 'var(--bg-3)' }}>
            {shop?.image_url
              ? <img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" />
              : <span className="text-lg">🏪</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black text-sm truncate" style={{ color: 'var(--text)' }}>{shop?.name || 'Shop'}</p>
              <span className="flex-shrink-0 text-xs font-black px-2 py-1 rounded-full" style={sc}>
                {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''} · ₹{order.total_amount}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
              {order.payment_method === 'cod' ? '💵 Cash' : '📲 UPI'} · {order.type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'} · #{order.order_number}
            </p>
          </div>
        </div>
        {active && (
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold" style={{ color: 'var(--brand)' }}>
            <span className="animate-pulse">●</span> Tap to track live →
          </div>
        )}
      </div>
    </Link>
  )
}
