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
  const dealProducts   = products.filter(p => p.original_price && p.original_price > p.price)
  // Sort by order frequency desc — most-ordered products surface first
  const sortByFreq     = (arr: Product[]) => [...arr].sort((a, b) => (prodFreqMap[b.id] || 0) - (prodFreqMap[a.id] || 0))
  const featuredProds  = sortByFreq(dealProducts.length > 0 ? dealProducts : products)
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

  const mealLabel = (() => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch picks' : 'Dinner picks' })()

  return (
    <>
    <InAppToast />
    {showPhoneGate && user?.id && <PhoneGate userId={user.id} onDone={() => setShowPhoneGate(false)} />}
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:88 }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .sk { background:linear-gradient(90deg,var(--bg-3) 25%,var(--bg-2) 50%,var(--bg-3) 75%); background-size:400px 100%; animation:shimmer 1.4s infinite; border-radius:12px; }
        .qa:active { transform:scale(.95); opacity:.9; }
        .stap:active { opacity:.8; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* ═══════════════════════════════════════════════
          1. STICKY HEADER — location + greeting + search
          ═══════════════════════════════════════════════ */}
      <div style={{ position:'sticky', top:0, zIndex:100, background:'var(--card-white)', boxShadow:'0 1px 0 rgba(0,0,0,.07)' }}>
        <div style={{ padding:'12px 16px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <button onClick={detectLocation} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', minHeight:44 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, flexShrink:0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF3008"/>
            </svg>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.06em' }}>DELIVER TO</div>
              <div style={{ display:'flex', alignItems:'center', gap:3, marginTop:1 }}>
                <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                  {locStatus === 'detecting' ? 'Detecting…' : areaName ? areaName.split(',')[0].trim() : 'Set location'}
                </span>
                <svg viewBox="0 0 24 24" fill="none" style={{ width:12, height:12 }}><path d="M7 10l5 5 5-5" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Link href="/cart" style={{ position:'relative', width:40, height:40, borderRadius:12, background: cartCount > 0 ? '#FF3008' : 'var(--page-bg)', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none' }}>
              <svg viewBox="0 0 24 24" fill="none" style={{ width:20, height:20 }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2"/>
                <path d="M16 10a4 4 0 01-8 0" stroke={cartCount > 0 ? '#fff' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cartCount > 0 && <span style={{ position:'absolute', top:-4, right:-4, width:16, height:16, background:'var(--card-white)', border:'2px solid #FF3008', borderRadius:'50%', fontSize:8, fontWeight:900, color:'#FF3008', display:'flex', alignItems:'center', justifyContent:'center' }}>{cartCount > 9 ? '9+' : cartCount}</span>}
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {/* Search bar */}
        <div style={{ padding:'8px 16px 12px' }}>
          <Link href="/search" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, background:'var(--page-bg)', borderRadius:12, padding:'0 14px', height:44 }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width:16, height:16, flexShrink:0 }}>
              <circle cx="11" cy="11" r="8" stroke="var(--text-muted)" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:500 }}>Search food, shops, services…</span>
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

      {/* ═══════════════════════════════════════════════
          3. QUICK ACTIONS — horizontal scroll cards
          ═══════════════════════════════════════════════ */}
      <div style={{ marginTop:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
          <p style={{ fontSize:15, fontWeight:900, color:'var(--text-primary)' }}>
            {greeting}, <span style={{ color:'var(--text-secondary)', fontWeight:600 }}>{user?.name?.split(' ')[0] || 'there'}</span>
          </p>
        </div>
        <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>

          {/* Reorder — only if past delivered order exists */}
          {lastDelivered && !activeOrders.length && (
            <button onClick={() => reorder(lastDelivered)} className="qa"
              style={{ flexShrink:0, width:132, height:90, borderRadius:16, border:'none', cursor:'pointer', fontFamily:'inherit', padding:'12px', overflow:'hidden', background:'linear-gradient(135deg,#FF3008 0%,#ff6b35 100%)', boxShadow:'0 6px 18px rgba(255,48,8,.28)', transition:'transform .15s', display:'flex', flexDirection:'column', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M1 4v6h6M23 20v-6h-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ textAlign:'left' }}>
                <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1.2 }}>Reorder</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:108 }}>{(lastDelivered as any).shop?.name || 'Last order'}</p>
              </div>
            </button>
          )}

          {/* My Orders */}
          <Link href="/orders/history" className="qa"
            style={{ flexShrink:0, width:132, height:90, borderRadius:16, background:'linear-gradient(135deg,#7c3aed 0%,#9f67fa 100%)', boxShadow:'0 6px 18px rgba(124,58,237,.22)', textDecoration:'none', padding:'12px', display:'flex', flexDirection:'column', justifyContent:'space-between', transition:'transform .15s' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1.2 }}>My Orders</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>Track & reorder</p>
            </div>
          </Link>

          {/* Fast Delivery */}
          <Link href="/stores" className="qa"
            style={{ flexShrink:0, width:132, height:90, borderRadius:16, background:'linear-gradient(135deg,#d97706 0%,#fbbf24 100%)', boxShadow:'0 6px 18px rgba(217,119,6,.22)', textDecoration:'none', padding:'12px', display:'flex', flexDirection:'column', justifyContent:'space-between', transition:'transform .15s' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1.2 }}>Fast Delivery</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>Under 30 min</p>
            </div>
          </Link>

          {/* Meal-time picks */}
          <Link href="/search" className="qa"
            style={{ flexShrink:0, width:132, height:90, borderRadius:16, background:'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)', boxShadow:'0 6px 18px rgba(22,163,74,.18)', textDecoration:'none', padding:'12px', display:'flex', flexDirection:'column', justifyContent:'space-between', transition:'transform .15s' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1.2 }}>{mealLabel}</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>What to eat now</p>
            </div>
          </Link>

          {/* Near me */}
          <Link href="/stores" className="qa"
            style={{ flexShrink:0, width:132, height:90, borderRadius:16, background:'linear-gradient(135deg,#0ea5e9 0%,#38bdf8 100%)', boxShadow:'0 6px 18px rgba(14,165,233,.18)', textDecoration:'none', padding:'12px', display:'flex', flexDirection:'column', justifyContent:'space-between', transition:'transform .15s' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,.22)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#fff"/></svg>
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1.2 }}>Near Me</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>{openShops.length || '–'} open now</p>
            </div>
          </Link>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          4. CATEGORY CHIPS — horizontal pill scroll
          ═══════════════════════════════════════════════ */}
      {(() => {
        const displayCats = activeCats.length > 0 ? activeCats : CATS.map(c => ({ name: c.label, q: c.q }))
        if (!displayCats.length) return null
        return (
          <div style={{ marginTop:16 }}>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:2, scrollbarWidth:'none' }}>
              {/* All pill */}
              <button onClick={() => setActiveCat(null)}
                style={{ flexShrink:0, height:36, padding:'0 16px', borderRadius:20, border:`1.5px solid ${!activeCategory ? '#FF3008' : 'var(--divider)'}`, background: !activeCategory ? '#FF3008' : 'var(--card-white)', color: !activeCategory ? '#fff' : 'var(--text-secondary)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}>
                All
              </button>
              {displayCats.map(cat => {
                const cfg = CATS.find(c => c.q === cat.q) || { color:'#FF3008' }
                const isActive = activeCategory === cat.q
                return (
                  <button key={cat.q} onClick={() => setActiveCat(isActive ? null : cat.q)}
                    style={{ flexShrink:0, height:36, padding:'0 16px', borderRadius:20, border:`1.5px solid ${isActive ? cfg.color : 'var(--divider)'}`, background: isActive ? cfg.color : 'var(--card-white)', color: isActive ? '#fff' : 'var(--text-secondary)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap' }}>
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════
          5. POPULAR NEAR YOU — horizontal cards 240px
          ═══════════════════════════════════════════════ */}
      <div style={{ marginTop:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
          <div>
            <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              {activeCategory ? `${activeCats.find(c => c.q === activeCategory)?.name || activeCategory} near you` : 'Popular near you'}
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
          <div style={{ margin:'0 16px', background:'var(--card-white)', borderRadius:20, padding:'28px 20px', textAlign:'center' }}>
            <div style={{ width:48, height:48, background:'var(--red-light)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg viewBox="0 0 24 24" fill="none" width={24} height={24}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" fill="#FF3008"/></svg>
            </div>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>Allow location access</p>
            <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>We show only shops in your neighbourhood</p>
            <button onClick={detectLocation} style={{ background:'#FF3008', border:'none', borderRadius:12, padding:'12px 28px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', fontFamily:'inherit' }}>Enable location</button>
          </div>
        )}

        {!shopsLoaded && (
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4 }}>
            {Array.from({length:4}).map((_,i) => <div key={i} className="sk" style={{ width:240, flexShrink:0, height:192, borderRadius:20 }} />)}
          </div>
        )}

        {shopsLoaded && openShops.length > 0 && (
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {openShops.slice(0, 8).map(shop => <PopularShopCard key={shop.id} shop={shop} />)}
          </div>
        )}

        {shopsLoaded && displayShops.length === 0 && locStatus !== 'denied' && (
          <div style={{ margin:'0 16px', background:'var(--card-white)', borderRadius:20, padding:'32px 20px', textAlign:'center' }}>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:6 }}>No shops nearby</p>
            <p style={{ fontSize:13, color:'var(--text-muted)' }}>{locStatus === 'granted' ? 'Try expanding your radius' : 'Set your location to find shops'}</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          6. FAST DELIVERY ⚡ — ETA-focused horizontal
          ═══════════════════════════════════════════════ */}
      {shopsLoaded && !activeCategory && fastDeliveryShops.length >= 2 && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>⚡ Fast Delivery</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Arrives under 30 min</p>
            </div>
            <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
          </div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {fastDeliveryShops.map(shop => <FastShopCard key={shop.id} shop={shop} />)}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          7. BECAUSE YOU ORDERED BEFORE — 1-tap reorder
          ═══════════════════════════════════════════════ */}
      {!activeCategory && pastOrderShopData.length >= 1 && (
        <div style={{ marginTop:24 }}>
          <div style={{ padding:'0 16px', marginBottom:12 }}>
            <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>Because you ordered before</p>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Your trusted shops · one tap reorder</p>
          </div>
          <div style={{ display:'flex', gap:12, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {pastOrderShopData.map(shop => {
              const lastOrder = orders.find(o => o.status === 'delivered' && (o as any).shop_id === shop.id)
              return <PastOrderCard key={shop.id} shop={shop} lastOrder={lastOrder} onReorder={reorder} />
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          8. CATEGORY FILTERED — vertical full cards
          ═══════════════════════════════════════════════ */}
      {shopsLoaded && activeCategory && openShops.length > 0 && (
        <div style={{ marginTop:8, padding:'0 12px', display:'flex', flexDirection:'column', gap:12 }}>
          {openShops.slice(0, 12).map(shop => <ShopCardFull key={shop.id} shop={shop} />)}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          9. DEALS — 2-column grid
          ═══════════════════════════════════════════════ */}
      {!activeCategory && featuredProds.length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', marginBottom:12 }}>
            <div>
              <p style={{ fontSize:16, fontWeight:900, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{dealProducts.length > 0 ? 'Deals near you' : 'Top picks'}</p>
              <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>Best from local shops</p>
            </div>
            <Link href="/stores" style={{ fontSize:13, fontWeight:800, color:'#FF3008', textDecoration:'none' }}>See all</Link>
          </div>
          {products.length === 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:'0 16px' }}>
              {Array.from({length:4}).map((_,i) => <div key={i} className="sk" style={{ height:200, borderRadius:16 }} />)}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, padding:'0 16px' }}>
              {featuredProds.slice(0, 6).map(p => <DealCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          10. CLOSED SHOPS — dimmed horizontal
          ═══════════════════════════════════════════════ */}
      {shopsLoaded && !activeCategory && closedShops.length > 0 && (
        <div style={{ marginTop:24, opacity:0.5 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 16px', marginBottom:10 }}>
            <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>OPENS LATER · {closedShops.length}</span>
            <div style={{ flex:1, height:1, background:'var(--chip-bg)' }} />
          </div>
          <div style={{ display:'flex', gap:10, overflowX:'auto', paddingLeft:16, paddingRight:16, paddingBottom:4, scrollbarWidth:'none' }}>
            {closedShops.slice(0, 6).map(shop => <ShopCardH key={shop.id} shop={shop} />)}
          </div>
        </div>
      )}

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

// ── SHOP CARD FULL (Zomato-style vertical card) ───────────────────
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

// ── POPULAR SHOP CARD — 240px wide horizontal card ────────────────
function PopularShopCard({ shop }: { shop: Shop & { km: number | null } }) {
  const catKey  = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color   = CAT_COLOR[catKey]
  const kmTxt   = shop.km === null ? null : shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`
  const rating  = shop.rating ?? 0
  const ratingBg = rating >= 4 ? '#16a34a' : rating >= 3 ? '#d97706' : rating > 0 ? '#ef4444' : '#6b7280'
  const isBoosted = (shop.boost_weight ?? 0) > 0
  const isOpen = computeIsOpen(shop)

  return (
    <Link href={`/stores/${shop.id}`} onClick={() => { if (isBoosted) createClient().rpc('increment_boost_click', { p_shop_id: shop.id, p_date: new Date().toISOString().slice(0,10) }) }}
      style={{ flexShrink:0, width:240, borderRadius:20, overflow:'hidden', textDecoration:'none', background:'var(--card-white)', boxShadow:'0 3px 14px rgba(0,0,0,.1)', border:'1px solid var(--divider)', display:'block' }}>
      {/* Image — 60% of card height */}
      <div style={{ height:136, position:'relative', background:`${color}18`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {shop.image_url
          ? <Image src={shop.image_url} alt={shop.name} fill sizes="240px" className="object-cover" style={isOpen ? undefined : { filter:'grayscale(55%) brightness(.8)' }} />
          : <span style={{ color, opacity:.25, display:'flex', transform:'scale(1.8)' }}>{getCatIcon(catKey)}</span>
        }
        {/* Rating pill — bottom left */}
        {rating > 0 && (
          <div style={{ position:'absolute', bottom:8, left:8, display:'flex', alignItems:'center', gap:3, background:ratingBg, borderRadius:7, padding:'3px 7px' }}>
            <svg viewBox="0 0 24 24" fill="#fff" width={9} height={9}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span style={{ color:'#fff', fontWeight:800, fontSize:11 }}>{rating.toFixed(1)}</span>
          </div>
        )}
        {/* Boost badge or closed */}
        {isBoosted && shop.boost_badge ? (
          <div style={{ position:'absolute', top:8, right:8, background: shop.boost_badge_color ?? '#6b7280', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:6, letterSpacing:'0.06em', textTransform:'uppercase' }}>{shop.boost_badge}</div>
        ) : !isOpen ? (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.32)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ background:'rgba(0,0,0,.7)', color:'#fff', fontSize:11, fontWeight:800, padding:'4px 12px', borderRadius:8 }}>CLOSED</span>
          </div>
        ) : null}
        {/* Offer badge */}
        {shop.offer_text?.match(/\d+\s*%/) && (
          <div style={{ position:'absolute', top:8, left:8, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:7 }}>
            {shop.offer_text.match(/(\d+\s*%)/)?.[1]} OFF
          </div>
        )}
      </div>
      {/* Info — 40% */}
      <div style={{ padding:'10px 12px 12px' }}>
        <p style={{ fontWeight:900, fontSize:14, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em', marginBottom:3 }}>{shop.name}</p>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
          <svg viewBox="0 0 24 24" fill="none" width={11} height={11}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          <span>{shop.avg_delivery_time} min</span>
          {kmTxt && <><span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', display:'inline-block' }} /><span>{kmTxt}</span></>}
          {shop.category_name && <><span style={{ width:3, height:3, borderRadius:'50%', background:'var(--text-faint)', display:'inline-block' }} /><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:70 }}>{shop.category_name.split(' ')[0]}</span></>}
        </div>
      </div>
    </Link>
  )
}

// ── FAST SHOP CARD — ETA-prominent, 180px wide ────────────────────
function FastShopCard({ shop }: { shop: Shop & { km: number | null } }) {
  const catKey = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color  = CAT_COLOR[catKey]
  const kmTxt  = shop.km === null ? null : shop.km < 1 ? `${Math.round(shop.km * 1000)}m` : `${shop.km.toFixed(1)}km`

  return (
    <Link href={`/stores/${shop.id}`}
      style={{ flexShrink:0, width:180, borderRadius:20, overflow:'hidden', textDecoration:'none', background:'var(--card-white)', boxShadow:'0 3px 14px rgba(0,0,0,.1)', border:'1px solid var(--divider)', display:'block' }}>
      {/* Image with ETA badge overlaid at bottom */}
      <div style={{ height:118, position:'relative', background:`${color}18`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {shop.image_url
          ? <Image src={shop.image_url} alt={shop.name} fill sizes="180px" className="object-cover" />
          : <span style={{ color, opacity:.25, display:'flex', transform:'scale(1.5)' }}>{getCatIcon(catKey)}</span>
        }
        {/* Gradient scrim for ETA badge */}
        <div style={{ position:'absolute', inset:'40% 0 0', background:'linear-gradient(to bottom, transparent, rgba(0,0,0,.65))' }} />
        {/* ETA badge — bottom left, always prominent */}
        <div style={{ position:'absolute', bottom:8, left:8, display:'flex', alignItems:'center', gap:4, background:'#fbbf24', borderRadius:8, padding:'4px 8px' }}>
          <svg viewBox="0 0 24 24" fill="none" width={10} height={10}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="#000"/></svg>
          <span style={{ color:'#000', fontWeight:900, fontSize:11 }}>{shop.avg_delivery_time} MIN</span>
        </div>
      </div>
      {/* Info */}
      <div style={{ padding:'9px 11px 11px' }}>
        <p style={{ fontWeight:900, fontSize:13, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em', marginBottom:3 }}>{shop.name}</p>
        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>
          <svg viewBox="0 0 24 24" fill="#f59e0b" width={10} height={10}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span style={{ color:'var(--text-primary)', fontWeight:800 }}>{(shop.rating ?? 0).toFixed(1)}</span>
          {kmTxt && <><span>·</span><span>{kmTxt}</span></>}
        </div>
      </div>
    </Link>
  )
}

// ── PAST ORDER CARD — with 1-tap "Order again" button ─────────────
function PastOrderCard({ shop, lastOrder, onReorder }: { shop: Shop & { km: number | null }; lastOrder: any; onReorder: (o: any) => void }) {
  const catKey = Object.keys(CAT_SVG).find(k => k !== 'default' && shop.category_name?.toLowerCase().replace(/[^a-z]/g,'').includes(k)) || 'default'
  const color  = CAT_COLOR[catKey]
  const isOpen = computeIsOpen(shop)

  return (
    <div style={{ flexShrink:0, width:172, borderRadius:20, overflow:'hidden', background:'var(--card-white)', boxShadow:'0 3px 14px rgba(0,0,0,.1)', border:'1px solid var(--divider)', display:'flex', flexDirection:'column' }}>
      {/* Top: clickable shop area */}
      <Link href={`/stores/${shop.id}`} style={{ textDecoration:'none', display:'block' }}>
        <div style={{ height:100, position:'relative', background:`${color}18`, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {shop.image_url
            ? <Image src={shop.image_url} alt={shop.name} fill sizes="172px" className="object-cover" style={isOpen ? undefined : { filter:'grayscale(55%)' }} />
            : <span style={{ color, opacity:.25, display:'flex', transform:'scale(1.4)' }}>{getCatIcon(catKey)}</span>
          }
          {!isOpen && (
            <div style={{ position:'absolute', top:7, right:7, background:'rgba(0,0,0,.65)', color:'#fff', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:5 }}>CLOSED</div>
          )}
        </div>
        <div style={{ padding:'9px 11px 6px' }}>
          <p style={{ fontWeight:900, fontSize:13, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', letterSpacing:'-0.01em' }}>{shop.name}</p>
          <p style={{ fontSize:10, color:'var(--text-muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {shop.category_name?.split(' ')[0]} · {shop.avg_delivery_time}min
          </p>
        </div>
      </Link>
      {/* Bottom: 1-tap reorder button */}
      <button onClick={() => lastOrder && onReorder(lastOrder)}
        style={{ margin:'0 10px 10px', padding:'8px 0', borderRadius:10, border:'1.5px solid #FF3008', background:'transparent', color:'#FF3008', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5, marginTop:'auto' }}>
        Order again
        <svg viewBox="0 0 24 24" fill="none" width={12} height={12}><path d="M9 18l6-6-6-6" stroke="#FF3008" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  )
}

// ── DEAL CARD — 2-column grid product card ────────────────────────
function DealCard({ product }: { product: Product }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100) : null
  return (
    <Link href={`/stores/${product.shop_id}`}
      style={{ background:'var(--card-white)', borderRadius:16, overflow:'hidden', textDecoration:'none', boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'block', border:'1px solid var(--divider)' }}>
      <div style={{ height:130, background:'var(--chip-bg)', position:'relative', overflow:'hidden' }}>
        {product.image_url
          ? <Image src={product.image_url} alt={product.name} fill sizes="(max-width:480px) 50vw, 240px" className="object-cover" />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg viewBox="0 0 24 24" fill="none" width={32} height={32}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" stroke="var(--text-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
        }
        {disc && (
          <div style={{ position:'absolute', top:8, left:8, background:'#FF3008', color:'#fff', fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:7 }}>-{disc}%</div>
        )}
      </div>
      <div style={{ padding:'10px 10px 12px' }}>
        <p style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3 }}>{product.name}</p>
        {product.shop_name && <p style={{ fontSize:10, color:'var(--text-muted)', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.shop_name}</p>}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontSize:14, fontWeight:900, color:'var(--text-primary)' }}>₹{product.price}</span>
            {product.original_price && <span style={{ fontSize:10, color:'var(--text-faint)', textDecoration:'line-through', marginLeft:4 }}>₹{product.original_price}</span>}
          </div>
          <div style={{ width:28, height:28, borderRadius:8, border:'1.5px solid #FF3008', display:'flex', alignItems:'center', justifyContent:'center', color:'#FF3008', fontSize:18, fontWeight:900, lineHeight:1, flexShrink:0 }}>+</div>
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
      style={{ background:'var(--card-white)', borderRadius:16, overflow:'hidden', textDecoration:'none', boxShadow:'0 2px 8px rgba(0,0,0,.05)', width:148, flexShrink:0, display:'block' }}>
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