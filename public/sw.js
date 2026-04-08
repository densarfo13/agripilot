// Farroway Service Worker — PWA + offline API caching
const CACHE_NAME = 'farroway-v3';
const API_CACHE = 'farroway-api-v2';

// API paths to cache for offline use (GET requests only)
const CACHEABLE_API = [
  '/api/v1/farms',
  '/api/v1/insights/recommend',
  '/api/auth/farmer-profile',
  '/api/v1/referral',
  '/api/localization/translations',
  '/api/portfolio/summary',
  '/api/tasks',
  '/api/lifecycle/farmers',
  '/api/seasons/farmer',
];

function isApiCacheable(pathname) {
  return CACHEABLE_API.some(p => pathname.startsWith(p));
}

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first with offline fallback for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache GET requests
  if (request.method !== 'GET') return;

  // Cacheable API calls: network-first, fall back to cached
  if (url.pathname.startsWith('/api/') && isApiCacheable(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'Offline', _offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }))
    );
    return;
  }

  // Non-cacheable API calls: network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // For navigation and assets: network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
