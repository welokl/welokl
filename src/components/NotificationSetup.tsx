// src/components/NotificationSetup.tsx
// Shows a one-time "Allow notifications" prompt to users.
// Place this anywhere in your layout or dashboard.
// After useFCM is added to dashboards, you may not need this at all —
// useFCM handles permission + token registration automatically.
// This component just gives a nicer in-app nudge UI.
'use client'
import { useEffect, useState } from 'react'
import { useFCM } from '@/hooks/useFCM'

export default function NotificationSetup({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [dismissed, setDismissed] = useState(false)

  // This handles the actual FCM token registration
  useFCM(userId)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('welokl_notif_dismissed')) { setDismissed(true); return }
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') { setStatus('granted'); return }
    if (Notification.permission === 'denied')  { setStatus('denied');  return }
    // Show nudge after 3 seconds
    const t = setTimeout(() => setStatus('asking'), 3000)
    return () => clearTimeout(t)
  }, [userId])

  function dismiss() {
    localStorage.setItem('welokl_notif_dismissed', '1')
    setDismissed(true)
  }

  async function allow() {
    const result = await Notification.requestPermission()
    setStatus(result === 'granted' ? 'granted' : 'denied')
    if (result !== 'granted') dismiss()
  }

  if (dismissed || status !== 'asking') return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 999,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,.15)',
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      maxWidth: 420, margin: '0 auto',
      animation: 'slideUp .3s ease',
    }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span style={{ fontSize: 28, flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
          Stay updated on your orders
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
          Get notified when your order status changes
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={dismiss}
          style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'none', color: 'var(--text-3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Not now
        </button>
        <button onClick={allow}
          style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: '#ff3008', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          Allow
        </button>
      </div>
    </div>
  )
}