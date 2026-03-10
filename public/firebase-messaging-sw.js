// public/firebase-messaging-sw.js
// This file MUST be at the root of /public so it's served from /firebase-messaging-sw.js
// Firebase registers this automatically as the messaging service worker.

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            "AIzaSyAp08LtadKXqI4QVP0gIAvYx0wDlmW6C18",
  authDomain:        "welokl-b47d4.firebaseapp.com",
  projectId:         "welokl-b47d4",
  storageBucket:     "welokl-b47d4.firebasestorage.app",
  messagingSenderId: "551056082419",
  appId:             "1:551056082419:web:b357bc92820ac8ff66fe86",
})

const messaging = firebase.messaging()

// ── Background push handler ───────────────────────────────────
// Fires when app is CLOSED or in background
// Firebase calls this automatically for background messages
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Welokl'
  const body  = payload.notification?.body  || 'You have a new update'
  const url   = payload.data?.url || '/'

  self.registration.showNotification(title, {
    body,
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    tag:     payload.data?.tag || 'welokl',
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    data:    { url },
  })
})

// ── Notification click: open the app ─────────────────────────
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
