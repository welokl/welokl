'use client'
// src/app/dashboard/delivery/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PhoneGate } from '@/components/PhoneGate'
import toast from 'react-hot-toast'
import { Navigation, MapPin, Package, DollarSign, Phone } from 'lucide-react'
import type { Order, DeliveryPartner, Wallet } from '@/types'
import Navbar from '@/components/Navbar'

export default function DeliveryDashboard() {
  const [partner, setPartner] = useState<DeliveryPartner | null>(null)
  const [userId, setUserId]   = useState<string>('')
  const watchIdRef = useRef<number | null>(null)
  const [assignedOrder, setAssignedOrder] = useState<Order | null>(null)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showPhoneGate, setShowPhoneGate] = useState(false)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    setUserId(user.id)
    // Role guard — read from users table
    const { data: roleRow } = await supabase.from('users').select('role, phone').eq('id', user.id).single()
    if (!roleRow?.phone) setShowPhoneGate(true)
    const role = roleRow?.role || ''
    if (role === 'customer')                              { window.location.replace('/dashboard/customer'); return }
    if (role === 'business' || role === 'shopkeeper')     { window.location.replace('/dashboard/business'); return }
    if (role === 'admin')                                 { window.location.replace('/dashboard/admin');    return }

    const [{ data: partnerData }, { data: walletData }] = await Promise.all([
      supabase.from('delivery_partners').select('*, user:users(name)').eq('user_id', user.id).single(),
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
    ])

    setPartner(partnerData)
    if (partnerData?.is_online && partnerData?.id) startGPSWatch(partnerData.id)
    setWallet(walletData)

    if (partnerData) {
      // Find active assigned order
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('*, business:businesses(name, address, phone), customer:users(name, phone)')
        .eq('delivery_partner_id', partnerData.id)
        .in('status', ['accepted', 'preparing', 'ready', 'picked_up'])
        .single()

      setAssignedOrder(activeOrder)

      // Today's earnings
      const today = new Date().toISOString().split('T')[0]
      const { data: todayTxns } = await supabase
        .from('transactions')
        .select('amount')
        .eq('wallet_id', walletData?.id)
        .eq('type', 'credit')
        .gte('created_at', `${today}T00:00:00`)

      setTodayEarnings((todayTxns ?? []).reduce((s, t) => s + t.amount, 0))
    }

    setLoading(false)
  }, [supabase])

  // Cleanup GPS watch on unmount
  useEffect(() => { return () => stopGPSWatch() }, [])

  useEffect(() => {
    loadData()

    const channel = supabase
      .channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadData])


  // Continuously push rider GPS every time position changes
  const startGPSWatch = useCallback((partnerId: string) => {
    if (!navigator.geolocation) return
    if (watchIdRef.current !== null) return // already watching

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const sb = createClient()
        await sb.from('delivery_partners').update({
          current_lat:  pos.coords.latitude,
          current_long: pos.coords.longitude,
        }).eq('id', partnerId)
      },
      (err) => console.warn('[GPS]', err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }, [])

  const stopGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const toggleOnline = async () => {
    if (!partner) return

    const newOnline = !partner.is_online

    // Update DB first — don't wait for GPS
    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_online: newOnline })
      .eq('user_id', userId)

    if (error) {
      console.error('[toggle] error:', error.message, error.code)
      toast.error('Could not update status: ' + error.message)
      return
    }

    setPartner({ ...partner, is_online: newOnline })
    toast.success(newOnline ? 'You are now online!' : 'You are now offline')

    // Update GPS in background if going online
    if (newOnline) {
      startGPSWatch(partner.id)
      navigator.geolocation?.getCurrentPosition(pos => {
        supabase.from('delivery_partners').update({
          current_lat: pos.coords.latitude,
          current_long: pos.coords.longitude,
        }).eq('id', partner.id).then(() => {})
      }, () => {}) // GPS optional — don't block toggle
    } else {
      stopGPSWatch()
    }
  }

  const updateOrderStatus = async (status: 'picked_up' | 'delivered') => {
    if (!assignedOrder || !partner) return

    const { error } = await supabase
      .from('orders')
      .update({ status, ...(status === 'delivered' ? { delivered_at: new Date().toISOString() } : { picked_up_at: new Date().toISOString() }) })
      .eq('id', assignedOrder.id)

    if (error) { toast.error('Failed to update'); return }

    // On delivery complete, credit wallet
    if (status === 'delivered') {
      await fetch('/api/orders/complete-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: assignedOrder.id, partnerId: partner.id }),
      })
      toast.success(`Delivery complete! ₹${(assignedOrder as any).partner_payout} added to wallet 💰`)
    }

    loadData()
  }

  if (loading) return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-10 animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-surface-200 rounded-3xl" />)}
      </div>
    </div>
  )

  return (
    <>
    {showPhoneGate && userId && <PhoneGate userId={userId} onDone={() => setShowPhoneGate(false)} />}
    <div className="min-h-screen bg-surface-50">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Online toggle */}
        <div className={`card p-6 ${partner?.is_online ? 'border-2 border-green-200 bg-green-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-surface-950">
                {partner?.is_online ? 'You\'re online' : 'You\'re offline'}
              </h2>
              <p className="text-surface-400 text-sm mt-1">
                {partner?.is_online ? 'Waiting for orders...' : 'Go online to receive deliveries'}
              </p>
            </div>
            <button
              onClick={toggleOnline}
              style={{
                width: 64, height: 34, borderRadius: 999, border: 'none', cursor: 'pointer',
                padding: 3, transition: 'background .25s',
                background: partner?.is_online ? '#16a34a' : '#d1d5db',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                display: 'flex', alignItems: 'center',
              }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', background: '#fff',
                display: 'block', boxShadow: '0 2px 6px rgba(0,0,0,.2)',
                transform: partner?.is_online ? 'translateX(30px)' : 'translateX(0)',
                transition: 'transform .25s',
              }} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="font-display font-bold text-xl text-surface-950">₹{todayEarnings.toFixed(0)}</div>
            <div className="text-surface-400 text-xs mt-1">Today</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-display font-bold text-xl text-surface-950">₹{wallet?.balance.toFixed(0) ?? 0}</div>
            <div className="text-surface-400 text-xs mt-1">Wallet</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-display font-bold text-xl text-surface-950">{partner?.total_deliveries ?? 0}</div>
            <div className="text-surface-400 text-xs mt-1">Deliveries</div>
          </div>
        </div>

        {/* Active order */}
        {assignedOrder ? (
          <div className="card p-6 border-2 border-brand-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Active delivery</h3>
              <span className={`status-${assignedOrder.status}`}>{assignedOrder.status.replace('_', ' ')}</span>
            </div>

            {/* Pickup */}
            <div className="space-y-3 mb-5">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={16} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Pickup from</p>
                  <p className="text-surface-500 text-sm">{((assignedOrder as any).business as any)?.name}</p>
                  <p className="text-surface-400 text-xs">{((assignedOrder as any).business as any)?.address}</p>
                </div>
                {((assignedOrder as any).business as any)?.phone && (
                  <a href={`tel:${((assignedOrder as any).business as any).phone}`}
                    className="p-2 bg-surface-100 rounded-xl hover:bg-surface-200 transition-colors">
                    <Phone size={16} className="text-surface-400" />
                  </a>
                )}
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin size={16} className="text-brand-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Deliver to</p>
                  <p className="text-surface-500 text-sm">{((assignedOrder as any).customer as any)?.name}</p>
                  <p className="text-surface-400 text-xs">{assignedOrder.delivery_address}</p>
                </div>
                {((assignedOrder as any).customer as any)?.phone && (
                  <a href={`tel:${((assignedOrder as any).customer as any).phone}`}
                    className="p-2 bg-surface-100 rounded-xl hover:bg-surface-200 transition-colors">
                    <Phone size={16} className="text-surface-400" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 p-3 bg-surface-50 rounded-2xl">
              <span className="text-surface-500 text-sm">Your earnings</span>
              <span className="font-bold text-brand-500">₹{(assignedOrder as any).partner_payout}</span>
            </div>

            <div className="flex gap-3">
              {['ready', 'accepted', 'preparing'].includes(assignedOrder.status) && (
                <button onClick={() => updateOrderStatus('picked_up')}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 rounded-2xl transition-colors">
                  <Navigation size={18} /> Picked up!
                </button>
              )}
              {assignedOrder.status === 'picked_up' && (
                <button onClick={() => updateOrderStatus('delivered')}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-2xl transition-colors">
                  <DollarSign size={18} /> Mark delivered
                </button>
              )}
            </div>
          </div>
        ) : (
          partner?.is_online && (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-3">🚴</div>
              <p className="font-semibold text-surface-700">You&apos;re online</p>
              <p className="text-surface-400 text-sm mt-1">Waiting for an order to be assigned...</p>
            </div>
          )
        )}
      </div>
    </div>
    </>
  )
}