'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Order {
  id: string; order_number: string; status: string
  total_amount: number; type: string; created_at: string
  shop: { name: string; image_url: string | null } | null
  items: { product_name: string; quantity: number }[]
}

const STATUS_COLOR: Record<string, string> = {
  placed: '#2563eb', accepted: '#7c3aed', preparing: '#d97706',
  ready: '#0891b2', picked_up: '#059669', delivered: '#16a34a',
  cancelled: '#ef4444', rejected: '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  placed: 'Placed', accepted: 'Accepted', preparing: 'Preparing',
  ready: 'Ready', picked_up: 'On the way', delivered: 'Delivered',
  cancelled: 'Cancelled', rejected: 'Rejected',
}

export default function OrdersHistoryPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all')

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const { data } = await sb.from('orders')
      .select('id, order_number, status, total_amount, type, created_at, shop:shops(name, image_url), items:order_items(product_name, quantity)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    setOrders((data || []) as Order[])
    setLoading(false)
  }

  const filtered = orders.filter(o => {
    if (filter === 'active') return !['delivered','cancelled','rejected'].includes(o.status)
    if (filter === 'delivered') return o.status === 'delivered'
    if (filter === 'cancelled') return ['cancelled','rejected'].includes(o.status)
    return true
  })

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes sp{to{transform:rotate(360deg)}}@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:14px;}`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-3)', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#8592;</button>
          <h1 style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', flex: 1 }}>My Orders</h1>
          <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{orders.length} total</span>
        </div>
        {/* Filter tabs */}
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 1 }}>
          {(['all','active','delivered','cancelled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '10px 16px', fontWeight: 700, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, color: filter === f ? '#ff3008' : 'var(--text-3)', borderBottom: `2px solid ${filter === f ? '#ff3008' : 'transparent'}`, textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height: 100 }} />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📦</div>
            <p style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 8 }}>No orders yet</p>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 24 }}>
              {filter === 'all' ? "You haven't placed any orders" : `No ${filter} orders`}
            </p>
            <Link href="/stores" style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 12, background: '#ff3008', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
              Browse shops
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(order => (
            <Link key={order.id} href={`/orders/${order.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px', cursor: 'pointer', transition: 'box-shadow .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,.1)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Shop logo */}
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-3)', border: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {order.shop?.image_url
                      ? <img src={order.shop.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                      : <span style={{ fontSize: 24 }}>🏪</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.shop?.name || 'Shop'}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[order.status] || '#888', background: `${STATUS_COLOR[order.status]}18`, padding: '3px 8px', borderRadius: 999, flexShrink: 0, marginLeft: 8 }}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.items.slice(0, 3).map(i => `${i.product_name} x${i.quantity}`).join(', ')}
                      {order.items.length > 3 && ` +${order.items.length - 3} more`}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>&#8377;{order.total_amount}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{timeAgo(order.created_at)} · #{order.order_number}</span>
                    </div>
                  </div>
                </div>
                {/* Reorder button for delivered orders */}
                {order.status === 'delivered' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ff3008' }}>Reorder &#8594;</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}