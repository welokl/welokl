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

// Register Firebase's OWN service worker explicitly
// This is the critical fix — must NOT use the existing sw.js
async function getFirebaseSWRegistration(): Promise<ServiceWorkerRegistration> {
  // Check if firebase-messaging-sw.js is already registered
  const registrations = await navigator.serviceWorker.getRegistrations()
  const existing = registrations.find(r =>
    r.active?.scriptURL.includes('firebase-messaging-sw') ||
    r.installing?.scriptURL.includes('firebase-messaging-sw') ||
    r.waiting?.scriptURL.includes('firebase-messaging-sw')
  )
  if (existing) return existing
  // Register it fresh
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  })
}

export async function getFCMToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    const supported = await isSupported()
    if (!supported) return null
    if (!('serviceWorker' in navigator)) return null

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // Register Firebase SW explicitly — do NOT use serviceWorker.ready
    // because that returns sw.js, not firebase-messaging-sw.js
    const swReg = await getFirebaseSWRegistration()

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