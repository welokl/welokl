const CACHE_NAME = 'welokl-v2'
const STATIC_ASSETS = ['/', '/stores', '/auth/login', '/manifest.json', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) return
  event.respondWith(
    fetch(event.request).then(r => {
      if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, c)) }
      return r
    }).catch(() => caches.match(event.request).then(c => c || (event.request.mode === 'navigate' ? caches.match('/') : undefined)))
  )
})

// PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Welokl', body: event.data.text() } }
  const { title = 'Welokl', body = 'New update', url = '/', tag = 'welokl' } = data
  event.waitUntil(
    self.registration.showNotification(title, {
      body, icon: '/icons/icon-192.png', badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200], tag, renotify: true, data: { url },
      actions: [{ action: 'view', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }]
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if (c.url.includes(self.location.origin) && 'focus' in c) { c.focus(); c.navigate(url); return } }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
