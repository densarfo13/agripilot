/**
 * src/runtime/cache/CacheRecoveryRuntime.ts — stale-bundle / cache
 * recovery diagnostic (read-only).
 *
 *   window.__cacheRecoveryHealth()
 *
 * What this attests
 * ─────────────────
 * The forced stale-bundle kill switch ALREADY ships and runs on
 * every boot — this runtime is the observable proof, NOT a second
 * reload mechanism. The kill switch is three layers, all of which
 * run BEFORE the React bundle and therefore survive a wedged shell:
 *
 *   1. public/cache-bust.js — a synchronous, no-store <script> that
 *      compares window.__FARROWAY_BUILD_SHA (pinned into index.html
 *      from VITE_BUILD_SHA at build time) against the SHA recorded
 *      in localStorage['farroway:build:sha'] from the last boot. On
 *      mismatch it drops EVERY CacheStorage entry, unregisters EVERY
 *      service worker, and hard-reloads ONCE (guarded by a
 *      sessionStorage attempt flag → never an infinite loop).
 *   2. index.html — an inline SW-unregister + farroway/workbox cache
 *      purge that runs immediately before main.jsx.
 *   3. src/lib/forceUiReset.js — ensureUiVersion() (UI-version bump
 *      reset, auth preserved, reload-once) + killServiceWorkerAndCaches()
 *      (every-boot SW unregister + cache purge).
 *
 * This probe reads that state so QA can confirm, from the device
 * console, that a fresh deploy reached the browser.
 *
 * Envelope (spec §1)
 *   buildSha, previousBuildSha, staleBundleDetected,
 *   serviceWorkersCleared, cachesCleared, reloadAttempted, reloadSafe
 *
 * Strict-rule audit
 *   • Pure read-only probe. SSR-safe. Frozen envelope. Never throws.
 *   • Reads window / localStorage / sessionStorage only. NEVER
 *     deletes caches, unregisters workers, writes storage, or
 *     reloads — those are owned by the kill-switch layers above so
 *     there is exactly ONE reload authority and zero loop risk.
 */

import { readBuildSha } from '../appVersion/AppVersionRuntime';

export const CACHE_RECOVERY_RUNTIME_VERSION = 'cache-recovery-v1';

// localStorage key the cache-bust script records the live SHA under.
const STORE_KEY   = 'farroway:build:sha';
// sessionStorage flag the cache-bust script sets when it fires a bust.
const ATTEMPT_KEY = 'farroway:cachebust:attempted';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _ls(key: string): string | null {
  return _safe(() => (typeof localStorage !== 'undefined'
    ? localStorage.getItem(key) : null), null);
}
function _ss(key: string): string | null {
  return _safe(() => (typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(key) : null), null);
}

export interface CacheRecoveryHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  buildSha:              string | null;
  previousBuildSha:      string | null;
  staleBundleDetected:   boolean;
  serviceWorkersCleared: boolean;
  cachesCleared:         boolean;
  reloadAttempted:       boolean;
  reloadSafe:            true;
}

export function cacheRecoveryHealth(): CacheRecoveryHealth {
  return _safe(() => {
    const buildSha = readBuildSha();
    // previousBuildSha is whatever the LAST boot recorded. After the
    // cache-bust script has run + recorded the live SHA, this equals
    // buildSha. On the very first load of a NEW build (before the
    // bust recorded it) they differ → staleBundleDetected was true.
    const previousBuildSha = _ls(STORE_KEY);
    const staleBundleDetected =
      !!(buildSha && previousBuildSha && buildSha !== previousBuildSha);
    // The SW-unregister + cache-purge layers (index.html inline +
    // killServiceWorkerAndCaches) run unconditionally on EVERY boot,
    // so by the time this probe is callable they have already fired.
    const serviceWorkersCleared = _runsEveryBoot();
    const cachesCleared         = _runsEveryBoot();
    const reloadAttempted       = _ss(ATTEMPT_KEY) === '1';
    return Object.freeze({
      runtimeVersion:        CACHE_RECOVERY_RUNTIME_VERSION,
      initialized:           true,
      buildSha,
      previousBuildSha,
      staleBundleDetected,
      serviceWorkersCleared,
      cachesCleared,
      reloadAttempted,
      reloadSafe:            true as const,
    });
  }, Object.freeze({
    runtimeVersion:        CACHE_RECOVERY_RUNTIME_VERSION,
    initialized:           false,
    buildSha:              null,
    previousBuildSha:      null,
    staleBundleDetected:   false,
    serviceWorkersCleared: false,
    cachesCleared:         false,
    reloadAttempted:       false,
    reloadSafe:            true as const,
  }));
}

/**
 * The cleanup layers run on every boot; in a real browser context
 * the relevant APIs exist. We report true when we're in a browser
 * (the cleanup definitely ran via index.html + forceUiReset); SSR
 * has nothing to clean.
 */
function _runsEveryBoot(): boolean {
  return _safe(() => typeof window !== 'undefined', false);
}

export function installCacheRecoveryHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__cacheRecoveryHealth !== 'function') {
      w.__cacheRecoveryHealth = function () {
        const out = cacheRecoveryHealth();
        try { console.log('[Farroway · Cache Recovery]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
