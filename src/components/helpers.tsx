'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── PUSH NOTIFICATION SETUP ──
export function usePushNotifications(userId: string | null) {
  useEffect(() => {
    if (!userId || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        if (existing) return // already subscribed

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })

        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, subscription: sub }),
        })
      } catch {}
    }

    subscribe()
  }, [userId])
}

// ── LOCATION BAR COMPONENT ──
interface SavedLocation {
  lat: number
  lng: number
  address: string
  area: string
  city: string
  label: string
}

export function LocationBar({ returnTo = '/stores' }: { returnTo?: string }) {
  const [location, setLocation] = useState<SavedLocation | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('welokl_location')
    if (saved) {
      try { setLocation(JSON.parse(saved)) } catch {}
    }
  }, [])

  return (
    <Link href={`/location?return=${encodeURIComponent(returnTo)}`}>
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 hover:border-brand-500 transition-colors cursor-pointer group">
        <span className="text-brand-500 text-sm flex-shrink-0">📍</span>
        <div className="flex-1 min-w-0">
          {location ? (
            <>
              <p className="text-xs font-bold text-ink truncate">{location.label === 'home' ? '🏠 Home' : location.label === 'work' ? '💼 Work' : `📌 ${location.label}`}</p>
              <p className="text-xs text-gray-400 truncate">{location.area || location.city}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 font-medium">Set your delivery location</p>
          )}
        </div>
        <span className="text-gray-400 text-xs group-hover:text-brand-500 transition-colors flex-shrink-0">▼</span>
      </div>
    </Link>
  )
}

// ── ORDER AGAIN BUTTON ──
export function OrderAgainButton({ shopId, items }: { shopId: string; items: Array<{ product_id: string; quantity: number }> }) {
  function handleOrderAgain() {
    // Store items in session for cart restoration
    sessionStorage.setItem('welokl_reorder', JSON.stringify({ shopId, items }))
    window.location.href = `/stores/${shopId}`
  }

  return (
    <button
      onClick={handleOrderAgain}
      className="flex items-center gap-2 text-xs font-semibold text-brand-500 bg-brand-50 border border-brand-200 px-3 py-1.5 rounded-xl hover:bg-brand-100 transition-all active:scale-95"
    >
      🔄 Order again
    </button>
  )
}

// ── DELIVERY COUNTDOWN TIMER ──
export function DeliveryCountdown({ pickedUpAt, estimatedMinutes = 20 }: { pickedUpAt: string; estimatedMinutes?: number }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    function calc() {
      const pickupTime = new Date(pickedUpAt).getTime()
      const deliveryTime = pickupTime + estimatedMinutes * 60 * 1000
      const now = Date.now()
      const rem = Math.max(0, Math.round((deliveryTime - now) / 60000))
      setRemaining(rem)
    }

    calc()
    const t = setInterval(calc, 30000)
    return () => clearInterval(t)
  }, [pickedUpAt, estimatedMinutes])

  if (remaining === null) return null

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold ${remaining <= 5 ? 'bg-green-50 text-green-700' : 'bg-brand-50 text-brand-600'}`}>
      <span className="animate-pulse">🛵</span>
      {remaining === 0 ? 'Arriving now!' : `Arriving in ~${remaining} min`}
    </div>
  )
}

// ── NOTIFICATION TOAST ──
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (typeof window === 'undefined') return

  const toast = document.createElement('div')
  const colors = { success: '#22c55e', error: '#ef4444', info: '#f97316' }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' }

  toast.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
    background: ${colors[type]}; color: white;
    padding: 12px 20px; border-radius: 12px;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 9999; opacity: 0;
    transition: all 0.3s ease;
    white-space: nowrap;
    display: flex; align-items: center; gap: 8px;
  `
  toast.innerHTML = `${icons[type]} ${message}`
  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateX(-50%) translateY(0)'
  })

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateX(-50%) translateY(20px)'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
