'use client'
// src/app/dashboard/delivery/page.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PhoneGate } from '@/components/PhoneGate'
import { Navigation, MapPin, Package, DollarSign, Phone, Clock, TrendingUp } from 'lucide-react'
import type { Order, DeliveryPartner, Wallet } from '@/types'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { useVisibilityReconnect } from '@/hooks/useOrderAlerts'

export default function DeliveryDashboard() {
  const [partner, setPartner] = useState<DeliveryPartner | null>(null)
  const [userId, setUserId]   = useState<string>('')
  const watchIdRef = useRef<number | null>(null)
  const [assignedOrder, setAssignedOrder] = useState<Order | null>(null)
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [showPhoneGate, setShowPhoneGate] = useState(false)
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [verStatus, setVerStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [verNote, setVerNote]     = useState<string | null>(null)
  const [partnerPayout, setPartnerPayout] = useState(20)
  const [riderPos, setRiderPos] = useState<{ lat: number; lng: number } | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<any>(null)
  const riderMarkerRef = useRef<any>(null)
  const supabase = createClient()

  const notify = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type })
    setTimeout(() => setNotification(null), 5000)
  }, [])

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    setUserId(user.id)

    // Load partner payout from platform config
    supabase.from('platform_config').select('key,value').eq('key', 'partner_payout').single()
      .then(({ data }) => { if (data?.value) setPartnerPayout(Number(data.value)) })

    // Role guard
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
    setVerStatus((partnerData as any)?.verification_status ?? 'pending')
    setVerNote((partnerData as any)?.verification_note ?? null)
    if (partnerData?.current_lat && partnerData?.current_long) {
      setRiderPos({ lat: partnerData.current_lat, lng: partnerData.current_long })
    }
    if (partnerData?.is_online && partnerData?.id) startGPSWatch(partnerData.id)
    setWallet(walletData)

    if (partnerData) {
      // Find active assigned order (joined with shops, not businesses)
      const { data: activeOrder } = await supabase
        .from('orders')
        .select('*, shop:shops(name, address, phone, latitude, longitude), customer:users!customer_id(name, phone)')
        .eq('delivery_partner_id', user.id)
        .in('status', ['accepted', 'preparing', 'ready', 'picked_up'])  // includes preparing — pre-assigned rider sees order early
        .maybeSingle()

      setAssignedOrder(activeOrder)

      // Fetch available orders — show 'preparing' AND 'ready' with no rider assigned
      // so all nearby riders see the request as soon as the shop starts preparing
      if (partnerData.is_online && !activeOrder) {
        const { data: readyOrders } = await supabase
          .from('orders')
          .select('*, shop:shops(name, address, phone, latitude, longitude), customer:users!customer_id(name, phone)')
          .in('status', ['preparing', 'ready'])
          .is('delivery_partner_id', null)
          .eq('type', 'delivery')
          .order('created_at', { ascending: false })
          .limit(10)

        setAvailableOrders(readyOrders ?? [])
      } else {
        setAvailableOrders([])
      }

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

  // Cleanup GPS watch and map on unmount
  useEffect(() => { return () => { stopGPSWatch(); leafletRef.current?.remove() } }, [])

  // Re-fetch when app comes back from background (phone lock / tab switch)
  useVisibilityReconnect(loadData)

  useEffect(() => {
    loadData()

    // Unique channel per user so multiple riders don't share a channel
    const channelId = `delivery-orders-${Date.now()}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_partners' }, loadData)
      .subscribe()

    // Polling fallback: if realtime misses an event (websocket gap), refresh every 20s
    const poll = setInterval(loadData, 20_000)

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [loadData])

  // Init Leaflet map when active order is assigned
  useEffect(() => {
    if (!assignedOrder || !mapRef.current || leafletRef.current) return

    const shopLat = (assignedOrder as any).shop?.latitude as number | null
    const shopLng = (assignedOrder as any).shop?.longitude as number | null
    const destLat = assignedOrder.delivery_lat as number | null
    const destLng = (assignedOrder as any).delivery_lng as number | null

    if (!shopLat && !destLat) return

    if (!document.querySelector('link[href*="leaflet@1.9.4"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    const doInit = () => {
      const L = (window as any).L
      if (!mapRef.current || leafletRef.current) return

      const center: [number, number] = shopLat && shopLng ? [shopLat, shopLng] : [destLat!, destLng!]
      const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 14)
      leafletRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      const points: [number, number][] = []

      // Shop pin — orange (pickup)
      if (shopLat && shopLng) {
        const icon = L.divIcon({
          html: `<div style="width:38px;height:38px;background:#FF3008;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(255,48,8,.5);"></div>`,
          className: '', iconSize: [38, 38], iconAnchor: [19, 38],
        })
        L.marker([shopLat, shopLng], { icon }).addTo(map)
          .bindPopup('Pickup: ' + ((assignedOrder as any).shop?.name || 'Shop'))
        points.push([shopLat, shopLng])
      }

      // Customer destination pin — green
      if (destLat && destLng) {
        const icon = L.divIcon({
          html: `<div style="width:34px;height:34px;background:#16a34a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(22,163,74,.5);"></div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 34],
        })
        L.marker([destLat, destLng], { icon }).addTo(map)
          .bindPopup('Deliver to: ' + ((assignedOrder as any).customer?.name || 'Customer'))
        points.push([destLat, destLng])
      }

      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [50, 50] })
      else if (points.length === 1) map.setView(points[0], 15)

      setMapReady(true)
    }

    if ((window as any).L) {
      doInit()
    } else {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = doInit
      document.head.appendChild(script)
    }
  }, [assignedOrder])

  // Clean up map when order is completed/cleared
  useEffect(() => {
    if (!assignedOrder && leafletRef.current) {
      leafletRef.current.remove()
      leafletRef.current = null
      riderMarkerRef.current = null
      setMapReady(false)
    }
  }, [assignedOrder])

  // Add/update rider marker as GPS updates
  useEffect(() => {
    if (!mapReady || !riderPos || !leafletRef.current) return
    const L = (window as any).L
    if (!L) return

    const icon = L.divIcon({
      html: `<div style="width:36px;height:36px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,.5);display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="5" cy="17" r="2.5" stroke="white" stroke-width="1.5"/><circle cx="19" cy="17" r="2.5" stroke="white" stroke-width="1.5"/><path d="M7.5 17h9M5 11l2-4h5l3 4h4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 11l1 3" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg></div>`,
      className: '', iconSize: [36, 36], iconAnchor: [18, 18],
    })

    if (!riderMarkerRef.current) {
      riderMarkerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon })
        .addTo(leafletRef.current)
        .bindPopup('You')
    } else {
      riderMarkerRef.current.setLatLng([riderPos.lat, riderPos.lng])
    }
  }, [riderPos, mapReady])

  // Continuously push rider GPS every time position changes
  const startGPSWatch = useCallback((partnerId: string) => {
    if (!navigator.geolocation) return
    if (watchIdRef.current !== null) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setRiderPos({ lat: pos.coords.latitude, lng: pos.coords.longitude })
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

    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_online: newOnline })
      .eq('user_id', userId)

    if (error) {
      console.error('[toggle] error:', error.message, error.code)
      notify('Could not update status: ' + error.message, 'error')
      return
    }

    setPartner({ ...partner, is_online: newOnline })
    notify(newOnline ? 'You are now online!' : 'You are now offline')

    if (newOnline) {
      startGPSWatch(partner.id)
      navigator.geolocation?.getCurrentPosition(pos => {
        supabase.from('delivery_partners').update({
          current_lat: pos.coords.latitude,
          current_long: pos.coords.longitude,
        }).eq('id', partner.id).then(() => {})
      }, () => {})
    } else {
      stopGPSWatch()
    }
  }

  const acceptOrder = async (orderId: string) => {
    if (!partner) return
    setAccepting(orderId)

    // Generate 4-digit pickup code
    const pickupCode = String(Math.floor(1000 + Math.random() * 9000))

    const { error } = await supabase
      .from('orders')
      .update({
        delivery_partner_id: userId,
        pickup_code: pickupCode,
        partner_accepted_at: new Date().toISOString(),
        // Status stays 'ready' — moves to 'picked_up' when shop verifies OTP
      })
      .eq('id', orderId)
      .in('status', ['preparing', 'ready'])
      .is('delivery_partner_id', null)

    if (error) {
      notify('Failed to accept order', 'error')
      setAccepting(null)
      return
    }

    notify('Order accepted! Show the pickup code to the shop.')
    setAccepting(null)
    loadData()
  }

  const updateOrderStatus = async (status: 'picked_up' | 'delivered') => {
    if (!assignedOrder || !partner) return

    const { error } = await supabase
      .from('orders')
      .update({
        status,
        ...(status === 'delivered'
          ? { delivered_at: new Date().toISOString() }
          : { picked_up_at: new Date().toISOString() }),
      })
      .eq('id', assignedOrder.id)

    if (error) { notify('Failed to update', 'error'); return }

    // Send notification
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        type: status === 'delivered' ? 'order_delivered' : 'order_picked_up',
        order_id: assignedOrder.id,
        shop_id: assignedOrder.shop_id,
        customer_id: assignedOrder.customer_id,
      }),
    }).catch(() => {})

    if (status === 'delivered') {
      await fetch('/api/orders/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: assignedOrder.id }),
      })
      notify(`Delivery complete! Earnings added to wallet.`)
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

  if (!loading && verStatus === 'pending') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #fafaf9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 24, padding: '40px 32px', maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 4px 32px rgba(0,0,0,.08)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '3px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>⏳</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: '#111', marginBottom: 10 }}>Application Under Review</h2>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: 28 }}>
          Your rider account is being reviewed by our team.<br />
          We&apos;ll approve it within <strong style={{ color: '#d97706' }}>24–48 hours</strong>.
        </p>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 16, padding: '18px 20px', marginBottom: 24, textAlign: 'left' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>What happens next</p>
          {[
            { n: '1', t: 'Admin verifies your details',    d: 'Name, phone, and vehicle type' },
            { n: '2', t: 'You get notified on approval',   d: "Log back in to start accepting orders" },
            { n: '3', t: 'Go online & earn!',              d: 'Set yourself online and receive deliveries' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.18)', color: '#d97706', fontWeight: 900, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.n}</div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{s.t}</p>
                <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Questions? support@welokl.com</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  if (!loading && verStatus === 'rejected') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #fafaf9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 24, padding: '40px 32px', maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 4px 32px rgba(0,0,0,.08)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '3px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 24px' }}>❌</div>
        <h2 style={{ fontWeight: 900, fontSize: 22, color: '#ef4444', marginBottom: 10 }}>Application Not Approved</h2>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, marginBottom: verNote ? 16 : 28 }}>
          Your rider application was not approved at this time.
        </p>
        {verNote && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', marginBottom: 6 }}>Reason from admin:</p>
            <p style={{ fontSize: 13, color: '#ef4444', lineHeight: 1.5 }}>{verNote}</p>
          </div>
        )}
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Contact support@welokl.com for assistance.</p>
        <button onClick={async () => { await createClient().auth.signOut(); window.location.href = '/' }}
          style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
      </div>
    </div>
  )

  return (
    <>
    {showPhoneGate && userId && <PhoneGate userId={userId} onDone={() => setShowPhoneGate(false)} />}

    {/* Toast notification */}
    {notification && (
      <div style={{
        position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, maxWidth: 'min(420px, 92vw)', width: '92vw',
        background: 'rgba(12,12,14,0.93)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
        borderRadius: 20, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.45)',
        animation: 'wt-in .28s cubic-bezier(.34,1.3,.64,1) forwards',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: notification.type === 'success' ? '#16a34a' : '#ef4444' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 20px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: notification.type === 'success' ? 'rgba(22,163,74,.2)' : 'rgba(239,68,68,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {notification.type === 'success' ? '✅' : '❌'}
          </div>
          <p style={{ flex: 1, fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.4 }}>{notification.text}</p>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,.1)' }}>
          <div style={{ height: '100%', background: notification.type === 'success' ? '#16a34a' : '#ef4444', animation: 'wt-drain 5s linear forwards', borderRadius: '0 2px 2px 0' }} />
        </div>
      </div>
    )}

    <style>{`
      @keyframes wt-in    { from { opacity:0; transform:translateX(-50%) translateY(-18px) scale(.95) } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1) } }
      @keyframes wt-drain { from { width:100% } to { width:0% } }
    `}</style>

    <div className="min-h-screen bg-surface-50">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
        {/* Online toggle */}
        <div className={`card p-6 ${partner?.is_online ? 'border-2 border-green-200 bg-green-50' : ''}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-xl text-surface-950">
                {partner?.is_online ? "You're online" : "You're offline"}
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
            <div className="font-display font-bold text-xl text-surface-950">{'\u20B9'}{todayEarnings.toFixed(0)}</div>
            <div className="text-surface-400 text-xs mt-1">Today</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-display font-bold text-xl text-surface-950">{'\u20B9'}{wallet?.balance.toFixed(0) ?? 0}</div>
            <div className="text-surface-400 text-xs mt-1">Wallet</div>
          </div>
          <div className="card p-4 text-center">
            <div className="font-display font-bold text-xl text-surface-950">{partner?.total_deliveries ?? 0}</div>
            <div className="text-surface-400 text-xs mt-1">Deliveries</div>
          </div>
        </div>

        {/* Earnings & history shortcut */}
        <Link href="/dashboard/delivery/analytics" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="card p-4" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,48,8,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={22} style={{ color: '#FF3008' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p className="font-display font-bold text-sm text-surface-950">Earnings & history</p>
              <p className="text-surface-400 text-xs mt-0.5">View your analytics and past deliveries</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" width={18} height={18} style={{ flexShrink: 0 }}>
              <path d="M9 18l6-6-6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </Link>

        {/* Active assigned order */}
        {assignedOrder ? (
          <div className="card p-6 border-2 border-brand-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg">Active delivery</h3>
              <span className={`status-${assignedOrder.status}`}>{assignedOrder.status.replace('_', ' ')}</span>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                  <Package size={16} className="text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">Pickup from</p>
                  <p className="text-surface-500 text-sm">{(assignedOrder as any).shop?.name}</p>
                  <p className="text-surface-400 text-xs">{(assignedOrder as any).shop?.address}</p>
                </div>
                {(assignedOrder as any).shop?.phone && (
                  <a href={`tel:${(assignedOrder as any).shop.phone}`}
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
                  <p className="text-surface-500 text-sm">{(assignedOrder as any).customer?.name}</p>
                  <p className="text-surface-400 text-xs">{assignedOrder.delivery_address}</p>
                </div>
                {(assignedOrder as any).customer?.phone && (
                  <a href={`tel:${(assignedOrder as any).customer.phone}`}
                    className="p-2 bg-surface-100 rounded-xl hover:bg-surface-200 transition-colors">
                    <Phone size={16} className="text-surface-400" />
                  </a>
                )}
              </div>
            </div>

            {/* Live map — shop (red pin) + customer (green pin) + rider (blue dot) */}
            {(() => {
              const shopLat  = (assignedOrder as any).shop?.latitude  as number | null
              const shopLng  = (assignedOrder as any).shop?.longitude as number | null
              const destLat  = assignedOrder.delivery_lat             as number | null
              const destLng  = (assignedOrder as any).delivery_lng    as number | null
              const isPickup = assignedOrder.status !== 'picked_up'
              const navLat   = isPickup ? shopLat  : destLat
              const navLng   = isPickup ? shopLng  : destLng
              const navLabel = isPickup ? 'Navigate to Pickup' : 'Navigate to Drop'
              const mapsUrl  = navLat && navLng
                ? `https://www.google.com/maps/dir/?api=1&destination=${navLat},${navLng}&travelmode=driving`
                : null
              return (
                <>
                  {/* Navigate button */}
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: isPickup ? '#FF3008' : '#16a34a',
                        color: '#fff', fontWeight: 800, fontSize: 15,
                        padding: '13px 20px', borderRadius: 14, marginBottom: 12,
                        textDecoration: 'none', letterSpacing: '0.01em',
                      }}>
                      <Navigation size={18} />
                      {navLabel}
                    </a>
                  )}
                  <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16, border: '1px solid #e5e7eb' }}>
                    <div style={{ padding: '10px 14px', background: '#f9fafb', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block', boxShadow: '0 0 0 3px rgba(37,99,235,.2)' }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Live map</span>
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                        <span style={{ color: '#FF3008' }}>● </span>Pickup &nbsp;
                        <span style={{ color: '#16a34a' }}>● </span>Drop &nbsp;
                        <span style={{ color: '#2563eb' }}>● </span>You
                      </span>
                    </div>
                    {/* Tap overlay opens Google Maps */}
                    <div style={{ position: 'relative' }}>
                      <div ref={mapRef} style={{ height: 220, width: '100%', background: '#e5e7eb' }} />
                      {mapsUrl && (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                          style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end',
                            justifyContent: 'flex-end', padding: 10, textDecoration: 'none',
                          }}>
                          <span style={{
                            background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700,
                            padding: '5px 10px', borderRadius: 8, backdropFilter: 'blur(4px)',
                          }}>
                            Open in Maps ↗
                          </span>
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}

            {/* Post-pickup: prominent navigate-to-customer banner */}
            {assignedOrder.status === 'picked_up' && (() => {
              const destLat = assignedOrder.delivery_lat as number | null
              const destLng = (assignedOrder as any).delivery_lng as number | null
              const mapsUrl = destLat && destLng
                ? `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`
                : null
              return (
                <div style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,.75)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Order picked up</p>
                  <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 12 }}>
                    Now deliver to {(assignedOrder as any).customer?.name || 'Customer'}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginBottom: 14 }}>{assignedOrder.delivery_address}</p>
                  {mapsUrl ? (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fff', color: '#15803d', fontWeight: 900, fontSize: 15, padding: '13px 20px', borderRadius: 13, textDecoration: 'none' }}>
                      <Navigation size={18} />
                      Navigate to Customer
                    </a>
                  ) : (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>No GPS coordinates for this address</p>
                  )}
                </div>
              )
            })()}

            <div className="flex items-center justify-between mb-4 p-3 bg-surface-50 rounded-2xl">
              <span className="text-surface-500 text-sm">Order total</span>
              <span className="font-bold text-brand-500">{'\u20B9'}{assignedOrder.total_amount}</span>
            </div>

            {/* Pickup OTP code — show when order is ready and rider is assigned */}
            {(assignedOrder as any).pickup_code && assignedOrder.status === 'ready' && (
              <div style={{
                background: 'linear-gradient(135deg, #FFF7ED, #FFF1E6)',
                border: '2px dashed #FF3008',
                borderRadius: 18, padding: '16px 20px', marginBottom: 16,
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pickup Code — Show to shop
                </p>
                <p style={{
                  fontSize: 36, fontWeight: 900, color: '#FF3008', letterSpacing: '0.3em',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                  {(assignedOrder as any).pickup_code}
                </p>
                <p style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>
                  The shop will verify this code before handing over the order
                </p>
              </div>
            )}

            <div className="flex gap-3">
              {/* Ready status: rider waits for shop to verify OTP — no button needed */}
              {assignedOrder.status === 'picked_up' && (
                <button onClick={() => updateOrderStatus('delivered')}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-2xl transition-colors">
                  <DollarSign size={18} /> Mark delivered
                </button>
              )}
            </div>
          </div>
        ) : partner?.is_online && availableOrders.length > 0 ? (
          /* Available orders for pickup */
          <div className="space-y-3">
            <h3 className="font-display font-bold text-lg text-surface-950 px-1">
              Available orders ({availableOrders.length})
            </h3>
            {availableOrders.map(order => (
              <div key={order.id} className="card p-5 border border-surface-200 hover:border-brand-200 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm text-surface-900">{order.shop?.name || 'Shop'}</p>
                    <p className="text-surface-400 text-xs mt-0.5">{order.shop?.address || ''}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-surface-400 bg-surface-100 px-2 py-1 rounded-lg">
                    <Clock size={12} />
                    {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={14} className="text-brand-500 shrink-0" />
                  <p className="text-surface-500 text-xs truncate">{order.delivery_address}</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-surface-900">{'\u20B9'}{order.total_amount}</span>
                      <span className="text-xs text-surface-400">
                        {order.payment_method === 'cod' ? 'Cash on delivery' : 'Paid online'}
                      </span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 8, padding: '3px 9px', width: 'fit-content' }}>
                      <svg viewBox="0 0 16 16" fill="none" width={11} height={11}><circle cx="8" cy="8" r="7" stroke="#16a34a" strokeWidth="1.5"/><path d="M8 4.5V5M8 11V11.5M10 6.5C10 5.7 9.1 5 8 5S6 5.7 6 6.5 7.2 7.5 8 7.5 10 8.3 10 9.5 9 11 8 11 6 10.3 6 9.5" stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d' }}>You earn ₹{partnerPayout}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptOrder(order.id)}
                    disabled={accepting === order.id}
                    style={{
                      padding: '10px 24px', borderRadius: 14, border: 'none',
                      background: accepting === order.id ? '#d1d5db' : '#FF3008',
                      color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      boxShadow: accepting === order.id ? 'none' : '0 4px 16px rgba(255,48,8,.3)',
                      transition: 'all .2s',
                    }}>
                    {accepting === order.id ? 'Accepting...' : 'Accept'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          partner?.is_online && (
            <div className="card p-8 text-center">
              <div className="text-5xl mb-3">
                <svg width="56" height="56" viewBox="0 0 100 100" style={{ margin: '0 auto' }}>
                  <circle cx="50" cy="65" r="18" fill="none" stroke="#FF3008" strokeWidth="3"/>
                  <circle cx="50" cy="65" r="3" fill="#FF3008"/>
                  <circle cx="80" cy="65" r="12" fill="none" stroke="#FF3008" strokeWidth="3"/>
                  <circle cx="80" cy="65" r="3" fill="#FF3008"/>
                  <path d="M32 65 L40 45 L70 45 L75 55 L68 55" fill="none" stroke="#FF3008" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="40" y1="45" x2="40" y2="65" stroke="#FF3008" strokeWidth="3"/>
                  <path d="M38 35 C42 25, 58 25, 62 35" fill="none" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                </svg>
              </div>
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