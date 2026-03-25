// public/sw.js
// ── SINGLE service worker — handles EVERYTHING ───────────────
// 1. FCM background messages (replaces firebase-messaging-sw.js)
// 2. Caching / offline shell
// 3. Push events
// 4. Notification click → open app
// 5. Message from client → show notification
//
// firebase.ts points FCM at THIS file via serviceWorkerRegistration
// DELETE firebase-messaging-sw.js from /public — having 2 SWs breaks FCM

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

// ── Firebase init ─────────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyAp08LtadKXqI4QVP0gIAvYx0wDlmW6C18",
  authDomain:        "welokl-b47d4.firebaseapp.com",
  projectId:         "welokl-b47d4",
  storageBucket:     "welokl-b47d4.firebasestorage.app",
  messagingSenderId: "551056082419",
  appId:             "1:551056082419:web:b357bc92820ac8ff66fe86",
})

const messaging = firebase.messaging()

// ── FCM background messages (app closed / tab in background) ─
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Welokl'
  const body  = payload.notification?.body  || 'You have a new update'
  const url   = payload.data?.url || '/'
  const tag   = payload.data?.tag || 'welokl'
  const type  = payload.data?.type || ''

  const isNewOrder = type === 'order_placed'

  self.registration.showNotification(title, {
    body,
    icon:               '/icons/icon-192.png',
    badge:              '/icons/badge-72.png',
    tag,
    renotify:           true,
    // New order: stays on screen until tapped (like Rapido) — must not auto-dismiss
    requireInteraction: isNewOrder,
    vibrate:            isNewOrder
      ? [600, 100, 600, 100, 600, 100, 1000, 100, 1000]
      : [300, 100, 300, 100, 500, 100, 700],
    actions:            isNewOrder
      ? [{ action: 'view', title: '👀 View Order' }]
      : [],
    data: { url },
  })
})

// ── Cache shell ───────────────────────────────────────────────
const CACHE = 'welokl-v4'
const SHELL = ['/', '/stores', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && (e.request.mode === 'navigate' || url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/))) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  )
})

// ── Push event (standard Web Push) ───────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'Welokl', body: 'You have a new update', url: '/', tag: 'welokl', type: '' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}
  const isNewOrder = data.type === 'order_placed'
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:               data.body,
      icon:               '/icons/icon-192.png',
      badge:              '/icons/badge-72.png',
      tag:                data.tag,
      renotify:           true,
      requireInteraction: isNewOrder,
      vibrate:            isNewOrder
        ? [600, 100, 600, 100, 600, 100, 1000, 100, 1000]
        : [300, 100, 300, 100, 500, 100, 700],
      actions:            isNewOrder
        ? [{ action: 'view', title: '👀 View Order' }]
        : [],
      data: { url: data.url },
    })
  )
})

// ── Notification click → open the right page ─────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const match = clients.find(c => c.url.includes(self.location.origin))
      if (match) { match.focus(); match.navigate(url); return }
      return self.clients.openWindow(url)
    })
  )
})

// ── Order alarm state (loops until shop accepts) ──────────────
const orderAlarms = new Map() // orderId → intervalId

function showOrderNotification(title, body, tag, url) {
  return self.registration.showNotification(title, {
    body,
    icon:               '/icons/icon-192.png',
    badge:              '/icons/badge-72.png',
    tag,
    renotify:           true,
    requireInteraction: true,
    vibrate:            [600, 100, 600, 100, 600, 100, 1000, 100, 1000],
    actions:            [{ action: 'view', title: '👀 View Order' }],
    data:               { url },
  })
}

// ── Message from client (useOrderAlerts postMessage) ─────────
self.addEventListener('message', e => {
  if (!e.data) return

  // Start looping alarm for a new order
  if (e.data.type === 'START_ORDER_ALARM') {
    const { orderId, title, body, tag, url } = e.data
    if (orderAlarms.has(orderId)) return // already running
    showOrderNotification(title, body, tag, url)
    const id = setInterval(() => showOrderNotification(title, body, tag, url), 8000)
    orderAlarms.set(orderId, id)
    return
  }

  // Stop alarm when shop accepts / rejects
  if (e.data.type === 'STOP_ORDER_ALARM') {
    const id = orderAlarms.get(e.data.orderId)
    if (id != null) { clearInterval(id); orderAlarms.delete(e.data.orderId) }
    return
  }

  // Generic one-shot notification
  if (e.data.type === 'NOTIFY') {
    const { title, body, tag, url, notifType } = e.data
    const isNewOrder = notifType === 'order_placed'
    self.registration.showNotification(title || 'Welokl', {
      body:               body || '',
      icon:               '/icons/icon-192.png',
      badge:              '/icons/badge-72.png',
      tag:                tag || 'welokl',
      renotify:           true,
      requireInteraction: isNewOrder,
      vibrate:            isNewOrder
        ? [600, 100, 600, 100, 600, 100, 1000, 100, 1000]
        : [300, 100, 300, 100, 500, 100, 700],
      actions:            isNewOrder ? [{ action: 'view', title: '👀 View Order' }] : [],
      data:               { url: url || '/' },
    })
  }
})