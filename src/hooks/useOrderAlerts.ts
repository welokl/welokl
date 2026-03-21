'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Audio engine ─────────────────────────────────────────────
function playSound(type: 'new_order' | 'status_update' | 'delivery_assigned' | 'new_available') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const patterns: Record<string, { freqs: number[]; offsets: number[]; wave: OscillatorType; vol: number }> = {
      new_order:         { freqs: [660,880,1100,1320,880,1320], offsets: [0,.18,.36,.54,.72,.90], wave: 'square', vol: 1.0 },
      status_update:     { freqs: [880,1100],                   offsets: [0,.22],                 wave: 'sine',   vol: 0.6 },
      delivery_assigned: { freqs: [1046,1046,1318],             offsets: [0,.20,.40],             wave: 'square', vol: 0.85 },
      new_available:     { freqs: [880,1100,880,1100,880,1320], offsets: [0,.20,.42,.62,.84,1.06], wave: 'square', vol: 1.0 },
    }
    const p = patterns[type]
    p.freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      const t = ctx.currentTime + p.offsets[i]
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = p.wave
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(p.vol, t + 0.01)
      gain.gain.linearRampToValueAtTime(0, t + 0.14)
      osc.start(t); osc.stop(t + 0.15)
    })
  } catch { }
}

function vibrate(pattern: number[]) {
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch { }
}

// ── In-app toast (for when the tab is open / active) ─────────
function inAppToast(title: string, body: string, color = '#FF3008', icon = '🔔') {
  try {
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent('welokl-toast', { detail: { title, body, color, icon } }))
  } catch {}
}

// ── Notification via Service Worker (survives backgrounding on Android/iOS PWA)
// Falls back to new Notification() if SW not available
async function pushNotify(title: string, body: string, tag = 'welokl', url = '/') {
  if (typeof window === 'undefined') return

  // Request permission if needed
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission().catch(() => {})
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  // Preferred: post to service worker — persists even when tab is backgrounded on mobile
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.active) {
        reg.active.postMessage({ type: 'NOTIFY', title, body, tag, url })
        return
      }
      // SW registered but not yet active — use showNotification directly
      await reg.showNotification(title, {
        body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png',
        tag, vibrate: [200, 100, 200],
        data: { url },
      } as NotificationOptions & { vibrate?: number[]; renotify?: boolean })
      return
    } catch { }
  }

  // Fallback: standard Notification API (works when tab is active/visible)
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag, ...({ renotify: true } as any) })
  } catch { }
}

export function requestNotificationPermission() {
  if (typeof window === 'undefined') return
  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission().catch(() => {})
}

