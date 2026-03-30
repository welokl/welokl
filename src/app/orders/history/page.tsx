'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import ReviewModal from '@/components/ReviewModal'

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
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all')
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set())
  const [reviewOrder, setReviewOrder] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }

      const { data, error } = await sb
        .from('orders')
        .select('id, status, total_amount, created_at, shop_id, delivery_partner_id, shop:shops(id, name, image_url), items:order_items(product_name, quantity)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })

      if (error) console.error('[orders]', error.message)
      const loaded = data || []
      setOrders(loaded)

      // Fetch which delivered orders already have reviews
      const deliveredIds = loaded.filter(o => o.status === 'delivered').map(o => o.id)
      if (deliveredIds.length) {
        const { data: reviews } = await sb.from('reviews').select('order_id').in('order_id', deliveredIds)
        if (reviews) setRatedIds(new Set(reviews.map((r: any) => r.order_id)))
      }
    } catch (e) {
      console.error('[orders] crash:', e)
    } finally {
      setLoading(false)
    }
  }

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

  const filtered = orders.filter(o => {
    if (filter === 'active')    return !['delivered','cancelled','rejected'].includes(o.status)
    if (filter === 'delivered') return o.status === 'delivered'
    if (filter === 'cancelled') return ['cancelled','rejected'].includes(o.status)
    return true
  })

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <style>{`
        @keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .sk{background:linear-gradient(90deg,var(--chip-bg) 25%,var(--page-bg) 50%,var(--chip-bg) 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:14px;}
      `}</style>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:10, background:'var(--chip-bg)', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>←</button>
          <h1 style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)', flex:1 }}>My Orders</h1>
          <span style={{ fontSize:13, color:'var(--text-muted)', fontWeight:600 }}>{orders.length} total</span>
        </div>
        {/* Filter tabs */}
        <div style={{ maxWidth:760, margin:'0 auto', display:'flex', overflowX:'auto', scrollbarWidth:'none' }}>
          {(['all','active','delivered','cancelled'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding:'10px 16px', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0, color:filter===f ? '#FF3008' : 'var(--text-muted)', borderBottom:`2px solid ${filter===f ? '#FF3008' : 'transparent'}`, textTransform:'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:760, margin:'0 auto', padding:'16px 12px' }}>

        {/* Skeletons */}
        {loading && [1,2,3].map(i => (
          <div key={i} className="sk" style={{ height:88, marginBottom:10 }} />
        ))}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'72px 20px' }}>
            <p style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', marginBottom:8 }}>
              {filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
            </p>
            <Link href="/stores" style={{ color:'#FF3008', fontWeight:700, textDecoration:'none' }}>Browse shops →</Link>
          </div>
        )}

        {/* Orders */}
        {!loading && filtered.map((o: any) => {
          const shop  = Array.isArray(o.shop) ? o.shop[0] : o.shop
          const items = o.items ?? []
          const canRate = o.status === 'delivered' && !ratedIds.has(o.id)
          return (
            <div key={o.id} style={{ background:'var(--card-white)', borderRadius:18, marginBottom:10, overflow:'hidden' }}>
              <Link href={`/orders/${o.id}`} style={{ display:'block', textDecoration:'none', padding:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:'var(--chip-bg)', overflow:'hidden', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {shop?.image_url
                      ? <img src={shop.image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <svg viewBox="0 0 24 24" fill="none" width={24} height={24}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--text-faint)" strokeWidth="2"/></svg>
                    }
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <strong style={{ color:'var(--text-primary)', fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {shop?.name ?? 'Shop'}
                      </strong>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:999, background:`${STATUS_COLOR[o.status]??'#888'}18`, color:STATUS_COLOR[o.status]??'#888', flexShrink:0 }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </div>
                    {items.length > 0 && (
                      <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {items.slice(0,2).map((i:any) => `${i.product_name} ×${i.quantity}`).join(', ')}
                        {items.length > 2 ? ` +${items.length-2} more` : ''}
                      </p>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontWeight:800, color:'var(--text-primary)', fontSize:14 }}>₹{o.total_amount}</span>
                      <span style={{ fontSize:11, color:'var(--text-faint)' }}>{timeAgo(o.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
              {canRate && (
                <div style={{ borderTop:'1px solid var(--divider)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color:'var(--text-muted)' }}>How was your order?</span>
                  <button onClick={() => setReviewOrder(o)}
                    style={{ padding:'7px 18px', borderRadius:12, background:'#FF3008', color:'#fff', fontWeight:800, fontSize:13, border:'none', cursor:'pointer' }}>
                    Rate ★
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {reviewOrder && (
          <ReviewModal
            orderId={reviewOrder.id}
            shopId={reviewOrder.shop_id}
            shopName={(Array.isArray(reviewOrder.shop) ? reviewOrder.shop[0] : reviewOrder.shop)?.name ?? 'Shop'}
            deliveryPartnerId={reviewOrder.delivery_partner_id ?? null}
            onClose={() => {
              setRatedIds(prev => new Set(Array.from(prev).concat(reviewOrder.id)))
              setReviewOrder(null)
            }}
          />
        )}
      </div>
      <BottomNav active="orders" />
    </div>
  )
}