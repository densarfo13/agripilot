/* eslint-disable */
/**
 * cache-bust.js — RC1 forced cache-bust for stale PWAs / Safari shells.
 *
 * Loaded as a SYNCHRONOUS <script src="/cache-bust.js"> in the HTML
 * head BEFORE any other script. Runs the following sequence:
 *
 *   1. Compare the build SHA baked into index.html (window.
 *      __FARROWAY_BUILD_SHA, set by an inline tag below this
 *      script) against the SHA recorded in localStorage from the
 *      LAST successful boot.
 *   2. If they differ — that means the user is loading a NEWER
 *      shell than the last one they ran. Drop EVERY cache the
 *      browser holds for this origin (CacheStorage), unregister
 *      EVERY service worker, then force a hard reload ONCE so
 *      the next paint pulls fresh assets.
 *   3. After the reload, the comparison matches and we update the
 *      stored SHA, then no more reloads fire.
 *
 * Idempotent guard: a session-storage flag prevents an infinite
 * reload loop if the SHA somehow stays mismatched after the first
 * reload (e.g. corrupted CacheStorage). We only attempt the bust
 * once per session.
 *
 * Why not in main.jsx?
 *   main.jsx is the React bundle — already cached by the same
 *   stale SW we're trying to evict. This script lives at a fixed
 *   path (/cache-bust.js) with `Cache-Control: no-store` so the
 *   browser MUST refetch it every load, and it runs before any
 *   bundle code that might be wedged on the old shell.
 */
(function () {
  try {
    var STORE_KEY  = 'farroway:build:sha';
    var ATTEMPT_KEY = 'farroway:cachebust:attempted';
    var BUSTER_VERSION = 'rc1-cache-bust-v1';

    // The CURRENT build SHA is pinned by an inline tag that runs
    // BEFORE this script. Falls back to a literal timestamp if
    // somehow missing (e.g. dev mode without the tag).
    var currentSha = (typeof window.__FARROWAY_BUILD_SHA === 'string'
      && window.__FARROWAY_BUILD_SHA.length > 0)
        ? window.__FARROWAY_BUILD_SHA
        : null;
    if (!currentSha) {
      // No SHA known — nothing to compare against. Bail.
      try { console.log('[FARROWAY_CACHE_BUST]', BUSTER_VERSION, 'no_build_sha'); } catch (e) {}
      return;
    }

    var lastSha = null;
    try { lastSha = window.localStorage.getItem(STORE_KEY); } catch (e) {}

    var attempted = false;
    try { attempted = window.sessionStorage.getItem(ATTEMPT_KEY) === '1'; } catch (e) {}

    // SHA matches → no bust needed. Just record + move on.
    if (lastSha === currentSha) {
      try { window.localStorage.setItem(STORE_KEY, currentSha); } catch (e) {}
      return;
    }

    // SHA differs AND we haven't already attempted a bust this
    // session. Fire the full cache + SW + reload sequence.
    if (!attempted) {
      try { window.sessionStorage.setItem(ATTEMPT_KEY, '1'); } catch (e) {}

      var jobs = [];

      // (a) Drop EVERY CacheStorage entry. We can't be selective
      //     because the legacy SW may have cached under any name.
      try {
        if ('caches' in window && window.caches && window.caches.keys) {
          jobs.push(
            window.caches.keys().then(function (keys) {
              return Promise.all((keys || []).map(function (k) {
                try { return window.caches.delete(k); }
                catch (e) { return Promise.resolve(false); }
              }));
            }).catch(function () { /* swallow */ })
          );
        }
      } catch (e) {}

      // (b) Unregister EVERY service worker for this origin.
      try {
        if (navigator && navigator.serviceWorker
            && navigator.serviceWorker.getRegistrations) {
          jobs.push(
            navigator.serviceWorker.getRegistrations().then(function (regs) {
              return Promise.all((regs || []).map(function (r) {
                try { return r.unregister(); }
                catch (e) { return Promise.resolve(false); }
              }));
            }).catch(function () { /* swallow */ })
          );
        }
      } catch (e) {}

      // (c) Wait for both, then hard-reload with a cache-busting
      //     timestamp param. The query param forces iOS Safari +
      //     installed PWA shells to refetch the HTML even if their
      //     internal HTTP cache disagrees with our Cache-Control.
      Promise.all(jobs).then(function () {
        try {
          window.localStorage.setItem(STORE_KEY, currentSha);
        } catch (e) {}
        try {
          var url = new URL(window.location.href);
          url.searchParams.set('__fb', String(Date.now()));
          window.location.replace(url.toString());
        } catch (e) {
          try { window.location.reload(); } catch (e2) {}
        }
      }).catch(function () {
        try { window.location.reload(); } catch (e) {}
      });

      try {
        console.log('[FARROWAY_CACHE_BUST]', BUSTER_VERSION,
          'busting', { from: lastSha, to: currentSha });
      } catch (e) {}
    } else {
      // We already attempted in this session; record the SHA and
      // accept whatever state the browser landed in.
      try { window.localStorage.setItem(STORE_KEY, currentSha); } catch (e) {}
      try {
        console.log('[FARROWAY_CACHE_BUST]', BUSTER_VERSION,
          'already_attempted_this_session');
      } catch (e) {}
    }
  } catch (e) {
    // Never throw from the cache buster. A failure here must NOT
    // block the app from booting.
    try { console.error('[FARROWAY_CACHE_BUST]', 'fatal', e && e.message); } catch (_) {}
  }
})();
