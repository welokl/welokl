'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function NotificationSetup({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Check if already dismissed
    if (localStorage.getItem('welokl_notif_dismissed')) { setDismissed(true); return }
    // Check current permission
    if ('Notification' in window) {
      if (Notification.permission === 'granted') { setStatus('granted'); subscribeUser(userId); return }
      if (Notification.permission === 'denied') { setStatus('denied'); return }
      // Show prompt after 3 seconds
      setTimeout(() => setStatus('asking'), 3000)
    }
  }, [userId])

  async function subscribeUser(uid: string) {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Save to DB
        await saveSub(uid, existing)
        return
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await saveSub(uid, sub)
    } catch (e) {
      console.log('Push subscription failed:', e)
    }
  }

  async function saveSub(uid: string, sub: PushSubscription) {
    const supabase = createClient()
    await supabase.from('push_subscriptions').upsert({
      user_id: uid,
      subscription: JSON.stringify(sub),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  async function requestPermission() {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      setStatus('granted')
      await subscribeUser(userId)
    } else {
      setStatus('denied')
      localStorage.setItem('welokl_notif_dismissed', '1')
    }
  }

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('welokl_notif_dismissed', '1')
  }

  if (dismissed || status === 'idle' || status === 'granted' || status === 'denied') return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🔔
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Get order updates</p>
            <p className="text-xs text-gray-400 mt-0.5">We'll notify you when your order is accepted, out for delivery, and delivered</p>
            <div className="flex gap-2 mt-3">
              <button onClick={requestPermission}
                className="flex-1 bg-brand-500 text-white text-xs font-bold py-2 rounded-xl">
                Allow notifications
              </button>
              <button onClick={dismiss}
                className="px-3 text-xs text-gray-400 hover:text-gray-600">
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}
