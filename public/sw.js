// public/sw.js — Welokl Service Worker v4
// FCM only — no fetch caching (was causing clone errors and breaking SW)

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyAp08LtadKXqI4QVP0gIAvYx0wDlmW6C18',
  authDomain:        'welokl-b47d4.firebaseapp.com',
  projectId:         'welokl-b47d4',
  storageBucket:     'welokl-b47d4.firebasestorage.app',
  messagingSenderId: '551056082419',
  appId:             '1:551056082419:web:b357bc92820ac8ff66fe86',
})

const messaging = firebase.messaging()

// FCM background messages (app closed / tab in background)
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || payload.data?.title || 'Welokl'
  const body  = payload.notification?.body  || payload.data?.body  || 'You have a new update'
  const url   = payload.data?.url || '/'
  const tag   = payload.data?.tag || 'welokl'

  self.registration.showNotification(title, {
    body,
    icon:     '/icons/icon-192.png',
    badge:    '/icons/badge-72.png',
    tag,
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url },
  })
})

// Standard Web Push fallback
self.addEventListener('push', e => {
  let data = { title: 'Welokl', body: 'You have a new update', url: '/', tag: 'welokl' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:     data.body,
      icon:     '/icons/icon-192.png',
      badge:    '/icons/badge-72.png',
      tag:      data.tag,
      renotify: true,
      vibrate:  [200, 100, 200],
      data:     { url: data.url },
    })
  )
})

// Notification click → open correct page
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.includes(self.location.origin))
      if (match) { match.focus(); match.navigate(url); return }
      return self.clients.openWindow(url)
    })
  )
})

// Message from client (useOrderAlerts postMessage)
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') { self.skipWaiting(); return }
  if (e.data?.type !== 'NOTIFY') return
  const { title, body, tag, url } = e.data
  self.registration.showNotification(title || 'Welokl', {
    body:     body || '',
    icon:     '/icons/icon-192.png',
    badge:    '/icons/badge-72.png',
    tag:      tag  || 'welokl',
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: url || '/' },
  })
})

// Install & activate
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))