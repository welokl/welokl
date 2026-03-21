// src/lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            "AIzaSyAp08LtadKXqI4QVP0gIAvYx0wDlmW6C18",
  authDomain:        "welokl-b47d4.firebaseapp.com",
  projectId:         "welokl-b47d4",
  storageBucket:     "welokl-b47d4.firebasestorage.app",
  messagingSenderId: "551056082419",
  appId:             "1:551056082419:web:b357bc92820ac8ff66fe86",
}

const VAPID_KEY = "BOQv6ar8lwtXUX6z1kGERvkt3sT3sHF5TJc131aRmnZ_vnwxaa2dr1JF97dTPCvKOobGOaeOqIXGx4Njci3Odos"

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// ── Get the ONE sw.js registration ───────────────────────────
// We use a single sw.js that handles BOTH caching AND FCM.
// firebase-messaging-sw.js should be DELETED from /public.
async function getSWRegistration(): Promise<ServiceWorkerRegistration> {
  // If already registered, return it
  const registrations = await navigator.serviceWorker.getRegistrations()
  const existing = registrations.find(r =>
    r.active?.scriptURL.includes('/sw.js') ||
    r.installing?.scriptURL.includes('/sw.js') ||
    r.waiting?.scriptURL.includes('/sw.js')
  )
  if (existing) return existing

  // Register fresh
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function getFCMToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    const supported = await isSupported()
    if (!supported) return null
    if (!('serviceWorker' in navigator)) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const swReg = await getSWRegistration()
    const messaging = getMessaging(app)
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    return token || null
  } catch (err) {
    console.error('[FCM] getToken failed:', err)
    return null
  }
}

export async function onForegroundMessage(
  handler: (payload: { title: string; body: string; url?: string }) => void
) {
  try {
    if (typeof window === 'undefined') return
    const supported = await isSupported()
    if (!supported) return
    const messaging = getMessaging(app)
    onMessage(messaging, (payload) => {
      const { title = 'Welokl', body = '' } = payload.notification || {}
      const url = (payload.data as any)?.url || '/'
      handler({ title, body, url })
    })
  } catch {}
}