// ── Visibility reconnect helper ───────────────────────────────
// When phone brings app back to foreground after suspension,
// the Supabase WebSocket may have died. We force a page reload
// only if the session gap was long enough to lose connection.
function useVisibilityReconnect(onVisible: () => void) {
  useEffect(() => {
    let hiddenAt = 0
    function handleVisibility() {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else {
        // If backgrounded for more than 30 seconds, refresh data
        if (hiddenAt && Date.now() - hiddenAt > 30_000) {
          onVisible()
        }
        hiddenAt = 0
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [onVisible]) // eslint-disable-line
}

export { useVisibilityReconnect }

// ─────────────────────────────────────────────────────────────
// HOOK 1: Shopkeeper — new order arrives for their shop
// ─────────────────────────────────────────────────────────────
export function useShopkeeperOrderAlerts(shopId: string | null | undefined) {
  const supabase = createClient()
  const ready = useRef(false)

  useEffect(() => {
    if (!shopId) return
    const t = setTimeout(() => { ready.current = true }, 1500)
    const ch = supabase
      .channel(`sk-alerts-${shopId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` },
        payload => {
          if (!ready.current) return
          const o = payload.new as any
          playSound('new_order')
          vibrate([200, 80, 200, 80, 400, 80, 400])
          pushNotify('🛒 New Order!', `Order #${o.order_number || o.id?.slice(0,8)} just arrived`, `order-${o.id}`, '/dashboard/business')
          inAppToast('🛒 New Order!', `Order #${o.order_number || o.id?.slice(0,8)} just arrived`, '#FF3008', '🛒')
        }
      )
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [shopId]) // eslint-disable-line
}

// ─────────────────────────────────────────────────────────────
// HOOK 2: Customer — order status changes
// ─────────────────────────────────────────────────────────────
export function useCustomerOrderAlerts(customerId: string | null | undefined) {
  const supabase = createClient()

  useEffect(() => {
    if (!customerId) return
    const ch = supabase
      .channel(`cust-alerts-${customerId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` },
        payload => {
          const n = payload.new as any, o = payload.old as any
          if (!n.status || n.status === o.status) return
          playSound('status_update')
          vibrate([200, 80, 200, 80, 400])
          const msgs: Record<string, [string, string, string, string]> = {
            accepted:  ['✅ Order Confirmed!',  'Your shop accepted the order',    '#16a34a', '✅'],
            preparing: ['👨‍🍳 Being Prepared',   'Your order is being prepared',    '#f59e0b', '👨‍🍳'],
            ready:     ['📦 Ready!',             'Your order is packed and ready',  '#2563eb', '📦'],
            picked_up: ['🛵 On the Way!',        'Rider picked up your order',      '#7c3aed', '🛵'],
            delivered: ['🎉 Delivered!',          'Your order has been delivered!',  '#16a34a', '🎉'],
            cancelled: ['❌ Order Cancelled',      'Your order was cancelled',        '#ef4444', '❌'],
            rejected:  ['❌ Order Rejected',       'The shop could not accept your order', '#ef4444', '❌'],
          }
          const [title, body, color, icon] = msgs[n.status] || ['📦 Order Update', `Status: ${n.status}`, '#FF3008', '📦']
          pushNotify(title, body, `order-${n.order_number}`, '/dashboard/customer')
          inAppToast(title, body, color, icon)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [customerId]) // eslint-disable-line
}

// ─────────────────────────────────────────────────────────────
// HOOK 3: Delivery Partner
//   Channel A — orders assigned to them (active order updates)
//   Channel B — any order going 'ready' with no partner yet
// ─────────────────────────────────────────────────────────────
export function useDeliveryPartnerAlerts(
  partnerId: string | null | undefined,
  isOnline: boolean
) {
  const supabase = createClient()
  const ready = useRef(false)
  const lastAlerted = useRef<string | null>(null)

  useEffect(() => {
    if (!partnerId) return
    const t = setTimeout(() => { ready.current = true }, 1500)

    // Channel A: my assigned order updates
    const chA = supabase
      .channel(`dp-assigned-${partnerId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `delivery_partner_id=eq.${partnerId}` },
        payload => {
          if (!ready.current) return
          const n = payload.new as any, o = payload.old as any
          if (n.status === o.status) return
          if (n.status === 'picked_up') {
            playSound('delivery_assigned')
            vibrate([300, 100, 300, 100, 600])
            pushNotify('📦 Pickup Verified!', `Go deliver #${n.order_number}`, `dp-job-${n.order_number}`, '/dashboard/delivery')
            inAppToast('📦 Pickup Verified!', `Go deliver #${n.order_number}`, '#2563eb', '📦')
          }
        }
      )
      .subscribe()

    // Channel B: new available orders (ready, no partner yet)
    const chB = supabase
      .channel(`dp-available-${partnerId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        payload => {
          if (!ready.current || !isOnline) return
          const n = payload.new as any, o = payload.old as any
          if (n.status !== 'ready' || o.status === 'ready') return
          if (n.delivery_partner_id != null) return
          if (n.type !== 'delivery') return
          if (lastAlerted.current === n.id) return
          lastAlerted.current = n.id
          setTimeout(() => { if (lastAlerted.current === n.id) lastAlerted.current = null }, 10000)
          playSound('new_available')
          vibrate([400, 100, 400, 100, 400, 100, 800])
          pushNotify('🛵 New Order Available!', `Tap to accept — earn ₹20!`, `dp-avail-${n.id}`, '/dashboard/delivery')
          inAppToast('🛵 New Order Available!', 'Tap to accept — earn ₹20!', '#FF3008', '🛵')
        }
      )
      .subscribe()

    return () => { clearTimeout(t); supabase.removeChannel(chA); supabase.removeChannel(chB) }
  }, [partnerId, isOnline]) // eslint-disable-line
}