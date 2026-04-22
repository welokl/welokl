// src/hooks/useFCM.ts
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFCMToken, onForegroundMessage } from '@/lib/firebase'

// Exported so business/delivery dashboards can call after explicit permission grant
export async function registerFCMToken(userId: string) {
  if (typeof window === 'undefined') return
  const token = await getFCMToken()
  if (!token) return
  const sb = createClient()
  await sb.from('users').update({
    fcm_token:            token,
    fcm_token_updated_at: new Date().toISOString(),
  }).eq('id', userId)
}

export function useFCM(userId: string | null) {
  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return

    async function register() {
      // Request permission explicitly before attempting token — Chrome PWA requires this
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {})
      }
      if (Notification.permission !== 'granted') return

      const token = await getFCMToken()
      if (!token) return

      const sb = createClient()
      await sb.from('users').update({
        fcm_token:            token,
        fcm_token_updated_at: new Date().toISOString(),
      }).eq('id', userId!)
    }

    register()

    // Foreground notifications
    onForegroundMessage(({ title, body, url }) => {
      window.dispatchEvent(new CustomEvent('dwarpar-notification', {
        detail: { title, body, url }
      }))
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon:  '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            data:  { url },
          } as NotificationOptions & { vibrate?: number[] })
        })
      }
    })
  }, [userId])
}