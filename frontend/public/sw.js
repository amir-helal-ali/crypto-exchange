// ============================================================
// NEXUS Exchange — Service Worker
// Strategy:
//   - Precache app shell & static assets
//   - Stale-while-revalidate for same-origin static (CSS/JS/fonts)
//   - Network-first for API & navigation requests
//   - Bypass for Binance WebSocket & external streams
// ============================================================

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `nexus-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `nexus-runtime-${CACHE_VERSION}`;

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html'
];

// Never cache these — always go to network
const NEVER_CACHE_PATTERNS = [
  /\/api\//,
  /wss?:\/\/stream\.binance\.com/,
  /wss?:\/\/.*\.binance\.com/,
  /chrome-extension:/
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.endsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin WebSocket & non-http(s) requests
  if (req.url.startsWith('chrome-extension://')) return;
  if (req.url.startsWith('ws://') || req.url.startsWith('wss://')) return;

  // Never cache these patterns
  if (NEVER_CACHE_PATTERNS.some((p) => p.test(req.url))) return;

  // Navigation requests → network-first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Same-origin static assets → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === 'basic') {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Cross-origin (fonts, etc.) → cache-first with network fallback
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});

// Allow page to trigger immediate activation
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
