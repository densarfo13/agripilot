/*
 * sw.js — Farroway OFFLINE_SHELL_V1 service worker.
 *
 * Goal: the app shell launches with no signal / on 2G/3G, and farmer
 * actions queue for later sync. Designed to NEVER re-introduce the
 * stale-shell bug that got the previous SW removed:
 *
 *   • Navigations (HTML)  → NETWORK-FIRST, cache fallback. When online a
 *     fresh index.html is always fetched (current chunk hashes), so a
 *     deploy is never served stale; offline serves the last good shell.
 *   • Hashed /assets/*     → CACHE-FIRST. Safe because the filename hash
 *     changes per build — a cached asset is immutable, never stale.
 *   • *.json (translations / crop library / knowledge) → STALE-WHILE-
 *     REVALIDATE.
 *   • /api/* and all non-GET → PASS THROUGH (never cached). The app's own
 *     offline queues (farmSync + offlineScanQueue) handle writes.
 *
 * Versioned caches purged on activate; skipWaiting + clientsClaim so an
 * update rolls out immediately. postMessage('KILL_SW') fully self-removes.
 */
const SW_VERSION = 'v4-boundary';
const SHELL_CACHE = 'fwshell-' + SW_VERSION;
const ASSET_CACHE = 'fwassets-' + SW_VERSION;
const DATA_CACHE = 'fwdata-' + SW_VERSION;
const KEEP = [SHELL_CACHE, ASSET_CACHE, DATA_CACHE];
const SHELL_URLS = ['/', '/index.html', '/manifest.json'];
const OWN_PREFIXES = ['fwshell-', 'fwassets-', 'fwdata-'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((k) => OWN_PREFIXES.some((p) => k.startsWith(p)) && !KEEP.includes(k))
        .map((k) => caches.delete(k)));
    } catch { /* tolerate */ }
    try { await self.clients.claim(); } catch { /* tolerate */ }
  })());
});

self.addEventListener('message', (event) => {
  const data = event && event.data;
  if (data === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data === 'KILL_SW') {
    // Emergency self-removal: drop our caches then unregister.
    event.waitUntil((async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => OWN_PREFIXES.some((p) => k.startsWith(p))).map((k) => caches.delete(k)));
      } catch { /* tolerate */ }
      try { await self.registration.unregister(); } catch { /* tolerate */ }
    })());
  }
});

function _isAsset(url) { return url.pathname.startsWith('/assets/'); }
function _isJson(url) { return url.pathname.endsWith('.json'); }

async function networkFirstShell(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type !== 'opaqueredirect') {
      try { (await caches.open(SHELL_CACHE)).put('/index.html', res.clone()); } catch { /* */ }
    }
    return res;
  } catch {
    const cached = (await caches.match('/index.html')) || (await caches.match('/'));
    return cached || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' }, status: 200 });
  }
}

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) { try { (await caches.open(cacheName)).put(req, res.clone()); } catch { /* */ } }
    return res;
  } catch { return hit || Response.error(); }
}

async function staleWhileRevalidate(req, cacheName) {
  const hit = await caches.match(req);
  const fetching = fetch(req).then((res) => {
    if (res && res.ok) { caches.open(cacheName).then((c) => c.put(req, res.clone())).catch(() => {}); }
    return res;
  }).catch(() => hit);
  return hit || fetching;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never cache writes
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;  // same-origin only
  if (url.pathname.startsWith('/api/')) return;     // API → network (app has its own queues)

  if (req.mode === 'navigate') { event.respondWith(networkFirstShell(req)); return; }
  if (_isAsset(url)) { event.respondWith(cacheFirst(req, ASSET_CACHE)); return; }
  if (_isJson(url)) { event.respondWith(staleWhileRevalidate(req, DATA_CACHE)); return; }
  // Other static (fonts/images): cache-first.
  event.respondWith(cacheFirst(req, ASSET_CACHE));
});
