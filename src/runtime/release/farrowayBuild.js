/**
 * farrowayBuild.js — Wave RC1 build identity.
 *
 *   import { getFarrowayBuild, installFarrowayBuildGlobal }
 *     from 'src/runtime/release/farrowayBuild.js';
 *
 * What this is
 * ────────────
 *   Single source of truth for the build identifiers the app
 *   surfaces in the QA + App Store readiness diagnostics. Reads
 *   the build-time VITE_* env vars Railway is configured to set
 *   (plus a Railway-native fallback) and the App Store mode flag.
 *
 *   Never crashes on missing env. Defaults are honest:
 *     • sha     → "unknown" when no env present
 *     • builtAt → new Date().toISOString() at first read (so the
 *                 surface always has SOMETHING for QA to anchor on)
 *     • appStoreMode → false unless VITE_APP_STORE_MODE === "true"
 *     • mode    → import.meta.env.MODE, fallback "unknown"
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe (window guard).
 *   • Idempotent install — repeated calls reuse the snapshot.
 *   • No PII, no secrets — only build metadata.
 */

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

let _cached = null;

function _readEnv() {
  return _safe(() => {
    return (typeof import.meta !== 'undefined' && import.meta.env) || {};
  }, {});
}

/**
 * Build snapshot — same shape every call. Cached on first read so
 * `builtAt` is stable within a session (don't surface a moving
 * timestamp to QA).
 */
export function getFarrowayBuild() {
  if (_cached) return _cached;
  const env = _readEnv();
  const sha =
       env.VITE_BUILD_SHA
    || env.VITE_BUILD_ID
    || env.RAILWAY_GIT_COMMIT_SHA
    || 'unknown';
  const builtAt =
       env.VITE_BUILD_TIMESTAMP
    || env.VITE_BUILD_TIME
    || _safe(() => new Date().toISOString(), null);
  const appStoreMode = env.VITE_APP_STORE_MODE === 'true'
    || env.VITE_APP_STORE_MODE === true;
  const mode = env.MODE || 'unknown';
  _cached = Object.freeze({
    runtimeVersion: 'farroway-build-rc1',
    sha,
    builtAt,
    appStoreMode,
    mode,
    isProduction: !!env.PROD,
  });
  return _cached;
}

/**
 * Pin `window.__farrowayBuild` to the getter. Idempotent.
 */
export function installFarrowayBuildGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__farrowayBuild === 'function') return true;
    window.__farrowayBuild = getFarrowayBuild;
    return true;
  }, false);
}

export function _resetForTests() { _cached = null; }
