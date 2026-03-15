'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/store/cart'
import BottomNav from '@/components/BottomNav'

interface Order {
  id: string; order_number: string; status: string
  total_amount: number; type: string; payment_method?: string; created_at: string
  shop: { id?: string; name: string; image_url: string | null } | null
  items: { product_id: string; product_name: string; quantity: number; price: number }[]
}

const STATUS_COLOR: Record<string, string> = {
  placed:'#2563eb', accepted:'#7c3aed', preparing:'#d97706',
  ready:'#0891b2', picked_up:'#059669', delivered:'#16a34a',
  cancelled:'#ef4444', rejected:'#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  placed:'Placed', accepted:'Accepted', preparing:'Preparing',
  ready:'Ready', picked_up:'On the way', delivered:'Delivered',
  cancelled:'Cancelled', rejected:'Rejected',
}

export default function OrdersHistoryPage() {
  const router   = useRouter()
  const cart     = useCart()
  const [orders,     setOrders]     = useState<Order[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<'all'|'active'|'delivered'|'cancelled'>('all')
  const [reordering, setReordering] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const { data, error } = await sb
        .from('orders')
        .select('id, order_number, status, total_amount, type, payment_method, created_at, shop:shops(id, name, image_url), items:order_items(product_id, product_name, quantity, price)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[orders]', error.message)
        // Fallback: load without join
        const { data: plain } = await sb
          .from('orders')
          .select('id, order_number, status, total_amount, type, payment_method, created_at')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false })
        setOrders((plain || []).map((o: any) => ({ ...o, shop: null, items: [] })) as Order[])
      } else {
        setOrders((data || []) as Order[])
      }
    } catch (e) {
      console.error('[orders] crash:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleReorder(order: Order) {
    setReordering(order.id)
    try {
      const sb  = createClient()
      const shop = order.shop
      if (!shop?.id || !order.items?.length) return
      const ids = order.items.map(i => i.product_id).filter(Boolean)
      const { data: products } = await sb.from('products').select('id,name,price,image_url,is_available').in('id', ids)
      cart.clear()
      for (const item of order.items) {
        const p = products?.find(p => p.id === item.product_id)
        if (p && p.is_available !== false) {
          for (let q = 0; q < item.quantity; q++) {
            cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url }, shop.id!, shop.name)
          }
        }
      }
      router.push('/cart')
    } finally { setReordering(null) }
  }

  const filtered = orders.filter(o => {
    if (filter === 'active')    return !['delivered','cancelled','rejected'].includes(o.status)
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
    return new Date(date).toLocaleDateString('en-IN', { day:'numeric', month:'short' })
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80 }}>
      <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:14px;}`}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--chip-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
              <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1, letterSpacing:'-0.02em' }}>My Orders</h1>
          <span style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>{orders.length} total</span>
        </div>
        {/* Filter tabs */}
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', gap:0, overflowX:'auto', paddingBottom:1, scrollbarWidth:'none' }}>
          {(['all','active','delivered','cancelled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'10px 16px', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, color: filter === f ? '#FF3008' : 'var(--text-muted)', borderBottom:`2px solid ${filter === f ? '#FF3008' : 'transparent'}`, textTransform:'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'16px 12px' }}>

        {/* Skeletons */}
        {loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[1,2,3,4].map(i => <div key={i} className="sk" style={{ height:96 }} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'72px 20px' }}>
            <div style={{ width:80, height:80, background:'var(--chip-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={36} height={36}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/>
                <rect x="9" y="3" width="6" height="4" rx="2" stroke="var(--text-faint)" strokeWidth="2"/>
                <path d="M9 12h6M9 16h4" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', marginBottom:8, letterSpacing:'-0.02em' }}>
              {filter === 'all' ? "No orders yet" : `No ${filter} orders`}
            </p>
            <p style={{ fontSize:14, color:'var(--text-muted)', marginBottom:24 }}>
              {filter === 'all' ? "Browse local shops and place your first order" : "Orders will appear here"}
            </p>
            <Link href="/stores" style={{ display:'inline-block', padding:'13px 28px', borderRadius:16, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:15, textDecoration:'none' }}>
              Browse shops →
            </Link>
          </div>
        )}

        {/* Order cards */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(order => (
            <Link key={order.id} href={`/orders/${order.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--card-white)', borderRadius:20, padding:'16px', transition:'transform .15s' }}
                onTouchStart={e => (e.currentTarget.style.transform='scale(.99)')}
                onTouchEnd={e => (e.currentTarget.style.transform='scale(1)')}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  {/* Shop image */}
                  <div style={{ width:54, height:54, borderRadius:16, background:'var(--chip-bg)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {order.shop?.image_url
                      ? <img src={order.shop.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display='none' }} />
                      : <svg viewBox="0 0 24 24" fill="none" width={26} height={26}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--text-faint)" strokeWidth="2"/><polyline points="9 22 9 12 15 12 15 22" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/></svg>
                    }
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Shop name + status */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4, gap:8 }}>
                      <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {order.shop?.name || 'Shop'}
                      </p>
                      <span style={{ fontSize:11, fontWeight:700, color: STATUS_COLOR[order.status] || 'var(--text-muted)', background:`${STATUS_COLOR[order.status] || '#888'}18`, padding:'3px 8px', borderRadius:999, flexShrink:0 }}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>

                    {/* Items */}
                    <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {(order.items || []).slice(0,3).map(i => `${i.product_name} ×${i.quantity}`).join(', ')}
                      {(order.items||[]).length > 3 && ` +${order.items.length-3} more`}
                      {!order.items?.length && 'Order details'}
                    </p>

                    {/* Amount + time */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontWeight:900, fontSize:14, color:'var(--text-primary)' }}>₹{order.total_amount}</span>
                      <span style={{ fontSize:11, color:'var(--text-faint)' }}>{timeAgo(order.created_at)} · #{order.order_number}</span>
                    </div>
                  </div>
                </div>

                {/* Reorder button */}
                {order.status === 'delivered' && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--divider)', display:'flex', justifyContent:'flex-end' }}>
                    <button
                      onClick={e => { e.preventDefault(); handleReorder(order) }}
                      disabled={reordering === order.id}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, background:'var(--red-light)', border:'1.5px solid rgba(255,48,8,.2)', color:'#FF3008', fontWeight:800, fontSize:13, fontFamily:'inherit', cursor:'pointer' }}>
                      <svg viewBox="0 0 24 24" fill="none" width={14} height={14}>
                        <path d="M1 4v6h6M23 20v-6h-6" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {reordering === order.id ? 'Adding…' : 'Reorder'}
                    </button>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <BottomNav active="orders" />
    </div>
  )
}