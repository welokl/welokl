'use client'
import { useEffect, useState, useCallback } from 'react'
import { useFCM } from '@/hooks/useFCM'
import { useCart } from '@/store/cart'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { computeIsOpen } from '@/lib/shopHours'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS } from '@/types'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'
import { PhoneGate } from '@/components/PhoneGate'
import InAppToast from '@/components/InAppToast'
import BottomNav from '@/components/BottomNav'

interface Shop {
  id: string; name: string; description: string | null; category_name: string
  is_open: boolean; rating: number; avg_delivery_time: number
  delivery_enabled: boolean; pickup_enabled: boolean; min_order_amount: number
  area: string; image_url: string | null; latitude: number | null; longitude: number | null
  offer_text?: string | null; free_delivery_above?: number | null
  // Boost fields (joined at query time — 0/null means no active boost)
  boost_weight?: number; boost_badge?: string | null; boost_badge_color?: string | null
  today_impressions?: number
}
interface Product {
  id: string; name: string; price: number; original_price: number | null
  image_url: string | null; shop_id: string; shop_name?: string
}

function dist(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Category SVG icons — keys are substrings to match against the computed `q`
const CAT_SVG: Record<string, JSX.Element> = {
  food:        <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  restaurant:  <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  grocery:     <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pharmacy:    <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  health:      <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  medical:     <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  electronics: <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  mobile:      <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><rect x="5" y="2" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>,
  salon:       <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M3.51 8.51L10 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  beauty:      <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="2"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M3.51 8.51L10 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  hardware:    <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  stationery:  <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  office:      <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  flower:      <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M12 22V12M12 12C12 12 7 11 7 7a5 5 0 0110 0c0 4-5 5-5 5zM12 12C12 12 7 13.5 5 17a5 5 0 009.33 2.5M12 12c0 0 5 1.5 7 5a5 5 0 01-9.33 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  gift:        <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pet:         <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.057-3.5 4 0 .75.562 1.931 1 2.5M14 5.172C14 3.782 15.577 2.679 17.5 3c2 .336 3.5 2.057 3.5 4 0 .75-.562 1.931-1 2.5M12 19c-4 0-7-1.5-7-5 0-2 1-3.5 3.5-4.5M12 19c4 0 7-1.5 7-5 0-2-1-3.5-3.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  cloth:       <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  fashion:     <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10a2 2 0 002 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  book:        <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 22h16V2H6.5A2.5 2.5 0 004 4.5v15z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  sport:       <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M19.07 4.93l-4.24 4.24M9.17 14.83l-4.24 4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  default:     <svg viewBox="0 0 24 24" fill="none" width={28} height={28}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
}
// Fuzzy match: find the first key that appears inside the category's q string
function getCatIcon(q: string): JSX.Element {
  if (CAT_SVG[q]) return CAT_SVG[q]
  const match = Object.keys(CAT_SVG).find(k => k !== 'default' && q.includes(k))
  return match ? CAT_SVG[match] : CAT_SVG['default']
}

const CATS = [
  { label:'Food',        q:'food',        bg:'var(--red-light)',    color:'#FF3008' },
  { label:'Grocery',     q:'grocery',     bg:'var(--green-light)',  color:'#16a34a' },
  { label:'Pharmacy',    q:'pharmacy',    bg:'var(--blue-light)',   color:'#4f46e5' },
  { label:'Electronics', q:'electronics', bg:'var(--purple-light)', color:'#7c3aed' },
  { label:'Salon',       q:'salon',       bg:'var(--pink-light)',   color:'#db2777' },
  { label:'Hardware',    q:'hardware',    bg:'var(--yellow-light)', color:'#d97706' },
  { label:'Gifts',       q:'gifts',       bg:'var(--purple-light)', color:'#7c3aed' },
  { label:'Pets',        q:'pet',         bg:'var(--orange-light)', color:'#ea580c' },
]

const CAT_COLOR: Record<string,string> = {
  food:'#FF3008', grocery:'#16a34a', pharmacy:'#4f46e5',
  electronics:'#7c3aed', salon:'#db2777', hardware:'#d97706', pet:'#ea580c', default:'#FF3008',
}

export default function CustomerHome() {
  const [user, setUser]                   = useState<User | null>(null)
  useFCM(user?.id ?? null)
  const cart = useCart() as any
  const cartCount = (cart.count?.() ?? cart.itemCount?.() ?? 0) as number
  useEffect(() => { cart._hydrate?.() }, [])

  const [orders, setOrders]               = useState<Order[]>([])
  const [allShops, setAllShops]           = useState<Shop[]>([])
  const [products, setProducts]           = useState<Product[]>([])
  const [displayShops, setDisplayShops]   = useState<(Shop & { km: number | null })[]>([])
  const [shopsLoaded, setShopsLoaded]     = useState(false)
  const [locStatus, setLocStatus]         = useState<'idle'|'detecting'|'granted'|'denied'>('idle')
  const [userLat, setUserLat]             = useState<number | null>(null)
  const [userLng, setUserLng]             = useState<number | null>(null)
  const [areaName, setAreaName]           = useState('')
  const [radius, setRadius]               = useState(5)
  const [activeCategory, setActiveCat]    = useState<string | null>(null)
  const [activeCats, setActiveCats]       = useState<{name:string; q:string}[]>([])
  const [showPhoneGate, setShowPhoneGate] = useState(false)
  const [staffShop, setStaffShop]         = useState<{name:string; role:string} | null>(null)
  const [prodFreqMap, setProdFreqMap]     = useState<Record<string,number>>({})
  useCustomerOrderAlerts(user?.id)

  const loadOrders = useCallback(async () => {
    const sb = createClient()
    const { data: { user: u } } = await sb.auth.getUser()
    if (!u) { window.location.href = '/auth/login'; return }

    // Fetch profile + orders in parallel — not sequentially
    const [{ data: profile }, { data: orderData }] = await Promise.all([
      sb.from('users').select('id,name,phone,role,avatar_url').eq('id', u.id).single(),
      sb.from('orders').select('*, shop:shops(name,category_name), items:order_items(*)')
        .eq('customer_id', u.id).order('created_at', { ascending: false }).limit(20),
    ])

    // New Google user who skipped signup
    if (!profile) {
      const name  = encodeURIComponent(u.user_metadata?.full_name || u.user_metadata?.name || '')
      const email = encodeURIComponent(u.email || '')
      window.location.href = `/auth/signup?from=google&email=${email}&name=${name}`
      return
    }

    // Role guard — read from DB, not JWT metadata
    const role = profile.role || ''
    if (role === 'business' || role === 'shopkeeper')           { window.location.replace('/dashboard/business');    return }
    if (role === 'delivery' || role === 'delivery_partner')     { window.location.replace('/dashboard/delivery');    return }
    if (role === 'admin')                                       { window.location.replace('/dashboard/admin');       return }
    if (role === 'management')                                  { window.location.replace('/dashboard/management'); return }

    if (!profile.phone) setShowPhoneGate(true)
    setUser(profile as any)
    cart._setUserId?.(u.id)   // migrate guest cart → user-keyed cart
    setOrders(orderData || [])

    // Check if this customer is also a shop operator
    const sb2 = createClient()
    const { data: staffRow } = await sb2
      .from('shop_staff')
      .select('role, shop:shops(name)')
      .eq('user_id', u.id)
      .eq('is_active', true)
      .maybeSingle()
    if (staffRow) {
      const shopName = (staffRow.shop as any)?.name || 'Shop'
      setStaffShop({ name: shopName, role: staffRow.role })
    }

  }, [])

  const SHOPS_CACHE_KEY = 'welokl_shops_v2'
  const SHOPS_TTL_MS   = 5 * 60 * 1000 // 5 minutes

  const loadShops = useCallback(async () => {
    // Serve cached shops immediately so the page feels instant
    try {
      const raw = localStorage.getItem(SHOPS_CACHE_KEY)
      if (raw) {
        const { ts, shops: cached } = JSON.parse(raw)
        if (Date.now() - ts < SHOPS_TTL_MS) {
          setAllShops(cached)
          setShopsLoaded(true)
          // Categories are NOT loaded from cache — always fetch fresh so admin toggles take effect immediately
        }
      }
    } catch {}

    const sb = createClient()
    const today = new Date().toISOString().slice(0, 10)
    const [{ data: shops }, { data: cats }, { data: boosts }, { data: metrics }] = await Promise.all([
      sb.from('shops')
        .select('id,name,category_name,area,is_open,is_active,rating,avg_delivery_time,image_url,offer_text,delivery_enabled,pickup_enabled,latitude,longitude,verification_status,opening_time,closing_time,manually_closed')
        .eq('is_active', true).eq('verification_status', 'approved').order('rating', { ascending: false }),
      sb.from('categories').select('*').eq('is_active', true),
      // Active boosts only — join plan for badge label + weight
      sb.from('vendor_boosts')
        .select('shop_id, plan:boost_plans(boost_weight, badge_label, badge_color)')
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().slice(0, 10)),
      // Today's impression counts for rotation fairness
      sb.from('vendor_boost_metrics').select('shop_id, impressions').eq('date', today),
    ])

    // Merge boost + metrics into shop records
    const boostMap: Record<string, { boost_weight: number; boost_badge: string; boost_badge_color: string }> = {}
    ;(boosts || []).forEach((b: any) => {
      if (b.plan) boostMap[b.shop_id] = {
        boost_weight:      b.plan.boost_weight  ?? 0,
        boost_badge:       b.plan.badge_label   ?? null,
        boost_badge_color: b.plan.badge_color   ?? '#6b7280',
      }
    })
    const impMap: Record<string, number> = {}
    ;(metrics || []).forEach((m: any) => { impMap[m.shop_id] = m.impressions ?? 0 })

    const enriched = (shops || []).map((s: any) => ({
      ...s,
      boost_weight:      boostMap[s.id]?.boost_weight      ?? 0,
      boost_badge:       boostMap[s.id]?.boost_badge       ?? null,
      boost_badge_color: boostMap[s.id]?.boost_badge_color ?? null,
      today_impressions: impMap[s.id] ?? 0,
    }))
    setAllShops(enriched)
    setShopsLoaded(true)

    const mappedCats = (cats || []).map((c: any) => ({
      name: c.name || c.label || '',
      q: (c.slug || c.name || c.label || '').toLowerCase().replace(/[^a-z]/g, ''),
    })).filter((c: any) => c.name && c.q)

    if (mappedCats.length) setActiveCats(mappedCats)

    // Persist to localStorage for instant load next visit
    try {
      localStorage.setItem(SHOPS_CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        shops: enriched,
      }))
    } catch {}

    if (cats?.length) {
    } else {
      // Fallback: derive from shop categories
      // (used when categories table is empty)
    }
  }, [])

  const loadProducts = useCallback(async (shopIds: string[]) => {
    if (!shopIds.length) { setProducts([]); return }
    const { data } = await createClient().from('products')
      .select('id,name,price,original_price,image_url,shop_id,shops(name)')
      .in('shop_id', shopIds.slice(0, 50))
      .order('original_price', { ascending: false }).limit(24)
    // Filter unavailable in JS — avoids broken .or() query
    const available = (data || []).filter((p: any) => p.is_available !== false)
    setProducts(available.map((p: any) => ({ ...p, shop_name: p.shops?.name })))
  }, [])

  // Track boost impressions — called after shops render, debounced 3s
  // Uses RPC to atomically increment daily counters
  const trackBoostImpressions = useCallback(async (shopIds: string[]) => {
    if (!shopIds.length) return
    const sb = createClient()
    const today = new Date().toISOString().slice(0, 10)
    await Promise.all(shopIds.map(id =>
      sb.rpc('increment_boost_impression', { p_shop_id: id, p_date: today })
    ))
  }, [])

  function detectLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    setLocStatus('detecting')
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      setUserLat(lat); setUserLng(lng); setLocStatus('granted')
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
        const d = await r.json()
        const name = d.address?.suburb || d.address?.neighbourhood || d.address?.village || d.address?.town || d.address?.city_district || d.address?.city || d.address?.county || ''
        setAreaName(name)
        localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name }))
      } catch { localStorage.setItem('welokl_location', JSON.stringify({ lat, lng, name: '' })) }
    }, () => setLocStatus('denied'), { timeout: 8000, enableHighAccuracy: false })
  }

  useEffect(() => {
    loadOrders(); loadShops()
    try {
      const saved = JSON.parse(localStorage.getItem('welokl_location') || 'null')
      if (saved?.lat) {
        setUserLat(saved.lat); setUserLng(saved.lng); setLocStatus('granted')
        if (saved.name) { setAreaName(saved.name); return }
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${saved.lat}&lon=${saved.lng}&format=json`, { headers: { 'Accept-Language': 'en' } })
          .then(r => r.json()).then(d => {
            const name = d.address?.suburb || d.address?.neighbourhood || d.address?.village || d.address?.town || d.address?.city_district || d.address?.city || d.address?.county || ''
            if (name) { setAreaName(name); localStorage.setItem('welokl_location', JSON.stringify({ lat: saved.lat, lng: saved.lng, name })) }
          }).catch(() => {})
        return
      }
    } catch {}
    detectLocation()
  }, [])

  useEffect(() => {
    const sb = createClient()
    let channel: ReturnType<typeof sb.channel> | null = null
    sb.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      channel = sb.channel(`cust-rt-${u.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${u.id}` }, () => loadOrders())
        .subscribe()
    })
    return () => { if (channel) sb.removeChannel(channel) }
  }, [loadOrders])

  // Track impressions for boosted shops — fires 3s after feed renders, once per session per shop set
  useEffect(() => {
    if (!shopsLoaded) return
    const boostedIds = displayShops.filter(s => (s.boost_weight ?? 0) > 0).map(s => s.id)
    if (!boostedIds.length) return
    const timer = setTimeout(() => trackBoostImpressions(boostedIds), 3000)
    return () => clearTimeout(timer)
  }, [shopsLoaded, displayShops, trackBoostImpressions])

  useEffect(() => {
    // ── Frequency signals from order history ──────────────────
    const shopFreq: Record<string, number> = {}   // weighted order count per shop
    const prodFreq: Record<string, number> = {}   // weighted order count per product
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const now = Date.now()

    orders.filter(o => o.status === 'delivered').forEach(o => {
      const sid = (o as any).shop_id
      const recent = now - new Date((o as any).created_at || 0).getTime() < thirtyDays
      const w = recent ? 2 : 1
      if (sid) shopFreq[sid] = (shopFreq[sid] || 0) + w
      // Count per-product frequency from order items
      ;((o as any).items || []).forEach((item: any) => {
        if (item.product_id) prodFreq[item.product_id] = (prodFreq[item.product_id] || 0) + w
      })
    })

    setProdFreqMap(prodFreq)

    // ── Personalized shop score ────────────────────────────────
    // Primary signal: order frequency (uncapped — most-ordered shops float to top)
    // Paid boost: additive overlay on top of organic rank
    // Rating + distance: tiebreakers only
    const DAILY_IMP_TARGET = 60
    function scoreShop(s: { id: string; rating: number; km: number | null; is_open: boolean; avg_delivery_time: number; category_name?: string | null; boost_weight?: number; today_impressions?: number }): number {
      let pts = 0
      // ORDER FREQUENCY — primary signal, 20pts per weighted order, uncapped
      pts += (shopFreq[s.id] || 0) * 20
      // PAID BOOST — overlay (fairness rotation applied)
      const bw = s.boost_weight ?? 0
      if (bw > 0) {
        const imp = s.today_impressions ?? 0
        const rotationPenalty = Math.min(imp / DAILY_IMP_TARGET, 0.4) * bw
        pts += bw - rotationPenalty
      }
      // RATING — tiebreaker, +5 per star above 3.0
      pts += Math.max(0, (s.rating - 3) * 5)
      // DISTANCE — mild penalty, -3 per km, cap at -15
      if (s.km !== null) pts -= Math.min(s.km * 3, 15)
      return pts
    }

    let shops = allShops.map(s => ({
      ...s,
      km: (userLat && userLng && s.latitude && s.longitude)
        ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null,
    }))
    if (userLat && userLng) shops = shops.filter(s => s.km !== null && s.km <= radius)
    if (activeCategory)     shops = shops.filter(s => s.category_name?.toLowerCase().includes(activeCategory))

    // Open first → personalized score within each group
    shops.sort((a, b) => {
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1
      return scoreShop(b) - scoreShop(a)
    })

    setDisplayShops(shops)
    if (locStatus === 'granted' || locStatus === 'denied') {
      const ids = shops.filter(s => computeIsOpen(s)).map(s => s.id)
      loadProducts(ids.length ? ids : shops.map(s => s.id))
    }
  }, [allShops, userLat, userLng, radius, activeCategory, locStatus, loadProducts, orders])

  const activeOrders   = orders.filter(o => !['delivered','cancelled','rejected'].includes(o.status))
  const lastDelivered  = orders.find(o => o.status === 'delivered')

  function reorder(order: Order) {
    const items = (order as any).items as any[] | undefined
    if (!items?.length) { window.location.href = `/stores/${(order as any).shop_id}`; return }
    cart.clear()
    items.forEach((item: any) => {
      if (!item.product_id) return
      cart.addItem(
        { id: item.product_id, name: item.product_name, price: item.price, image_url: item.product_image || null, shop_id: (order as any).shop_id },
        (order as any).shop_id,
        (order as any).shop?.name || ''
      )
    })
    window.location.href = '/cart'
  }

  const openShops      = displayShops.filter(s => computeIsOpen(s))
  const closedShops    = displayShops.filter(s => !computeIsOpen(s))
  // Sort by order frequency desc — most-ordered products surface first
  const sortByFreq     = (arr: Product[]) => [...arr].sort((a, b) => (prodFreqMap[b.id] || 0) - (prodFreqMap[a.id] || 0))

  // ── Personalised product / shop slices ────────────────────────
  // Price-band product slices — freq-sorted, shown as horizontal scrolls
  const under49    = sortByFreq(products.filter(p => p.price <= 49)).slice(0, 10)
  const under100   = sortByFreq(products.filter(p => p.price <= 99 && p.price > 49)).slice(0, 10)

  // Products grouped by shop — powers the shop+products rows in the feed
  const productsByShop = products.reduce<Record<string, Product[]>>((acc, p) => {
    if (!acc[p.shop_id]) acc[p.shop_id] = []
    acc[p.shop_id].push(p)
    return acc
  }, {})

  return (
    <>
    <InAppToast />
    {showPhoneGate && user?.id && <PhoneGate userId={user.id} onDone={() => setShowPhoneGate(false)} />}
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%); background-size:400px 100%; animation:shimmer 1.4s infinite; border-radius:12px; }
        .qa:active { transform:scale(.95); opacity:.9; }
        .stap:active { opacity:.8; }
        ::-webkit-scrollbar { display:none; }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ticker-track { display:inline-flex; animation:ticker 18s linear infinite; }
        .ticker-track:hover { animation-play-state:paused; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          ZONE 1 — RED HEADER: location + live signal + bell
          ZONE 2 — Search bar (inside header)
          ═══════════════════════════════════════════════ */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'#FF3008' }}>
        {/* Location row + bell */}
        <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={detectLocation} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.18)', border:'none', cursor:'pointer', padding:'6px 12px 6px 10px', borderRadius:20, fontFamily:'inherit', minHeight:36 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:14, height:14, flexShrink:0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#fff"/>
            </svg>
            <span style={{ fontSize:13, fontWeight:800, color:'#fff', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {locStatus === 'detecting' ? 'Detecting…' : areaName ? areaName.split(',')[0].trim() : 'Set location'}
            </span>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:12, height:12 }}>
              <path d="M7 10l5 5 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {/* Cart icon */}
            <Link href="/cart" style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', textDecoration:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cartCount > 0 && (
                <span style={{ position:'absolute', top:-2, right:-2, width:16, height:16, borderRadius:'50%', background:'#fff', color:'#FF3008', fontSize:9, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>{cartCount}</span>
              )}
            </Link>
          </div>
        </div>
        {/* Live delivery signal */}
        <div style={{ padding:'5px 16px 0', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', animation:'pulse 1.5s infinite', flexShrink:0 }} />
          <span style={{ fontSize:11, color:'rgba(255,255,255,.9)', fontWeight:700 }}>
            Delivering now — avg {openShops.length > 0 ? Math.round(openShops.reduce((s,sh) => s + sh.avg_delivery_time, 0) / openShops.length) : 22} min
          </span>
        </div>
        {/* Search bar */}
        <div style={{ padding:'8px 16px 12px' }}>
          <Link href="/search" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, background:'#fff', borderRadius:12, padding:'0 14px', height:44 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:14, color:'#9ca3af', fontWeight:500 }}>Search food, groceries, medicine...</span>
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          2. ORDER STATUS BANNER (conditional)
          ═══════════════════════════════════════════════ */}
      {activeOrders.length > 0 && (
        <Link href={`/orders/${activeOrders[0].id}`} style={{ display:'flex', alignItems:'center', gap:10, margin:'12px 16px 0', background:'#FF3008', borderRadius:16, padding:'14px 16px', textDecoration:'none', boxShadow:'0 6px 20px rgba(255,48,8,.28)', minHeight:60 }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', flexShrink:0, animation:'pulse 1.5s infinite', display:'block' }} />
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:13, fontWeight:800, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(activeOrders[0] as any).shop?.name} · {ORDER_STATUS_LABELS[activeOrders[0].status as keyof typeof ORDER_STATUS_LABELS]}
            </p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.8)', marginTop:2 }}>Tap to track your order</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      )}

      {/* Staff banner */}
      {staffShop && (
        <Link href="/dashboard/business" style={{ display:'flex', alignItems:'center', gap:12, margin:'10px 16px 0', background:'var(--card-white)', borderRadius:16, padding:'14px 16px', textDecoration:'none', border:'1.5px solid rgba(124,58,237,.25)' }}>
          <div style={{ width:38, height:38, borderRadius:11, background:'rgba(124,58,237,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', marginBottom:1 }}>Manage {staffShop.name}</p>
            <p style={{ fontSize:11, color:'#7c3aed', fontWeight:700, textTransform:'capitalize' }}>{staffShop.role} access</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" width={15} height={15}><path d="M9 18l6-6-6-6" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      )}

      {/* ── Value prop marketing strip ── */}
      <ValuePropStrip />

      {/* ═══════════════════════════════════════════════
          ZONE 4 — WHAT DO YOU NEED? — compact 4-col strip
          ═══════════════════════════════════════════════ */}
      <div style={{ margin:'14px 16px 0' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {([
            { label:'Food',       q:'food',       color:'#FF3008', bg:'#FFF0EC',
              icon: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            { label:'Grocery',    q:'grocery',    color:'#16a34a', bg:'#F0FFF4',
              icon: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            { label:'Medicine',   q:'pharmacy',   color:'#3b82f6', bg:'#EFF6FF',
              icon: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg> },
            { label:'Stationery', q:'stationery', color:'#7c3aed', bg:'#FAF5FF',
              icon: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ] as const).map(cat => {
            const isActive = activeCategory === cat.q
            return (
              <button key={cat.q} onClick={() => setActiveCat(isActive ? null : cat.q)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, background: isActive ? cat.color : cat.bg, border:`2px solid ${isActive ? cat.color : 'transparent'}`, borderRadius:14, padding:'10px 6px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                <div style={{ width:38, height:38, borderRadius:11, background: isActive ? 'rgba(255,255,255,.2)' : `${cat.color}18`, display:'flex', alignItems:'center', justifyContent:'center', color: isActive ? '#fff' : cat.color }}>
                  {cat.icon}
                </div>
                <span style={{ fontSize:11, fontWeight:800, color: isActive ? '#fff' : cat.color, letterSpacing:'-0.01em', textAlign:'center', lineHeight:1.2 }}>{cat.label}</span>
              </button>
            )
          })}
        </div>
        {/* Additional categories — horizontal scroll below the grid */}
        {activeCats.length > 0 && (
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2, marginTop:10, scrollbarWidth:'none' }}>
            <button onClick={() => setActiveCat(null)}
              style={{ flexShrink:0, height:32, padding:'0 14px', borderRadius:20, border:`1.5px solid ${!activeCategory ? '#FF3008' : 'var(--divider)'}`, background: !activeCategory ? '#FF3008' : 'var(--card-white)', color: !activeCategory ? '#fff' : 'var(--text-secondary)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              All
            </button>
            {activeCats.filter(c => !['food','grocery','pharmacy','stationery'].includes(c.q)).map(cat => {
              const cfg = CATS.find(c => c.q === cat.q) || { color:'#FF3008' }
              const isActive = activeCategory === cat.q
              return (
                <button key={cat.q} onClick={() => setActiveCat(isActive ? null : cat.q)}
                  style={{ flexShrink:0, height:32, padding:'0 14px', borderRadius:20, border:`1.5px solid ${isActive ? cfg.color : 'var(--divider)'}`, background: isActive ? cfg.color : 'var(--card-white)', color: isActive ? '#fff' : 'var(--text-secondary)', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  {cat.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          ORDER AGAIN — compact single-line chip
          ═══════════════════════════════════════════════ */}
      {!activeCategory && lastDelivered && !activeOrders.length && (() => {
        const items = (lastDelivered as any).items as any[] | undefined
        const shopName = (lastDelivered as any).shop?.name || ''
        const firstItem = items?.[0]?.product_name || ''
        const extra = (items?.length ?? 1) - 1
        return (
          <div style={{ margin:'14px 16px 0', display:'flex', alignItems:'center', gap:10, background:'var(--card-white)', borderRadius:14, padding:'10px 14px', border:'1px solid var(--divider)' }}>
            {/* Reorder icon */}
            <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,48,8,.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M1 4v6h6M23 20v-6h-6" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:12, fontWeight:900, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shopName}</p>
              <p style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {firstItem}{extra > 0 ? ` +${extra} more` : ''}
              </p>
            </div>
            <button onClick={() => reorder(lastDelivered)}
              style={{ background:'#FF3008', border:'none', borderRadius:9, padding:'7px 14px', fontSize:12, fontWeight:900, color:'#fff', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              Reorder
            </button>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════
          PRICE BANDS — Under ₹49 · Under ₹99
          Horizontal scroll, large cards (Swiggy-style)
          Hidden when category filter is active
          ═══════════════════════════════════════════════ */}
      {!activeCategory && (under49.length >= 2 || under100.length >= 2) && (
        <PriceBandSection under49={under49} under100={under100} />
      )}

      {/* ═══════════════════════════════════════════════
          MAIN SHOP LIST — continuous vertical (Swiggy-style)
          Default: all open shops, personalised order
          Category active: filtered + price bands hidden
          ═══════════════════════════════════════════════ */}
      <div style={{ marginTop:24 }}>
        {/* Section header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:14 }}>
          <div>
            <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              {activeCategory
                ? `${activeCats.find(c => c.q === activeCategory)?.name || activeCategory} near you`
                : 'Restaurants & Shops'}
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {shopsLoaded ? `${openShops.length} open now` : 'Finding shops…'}
              {locStatus === 'granted' && (
                <> · <button onClick={() => setRadius(prev => prev === 5 ? 2 : prev === 2 ? 1 : prev === 1 ? 7 : 5)}
                  style={{ background:'none', border:'none', color:'#FF3008', fontWeight:800, fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                  {radius}km ↕
                </button></>
              )}
            </p>
          </div>
          {activeCategory && (
            <button onClick={() => setActiveCat(null)}
              style={{ display:'flex', alignItems:'center', gap:4, background:'var(--card-white)', border:'1.5px solid #FF3008', borderRadius:20, padding:'5px 12px', fontSize:12, fontWeight:800, color:'#FF3008', cursor:'pointer', fontFamily:'inherit' }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Location denied prompt */}
        {locStatus === 'denied' && (
          <div style={{ margin:'0 16px', background:'var(--card-white)', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
            <div style={{ width:48, height:48, background:'var(--red-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={24} height={24}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>Allow location access</p>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>We show only shops in your neighbourhood</p>
            <button onClick={detectLocation} style={{ background:'#FF3008', border:'none', borderRadius:12, padding:'12px 28px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>Enable location</button>
          </div>
        )}

        {/* Loading skeletons */}
        {!shopsLoaded && (
          <div style={{ display:'flex', flexDirection:'column', gap:12, padding:'0 12px' }}>
            {Array.from({length:4}).map((_,i) => <div key={i} className="sk" style={{ height:200, borderRadius:20 }} />)}
          </div>
        )}

        {/* Empty state */}
        {shopsLoaded && openShops.length === 0 && locStatus !== 'denied' && (
          <div style={{ margin:'0 16px', background:'var(--card-white)', borderRadius:20, padding:'32px 20px', textAlign:'center' }}>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>No shops open right now</p>
            <p style={{ fontSize:13, color:'var(--text-muted)' }}>{locStatus === 'granted' ? `Try expanding your radius (currently ${radius}km)` : 'Set your location to find shops'}</p>
            {locStatus === 'granted' && (
              <button onClick={() => setRadius(7)} style={{ marginTop:12, background:'#FF3008', border:'none', borderRadius:10, padding:'8px 20px', fontSize:13, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
                Expand to 7km
              </button>
            )}
          </div>
        )}

        {/* Continuous vertical shop list — shop header + horizontal product scroll */}
        {shopsLoaded && openShops.length > 0 && (
          <div style={{ padding:'0 12px', display:'flex', flexDirection:'column', gap:12 }}>
            {openShops.map(shop => (
              <ShopProductRow key={shop.id} shop={shop} products={productsByShop[shop.id] || []} />
            ))}
          </div>
        )}

        {/* Closed shops — dimmed, below the fold */}
        {shopsLoaded && closedShops.length > 0 && (
          <div style={{ marginTop:28, opacity:0.55 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', marginBottom:12 }}>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>OPENS LATER · {closedShops.length}</span>
              <div style={{ flex:1, height:1, background:'var(--divider)' }} />
            </div>
            <div style={{ padding:'0 12px', display:'flex', flexDirection:'column', gap:10 }}>
              {closedShops.slice(0, 4).map(shop => <ShopCardFull key={shop.id} shop={shop} />)}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          11. SUBSCRIPTIONS entry point
          ═══════════════════════════════════════════════ */}
      <Link href="/subscriptions" style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 16px 0', background:'var(--card-white)', borderRadius:16, padding:'14px 16px', textDecoration:'none', border:'1.5px solid var(--divider)', minHeight:56 }}>
        <div style={{ width:34, height:34, borderRadius:10, background:'rgba(255,48,8,.07)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg viewBox="0 0 24 24" fill="none" width={17} height={17}>
            <path d="M1 4v6h6M23 20v-6h-6" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>My Subscriptions</p>
          <p style={{ fontSize:11, color:'var(--text-muted)' }}>Daily milk, tiffin, eggs & more</p>
        </div>
        <svg viewBox="0 0 24 24" fill="none" style={{ width:14, height:14, flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </Link>

      {/* ═══════════════════════════════════════════════
          ZONE 8 — PERSISTENT CART BAR
          ═══════════════════════════════════════════════ */}
      {cartCount > 0 && (
        <Link href="/cart"
          style={{ position:'fixed', bottom:'calc(64px + env(safe-area-inset-bottom,0px) + 8px)', left:16, right:16, zIndex:89, background:'#FF3008', borderRadius:16, padding:'13px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', textDecoration:'none', boxShadow:'0 -2px 24px rgba(255,48,8,.32)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>{cartCount}</span>
            </div>
            <span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>{cartCount === 1 ? '1 item' : `${cartCount} items`} in cart</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:14, fontWeight:900, color:'#fff' }}>View Cart</span>
            <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </Link>
      )}

      <BottomNav active="home" />
    </div>
    </>
  )
}

// ── VALUE PROP ANIMATED TICKER ────────────────────────────────────
function ValuePropStrip() {
  const items = [
    { icon: <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff"/></svg>, text:'₹0 Platform fee' },
    { icon: <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>, text:'₹0 Night charges' },
    { icon: <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/></svg>, text:'₹0 Handling fee' },
    { icon: <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text:'Offline menu prices' },
    { icon: <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>, text:'Lowest price guaranteed' },
  ]
  // Render twice for seamless loop
  const row = (
    <>
      {items.map((item, i) => (
        <div key={i} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'0 20px', borderRight:'1px solid rgba(255,255,255,.25)', flexShrink:0 }}>
          {item.icon}
          <span style={{ fontSize:12, fontWeight:800, color:'#fff', whiteSpace:'nowrap', letterSpacing:'0.01em' }}>{item.text}</span>
        </div>
      ))}
    </>
  )
  return (
    <div style={{ margin:'14px 0 0', background:'#1a1a1a', overflow:'hidden', height:36, display:'flex', alignItems:'center', position:'relative' }}>
      {/* Fade edges */}
      <div style={{ position:'absolute', left:0, top:0, bottom:0, width:24, background:'linear-gradient(to right,#1a1a1a,transparent)', zIndex:2 }} />
      <div style={{ position:'absolute', right:0, top:0, bottom:0, width:24, background:'linear-gradient(to left,#1a1a1a,transparent)', zIndex:2 }} />
      {/* Ticker */}
      <div className="ticker-track">
        {row}{row}
      </div>
    </div>
  )
}

// ── PRICE BAND SECTION ────────────────────────────────────────────
// ── PRICE BAND CARD — top-level (never nested) so cart hook is stable ──
function PriceBandCard({ product: p }: { product: Product }) {
  const cart = useCart() as any
  const disc = p.original_price && p.original_price > p.price
    ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : null
  const qty: number = cart.items?.find((i: any) => i.product.id === p.id)?.quantity ?? 0

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault()
    if (cart.shop_id && cart.shop_id !== p.shop_id && cart.items?.length > 0) {
      window.location.href = `/stores/${p.shop_id}`; return
    }
    cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, shop_id: p.shop_id }, p.shop_id, p.shop_name || '')
  }

  function handleRemove(e: React.MouseEvent) {
    e.preventDefault()
    cart.updateQty(p.id, qty - 1)
  }

  // outer wrapper: position:relative so action button can be absolutely placed
  return (
    <div style={{ flexShrink:0, width:160, position:'relative' }}>
      {/* ── Card body: Link handles navigation ── */}
      <Link href={`/stores/${p.shop_id}`}
        style={{ display:'block', textDecoration:'none', background:'var(--card-white)', borderRadius:16, overflow:'hidden', border:'1px solid var(--divider)', boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
        <div style={{ height:140, position:'relative', background:'var(--chip-bg)', overflow:'hidden' }}>
          {p.image_url
            ? <Image src={p.image_url} alt={p.name} fill sizes="160px" className="object-cover" />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>}
          {disc && (
            <div style={{ position:'absolute', top:8, left:8, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:6 }}>-{disc}%</div>
          )}
        </div>
        <div style={{ padding:'9px 11px 11px' }}>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{p.name}</p>
          {p.shop_name && <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.shop_name}</p>}
          <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
            <span style={{ fontSize:14, fontWeight:900, color:'#FF3008' }}>₹{p.price}</span>
            {p.original_price && p.original_price > p.price && (
              <span style={{ fontSize:10, color:'var(--text-faint)', textDecoration:'line-through' }}>₹{p.original_price}</span>
            )}
          </div>
        </div>
      </Link>
      {/* ── Action button: outside Link, absolutely positioned over image ── */}
      {qty > 0 ? (
        <div style={{ position:'absolute', top:100, right:8, display:'flex', alignItems:'center', background:'#FF3008', borderRadius:20, boxShadow:'0 3px 10px rgba(255,48,8,.4)', overflow:'hidden', zIndex:3 }}>
          <button onClick={handleRemove} style={{ width:26, height:26, border:'none', background:'transparent', color:'#fff', fontSize:18, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>−</button>
          <span style={{ fontSize:12, fontWeight:900, color:'#fff', minWidth:16, textAlign:'center' }}>{qty}</span>
          <button onClick={handleAdd} style={{ width:26, height:26, border:'none', background:'transparent', color:'#fff', fontSize:18, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>+</button>
        </div>
      ) : (
        <button onClick={handleAdd}
          style={{ position:'absolute', top:100, right:8, width:32, height:32, borderRadius:'50%', border:'none', background:'#FF3008', color:'#fff', fontSize:22, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, lineHeight:1, boxShadow:'0 3px 10px rgba(255,48,8,.4)', zIndex:3 }}>+</button>
      )}
    </div>
  )
}

function PriceBandSection({ under49, under100 }: { under49: Product[]; under100: Product[] }) {
  return (
    <>
      {under49.length >= 2 && (
        <div style={{ marginTop:22 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Under ₹49</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Chai, snacks & impulse picks</p>
            </div>
            <Link href="/search" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {under49.map(p => <PriceBandCard key={p.id} product={p} />)}
          </div>
        </div>
      )}

      {under100.length >= 2 && (
        <div style={{ marginTop:22 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Meals under</p>
              <span style={{ fontSize:14, fontWeight:900, color:'#FF3008', border:'2px solid #FF3008', borderRadius:20, padding:'1px 10px', lineHeight:1.6 }}>₹99</span>
            </div>
            <Link href="/search" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See All →</Link>
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {under100.map(p => <PriceBandCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </>
  )
}

// ── SHOP + PRODUCTS ROW (Swiggy-style) ───────────────────────────
function ShopProductRow({ shop, products }: { shop: Shop & { km: number | null }; products: Product[] }) {
  const cart      = useCart() as any
  const catKey    = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color     = CAT_COLOR[catKey]
  const kmTxt     = shop.km === null ? null : shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`
  const isOpen    = computeIsOpen(shop)
  const isBoosted = (shop.boost_weight ?? 0) > 0
  const rating    = shop.rating ?? 0
  const ratingBg  = rating >= 4 ? '#16a34a' : rating >= 3 ? '#d97706' : rating > 0 ? '#ef4444' : null

  function addToCart(p: Product, e: React.MouseEvent) {
    e.preventDefault()
    if (cart.shop_id && cart.shop_id !== p.shop_id && cart.items?.length > 0) {
      window.location.href = `/stores/${p.shop_id}`; return
    }
    cart.addItem({ id: p.id, name: p.name, price: p.price, image_url: p.image_url, shop_id: p.shop_id }, p.shop_id, shop.name)
  }

  // Each product card is (screenWidth - 32px padding - gaps) / 3 ≈ 108px, show 3 then "View all"
  const CARD_W = 116

  return (
    <div style={{ background:'var(--card-white)', borderRadius:20, overflow:'hidden', border:'1px solid var(--divider)', boxShadow:'0 1px 8px rgba(0,0,0,.07)' }}>

      {/* ── Shop header ── */}
      <Link href={`/stores/${shop.id}`}
        onClick={() => { if (isBoosted) createClient().rpc('increment_boost_click', { p_shop_id: shop.id, p_date: new Date().toISOString().slice(0,10) }) }}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px 12px', textDecoration:'none' }}>
        {/* Thumbnail */}
        <div style={{ width:54, height:54, borderRadius:14, overflow:'hidden', flexShrink:0, background:`${color}18`, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {shop.image_url
            ? <Image src={shop.image_url} alt={shop.name} fill sizes="54px" className="object-cover" style={isOpen ? undefined : { filter:'grayscale(60%)' }} />
            : <span style={{ color, opacity:.45, display:'flex' }}>{getCatIcon(catKey)}</span>}
        </div>

        {/* Text block */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Boost label above shop name */}
          {isBoosted && shop.boost_badge && (
            <p style={{ fontSize:9, fontWeight:800, color: shop.boost_badge_color ?? '#6b7280', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:2 }}>{shop.boost_badge}</p>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <p style={{ fontWeight:900, fontSize:15, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em', flex:1 }}>{shop.name}</p>
            {/* Rating pill */}
            {rating > 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:3, background: ratingBg ?? '#6b7280', borderRadius:7, padding:'3px 8px', flexShrink:0 }}>
                <svg viewBox="0 0 24 24" fill="#fff" width={9} height={9}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span style={{ color:'#fff', fontWeight:900, fontSize:11 }}>{rating.toFixed(1)}</span>
              </div>
            ) : (
              <span style={{ fontSize:10, color:'#9ca3af', fontWeight:700, flexShrink:0 }}>New</span>
            )}
          </div>
          {/* Meta line: category · distance · time */}
          <p style={{ fontSize:12, color:'var(--text-muted)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom: (shop.free_delivery_above === 0 || shop.offer_text || !isOpen) ? 5 : 0 }}>
            {shop.category_name?.split(' ')[0]}
            {kmTxt ? ` · ${kmTxt}` : ''} · {shop.avg_delivery_time} min
          </p>
          {/* Offer/status chips */}
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {!isOpen && <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:'#374151', padding:'2px 8px', borderRadius:5 }}>Closed now</span>}
            {shop.free_delivery_above === 0 && isOpen && <span style={{ fontSize:10, fontWeight:700, color:'#16a34a', background:'rgba(22,163,74,.1)', padding:'2px 8px', borderRadius:5 }}>Free Delivery</span>}
            {shop.offer_text && <span style={{ fontSize:10, fontWeight:700, color:'#FF3008', background:'rgba(255,48,8,.08)', padding:'2px 8px', borderRadius:5 }}>{shop.offer_text}</span>}
          </div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" style={{ width:14, height:14, flexShrink:0, color:'var(--text-faint)' }}><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </Link>

      {/* ── Product grid: horizontal scroll, 3 visible + view-all ── */}
      {products.length > 0 && (
        <>
          <div style={{ height:1, background:'var(--divider)', margin:'0 16px' }} />
          <div style={{ display:'flex', gap:8, overflowX:'auto', padding:'12px 16px 14px', scrollbarWidth:'none' }}>
            {products.slice(0, 6).map(p => {
              const disc = p.original_price && p.original_price > p.price
                ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : null
              const qty: number = cart.items?.find((i: any) => i.product.id === p.id)?.quantity ?? 0
              // top offset: CARD_W - button_h(28) - 6px gap = CARD_W - 34
              const btnTop = CARD_W - 34
              return (
                <div key={p.id} style={{ flexShrink:0, width:CARD_W, position:'relative' }}>
                  {/* Card: Link handles all navigation */}
                  <Link href={`/stores/${p.shop_id}`} style={{ display:'block', textDecoration:'none' }}>
                    <div style={{ width:CARD_W, height:CARD_W, borderRadius:14, overflow:'hidden', position:'relative', background:'var(--chip-bg)', marginBottom:7 }}>
                      {p.image_url
                        ? <Image src={p.image_url} alt={p.name} fill sizes={`${CARD_W}px`} className="object-cover" />
                        : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <svg viewBox="0 0 24 24" fill="none" width={30} height={30}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>}
                      {disc && (
                        <div style={{ position:'absolute', top:6, left:6, background:'#FF3008', color:'#fff', fontSize:9, fontWeight:900, padding:'2px 6px', borderRadius:5 }}>-{disc}%</div>
                      )}
                    </div>
                    <p style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3, lineHeight:1.3 }}>{p.name}</p>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <span style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)' }}>₹{p.price}</span>
                      {p.original_price && p.original_price > p.price && (
                        <span style={{ fontSize:10, color:'var(--text-faint)', textDecoration:'line-through' }}>₹{p.original_price}</span>
                      )}
                    </div>
                  </Link>
                  {/* Action: outside Link, positioned over image — no click conflict */}
                  {qty > 0 ? (
                    <div style={{ position:'absolute', top:btnTop, right:6, display:'flex', alignItems:'center', background:'#FF3008', borderRadius:16, boxShadow:'0 2px 8px rgba(255,48,8,.4)', overflow:'hidden', zIndex:3 }}>
                      <button onClick={(e) => { e.preventDefault(); cart.updateQty(p.id, qty - 1) }}
                        style={{ width:22, height:22, border:'none', background:'transparent', color:'#fff', fontSize:16, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>−</button>
                      <span style={{ fontSize:11, fontWeight:900, color:'#fff', minWidth:14, textAlign:'center' }}>{qty}</span>
                      <button onClick={(e) => addToCart(p, e)}
                        style={{ width:22, height:22, border:'none', background:'transparent', color:'#fff', fontSize:16, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>+</button>
                    </div>
                  ) : (
                    <button onClick={(e) => addToCart(p, e)}
                      style={{ position:'absolute', top:btnTop, right:6, width:28, height:28, borderRadius:'50%', border:'none', background:'#FF3008', color:'#fff', fontSize:20, fontWeight:300, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0, lineHeight:1, boxShadow:'0 2px 8px rgba(255,48,8,.4)', zIndex:3 }}>+</button>
                  )}
                </div>
              )
            })}

            {/* View all tile — same size as product card */}
            <Link href={`/stores/${shop.id}`}
              style={{ flexShrink:0, width:CARD_W, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, textDecoration:'none', borderRadius:14, background:'var(--page-bg)', border:'1.5px dashed var(--divider)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width={14} height={14}><path d="M9 18l6-6-6-6" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize:11, fontWeight:800, color:'#FF3008', textAlign:'center', lineHeight:1.3 }}>View{'\n'}all</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ── SHOP CARD FULL (closed shops — dimmed below the fold) ─────────
function ShopCardFull({ shop }: { shop: Shop & { km: number | null } }) {
  const catKey   = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color    = CAT_COLOR[catKey]
  const discMatch = shop.offer_text?.match(/(\d+)\s*%/)
  const discPct   = discMatch ? discMatch[1] : null
  const kmTxt    = shop.km === null ? null : shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`
  const isOpen   = computeIsOpen(shop)
  const isBoosted = (shop.boost_weight ?? 0) > 0
  const rating   = shop.rating ?? 0
  // rating color: 4+ green, 3+ amber, below red
  const ratingBg = rating >= 4 ? '#16a34a' : rating >= 3 ? '#d97706' : rating > 0 ? '#ef4444' : '#6b7280'

  function handleClick() {
    if (!isBoosted) return
    createClient().rpc('increment_boost_click', { p_shop_id: shop.id, p_date: new Date().toISOString().slice(0, 10) })
  }

  return (
    <Link href={`/stores/${shop.id}`} onClick={handleClick}
      style={{ display:'block', textDecoration:'none', background:'var(--card-white)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,.07)', border:'1px solid var(--divider)' }}>

      {/* Banner image */}
      <div style={{ height:168, position:'relative', background:`${color}18`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {shop.image_url
          ? <Image src={shop.image_url} alt={shop.name} fill sizes="(max-width:640px) 100vw, 600px" className="object-cover"
              style={isOpen ? undefined : { filter:'grayscale(60%) brightness(.8)' }} />
          : <span style={{ color, opacity:.22, display:'flex', transform:'scale(2.2)' }}>{getCatIcon(catKey)}</span>
        }
        {/* Top-left: discount badge */}
        {discPct && (
          <div style={{ position:'absolute', top:10, left:10, background:'#FF3008', color:'#fff', fontSize:11, fontWeight:900, padding:'4px 10px', borderRadius:9 }}>
            {discPct}% OFF
          </div>
        )}
        {/* Top-right: boost badge OR closed */}
        {isBoosted && shop.boost_badge ? (
          <div style={{ position:'absolute', top:10, right:10, background: shop.boost_badge_color ?? '#6b7280', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 9px', borderRadius:7, letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {shop.boost_badge}
          </div>
        ) : !isOpen ? (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.38)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ background:'rgba(0,0,0,.72)', color:'#fff', fontSize:12, fontWeight:800, padding:'5px 14px', borderRadius:10, letterSpacing:'0.06em' }}>CLOSED</span>
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:5 }}>
          <p style={{ fontWeight:900, fontSize:16, color:'var(--text-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>{shop.name}</p>
          {/* Rating pill */}
          {rating > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:4, background:ratingBg, borderRadius:8, padding:'4px 8px', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" fill="#fff" width={10} height={10}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span style={{ color:'#fff', fontWeight:800, fontSize:12, lineHeight:1 }}>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {shop.category_name}
        </p>
        {/* Meta row */}
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--text-muted)', flexWrap:'wrap' }}>
          <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <span>{shop.avg_delivery_time} min</span>
          {kmTxt && <>
            <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', display:'inline-block' }} />
            <span>{kmTxt} away</span>
          </>}
          {shop.free_delivery_above != null && shop.free_delivery_above === 0 && <>
            <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', display:'inline-block' }} />
            <span style={{ color:'#16a34a', fontWeight:700 }}>Free delivery</span>
          </>}
        </div>
        {/* Offer text */}
        {shop.offer_text && !discPct && (
          <div style={{ marginTop:9, display:'flex', alignItems:'center', gap:6, background:'rgba(255,48,8,.06)', borderRadius:10, padding:'6px 10px' }}>
            <svg viewBox="0 0 24 24" fill="none" width={13} height={13}><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" stroke="#FF3008" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round"/></svg>
            <span style={{ fontSize:11, fontWeight:700, color:'#FF3008' }}>{shop.offer_text}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
