// ═══════════════════════════════════════════════════════════════
//  Welokl Service Worker
//  • Caches shell for offline / fast load
//  • Handles push events → shows persistent notifications on phone
//    even when app is backgrounded / screen off
//  • Reconnects realtime when app comes back to foreground
// ═══════════════════════════════════════════════════════════════

const CACHE  = 'welokl-v2'
const SHELL  = ['/', '/stores', '/dashboard/customer', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

// ── Install: pre-cache shell ──────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: remove old caches ───────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: network-first with cache fallback ─────────────────
self.addEventListener('fetch', e => {
  // Only handle GET, skip supabase / api calls
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api/')) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful responses for HTML pages and static assets
        if (res.ok && (e.request.mode === 'navigate' || url.pathname.match(/\.(js|css|png|jpg|ico|svg|woff2?)$/))) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/')))
  )
})

// ── Push: background notifications ───────────────────────────
// Triggered by server-sent push (requires push subscription setup)
// Also used by showNotificationViaSW() from the client
self.addEventListener('push', e => {
  let data = { title: 'Welokl', body: 'You have a new update', url: '/', tag: 'welokl' }
  try { if (e.data) data = { ...data, ...e.data.json() } } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/badge-72.png',
      tag:     data.tag || 'welokl',
      renotify: true,
      vibrate: [200, 100, 200, 100, 400],
      data:    { url: data.url || '/' },
    })
  )
})

// ── Notification click: focus or open the app ────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If app is already open in any tab, focus it
      const match = clients.find(c => c.url.includes(self.location.origin))
      if (match) { match.focus(); match.navigate(url); return }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    })
  )
})

// ── Message: allow client to trigger SW notification ─────────
// useOrderAlerts calls postMessage({type:'NOTIFY',...}) 
// so notifications survive tab backgrounding on Android
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'NOTIFY') return
  const { title, body, tag, url } = e.data
  self.registration.showNotification(title || 'Welokl', {
    body:    body || '',
    icon:    '/icons/icon-192.png',
    badge:   '/icons/badge-72.png',
    tag:     tag || 'welokl',
    renotify: true,
    vibrate: [200, 100, 200, 100, 400],
    data:    { url: url || '/' },
  })
})