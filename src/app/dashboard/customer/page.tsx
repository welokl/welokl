'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useFCM } from '@/hooks/useFCM'
import { useCart } from '@/store/cart'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { computeIsOpen } from '@/lib/shopHours'
import type { Order, User } from '@/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_ICONS } from '@/types'
import { useCustomerOrderAlerts } from '@/hooks/useOrderAlerts'
import ThemeToggle from '@/components/ThemeToggle'
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
const CAT_ICON_SVG: Record<string,JSX.Element> = {
  food:        <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  grocery:     <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pharmacy:    <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  electronics: <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  salon:       <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><circle cx="18" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M3.51 8.51L10 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  hardware:    <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pet:         <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2 .336-3.5 2.057-3.5 4 0 .75.562 1.931 1 2.5M14 5.172C14 3.782 15.577 2.679 17.5 3c2 .336 3.5 2.057 3.5 4 0 .75-.562 1.931-1 2.5M12 19c-4 0-7-1.5-7-5 0-2 1-3.5 3.5-4.5M12 19c4 0 7-1.5 7-5 0-2-1-3.5-3.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  default:     <svg viewBox="0 0 24 24" fill="none" width={36} height={36}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
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
  const [loading, setLoading]             = useState(true)
  const [shopsLoaded, setShopsLoaded]     = useState(false)
  const [locStatus, setLocStatus]         = useState<'idle'|'detecting'|'granted'|'denied'>('idle')
  const [userLat, setUserLat]             = useState<number | null>(null)
  const [userLng, setUserLng]             = useState<number | null>(null)
  const [areaName, setAreaName]           = useState('')
  const [radius, setRadius]               = useState(5)
  const [activeCategory, setActiveCat]    = useState<string | null>(null)
  const [activeCats, setActiveCats]       = useState<{name:string; q:string}[]>([])
  const [showPhoneGate, setShowPhoneGate] = useState(false)

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
    setOrders(orderData || [])
    setLoading(false)
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
    // ── Personalization signals from order history ─────────────
    const shopFreq: Record<string, number> = {}   // weighted order count per shop
    const catFreq:  Record<string, number> = {}   // weighted order count per category
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const now = Date.now()

    orders.filter(o => o.status === 'delivered').forEach(o => {
      const sid = (o as any).shop_id
      const cat = ((o as any).shop?.category_name || '').toLowerCase()
      // Recent orders (≤30 days) count double — recency×frequency signal
      const recent = now - new Date((o as any).created_at || 0).getTime() < thirtyDays
      const w = recent ? 2 : 1
      if (sid) shopFreq[sid] = (shopFreq[sid] || 0) + w
      if (cat) catFreq[cat]  = (catFreq[cat]  || 0) + w
    })

    // Top preferred categories (ordered by score)
    const preferredCats = Object.entries(catFreq).sort((a, b) => b[1] - a[1]).map(([c]) => c)

    // Time-of-day meal period: breakfast / lunch / dinner
    const h = new Date().getHours()
    const isMealTime = (h >= 7 && h <= 10) || (h >= 12 && h <= 14) || (h >= 19 && h <= 21)

    // ── Personalized shop score ────────────────────────────────
    // Target impressions per boosted shop per day (rotation resets after this)
    const DAILY_IMP_TARGET = 60
    function scoreShop(s: { id: string; rating: number; km: number | null; is_open: boolean; avg_delivery_time: number; category_name?: string | null; boost_weight?: number; today_impressions?: number }): number {
      let pts = 0
      // ── PAID BOOST (dominant signal) ──────────────────────────
      const bw = s.boost_weight ?? 0
      if (bw > 0) {
        // Rotation fairness: penalise shops that have already had high exposure today
        // Max 40% reduction — a Premium shop (100) will never fall below 60 pts from boost alone
        const imp = s.today_impressions ?? 0
        const rotationPenalty = Math.min(imp / DAILY_IMP_TARGET, 0.4) * bw
        pts += bw - rotationPenalty
      }
      // ── ORGANIC SIGNALS ───────────────────────────────────────
      // Frequency: +10 per weighted order, cap at 50
      pts += Math.min((shopFreq[s.id] || 0) * 10, 50)
      // Category preference: +35 for #1 preferred, +20 for #2
      const cat = (s.category_name || '').toLowerCase()
      if (preferredCats[0] && cat.includes(preferredCats[0])) pts += 35
      else if (preferredCats[1] && cat.includes(preferredCats[1])) pts += 20
      // Rating: +12.5 per star above 3.0, cap at 25
      pts += Math.max(0, Math.min((s.rating - 3) * 12.5, 25))
      // Distance: -6 per km, cap at -30
      if (s.km !== null) pts -= Math.min(s.km * 6, 30)
      // Meal-time speed bonus
      if (isMealTime && computeIsOpen(s) && s.avg_delivery_time <= 30) pts += 12
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
  const dealProducts   = products.filter(p => p.original_price && p.original_price > p.price)
  const featuredProds  = dealProducts.length > 0 ? dealProducts : products
  const greeting       = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()

  // Past-order shops sorted by frequency (most ordered = shown first)
  const pastOrderShopData = (() => {
    const freq: Record<string, { lastOrder: any; count: number }> = {}
    orders.filter(o => o.status === 'delivered' && (o as any).shop_id).forEach(o => {
      const sid = (o as any).shop_id
      if (!freq[sid]) freq[sid] = { lastOrder: o, count: 0 }
      freq[sid].count++
    })
    return Object.values(freq)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ lastOrder }) => {
        const s = allShops.find(sh => sh.id === (lastOrder as any).shop_id)
        if (!s) return null
        const km = (userLat && userLng && s.latitude && s.longitude)
          ? dist(userLat, userLng, Number(s.latitude), Number(s.longitude)) : null
        return { ...s, km }
      })
      .filter(Boolean) as (Shop & { km: number | null })[]
  })()

  // Fast-delivery shops (≤25 min) for horizontal preview row
  const fastDeliveryShops = openShops
    .filter(s => s.avg_delivery_time <= 25)
    .sort((a, b) => a.avg_delivery_time - b.avg_delivery_time)
    .slice(0, 6)

  // Remaining shops after fast-delivery (no duplication in vertical list)
  const remainingShops = openShops.filter(s => !fastDeliveryShops.find(f => f.id === s.id))

  return (
    <>
    <InAppToast />
    {showPhoneGate && user?.id && <PhoneGate userId={user.id} onDone={() => setShowPhoneGate(false)} />}
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:80 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%); background-size:400px 100%; animation:shimmer 1.4s infinite; border-radius:12px; }
        .shop-card { display:flex; align-items:center; background:var(--card-white); border-radius:20px; overflow:hidden; text-decoration:none; transition:transform .15s,box-shadow .15s; box-shadow:0 2px 8px rgba(0,0,0,.06); }
        .shop-card:active { transform:scale(.98); }
        .prod-card { background:var(--card-white); border-radius:18px; overflow:hidden; text-decoration:none; display:block; box-shadow:0 2px 8px rgba(0,0,0,.05); }
        .prod-card:active { transform:scale(.97); }
        .nav-item { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; flex:1; padding:8px 4px; text-decoration:none; color:var(--text-muted); transition:color .15s; }
        .nav-item.on { color:#FF3008; }
        .nav-item svg { width:22px; height:22px; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ── 1. STICKY HEADER ──────────────────────────────────────── */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'var(--card-white)', boxShadow:'0 1px 0 rgba(0,0,0,.08)' }}>
        <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={detectLocation} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:18, height:18, flexShrink:0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF3008"/>
            </svg>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.05em', lineHeight:1 }}>DELIVER TO</div>
              <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
                <span style={{ fontSize:15, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                  {locStatus === 'detecting' ? 'Detecting…' : areaName ? areaName.split(',')[0].trim() : 'Set location'}
                </span>
                <svg viewBox="0 0 24 24" fill="none" style={{ width:13, height:13 }}>
                  <path d="M7 10l5 5 5-5" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Link href="/cart" style={{ position:'relative', width:38, height:38, borderRadius:12, background: cartCount > 0 ? '#FF3008' : 'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width:20, height:20 }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2"/>
                <path d="M16 10a4 4 0 01-8 0" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cartCount > 0 && (
                <span style={{ position:'absolute', top:-5, right:-5, width:18, height:18, background:'var(--card-white)', border:'2px solid #FF3008', borderRadius:'50%', fontSize:9, fontWeight:900, color:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
          </div>
        </div>
        <div style={{ padding:'3px 16px 0' }}>
          <p style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)' }}>
            {greeting}, <span style={{ color:'var(--text-primary)', fontWeight:800 }}>{user?.name?.split(' ')[0] || 'there'}</span>
          </p>
        </div>
        <div style={{ padding:'9px 16px 12px' }}>
          <Link href="/search" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, background:'var(--page-bg)', borderRadius:14, padding:'11px 14px' }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:17, height:17, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8" stroke="var(--text-muted)" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:600 }}>Search products, shops, services…</span>
          </Link>
        </div>
      </div>

      {/* ── 2. ACTIVE ORDER — always-visible pill ─────────────────── */}
      {activeOrders.length > 0 && (
        <Link href={`/orders/${activeOrders[0].id}`} style={{ display:'flex', alignItems:'center', gap:10, margin:'10px 12px 0', background:'#FF3008', borderRadius:16, padding:'12px 16px', textDecoration:'none', boxShadow:'0 4px 16px rgba(255,48,8,.3)' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#fff', flexShrink:0, animation:'pulse 1.5s infinite', display:'block' }} />
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:800, color:'#fff' }}>{(activeOrders[0] as any).shop?.name} · {ORDER_STATUS_LABELS[activeOrders[0].status as keyof typeof ORDER_STATUS_LABELS]}</p>
            <p style={{ fontSize:11, color:'rgba(255,255,255,.75)' }}>Tap to track your order</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" style={{ width:17, height:17, flexShrink:0 }}>
            <path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      )}

      {/* ── 3. QUICK ACTIONS — reorder card + category tiles ─────── */}
      {(() => {
        // Use DB categories when available, fallback to hardcoded so categories always show
        const displayCats = activeCats.length > 0
          ? activeCats
          : CATS.map(c => ({ name: c.label, q: c.q }))
        const showReorder = !!lastDelivered && !activeOrders.length
        if (!showReorder && !displayCats.length) return null
        return (
          <div style={{ margin:'16px 0 0' }}>
            <p style={{ padding:'0 16px', fontSize:15, fontWeight:900, color:'var(--text-primary)', marginBottom:12 }}>Quick Actions</p>
            <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:6 }}>

              {/* ── Reorder card ── */}
              {showReorder && (
                <button onClick={() => reorder(lastDelivered!)}
                  style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                  <div style={{ width:164, height:88, borderRadius:20, overflow:'hidden', position:'relative', background:'#111', boxShadow:'0 4px 18px rgba(0,0,0,.25)' }}>
                    {(lastDelivered as any).shop?.image_url && (
                      <Image src={(lastDelivered as any).shop.image_url} alt="" fill sizes="164px" className="object-cover" style={{ opacity:.45 }} />
                    )}
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(120deg, rgba(0,0,0,.75) 0%, rgba(0,0,0,.45) 100%)' }} />
                    {/* Icon LEFT + Text RIGHT */}
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', gap:11, padding:'0 15px' }}>
                      <div style={{ width:36, height:36, borderRadius:11, background:'rgba(255,255,255,.14)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <svg viewBox="0 0 24 24" fill="none" width={19} height={19}>
                          <path d="M1 4v6h6M23 20v-6h-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:15, fontWeight:900, color:'#fff', marginBottom:3, letterSpacing:'-0.02em' }}>Reorder</p>
                        <p style={{ fontSize:11, color:'rgba(255,255,255,.68)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:96 }}>
                          {(lastDelivered as any).shop?.name || 'Last order'}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {/* ── Category tiles ── */}
              {displayCats.map(cat => {
                const cfg = CATS.find(c => c.q === cat.q) || { color:'#FF3008', bg:'var(--red-light)' }
                const isActive = activeCategory === cat.q
                return (
                  <button key={cat.q} onClick={() => setActiveCat(isActive ? null : cat.q)}
                    style={{ flexShrink:0, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'center', fontFamily:'inherit' }}>
                    {/* Tile — same height as reorder card */}
                    <div style={{
                      width:90, height:88, borderRadius:20,
                      background: isActive ? cfg.color : 'var(--card-white)',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                      boxShadow: isActive ? `0 4px 18px ${cfg.color}55` : '0 3px 14px rgba(0,0,0,.08)',
                      border: isActive ? 'none' : '1px solid var(--divider)',
                      transition:'all .15s',
                    }}>
                      <span style={{ color: isActive ? '#fff' : cfg.color, display:'flex', transform:'scale(0.9)', lineHeight:0 }}>
                        {getCatIcon(cat.q)}
                      </span>
                      <p style={{ fontSize:11, fontWeight:800, color: isActive ? '#fff' : 'var(--text-primary)', lineHeight:1, margin:0 }}>{cat.name}</p>
                    </div>
                  </button>
                )
              })}

            </div>
          </div>
        )
      })()}

      {/* ── 5. HYPERLOCAL SHOPS FEED — dominant section ───────────── */}
      <div style={{ margin:'22px 0 0' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:17, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              {activeCategory
                ? `${activeCats.find(c => c.q === activeCategory)?.name || activeCategory} near you`
                : 'Popular near you'}
            </p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {shopsLoaded ? `${openShops.length} shops open` : 'Finding local shops…'}
              {locStatus === 'granted' && (
                <> · <button onClick={() => setRadius(prev => prev === 5 ? 2 : prev === 2 ? 1 : prev === 1 ? 7 : 5)}
                  style={{ background:'none', border:'none', color:'#FF3008', fontWeight:800, fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:0 }}>
                  {radius}km ↕
                </button></>
              )}
            </p>
          </div>
          <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
        </div>

        {locStatus === 'denied' && (
          <div style={{ margin:'0 12px', background:'var(--card-white)', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
            <div style={{ width:52, height:52, background:'var(--red-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={26} height={26}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>Allow location access</p>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>We show only shops in your neighbourhood</p>
            <button onClick={detectLocation} style={{ background:'#FF3008', border:'none', borderRadius:14, padding:'12px 28px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>
              Enable location
            </button>
          </div>
        )}

        {!shopsLoaded && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, padding:'0 12px' }}>
            {Array.from({length:5}).map((_,i) => <div key={i} className="sk" style={{ height:90, borderRadius:20 }} />)}
          </div>
        )}

        {/* Fast delivery horizontal strip */}
        {shopsLoaded && !activeCategory && fastDeliveryShops.length >= 2 && (
          <div style={{ marginBottom:22 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
              <p style={{ fontSize:17, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Fast Delivery</p>
              <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
            </div>
            <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4 }}>
              {fastDeliveryShops.map(shop => <ShopCardH key={shop.id} shop={shop} />)}
            </div>
          </div>
        )}

        {/* Popular near you — horizontal scroll */}
        {shopsLoaded && openShops.length > 0 && (
          <div style={{ marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
              <p style={{ fontSize:17, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                {activeCategory ? `${activeCats.find(c => c.q === activeCategory)?.name || 'Nearby'} Shops` : 'Popular near you'}
              </p>
              <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>
                See all
              </Link>
            </div>
            <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4 }}>
              {(fastDeliveryShops.length >= 2 && !activeCategory ? remainingShops : openShops)
                .slice(0, 10)
                .map(shop => <ShopCardH key={shop.id} shop={shop} />)
              }
            </div>
          </div>
        )}

        {shopsLoaded && displayShops.length === 0 && locStatus !== 'denied' && (
          <div style={{ margin:'0 12px', background:'var(--card-white)', borderRadius:20, padding:'36px 20px', textAlign:'center' }}>
            <div style={{ width:52, height:52, background:'var(--chip-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={26} height={26}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>No shops nearby</p>
            <p style={{ fontSize:13, color:'var(--text-muted)' }}>{locStatus === 'granted' ? 'Try expanding your radius' : 'Set your location to find shops'}</p>
          </div>
        )}
      </div>

      {/* ── 6. DEALS — 2-column grid (breaks monotony vs horizontal scroll) ── */}
      {!activeCategory && featuredProds.length > 0 && (
        <div style={{ margin:'22px 0 0' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{dealProducts.length > 0 ? 'Deals near you' : 'Top picks'}</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Best from local shops</p>
            </div>
            <Link href="/stores" style={{ fontSize:12, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
          </div>
          {products.length === 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 12px' }}>
              {Array.from({length:4}).map((_,i) => <div key={i} className="sk" style={{ height:195, borderRadius:16 }} />)}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 12px' }}>
              {featuredProds.slice(0, 6).map(p => <ProductGridCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ── 7. CLOSED SHOPS — compact horizontal, max 6 ──────────── */}
      {shopsLoaded && closedShops.length > 0 && (
        <div style={{ margin:'22px 0 0', opacity:0.55 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', marginBottom:10 }}>
            <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>OPENS LATER · {closedShops.length}</span>
            <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4 }}>
            {closedShops.slice(0, 6).map(shop => <ShopCardH key={shop.id} shop={shop} />)}
          </div>
        </div>
      )}

      {/* ── 8. PERSONALIZATION — from past orders ─────────────────── */}
      {pastOrderShopData.length >= 1 && (
        <div style={{ margin:'22px 0 0' }}>
          <div style={{ padding:'0 16px', marginBottom:12 }}>
            <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Because you ordered before</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Your trusted shops · one tap reorder</p>
          </div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4 }}>
            {pastOrderShopData.map(shop => <ShopCardH key={shop.id} shop={shop} />)}
          </div>
        </div>
      )}

      {/* ── 9. SUBSCRIPTIONS entry point ──────────────────────────── */}
      <Link href="/subscriptions" style={{ display:'flex', alignItems:'center', gap:10, margin:'20px 12px 0', background:'var(--card-white)', borderRadius:16, padding:'12px 16px', textDecoration:'none', border:'1.5px solid var(--divider)' }}>
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
        <svg viewBox="0 0 24 24" fill="none" style={{ width:15, height:15, flexShrink:0 }}><path d="M9 18l6-6-6-6" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </Link>

      <BottomNav active="home" />
    </div>
    </>
  )
}

// ── SHOP CARD ─────────────────────────────────────────────────────
function ShopCard({ shop, index }: { shop: Shop & { km: number | null }; index: number }) {
  const catKey  = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color   = CAT_COLOR[catKey]

  return (
    <Link href={`/stores/${shop.id}`} className="shop-card" style={{ animation:`fadeUp .2s ease ${index*30}ms both` }}>
      {/* Image */}
      <div style={{ width:90, height:90, flexShrink:0, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
        {shop.image_url
          ? <Image src={shop.image_url} alt={shop.name} fill sizes="90px" className="object-cover" />
          : <span style={{ color: color, opacity:.6, transform:'scale(1.3)', display:'flex' }}>{getCatIcon(catKey)}</span>
        }
        <div style={{ position:'absolute', bottom:5, left:5 }}>
          {computeIsOpen(shop)
            ? <span style={{ background:'#16a34a', color:'#fff', fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:5 }}>OPEN</span>
            : <span style={{ background:'rgba(0,0,0,.55)', color:'rgba(255,255,255,.7)', fontSize:8, fontWeight:800, padding:'2px 5px', borderRadius:5 }}>CLOSED</span>
          }
        </div>
      </div>

      {/* Info */}
      <div style={{ flex:1, padding:'10px 12px', minWidth:0 }}>
        <p style={{ fontWeight:800, fontSize:14, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shop.name}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {shop.category_name?.split(' ')[0]} · {shop.area}
        </p>
        {(shop.offer_text || shop.free_delivery_above) && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:4 }}>
            {shop.offer_text && <span style={{ fontSize:10, fontWeight:700, color:'#FF3008', background:'var(--red-light)', padding:'2px 7px', borderRadius:6 }}>{shop.offer_text}</span>}
            {shop.free_delivery_above && <span style={{ fontSize:10, fontWeight:700, color:'#16a34a', background:'var(--green-light)', padding:'2px 7px', borderRadius:6 }}>Free delivery above ₹{shop.free_delivery_above}</span>}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>
            <svg viewBox="0 0 24 24" fill="#f59e0b" width={12} height={12}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {(shop.rating ?? 0).toFixed(1)}
          </span>
          <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)' }} />
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--text-muted)' }}>
            <svg viewBox="0 0 24 24" fill="none" width={12} height={12}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            {shop.avg_delivery_time}min
          </span>
          {shop.km !== null && (
            <>
              <span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)' }} />
              <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--text-muted)' }}>
              <svg viewBox="0 0 24 24" fill="none" width={11} height={11}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="currentColor" opacity=".6"/></svg>
              {shop.km < 1 ? `${Math.round(shop.km*1000)}m` : `${shop.km.toFixed(1)}km`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{ paddingRight:14, flexShrink:0 }}>
        <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, color:'var(--text-faint)' }}>
          <path d="M9 18l6-6-6-6" stroke="var(--text-faint)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Link>
  )
}

// ── PRODUCT CARD ──────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null

  return (
    <Link href={`/stores/${product.shop_id}`} className="prod-card" style={{ width:140, flexShrink:0 }}>
      <div style={{ height:130, background:'var(--chip-bg)', position:'relative', overflow:'hidden' }}>
        {product.image_url
          ? <Image src={product.image_url} alt={product.name} fill sizes="140px" className="object-cover" />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><svg viewBox="0 0 24 24" fill="none" width={40} height={40}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        }
        {disc && (
          <div style={{ position:'absolute', top:8, left:8, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 7px', borderRadius:8 }}>
            -{disc}%
          </div>
        )}
      </div>
      <div style={{ padding:'10px 10px 12px' }}>
        <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>{product.name}</p>
        {product.shop_name && <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.shop_name}</p>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize:11, color:'var(--text-faint)', textDecoration:'line-through', marginLeft:4 }}>₹{product.original_price}</span>}
          </div>
          <div style={{ width:28, height:28, borderRadius:8, border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008', fontSize:18, fontWeight:900, lineHeight:1 }}>+</div>
        </div>
      </div>
    </Link>
  )
}

// ── SHOP CARD H (horizontal scroll variant) ───────────────────────
function ShopCardH({ shop }: { shop: Shop & { km: number | null } }) {
  const catKey  = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color   = CAT_COLOR[catKey]
  const discMatch = shop.offer_text?.match(/(\d+)\s*%/)
  const discPct   = discMatch ? discMatch[1] : null
  const kmTxt = shop.km === null ? null : shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`
  const isBoosted = (shop.boost_weight ?? 0) > 0

  function handleClick() {
    if (!isBoosted) return
    const sb = createClient()
    sb.rpc('increment_boost_click', { p_shop_id: shop.id, p_date: new Date().toISOString().slice(0, 10) })
  }

  return (
    <Link href={`/stores/${shop.id}`}
      onClick={handleClick}
      style={{ flexShrink:0, width:172, background:'var(--card-white)', borderRadius:20, overflow:'hidden', textDecoration:'none', boxShadow:'0 3px 14px rgba(0,0,0,.11)', border:'1px solid var(--divider)', display:'block' }}>

      {/* ── Image ── */}
      <div style={{ height:116, background:`${color}18`, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {shop.image_url
          ? <Image src={shop.image_url} alt={shop.name} fill sizes="172px" className="object-cover"
              style={computeIsOpen(shop) ? undefined : { filter:'grayscale(55%) brightness(.85)' }} />
          : <span style={{ color, opacity:.28, transform:'scale(1.2)', display:'flex' }}>{getCatIcon(catKey)}</span>
        }
        {/* Boost badge — top-right, replaces open status when boosted */}
        {isBoosted && shop.boost_badge ? (
          <div style={{ position:'absolute', top:8, right:8, background: shop.boost_badge_color ?? '#6b7280', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:6, letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {shop.boost_badge}
          </div>
        ) : !computeIsOpen(shop) ? (
          <div style={{ position:'absolute', top:9, right:9, background:'rgba(0,0,0,.72)', color:'rgba(255,255,255,.85)', fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:6, letterSpacing:'0.06em' }}>
            CLOSED
          </div>
        ) : null}
        {/* Discount badge */}
        {discPct && (
          <div style={{ position:'absolute', top:9, left:9, background:'#FF3008', color:'#fff', fontSize:12, fontWeight:900, padding:'3px 9px', borderRadius:8, letterSpacing:'-0.01em' }}>
            {discPct}%
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding:'10px 11px 11px' }}>
        <p style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3, letterSpacing:'-0.01em' }}>{shop.name}</p>
        <p style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:9 }}>
          {shop.category_name?.split(' ')[0]} / {shop.avg_delivery_time}min
        </p>
        {/* Bottom row: rating · time · km — arrow */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
            <svg viewBox="0 0 24 24" fill="#f59e0b" width={10} height={10}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span style={{ color:'var(--text-primary)', fontWeight:800 }}>{(shop.rating ?? 0).toFixed(1)}</span>
            <span>·</span>
            <span>{shop.avg_delivery_time}m</span>
            {kmTxt && <><span>·</span><span>{kmTxt}</span></>}
          </div>
          {/* Outlined arrow button */}
          <div style={{ width:28, height:28, borderRadius:'50%', border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg viewBox="0 0 24 24" fill="none" width={13} height={13}>
              <path d="M9 18l6-6-6-6" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── PRODUCT GRID CARD (2-column grid variant) ─────────────────────
function ProductGridCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null
  return (
    <Link href={`/stores/${product.shop_id}`}
      style={{ background:'var(--card-white)', borderRadius:16, overflow:'hidden', textDecoration:'none', boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
      <div style={{ height:118, background:'var(--chip-bg)', position:'relative', overflow:'hidden' }}>
        {product.image_url
          ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width:480px) 50vw, 240px" className="object-cover" />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={34} height={34}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
        }
        {disc && (
          <div style={{ position:'absolute', top:7, left:7, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'2px 6px', borderRadius:7 }}>
            -{disc}%
          </div>
        )}
      </div>
      <div style={{ padding:'9px 10px 11px' }}>
        <p style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>{product.name}</p>
        {product.shop_name && <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.shop_name}</p>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:13, fontWeight:900, color:'var(--text-primary)' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize:10, color:'var(--text-faint)', textDecoration:'line-through', marginLeft:3 }}>₹{product.original_price}</span>}
          </div>
          <div style={{ width:26, height:26, borderRadius:7, border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008', fontSize:16, fontWeight:900, lineHeight:1 }}>+</div>
        </div>
      </div>
    </Link>
  )
}