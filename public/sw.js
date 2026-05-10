/* BH Grain — Service Worker (PWA + Web Push + Offline shell)
 *
 * Strategies:
 *  - CacheFirst:           /_next/static/*  (immutable assets, hash-busted)
 *  - StaleWhileRevalidate: imagens em /icons/*, /landing/*, .png/.jpg/.webp
 *  - NetworkFirst:         GET /api/*  e demais GETs HTML
 *  - Offline shell:        /, /dashboard, /operacao/balanca, /cotacoes
 *
 * Background sync: a fila offline de POSTs vive em IndexedDB
 * (lib/pwa/offline-queue.ts); o flush é disparado pela página quando
 * `online` event ocorrer. O SW só processa fetch GETs.
 */

const CACHE_VERSION = 'v2'
const STATIC_CACHE = `bh-grain-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `bh-grain-runtime-${CACHE_VERSION}`
const IMG_CACHE = `bh-grain-img-${CACHE_VERSION}`

const APP_SHELL = [
  '/',
  '/dashboard',
  '/operacao/balanca',
  '/cotacoes',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        // Each addAll silently tolerates failures (rota auth pode 401)
        Promise.allSettled(APP_SHELL.map((u) => cache.add(u).catch(() => null)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith('bh-grain-') &&
                ![STATIC_CACHE, RUNTIME_CACHE, IMG_CACHE].includes(k)
            )
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isImage(req) {
  return (
    req.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(new URL(req.url).pathname)
  )
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  if (cached) return cached
  try {
    const fresh = await fetch(req)
    if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
      cache.put(req, fresh.clone())
    }
    return fresh
  } catch (e) {
    return cached || Response.error()
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone())
      return res
    })
    .catch(() => cached)
  return cached || fetchPromise
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(req)
    if (fresh && fresh.status === 200 && req.method === 'GET') {
      cache.put(req, fresh.clone())
    }
    return fresh
  } catch (e) {
    const cached = await cache.match(req)
    if (cached) return cached
    // Fallback offline para navegações
    if (req.mode === 'navigate') {
      const shell = await caches.match('/')
      if (shell) return shell
    }
    return new Response(
      JSON.stringify({ error: 'offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // POSTs vão pela offline-queue do app
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE))
    return
  }
  if (isImage(req)) {
    event.respondWith(staleWhileRevalidate(req, IMG_CACHE))
    return
  }
  // /api/* e navegações usam NetworkFirst
  event.respondWith(networkFirst(req, RUNTIME_CACHE))
})

// ============================================================
// Web Push (mantido do Sprint S2)
// ============================================================
self.addEventListener('push', (event) => {
  let data = { title: 'BH Grain', body: '', url: '/' }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/api/icons/192',
    badge: '/api/icons/192',
    tag: data.tag || 'bhgrain-default',
    data: { url: data.url || '/' },
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url).catch(() => {})
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// ============================================================
// Message channel — página pode pedir pra limpar caches
// ============================================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    )
  }
})
