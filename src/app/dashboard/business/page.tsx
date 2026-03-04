'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Shop, Product, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'

type Tab = 'orders' | 'products' | 'analytics' | 'settings'

export default function BusinessDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tab, setTab] = useState<Tab>('orders')
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [actionError, setActionError] = useState('')

  const loadData = useCallback(async (userId?: string) => {
    const supabase = createClient()
    const uid = userId || (await supabase.auth.getUser()).data.user?.id
    if (!uid) return
    const { data: profile } = await supabase.from('users').select('*').eq('id', uid).single()
    if (!profile) return
    setUser(profile)
    const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', uid).single()
    if (!shopData) { setLoading(false); return }
    setShop(shopData)
    const [{ data: orderData }, { data: productData }] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(*)').eq('shop_id', shopData.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('products').select('*').eq('shop_id', shopData.id).order('sort_order'),
    ])
    setOrders(orderData || [])
    setProducts(productData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { window.location.href = '/auth/login'; return }
      if (session?.user) loadData(session.user.id)
    })
    const channel = supabase.channel('biz-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadData())
      .subscribe()
    return () => { subscription.unsubscribe(); supabase.removeChannel(channel) }
  }, [loadData])

  async function updateOrderStatus(orderId: string, status: string, currentOrder?: Order) {
    setActionError('')
    const supabase = createClient()

    // ── CRITICAL CHECKS ──
    // 1. Cannot hand to rider without a delivery partner assigned
    if (status === 'picked_up' && currentOrder) {
      if (!currentOrder.delivery_partner_id) {
        setActionError('Cannot mark as picked up — no delivery partner has been assigned yet. Wait for a partner to be assigned, or contact support.')
        return
      }
    }

    // 2. Cannot accept if shop is closed
    if (status === 'accepted' && shop && !shop.is_open) {
      setActionError('Your shop is marked as closed. Open your shop first before accepting orders.')
      return
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'accepted') updates.accepted_at = new Date().toISOString()

    await supabase.from('orders').update(updates).eq('id', orderId)
    await supabase.from('order_status_log').insert({
      order_id: orderId, status, message: `Status updated to ${status} by shop`
    })

    // Notify customer
    if (currentOrder?.customer_id) {
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, customerId: currentOrder.customer_id }),
      }).catch(() => {})
    }

    // NOTE: Delivery partners accept orders themselves — no auto-assign
    // When shop marks order "ready", it becomes visible to online delivery partners
    if (status === 'ready' && currentOrder?.type === 'delivery') {
      setActionError('') // clear any previous error
      // Order is now visible to all online delivery partners to accept
    }

    loadData()
  }

  async function toggleProduct(productId: string, is_available: boolean) {
    const supabase = createClient()
    await supabase.from('products').update({ is_available }).eq('id', productId)
    loadData()
  }

  async function deleteProduct(productId: string) {
    if (!confirm('Delete this product?')) return
    const supabase = createClient()
    await supabase.from('products').delete().eq('id', productId)
    loadData()
  }

  const newOrders = orders.filter(o => o.status === 'placed')
  const activeOrders = orders.filter(o => ['accepted','preparing','ready'].includes(o.status))
  const deliveredOrders = orders.filter(o => o.status === 'delivered')
  const totalRevenue = deliveredOrders.reduce((s, o) => s + o.subtotal, 0)
  const commission = Math.round(totalRevenue * ((shop?.commission_percent || 15) / 100))
  const netEarnings = totalRevenue - commission

  if (!loading && !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--paper)' }}>
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="font-black text-xl mb-2" style={{ fontFamily: 'Nunito' }}>Set up your shop</h2>
          <p className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>Create your shop to start receiving orders.</p>
          <button onClick={() => window.location.href = '/shop/setup'} className="btn-primary w-full py-3" style={{ borderRadius: '100px' }}>
            Set up my shop →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm"
                  style={{ background: 'linear-gradient(135deg, #ff5722, #e64a19)' }}>W</div>
                <div>
                  <h1 className="font-black text-base leading-none" style={{ color: 'var(--ink)', fontFamily: 'Nunito' }}>
                    {shop?.name || 'My Shop'}
                  </h1>
                  <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>{shop?.area}, {shop?.city}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const s = createClient()
                  await s.from('shops').update({ is_open: !shop?.is_open }).eq('id', shop?.id || '')
                  loadData()
                }}
                className="text-xs font-black px-3 py-1.5 rounded-full border-2 transition-all"
                style={shop?.is_open
                  ? { background: '#e8f5e9', color: '#2e7d32', borderColor: '#a5d6a7' }
                  : { background: '#ffebee', color: '#c62828', borderColor: '#ef9a9a' }}>
                {shop?.is_open ? '● Open' : '● Closed'}
              </button>
              <button onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/' }}
                className="btn-ghost text-sm">Logout</button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'New', value: newOrders.length, color: '#1565c0', bg: '#e3f2fd' },
              { label: 'Active', value: activeOrders.length, color: '#e65100', bg: '#fff8e1' },
              { label: 'Done', value: deliveredOrders.length, color: '#2e7d32', bg: '#e8f5e9' },
              { label: 'Earned', value: `₹${netEarnings}`, color: '#ff5722', bg: '#fff3ef' },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: s.bg }}>
                <div className="font-black text-lg leading-none" style={{ color: s.color, fontFamily: 'Nunito' }}>{s.value}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex border-t" style={{ borderColor: 'var(--border)' }}>
          {(['orders','products','analytics','settings'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setActionError('') }}
              className="px-5 py-3 text-sm font-black capitalize border-b-2 transition-all relative"
              style={tab === t
                ? { borderColor: 'var(--brand)', color: 'var(--brand)' }
                : { borderColor: 'transparent', color: 'var(--ink-soft)' }}>
              {t}
              {t === 'orders' && newOrders.length > 0 && (
                <span className="ml-1.5 text-white text-xs rounded-full px-1.5 py-0.5 font-black"
                  style={{ background: 'var(--brand)' }}>{newOrders.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {/* Action error banner */}
        {actionError && (
          <div className="mb-4 p-4 rounded-2xl border-2 flex items-start gap-3"
            style={{ background: '#fff3cd', borderColor: '#ffc107' }}>
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <p className="font-bold text-sm" style={{ color: '#856404' }}>{actionError}</p>
            </div>
            <button onClick={() => setActionError('')} className="ml-auto text-lg" style={{ color: '#856404' }}>✕</button>
          </div>
        )}

        {/* ORDERS */}
        {tab === 'orders' && (
          <div className="space-y-5">
            {newOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: 'var(--brand)' }} />
                  <h2 className="font-black" style={{ color: 'var(--brand)', fontFamily: 'Nunito' }}>New Orders ({newOrders.length})</h2>
                </div>
                <div className="space-y-3">
                  {newOrders.map(order => (
                    <div key={order.id} className="card p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="font-black text-sm" style={{ fontFamily: 'Nunito' }}>#{order.order_number}</span>
                          <div className="flex gap-2 mt-1">
                            <span className="status-placed">{order.type === 'delivery' ? '🛵 Delivery' : '🏃 Pickup'}</span>
                            <span className="status-placed">{order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'}</span>
                          </div>
                        </div>
                        <span className="font-black text-lg" style={{ color: 'var(--ink)', fontFamily: 'Nunito' }}>₹{order.total_amount}</span>
                      </div>
                      <div className="text-xs mb-3 p-3 rounded-xl" style={{ background: 'var(--surface)', color: 'var(--ink-soft)' }}>
                        {(order as any).items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ')}
                        {order.delivery_address && <div className="mt-1">📍 {order.delivery_address}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateOrderStatus(order.id, 'accepted', order)} className="btn-primary flex-1 text-sm py-2.5" style={{ borderRadius: '100px' }}>
                          ✓ Accept Order
                        </button>
                        <button onClick={() => updateOrderStatus(order.id, 'rejected', order)} className="btn-secondary flex-1 text-sm py-2.5" style={{ borderRadius: '100px', color: '#c62828', borderColor: '#ef9a9a' }}>
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeOrders.length > 0 && (
              <div>
                <h2 className="font-black mb-3" style={{ color: '#e65100', fontFamily: 'Nunito' }}>Active ({activeOrders.length})</h2>
                <div className="space-y-3">
                  {activeOrders.map(order => {
                    // Shop flow ends at "ready". Rider accepts order from their app.
                    // For pickup (no delivery): shop can mark delivered directly.
                    const nextMap: Record<string, { label: string; next: string; disabled?: boolean; disabledMsg?: string }> = {
                      accepted: { label: '👨‍🍳 Start Preparing', next: 'preparing' },
                      preparing: { label: '✅ Mark Ready for Pickup', next: 'ready' },
                      ...(order.type !== 'delivery' ? { ready: { label: '🤝 Handed to Customer', next: 'delivered' } } : {}),
                    }
                    const a = nextMap[order.status]
                    return (
                      <div key={order.id} className="card p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-black text-sm" style={{ fontFamily: 'Nunito' }}>#{order.order_number}</span>
                          <span className={`status-${order.status}`}>
                            {ORDER_STATUS_ICONS[order.status as keyof typeof ORDER_STATUS_ICONS]} {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                          </span>
                        </div>
                        <div className="text-xs mb-3" style={{ color: 'var(--ink-soft)' }}>
                          {(order as any).items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ')}
                          {order.type === 'delivery' && (
                            <div className="mt-1.5">
                              {order.delivery_partner_id
                                ? <div className="text-xs font-bold px-2 py-1.5 rounded-xl" style={{background:'#f0fdf4',color:'#16a34a'}}><PartnerName partnerId={order.delivery_partner_id} /></div>
                                : order.status === 'ready'
                                  ? <div className="text-xs font-bold px-2 py-1.5 rounded-xl animate-pulse" style={{background:'#fff7ed',color:'#ea580c'}}>⏳ Waiting for a rider to accept this order...</div>
                                  : <div className="text-xs text-gray-400">🛵 Riders will see this when you mark Ready</div>
                              }
                            </div>
                          )}
                        </div>
                        {a && (
                          <div>
                            {a.disabled && a.disabledMsg && (
                              <p className="text-xs mb-2 font-semibold" style={{ color: '#e65100' }}>⚠️ {a.disabledMsg}</p>
                            )}
                            <button
                              onClick={() => !a.disabled && updateOrderStatus(order.id, a.next, order)}
                              disabled={a.disabled}
                              className="w-full text-sm py-2.5 font-black rounded-full transition-all"
                              style={a.disabled
                                ? { background: '#f5f4f0', color: '#999', cursor: 'not-allowed' }
                                : { background: 'linear-gradient(135deg, #ff5722, #e64a19)', color: 'white', boxShadow: '0 4px 12px rgba(255,87,34,0.3)' }}>
                              {a.label}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {newOrders.length === 0 && activeOrders.length === 0 && (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-3">⏳</div>
                <p className="font-black text-lg" style={{ fontFamily: 'Nunito' }}>No active orders</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>New orders appear here in real time</p>
              </div>
            )}

            {deliveredOrders.slice(0,5).length > 0 && (
              <div>
                <h2 className="font-bold text-sm mb-2" style={{ color: 'var(--ink-soft)' }}>Completed</h2>
                <div className="space-y-2">
                  {deliveredOrders.slice(0,5).map(order => (
                    <div key={order.id} className="card px-4 py-3 flex justify-between items-center" style={{ opacity: 0.7 }}>
                      <span className="font-bold text-sm">#{order.order_number}</span>
                      <span className="font-bold text-sm" style={{ color: 'var(--ink-soft)' }}>₹{order.total_amount}</span>
                      <span className="status-delivered">✓ Delivered</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-black" style={{ fontFamily: 'Nunito' }}>Products ({products.length})</h2>
              <button onClick={() => setShowAddProduct(true)} className="btn-primary text-sm py-2 px-5" style={{ borderRadius: '100px' }}>
                + Add Product
              </button>
            </div>
            {products.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-5xl mb-3">📦</div>
                <p className="font-black mb-1" style={{ fontFamily: 'Nunito' }}>No products yet</p>
                <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>Add products so customers can order from you</p>
                <button onClick={() => setShowAddProduct(true)} className="btn-primary px-6" style={{ borderRadius: '100px' }}>Add first product</button>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="card px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-black text-sm" style={{ color: 'var(--brand)' }}>₹{p.price}</span>
                        {p.original_price && p.original_price > p.price && (
                          <span className="text-xs line-through" style={{ color: 'var(--ink-soft)' }}>₹{p.original_price}</span>
                        )}
                        {p.category && <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>· {p.category}</span>}
                      </div>
                    </div>
                    <button onClick={() => toggleProduct(p.id, !p.is_available)}
                      className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                      style={{ background: p.is_available ? 'var(--green)' : '#ddd' }}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${p.is_available ? 'translate-x-5' : ''}`} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="text-gray-300 hover:text-red-400 text-sm px-1 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS */}

        {tab === 'settings' && shop && (
          <ShopSettings shop={shop} onUpdate={loadData} />
        )}

        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Orders', value: deliveredOrders.length, icon: '📦', color: '#1565c0', bg: '#e3f2fd' },
                { label: 'Gross Revenue', value: `₹${totalRevenue}`, icon: '💰', color: '#2e7d32', bg: '#e8f5e9' },
                { label: 'Your Earnings', value: `₹${netEarnings}`, icon: '🏦', color: '#ff5722', bg: '#fff3ef' },
              ].map(s => (
                <div key={s.label} className="card p-5" style={{ borderLeft: `4px solid ${s.color}` }}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="font-black text-2xl" style={{ color: s.color, fontFamily: 'Nunito' }}>{s.value}</div>
                  <div className="text-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card p-5">
              <h3 className="font-black mb-4" style={{ fontFamily: 'Nunito' }}>Revenue Breakdown</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--ink-soft)' }}>Gross Revenue</span><span className="font-bold">₹{totalRevenue}</span></div>
                <div className="flex justify-between"><span style={{ color: '#c62828' }}>Platform commission ({shop?.commission_percent || 15}%)</span><span className="font-bold" style={{ color: '#c62828' }}>-₹{commission}</span></div>
                <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-black" style={{ color: '#2e7d32' }}>Your earnings</span>
                  <span className="font-black" style={{ color: '#2e7d32' }}>₹{netEarnings}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddProduct && shop && (
        <AddProductModal shopId={shop.id} onClose={() => setShowAddProduct(false)} onSuccess={() => { setShowAddProduct(false); loadData() }} />
      )}
    </div>
  )
}

function AddProductModal({ shopId, onClose, onSuccess }: { shopId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', price: '', original_price: '', category: '', is_veg: '', is_available: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  function update(field: string, value: string | boolean) { setForm(p => ({ ...p, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required'); return }
    if (!form.price || isNaN(Number(form.price))) { setError('Valid price required'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('products').insert({
      shop_id: shopId, name: form.name.trim(), description: form.description.trim() || null,
      price: parseInt(form.price), original_price: form.original_price ? parseInt(form.original_price) : null,
      category: form.category.trim() || null,
      is_veg: form.is_veg === 'veg' ? true : form.is_veg === 'nonveg' ? false : null,
      is_available: form.is_available,
    })
    if (err) { setError(err.message); setLoading(false); return }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-black text-lg" style={{ fontFamily: 'Nunito' }}>Add Product</h2>
          <button onClick={onClose} className="text-gray-400 text-xl w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Product name *</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="input-field" placeholder="Butter Chicken, Amul Milk..." required /></div>
          <div><label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} className="input-field resize-none" rows={2} placeholder="Short description..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Selling Price (₹) *</label>
              <input type="number" value={form.price} onChange={e => update('price', e.target.value)} className="input-field" placeholder="199" min="0" required /></div>
            <div><label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Original Price (₹)</label>
              <input type="number" value={form.original_price} onChange={e => update('original_price', e.target.value)} className="input-field" placeholder="249" min="0" /></div>
          </div>
          <div><label className="block text-sm font-bold mb-1.5" style={{ color: 'var(--ink)' }}>Category</label>
            <input type="text" value={form.category} onChange={e => update('category', e.target.value)} className="input-field" placeholder="Main Course, Dairy, Medicines..." /></div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--ink)' }}>Type</label>
            <div className="flex gap-2">
              {[{ val: 'veg', label: '🟢 Veg' }, { val: 'nonveg', label: '🔴 Non-Veg' }, { val: '', label: 'N/A' }].map(o => (
                <button key={o.val} type="button" onClick={() => update('is_veg', o.val)}
                  className="flex-1 py-2.5 rounded-2xl border-2 text-sm font-bold transition-all"
                  style={form.is_veg === o.val ? { borderColor: 'var(--brand)', background: 'var(--brand-pale)', color: 'var(--brand)' } : { borderColor: 'var(--border)', color: 'var(--ink-soft)' }}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--surface)' }}>
            <div><p className="font-bold text-sm">Available to order</p><p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Customers can add this to cart</p></div>
            <button type="button" onClick={() => update('is_available', !form.is_available)}
              className="relative w-12 h-6 rounded-full transition-all"
              style={{ background: form.is_available ? 'var(--green)' : '#ddd' }}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.is_available ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          {error && <div className="p-3 rounded-2xl text-sm font-semibold" style={{ background: 'var(--red-bg)', color: '#c62828' }}>{error}</div>}
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3" style={{ borderRadius: '100px' }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3" style={{ borderRadius: '100px' }}>
              {loading ? 'Adding...' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Shows delivery partner name when they accept an order
function PartnerName({ partnerId }: { partnerId: string }) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    createClient().from('users').select('name, phone').eq('id', partnerId).single()
      .then(({ data }) => setName(data ? `🛵 ${data.name} accepted · 📞 ${data.phone || ''}` : '✓ Rider assigned'))
  }, [partnerId])
  return <span>{name || '✓ Rider accepted...'}</span>
}

// ── Shop Settings Component ──
function ShopSettings({ shop, onUpdate }: { shop: any; onUpdate: () => void }) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    name: shop.name || '',
    description: shop.description || '',
    phone: shop.phone || '',
    opens_at: shop.opens_at || '09:00',
    closes_at: shop.closes_at || '22:00',
    min_order_amount: String(shop.min_order_amount || 0),
    avg_delivery_time: String(shop.avg_delivery_time || 30),
  })

  function up(f: string, v: string) { setForm(p => ({ ...p, [f]: v })) }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setMsg('Image must be under 3MB'); return }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function saveSettings() {
    setSaving(true); setMsg('')
    const supabase = createClient()
    let image_url = shop.image_url

    if (imageFile) {
      setUploading(true)
      const ext = imageFile.name.split('.').pop() || 'jpg'
      const path = `shops/${shop.id}/cover.${ext}`
      const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true })
      if (!uploadErr) {
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        image_url = data.publicUrl
      }
      setUploading(false)
    }

    const { error } = await supabase.from('shops').update({
      name: form.name,
      description: form.description || null,
      phone: form.phone || null,
      opens_at: form.opens_at,
      closes_at: form.closes_at,
      min_order_amount: parseInt(form.min_order_amount) || 0,
      avg_delivery_time: parseInt(form.avg_delivery_time) || 30,
      image_url,
    }).eq('id', shop.id)

    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('✓ Shop updated!')
    onUpdate()
  }

  return (
    <div className="space-y-5 max-w-lg">
      {/* Shop photo */}
      <div className="card p-5">
        <h3 className="font-black text-sm mb-3">Shop Cover Photo</h3>
        <label className="block cursor-pointer">
          {(imagePreview || shop.image_url) ? (
            <div className="relative rounded-2xl overflow-hidden mb-2">
              <img src={imagePreview || shop.image_url} alt="Shop" className="w-full h-40 object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
                <span className="text-white font-bold text-sm">📷 Change photo</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 mb-2 hover:border-orange-400 transition-colors" style={{ borderColor: '#e5e7eb', background: '#fafafa' }}>
              <span className="text-3xl">🏪</span>
              <span className="text-sm text-gray-400 font-medium">Add a cover photo</span>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
        </label>
        <p className="text-xs text-gray-400">Recommended: 800×400px · Max 3MB</p>
      </div>

      {/* Basic settings */}
      <div className="card p-5 space-y-4">
        <h3 className="font-black text-sm">Shop Info</h3>
        {[
          { f: 'name', l: 'Shop Name', ph: '' },
          { f: 'description', l: 'Description', ph: 'What do you sell?' },
          { f: 'phone', l: 'Phone Number', ph: '+91 98765 43210' },
        ].map(({ f, l, ph }) => (
          <div key={f}>
            <label className="block text-sm font-bold mb-1.5">{l}</label>
            <input value={(form as any)[f]} onChange={e => up(f, e.target.value)} className="input-field" placeholder={ph} />
          </div>
        ))}
      </div>

      {/* Hours & delivery */}
      <div className="card p-5 space-y-4">
        <h3 className="font-black text-sm">Hours & Delivery</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold mb-1.5">Opens at</label>
            <input type="time" value={form.opens_at} onChange={e => up('opens_at', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5">Closes at</label>
            <input type="time" value={form.closes_at} onChange={e => up('closes_at', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5">Min Order (₹)</label>
            <input type="number" value={form.min_order_amount} onChange={e => up('min_order_amount', e.target.value)} className="input-field" min="0" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1.5">Avg Delivery (min)</label>
            <input type="number" value={form.avg_delivery_time} onChange={e => up('avg_delivery_time', e.target.value)} className="input-field" min="5" />
          </div>
        </div>
      </div>

      {msg && <div className={`p-3 rounded-2xl text-sm font-bold ${msg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{msg}</div>}

      <button onClick={saveSettings} disabled={saving || uploading}
        className="w-full py-3.5 rounded-2xl font-black text-white text-sm active:scale-95 transition-all"
        style={{ background: '#ff5a1f', boxShadow: '0 4px 14px rgba(255,90,31,0.3)' }}>
        {uploading ? 'Uploading photo...' : saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
