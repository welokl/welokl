'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  totalOrders: number
  deliveredOrders: number
  totalRevenue: number
  platformRevenue: number
  totalUsers: number
  totalShops: number
  todayOrders: number
}

interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
  subtotal: number
  commission_amount: number
  payment_method: string
  created_at: string
  shop: { name: string; commission_percent: number } | null
}

interface Shop {
  id: string
  name: string
  category_name: string
  is_active: boolean
  commission_percent: number
  rating: number
  total_orders: number
}

type Tab = 'overview' | 'orders' | 'shops' | 'users'

export default function AdminDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/auth/login'); return }

    // Verify admin
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    if (profile?.role !== 'admin') { router.push('/dashboard/customer'); return }

    const [{ data: orderData }, { data: shopData }, { count: userCount }] = await Promise.all([
      supabase.from('orders').select('*, shop:shops(name, commission_percent)').order('created_at', { ascending: false }).limit(100),
      supabase.from('shops').select('*'),
      supabase.from('users').select('id', { count: 'exact', head: true }),
    ])

    const allOrders = (orderData || []) as Order[]
    const today = new Date().toDateString()

    const deliveredOrders = allOrders.filter(o => o.status === 'delivered')
    const totalRevenue = deliveredOrders.reduce((s, o) => s + o.subtotal, 0)
    const platformRevenue = deliveredOrders.reduce((s, o) => {
      const commission = Math.round(o.subtotal * ((o.shop?.commission_percent || 15) / 100))
      return s + commission + 5 // commission + platform fee
    }, 0)

    setStats({
      totalOrders: allOrders.length,
      deliveredOrders: deliveredOrders.length,
      totalRevenue,
      platformRevenue,
      totalUsers: userCount || 0,
      totalShops: (shopData || []).length,
      todayOrders: allOrders.filter(o => new Date(o.created_at).toDateString() === today).length,
    })

    setOrders(allOrders.slice(0, 50))
    setShops(shopData || [])
    setLoading(false)
  }

  async function toggleShopActive(shopId: string, is_active: boolean) {
    const supabase = createClient()
    await supabase.from('shops').update({ is_active }).eq('id', shopId)
    loadData()
  }

  async function updateCommission(shopId: string, commission: number) {
    const supabase = createClient()
    await supabase.from('shops').update({ commission_percent: commission }).eq('id', shopId)
    loadData()
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const supabase = createClient()
    await supabase.from('orders').update({ status }).eq('id', orderId)
    loadData()
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const statusColors: Record<string, string> = {
    placed: 'badge-blue', accepted: 'badge-blue', preparing: 'badge-orange',
    ready: 'badge-orange', picked_up: 'badge-orange', delivered: 'badge-green',
    cancelled: 'badge-red', rejected: 'badge-red',
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="bg-[#0a0a0a] text-white px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs">Admin Console</p>
            <h1 className="font-bold text-xl font-display">Welokl Platform</h1>
          </div>
          <button onClick={logout} className="text-white/50 text-sm hover:text-white">Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4">
        <div className="max-w-6xl mx-auto flex gap-1">
          {(['overview', 'orders', 'shops', 'users'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold capitalize border-b-2 transition-all ${tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid sm:grid-cols-4 gap-4">
            {Array.from({length:8}).map((_, i) => <div key={i} className="h-24 card shimmer" />)}
          </div>
        ) : (

          <>
            {/* OVERVIEW */}
            {tab === 'overview' && stats && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Today\'s Orders', value: stats.todayOrders, icon: '📦', color: 'text-blue-600' },
                    { label: 'Total Orders', value: stats.totalOrders, icon: '🧾', color: 'text-gray-700' },
                    { label: 'GMV (Gross Revenue)', value: `₹${stats.totalRevenue}`, icon: '💰', color: 'text-green-600' },
                    { label: 'Platform Revenue', value: `₹${stats.platformRevenue}`, icon: '🏦', color: 'text-brand-500' },
                  ].map(s => (
                    <div key={s.label} className="card p-5">
                      <div className="text-2xl mb-2">{s.icon}</div>
                      <div className={`font-bold text-2xl ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Registered Users', value: stats.totalUsers, icon: '👥' },
                    { label: 'Active Shops', value: stats.totalShops, icon: '🏪' },
                    { label: 'Delivered Orders', value: stats.deliveredOrders, icon: '✅' },
                  ].map(s => (
                    <div key={s.label} className="card p-5 flex items-center gap-4">
                      <div className="text-3xl">{s.icon}</div>
                      <div>
                        <div className="font-bold text-2xl">{s.value}</div>
                        <div className="text-xs text-gray-400">{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card p-5">
                  <h3 className="font-bold text-sm mb-4">Revenue Breakdown</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Gross Merchandise Value (GMV)</span><span className="font-semibold">₹{stats.totalRevenue}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Business commissions (avg 15%)</span><span className="font-semibold text-brand-500">₹{Math.round(stats.totalRevenue * 0.15)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Platform fees (₹5 each × {stats.deliveredOrders})</span><span className="font-semibold text-brand-500">₹{stats.deliveredOrders * 5}</span></div>
                    <div className="flex justify-between font-bold pt-2 border-t"><span>Total Platform Revenue</span><span className="text-green-600">₹{stats.platformRevenue}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {tab === 'orders' && (
              <div>
                <h2 className="font-bold mb-4">All Orders</h2>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Order #', 'Shop', 'Amount', 'Payment', 'Status', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map(order => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs">{order.order_number}</td>
                          <td className="px-4 py-3 font-semibold">{order.shop?.name || '–'}</td>
                          <td className="px-4 py-3">₹{order.total_amount}</td>
                          <td className="px-4 py-3 capitalize">{order.payment_method}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${statusColors[order.status] || 'badge-gray'}`}>{order.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={order.status}
                              onChange={e => updateOrderStatus(order.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                            >
                              {['placed','accepted','preparing','ready','picked_up','delivered','cancelled'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SHOPS */}
            {tab === 'shops' && (
              <div>
                <h2 className="font-bold mb-4">Shops ({shops.length})</h2>
                <div className="space-y-3">
                  {shops.map(shop => (
                    <div key={shop.id} className="card p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{shop.name}</p>
                          <span className={`badge ${shop.is_active ? 'badge-green' : 'badge-red'}`}>{shop.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <p className="text-xs text-gray-400">{shop.category_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Commission %</label>
                        <input
                          type="number"
                          value={shop.commission_percent}
                          onChange={e => updateCommission(shop.id, parseFloat(e.target.value))}
                          className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1"
                          min="0" max="30" step="0.5"
                        />
                      </div>
                      <button
                        onClick={() => toggleShopActive(shop.id, !shop.is_active)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${shop.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {shop.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* USERS tab placeholder */}
            {tab === 'users' && (
              <div className="card p-8 text-center">
                <div className="text-4xl mb-3">👥</div>
                <p className="font-bold">User management</p>
                <p className="text-gray-400 text-sm mt-1">Manage users via Supabase dashboard for full control</p>
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-block">Open Supabase →</a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
