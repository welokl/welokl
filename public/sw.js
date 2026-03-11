// ═══════════════════════════════════════════════════════════════
//  Welokl Service Worker
//  • PWA caching
//  • Firebase push notifications
//  • Offline support
//  • Background notifications
// ═══════════════════════════════════════════════════════════════

// ── Firebase Messaging Setup ──────────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyAp08LtadKXqI4QVP0gIAvYx0wDlmW6C18",
  authDomain: "welokl-b47d4.firebaseapp.com",
  projectId: "welokl-b47d4",
  storageBucket: "welokl-b47d4.firebasestorage.app",
  messagingSenderId: "551056082419",
  appId: "1:551056082419:web:b357bc92820ac8ff66fe86",
})

const messaging = firebase.messaging()

// Firebase background messages
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Welokl'
  const body  = payload.notification?.body || 'You have a new update'
  const url   = payload.data?.url || '/'

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.data?.tag || 'welokl',
    renotify: true,
    vibrate: [200,100,200,100,400],
    data: { url }
  })
})


// ═══════════════════════════════════════════════════════════════
// PWA CACHE SYSTEM
// ═══════════════════════════════════════════════════════════════

const CACHE  = 'welokl-v3'
const SHELL  = ['/', '/stores', '/dashboard/customer', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']


// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})


// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})


// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {

  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {

        if (
          res.ok &&
          (e.request.mode === 'navigate' ||
          url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/))
        ) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }

        return res
      })
      .catch(() =>
        caches.match(e.request).then(r => r || caches.match('/'))
      )
  )
})


// ── Push Event (Manual Push Support) ──────────────────────────
self.addEventListener('push', e => {

  let data = {
    title: 'Welokl',
    body: 'You have a new update',
    url: '/',
    tag: 'welokl'
  }

  try {
    if (e.data) data = { ...data, ...e.data.json() }
  } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,
      renotify: true,
      vibrate: [200,100,200,100,400],
      data: { url: data.url }
    })
  )
})


// ── Notification Click ────────────────────────────────────────
self.addEventListener('notificationclick', e => {

  e.notification.close()

  const url = e.notification.data?.url || '/'

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {

        const match = clients.find(c =>
          c.url.includes(self.location.origin)
        )

        if (match) {
          match.focus()
          match.navigate(url)
          return
        }

        return self.clients.openWindow(url)
      })
  )
})


// ── Client Message → Show Notification ────────────────────────
self.addEventListener('message', e => {

  if (!e.data || e.data.type !== 'NOTIFY') return

  const { title, body, tag, url } = e.data

  self.registration.showNotification(title || 'Welokl', {
    body: body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: tag || 'welokl',
    renotify: true,
    vibrate: [200,100,200,100,400],
    data: { url: url || '/' }
  })
})