// Farroway Service Worker — PWA + offline API caching
//
// CACHE_VERSION below is replaced at build time by
// scripts/bake-sw-version.mjs with the value of package.json:version
// + a build hash. The placeholder string survives source control so
// dev work without the bake step still runs (it just keeps a
// previous cache instead of evicting it). Production deploys ALWAYS
// run the bake step via the `postbuild` npm script.
//
// __APP_VERSION_TOKEN__  ← single source of truth, do not duplicate
const APP_VERSION = '__APP_VERSION__';
const CACHE_NAME = `farroway-${APP_VERSION}`;
const API_CACHE  = `farroway-api-${APP_VERSION}`;

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

// Activate: clean old caches + broadcast a "new version available"
// message so the client UI can prompt the farmer to refresh. The
// message includes APP_VERSION so the client can compare against
// the version it booted with.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    // Announce activation to every controlled client.
    const allClients = await self.clients.matchAll({ includeUncontrolled: true });
    for (const c of allClients) {
      c.postMessage({ type: 'farroway:sw_activated', version: APP_VERSION });
    }
  })());
});

// Allow the client to ask the SW to skipWaiting (used by the
// "Reload to update" button — when the user taps it we want the new
// SW to take over immediately).
self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'farroway:skip_waiting') {
    self.skipWaiting();
  }
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

  // Non-cacheable API calls: network only, but guard against raw
  // FetchEvent errors leaking to the UI when offline.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Offline', _offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // For navigation and assets: network first, fall back to cache,
  // then to the cached app shell. Always return a Response so the
  // browser never surfaces "FetchEvent.respondWith received an error".
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // HTML navigations: serve the app shell so the SPA can boot
        // and render its own offline-aware fallback state.
        if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
          const shell = await caches.match('/');
          if (shell) return shell;
        }
        // Final safety net — an empty 503 is still better than a raw
        // fetch rejection the UI can't catch.
        return new Response('', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
  );
});
