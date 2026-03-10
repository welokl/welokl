// src/hooks/useFCM.ts
// Drop this hook into layout or any dashboard page.
// It silently requests permission + saves token to Supabase on first load.
// No UI needed — user just sees the browser's native "Allow notifications" prompt.
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
      if (!token) return

      // Save token to Supabase — only update if changed
      const sb = createClient()
      const { data: existing } = await sb
        .from('users')
        .select('fcm_token')
        .eq('id', userId)
        .single()

      if (existing?.fcm_token === token) return // already up to date

      await sb.from('users').update({
        fcm_token: token,
        fcm_token_updated_at: new Date().toISOString(),
      }).eq('id', userId!)
    }

    register()

    // Handle foreground notifications (app is open)
    // Shows a simple in-app banner — SW handles background
    onForegroundMessage(({ title, body, url }) => {
      // Dispatch a custom event — dashboards can listen to this
      window.dispatchEvent(new CustomEvent('welokl-notification', {
        detail: { title, body, url }
      }))
      // Also show native notification if permission is granted
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            vibrate: [200, 100, 200],
            data: { url },
          })
        })
      }
    })
  }, [userId])
}
