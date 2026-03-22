'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useManagementAlerts } from '@/hooks/useOrderAlerts'
import { useFCM } from '@/hooks/useFCM'
import InAppToast from '@/components/InAppToast'

const card = { background: 'var(--card-bg)', borderRadius: 18, border: '1px solid var(--border)', padding: 20 }

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  placed:    { bg: 'rgba(59,130,246,0.15)',  text: '#3b82f6' },
  accepted:  { bg: 'rgba(34,197,94,0.15)',   text: '#16a34a' },
  preparing: { bg: 'rgba(245,158,11,0.15)',  text: '#d97706' },
  ready:     { bg: 'rgba(124,58,237,0.15)',  text: '#7c3aed' },
  picked_up: { bg: 'rgba(234,88,12,0.15)',   text: '#c2410c' },
  delivered: { bg: 'rgba(21,128,61,0.15)',   text: '#15803d' },
  cancelled: { bg: 'rgba(220,38,38,0.15)',   text: '#dc2626' },
  rejected:  { bg: 'rgba(220,38,38,0.15)',   text: '#dc2626' },
}

interface OrderRow {
  id: string
  order_number: string
  status: string
  total_amount: number
  type: string
  created_at: string
  customer: { name: string; phone: string } | null
  shop: { name: string } | null
}

export default function ManagementDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useFCM(userId)
  useManagementAlerts(userId)

  const load = useCallback(async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await sb.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'management') {
      const roleHome: Record<string, string> = {
        customer: '/dashboard/customer', business: '/dashboard/business',
        shopkeeper: '/dashboard/business', delivery_partner: '/dashboard/delivery',
        delivery: '/dashboard/delivery', admin: '/dashboard/admin',
      }
      window.location.replace(roleHome[profile?.role || ''] || '/dashboard/customer')
      return
    }

    setUserId(user.id)

    const { data } = await sb
      .from('orders')
      .select('id, order_number, status, total_amount, type, created_at, customer:users!customer_id(name, phone), shop:shops(name)')
      .order('created_at', { ascending: false })
      .limit(100)

    setOrders((data as any[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Realtime: prepend new orders without full reload
  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const ch = sb.channel('mgmt-orders-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async payload => {
        const o = payload.new as any
        const [{ data: customer }, { data: shop }] = await Promise.all([
          sb.from('users').select('name, phone').eq('id', o.customer_id).single(),
          sb.from('shops').select('name').eq('id', o.shop_id).single(),
        ])
        const row: OrderRow = { ...o, customer: customer || null, shop: shop || null }
        setOrders(prev => [row, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const n = payload.new as any
        setOrders(prev => prev.map(o => o.id === n.id ? { ...o, status: n.status } : o))
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [userId])

  const unresponded = orders.filter(o => o.status === 'placed')

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '24px 16px', maxWidth: 700, margin: '0 auto' }}>
      <InAppToast />

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Management</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Operations Feed</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>All incoming orders — you are notified for every new order</p>
      </div>

      {/* Unresponded alert */}
      {!loading && unresponded.length > 0 && (
        <div style={{ ...card, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.3)', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', margin: 0 }}>
            {unresponded.length} order{unresponded.length > 1 ? 's' : ''} waiting — no shop response yet
          </p>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unresponded.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>#{o.order_number}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>{o.shop?.name || '—'}</span>
                </div>
                {o.customer?.phone && (
                  <a href={`tel:${o.customer.phone}`}
                    style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: '#dc2626', padding: '5px 12px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    Call {o.customer.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)', fontSize: 14 }}>Loading...</div>
      ) : orders.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 14 }}>No orders yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(o => {
            const sc = STATUS_COLOR[o.status] || { bg: 'rgba(100,100,100,0.1)', text: 'var(--text-3)' }
            const t = new Date(o.created_at)
            return (
              <div key={o.id} style={{ ...card, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--text)' }}>#{o.order_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: sc.bg, color: sc.text }}>
                        {o.status.replace('_', ' ')}
                      </span>
                      {o.type === 'delivery' && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>delivery</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '5px 0 2px', fontWeight: 700 }}>
                      {o.shop?.name || '—'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                      {o.customer?.name || '—'}
                      {o.customer?.phone ? ` · ${o.customer.phone}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', margin: 0 }}>₹{o.total_amount}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '3px 0 0' }}>
                      {t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {o.customer?.phone && (
                      <a href={`tel:${o.customer.phone}`}
                        style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 800, color: '#fff', background: '#16a34a', padding: '4px 10px', borderRadius: 8, textDecoration: 'none' }}>
                        Call
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
