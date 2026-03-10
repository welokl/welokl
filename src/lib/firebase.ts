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
  measurementId:     "G-JX7B2L5DK1",
}

const VAPID_KEY = "BOQv6ar8lwtXUX6z1kGERvkt3sT3sHF5TJc131aRmnZ_vnwxaa2dr1JF97dTPCvKOobGOaeOqIXGx4Njci3Odos"

// Init app once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

/**
 * Request notification permission and return FCM token.
 * Returns null if not supported or denied.
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const supported = await isSupported()
    if (!supported) return null

    const messaging = getMessaging(app)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    })

    return token || null
  } catch (err) {
    console.error('[FCM] getToken failed:', err)
    return null
  }
}

/**
 * Listen for foreground messages (app is open).
 * Background messages are handled by firebase-messaging-sw.js
 */
export async function onForegroundMessage(
  handler: (payload: { title: string; body: string; url?: string }) => void
) {
  try {
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
