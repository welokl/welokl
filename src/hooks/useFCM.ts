// src/hooks/useFCM.ts
'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getFCMToken, onForegroundMessage } from '@/lib/firebase'

export function useFCM(userId: string | null) {
  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined') return

    async function register() {
      const token = await getFCMToken()
      if (!token) { console.log('[FCM] no token obtained'); return }

      console.log('[FCM] saving token to DB')
      const sb = createClient()

      // Always update — don't skip even if same token
      // SW change can invalidate old token silently
      await sb.from('users').update({
        fcm_token:            token,
        fcm_token_updated_at: new Date().toISOString(),
      }).eq('id', userId!)

      console.log('[FCM] token saved')
    }

    register()

    // Foreground notifications
    onForegroundMessage(({ title, body, url }) => {
      window.dispatchEvent(new CustomEvent('welokl-notification', {
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