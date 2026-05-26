/**
 * scanBuildStamp.js — exposes `window.__SCAN_BUILD_SHA__` so a
 * field operator can confirm which scan-pipeline build is
 * actually running in their browser.
 *
 *   import { installScanBuildStamp, getScanBuildSha }
 *     from 'src/core/scan/scanBuildStamp.js';
 *
 *   // From main.jsx (or App boot):
 *   installScanBuildStamp();
 *   // Then from DevTools:
 *   window.__SCAN_BUILD_SHA__
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny boot helper. Resolves the deployed commit SHA via the
 *   existing release-resolution chain (mirrors the backend
 *   `productionRuntime.resolveBuildVersion()` priority: Railway
 *   commit SHA → Sentry release → VITE_BUILD_ID → fallback). Pins
 *   the value on `window.__SCAN_BUILD_SHA__` so operators can
 *   `curl https://farroway.app/` + open DevTools to confirm the
 *   browser actually loaded the latest deploy — closes "is this a
 *   stale bundle?" debugging.
 *
 *   It is NOT a service worker, NOT a cache-bust mechanism, NOT
 *   a backend version comparator (the existing `/api/health`
 *   `version` field is the backend stamp).
 *
 * Strict-rule audit
 *   • Pure-runtime. Never throws. SSR-safe.
 */

function _resolveSha() {
  try {
    const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
    const candidates = [
      env.VITE_SCAN_BUILD_SHA,
      env.VITE_BUILD_ID,
      env.VITE_RAILWAY_GIT_COMMIT_SHA,
      env.VITE_SENTRY_RELEASE,
    ];
    for (const v of candidates) {
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 64);
    }
    if (typeof window !== 'undefined' && window.__FARROWAY_BUILD_VERSION) {
      return String(window.__FARROWAY_BUILD_VERSION).slice(0, 64);
    }
  } catch { /* swallow */ }
  return '0.0.0-local';
}

let _cached = null;

/**
 * Resolve + cache the scan-pipeline build SHA.
 */
export function getScanBuildSha() {
  if (_cached != null) return _cached;
  _cached = _resolveSha();
  return _cached;
}

/**
 * Pin the SHA to `window.__SCAN_BUILD_SHA__`. Idempotent.
 */
export function installScanBuildStamp() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__SCAN_BUILD_SHA__) return true;
    Object.defineProperty(window, '__SCAN_BUILD_SHA__', {
      value:        getScanBuildSha(),
      writable:     false,
      configurable: false,
      enumerable:   true,
    });
    return true;
  } catch { return false; }
}

/** Test-only reset. */
export function _resetScanBuildStampForTests() { _cached = null; }

const _module = {
  getScanBuildSha,
  installScanBuildStamp,
  _resetScanBuildStampForTests,
};
export default _module;
