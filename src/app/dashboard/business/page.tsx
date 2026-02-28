'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Shop, Product, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'

type Tab = 'orders' | 'products' | 'analytics'

export default function BusinessDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [tab, setTab] = useState<Tab>('orders')
  const [loading, setLoading] = useState(true)
  const [showAddProduct, setShowAddProduct] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { window.location.href = '/auth/login'; return }
    const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
    setUser(profile)
    const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', authUser.id).single()
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
    loadData()
    const supabase = createClient()
    const channel = supabase.channel('biz-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadData])

  async function updateOrderStatus(orderId: string, status: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    await supabase.from('order_status_log').insert({ order_id: orderId, status, message: `Status: ${status}` })
    if (status === 'accepted' && shop) {
      await fetch('/api/orders/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, shopLat: shop.latitude, shopLng: shop.longitude }) })
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
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center p-6">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="font-bold text-xl mb-2">Set up your shop first</h2>
          <p className="text-gray-400 text-sm mb-6">Create your shop to start receiving orders.</p>
          <button onClick={() => window.location.href = '/shop/setup'} className="btn-primary w-full py-3">Set up my shop →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-400">Business Dashboard</p>
              <h1 className="font-bold text-lg">{shop?.name || 'My Shop'}</h1>
              <p className="text-xs text-gray-400">{shop?.area}, {shop?.city}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={async () => { const s = createClient(); await s.from('shops').update({ is_open: !shop?.is_open }).eq('id', shop?.id || ''); loadData() }}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border ${shop?.is_open ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {shop?.is_open ? '● Open' : '● Closed'}
              </button>
              <button onClick={async () => { const s = createClient(); await s.auth.signOut(); window.location.href = '/' }}
                className="text-xs text-gray-400 px-2">Logout</button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'New', value: newOrders.length, color: 'text-blue-600' },
              { label: 'Active', value: activeOrders.length, color: 'text-amber-600' },
              { label: 'Done', value: deliveredOrders.length, color: 'text-green-600' },
              { label: 'Earned', value: `₹${netEarnings}`, color: 'text-brand-500' },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <div className={`font-bold text-lg ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 px-4">
        <div className="max-w-4xl mx-auto flex">
          {(['orders','products','analytics'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-all ${tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500'}`}>
              {t}{t === 'orders' && newOrders.length > 0 && <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{newOrders.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5">

        {tab === 'orders' && (
          <div className="space-y-5">
            {newOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><h2 className="font-bold text-red-600">New Orders ({newOrders.length})</h2></div>
                <div className="space-y-3">
                  {newOrders.map(order => (
                    <div key={order.id} className="card p-4">
                      <div className="flex justify-between mb-2">
                        <span className="font-bold text-sm">#{order.order_number}</span>
                        <span className="font-bold">₹{order.total_amount}</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        <div>{(order as any).items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ')}</div>
                        <div className="mt-1">{order.payment_method === 'cod' ? '💵 COD' : '📲 UPI'} · {order.type === 'delivery' ? '🛵 Delivery' : '🏃 Pickup'}</div>
                        {order.delivery_address && <div>📍 {order.delivery_address}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateOrderStatus(order.id, 'accepted')} className="btn-primary text-sm py-2 flex-1">✓ Accept</button>
                        <button onClick={() => updateOrderStatus(order.id, 'rejected')} className="btn-secondary text-sm py-2 flex-1 text-red-500 border-red-200">✕ Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeOrders.length > 0 && (
              <div>
                <h2 className="font-bold text-amber-600 mb-3">Active ({activeOrders.length})</h2>
                <div className="space-y-3">
                  {activeOrders.map(order => {
                    const nextMap: Record<string, { label: string; next: string }> = {
                      accepted: { label: '👨‍🍳 Start Preparing', next: 'preparing' },
                      preparing: { label: '📦 Mark Ready', next: 'ready' },
                      ready: { label: '✓ Handed to Rider', next: 'picked_up' },
                    }
                    const a = nextMap[order.status]
                    return (
                      <div key={order.id} className="card p-4">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-sm">#{order.order_number}</span>
                          <span className={`badge status-${order.status} text-xs`}>{ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}</span>
                        </div>
                        <div className="text-xs text-gray-500 mb-3">{(order as any).items?.map((i: any) => `${i.product_name} ×${i.quantity}`).join(', ')}</div>
                        {a && <button onClick={() => updateOrderStatus(order.id, a.next)} className="btn-primary text-sm py-2 w-full">{a.label}</button>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {newOrders.length === 0 && activeOrders.length === 0 && (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-3">⏳</div>
                <p className="font-bold">No active orders</p>
                <p className="text-gray-400 text-sm mt-1">New orders appear here in real time</p>
              </div>
            )}
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Products ({products.length})</h2>
              <button onClick={() => setShowAddProduct(true)} className="btn-primary text-sm py-2 px-4">+ Add Product</button>
            </div>
            {products.length === 0 ? (
              <div className="card p-10 text-center">
                <div className="text-5xl mb-3">📦</div>
                <p className="font-bold mb-1">No products yet</p>
                <p className="text-gray-400 text-sm mb-4">Add products so customers can order from you</p>
                <button onClick={() => setShowAddProduct(true)} className="btn-primary px-6">Add first product</button>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map(p => (
                  <div key={p.id} className="card px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-brand-500">₹{p.price}</span>
                        {p.original_price && p.original_price > p.price && <span className="text-xs text-gray-400 line-through">₹{p.original_price}</span>}
                        {p.category && <span className="text-xs text-gray-400">· {p.category}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleProduct(p.id, !p.is_available)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${p.is_available ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${p.is_available ? 'translate-x-5' : ''}`} />
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Orders', value: deliveredOrders.length, icon: '📦' },
                { label: 'Gross Revenue', value: `₹${totalRevenue}`, icon: '💰' },
                { label: 'Your Earnings', value: `₹${netEarnings}`, icon: '🏦' },
              ].map(s => (
                <div key={s.label} className="card p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="font-bold text-2xl">{s.value}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="card p-5 text-sm space-y-2">
              <h3 className="font-bold mb-3">Breakdown</h3>
              <div className="flex justify-between text-gray-600"><span>Gross Revenue</span><span className="font-semibold">₹{totalRevenue}</span></div>
              <div className="flex justify-between text-red-500"><span>Commission ({shop?.commission_percent || 15}%)</span><span>-₹{commission}</span></div>
              <div className="flex justify-between font-bold text-green-700 border-t pt-2"><span>Your earnings</span><span>₹{netEarnings}</span></div>
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-lg">Add Product</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product name *</label>
            <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="input-field" placeholder="Butter Chicken, Amul Milk 1L..." required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => update('description', e.target.value)} className="input-field resize-none" rows={2} placeholder="Short description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Selling Price (₹) *</label>
              <input type="number" value={form.price} onChange={e => update('price', e.target.value)} className="input-field" placeholder="199" min="0" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Original Price (₹)</label>
              <input type="number" value={form.original_price} onChange={e => update('original_price', e.target.value)} className="input-field" placeholder="249" min="0" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
            <input type="text" value={form.category} onChange={e => update('category', e.target.value)} className="input-field" placeholder="Main Course, Dairy, Medicines..." />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
            <div className="flex gap-2">
              {[{ val: 'veg', label: '🟢 Veg' }, { val: 'nonveg', label: '🔴 Non-Veg' }, { val: '', label: 'N/A' }].map(o => (
                <button key={o.val} type="button" onClick={() => update('is_veg', o.val)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${form.is_veg === o.val ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}`}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div><p className="font-semibold text-sm">Available to order</p><p className="text-xs text-gray-400">Customers can add this to cart</p></div>
            <button type="button" onClick={() => update('is_available', !form.is_available)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_available ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.is_available ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div className="flex gap-3 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">{loading ? 'Adding...' : 'Add product'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
