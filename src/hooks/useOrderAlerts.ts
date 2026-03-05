'use client'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Audio engine — Web Audio API, zero external files ─────────────────────────
function playSound(type: 'new_order' | 'status_update' | 'delivery_assigned') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const patterns: Record<string, [number, number][]> = {
      new_order:         [[660,0],[880,0.18],[1100,0.36],[1320,0.54]],
      status_update:     [[880,0],[1100,0.22]],
      delivery_assigned: [[1046,0],[1046,0.20],[1318,0.40]],
    }
    const urgent = type !== 'status_update'
    patterns[type].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), t = ctx.currentTime + offset
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = urgent ? 'square' : 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(urgent ? 0.9 : 0.6, t + 0.01)
      gain.gain.linearRampToValueAtTime(0, t + 0.14)
      osc.start(t); osc.stop(t + 0.15)
    })
  } catch { }
}

function vibrate(pattern: number[]) {
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch { }
}

// renotify is valid but some TS lib versions don't include it — cast to any to avoid the error
async function pushNotify(title: string, body: string, tag = 'welokl') {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') await Notification.requestPermission().catch(() => {})
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', tag, ...({ renotify: true } as any) })
  } catch { }
}

export function requestNotificationPermission() {
  if (typeof window === 'undefined') return
  if ('Notification' in window && Notification.permission === 'default')
    Notification.requestPermission().catch(() => {})
}

// ── HOOK 1: Shopkeeper ────────────────────────────────────────────────────────
export function useShopkeeperOrderAlerts(shopId: string | null | undefined) {
  const supabase = createClient()
  const ready = useRef(false)
  useEffect(() => {
    if (!shopId) return
    const t = setTimeout(() => { ready.current = true }, 1000)
    const ch = supabase
      .channel(`sk-${shopId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, payload => {
        if (!ready.current) return
        const o = payload.new as any
        playSound('new_order')
        vibrate([200, 80, 200, 80, 400])
        pushNotify('🛒 New Order!', `Order #${o.order_number || o.id?.slice(0,8)} just arrived`)
      })
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [shopId]) // eslint-disable-line
}

// ── HOOK 2: Customer ──────────────────────────────────────────────────────────
export function useCustomerOrderAlerts(customerId: string | null | undefined) {
  const supabase = createClient()
  useEffect(() => {
    if (!customerId) return
    const ch = supabase
      .channel(`cust-${customerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` }, payload => {
        const n = payload.new as any, o = payload.old as any
        if (!n.status || n.status === o.status) return
        playSound('status_update')
        vibrate([100, 50, 100])
        const msgs: Record<string, [string, string]> = {
          accepted:         ['✅ Order Confirmed!',   'Shop accepted your order'],
          preparing:        ['👨‍🍳 Being Prepared',   'Your order is being cooked'],
          ready:            ['📦 Ready!',             'Your order is packed'],
          out_for_delivery: ['🛵 On the Way!',        'Rider is heading to you'],
          picked_up:        ['🛵 On the Way!',        'Rider picked up your order'],
          delivered:        ['🎉 Delivered!',         'Enjoy your order!'],
          cancelled:        ['❌ Cancelled',           'Your order was cancelled'],
        }
        const [title, body] = msgs[n.status] || ['📦 Update', `Status: ${n.status}`]
        pushNotify(title, body, `order-${n.order_number}`)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [customerId]) // eslint-disable-line
}

// ── HOOK 3: Delivery Partner ──────────────────────────────────────────────────
export function useDeliveryPartnerAlerts(partnerId: string | null | undefined, isOnline: boolean) {
  const supabase = createClient()
  useEffect(() => {
    if (!partnerId) return
    const ch = supabase
      .channel(`dp-${partnerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `delivery_partner_id=eq.${partnerId}` }, payload => {
        const n = payload.new as any, o = payload.old as any
        if (n.status === o.status) return
        const shop = n.shop_name || 'the shop'
        if (n.status === 'accepted' && !o.delivery_partner_id && n.delivery_partner_id === partnerId) {
          playSound('delivery_assigned'); vibrate([300, 100, 300, 100, 600])
          pushNotify('📦 New Delivery Job!', `Pick up from ${shop} — #${n.order_number}`, `dp-${n.order_number}`)
        } else if (n.status === 'ready') {
          playSound('delivery_assigned'); vibrate([300, 100, 300])
          pushNotify('✅ Order Ready for Pickup', `${shop} packed #${n.order_number}`, `dp-${n.order_number}`)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partnerId]) // eslint-disable-line
}