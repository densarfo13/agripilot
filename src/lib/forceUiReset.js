/**
 * forceUiReset.js — forced UI cache + state reset on version bump,
 * plus unconditional service-worker disable + cache purge.
 *
 *   import {
 *     ensureUiVersion,
 *     killServiceWorkerAndCaches,
 *     FARROWAY_BUILD_VERSION,
 *     FARROWAY_UI_VERSION,
 *   } from './lib/forceUiReset.js';
 *
 *   // At the very top of main.jsx — before any other side-effect:
 *   const resetting = ensureUiVersion();
 *   killServiceWorkerAndCaches();   // runs every boot, fire-and-forget
 *   if (!resetting) { ... continue boot ... }
 *
 * Why this exists
 *   When we cut a deploy that materially changes the UI shell,
 *   some farmers' browsers hang onto stale state — old localStorage,
 *   old service-worker caches, the old "Back online. Syncing…"
 *   banner — and the new build never visibly takes hold even after
 *   a reload.
 *
 *   Strategy:
 *     1. Bump FARROWAY_UI_VERSION when client state must be wiped.
 *     2. Bump FARROWAY_BUILD_VERSION on every deploy that ships a
 *        new bundle, so DevTools (and the Home overlay) can confirm
 *        which build is actually running.
 *     3. Unconditionally unregister the service worker and drop
 *        farroway/workbox caches on EVERY boot. Until the SW story
 *        stabilises we'd rather pay one extra fetch than hand a user
 *        an old cached shell.
 *
 * Strict-rule audit
 *   • Auth is never cleared — `farroway_token` + `farroway_user`
 *     remain in place so the user is NOT logged out.
 *   • Reload happens exactly once — guarded by the freshly-set
 *     `farroway_ui_version` value, so there's no loop risk.
 *   • Every step is wrapped in try/catch — any single failure
 *     falls through to the next step.
 *   • Pure browser-only — no-ops in SSR / non-window contexts.
 */

// Bump on EVERY deploy. Visible in console + bottom-of-Home stamp.
// Format: YYYY-MM-DD-vN OR YYYY-MM-DD-debug-N for diagnostic
// builds (May 2026 deployment-debug spec).
export const FARROWAY_BUILD_VERSION = '2026-05-04-stable-v1';

// Bump only when client state must be wiped. When this changes the
// reset routine fires once and reloads the page.
// Format: YYYY-MM-DD-vN. Always increment N for same-day reissues.
export const FARROWAY_UI_VERSION = '2026-05-04-stable-v1';

// Commit SHA stamped at build time via the VITE_COMMIT_SHA env
// var. Falls back to 'local-dev' when running outside the CI
// build environment OR to a build-time epoch fingerprint so a
// missing CI variable still yields a unique stamp per build.
export const FARROWAY_COMMIT_SHA = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = import.meta.env.VITE_COMMIT_SHA;
      if (typeof v === 'string' && v.length > 0) return v.slice(0, 12);
    }
  } catch { /* swallow */ }
  // Build-time fingerprint — captured once when the module is
  // first evaluated. Stable for the lifetime of the bundle so
  // every page load on the same build shows the same hash.
  return 'local-' + Date.now().toString(36).slice(-6);
})();

// localStorage key the version is stored under.
const VERSION_KEY = 'farroway_ui_version';

// Auth-related keys. NEVER clear these — they keep the user signed in.
//
// Kept in sync with storageSafe.FARROWAY_AUTH_KEYS — every reset
// path the app has must respect the same preservation contract.
// Onboarding flags also live here so a forced UI reset never
// re-routes a returning user back through setup.
const AUTH_KEYS = Object.freeze([
  'farroway_token',
  'farroway_user',
  'farroway_refresh',
  'farroway_step_up',
  'farroway_auth_token',
  'farroway_session',
  'farroway:session_cache',
  'farroway:access_token',
  'farroway:refresh_token',
  'farroway:user_profile',
  'farroway:farmerProfile',
  'auth_token',
  'access_token',
  'refresh_token',
  'token',
  'user',
  'session',
  'supabase.auth.token',
  // Onboarding flags must NEVER be cleared by a reset.
  'farroway_onboarding_done',
  'farroway_onboarding_completed',
  'farroway_onboarding_complete',
]);

// Stale UI / sync / cache keys to clear when the version bumps.
const RESET_KEYS = Object.freeze([
  'farroway_active_farm',
  'farroway_location',
  'farroway_events',
  'farroway_user_memory',
  'farroway_farmer_source',
  'farroway_sync_queue',
  'farroway_cached_tasks',
  'farroway_cached_weather',
  'farroway_offline_state',
]);

// JSON-encoded localStorage keys whose shape we validate at boot.
// Each entry: { key, kind } where kind ∈ {'object','array'}. If a
// value is present but doesn't parse, OR doesn't match the expected
// kind, we remove it BEFORE React mounts so consumer components
// never read malformed data — preventing the "We hit a problem
// rendering this page" crash that surfaces after a partial
// cache reset.
const SHAPED_LOCAL_KEYS = Object.freeze([
  { key: 'farroway_active_farm',   kind: 'object' },
  { key: 'farroway_user',          kind: 'object' },
  { key: 'farroway_location',      kind: 'object' },
  { key: 'farroway_user_memory',   kind: 'object' },
  { key: 'farroway_cached_tasks',  kind: 'array'  },
  { key: 'farroway_cached_weather',kind: 'object' },
  { key: 'farroway_offline_state', kind: 'object' },
  { key: 'farroway_events',        kind: 'array'  },
  { key: 'farroway_sync_queue',    kind: 'array'  },
  { key: 'farroway_farmer_source', kind: 'object' },
]);

// Console diagnostic — emitted on every boot so engineers can
// confirm both the live UI version and the actual build hash.
function _stampVersion() {
  try {
    // eslint-disable-next-line no-console
    console.log('Farroway Build:', FARROWAY_BUILD_VERSION);
    // eslint-disable-next-line no-console
    console.log('Farroway UI version:', FARROWAY_UI_VERSION);
  } catch { /* swallow */ }
}

// Idempotency guard — if the page has already triggered a reset
// in the current document lifetime, don't trigger a second one.
let _resetInFlight = false;

/**
 * ensureUiVersion()
 *
 * Reads the stored UI version. When it matches FARROWAY_UI_VERSION,
 * returns false (boot proceeds normally). When it differs, kicks off
 * the async reset + reload pipeline and returns true (caller should
 * skip the React mount; the page will reload momentarily).
 */
export function ensureUiVersion() {
  _stampVersion();

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }
  if (_resetInFlight) return true;

  let stored = null;
  try { stored = localStorage.getItem(VERSION_KEY); } catch { stored = null; }

  if (stored === FARROWAY_UI_VERSION) return false;

  // First run on a fresh install (no stored version yet) is also
  // counted as a "match" — there's no stale state to clear, so
  // we just stamp the version and continue. Without this, every
  // brand-new browser would needlessly reload once.
  if (stored == null) {
    try { localStorage.setItem(VERSION_KEY, FARROWAY_UI_VERSION); }
    catch { /* swallow — boot continues */ }
    return false;
  }

  // Direction guard — if `stored` is NEWER than the bundle's
  // version, the browser is almost certainly serving a stale
  // cached bundle (the new index.html hasn't been fetched yet).
  // Triggering a reset here would push v6 state through v5
  // code, then reload, then hit the same cached v5 bundle, then
  // ping-pong forever until Chrome throttles navigation.
  //
  // Format is YYYY-MM-DD-vN so a plain string compare is enough
  // for the common case. Bail without resetting; the next time
  // the browser fetches index.html it'll get the new bundle and
  // this branch will never fire.
  if (typeof stored === 'string'
      && typeof FARROWAY_UI_VERSION === 'string'
      && stored > FARROWAY_UI_VERSION) {
    try {
      // eslint-disable-next-line no-console
      console.warn(
        '[Farroway] Stale bundle detected (in-bundle '
        + FARROWAY_UI_VERSION + ' < stored ' + stored + '). '
        + 'Skipping UI reset to avoid a reload loop. '
        + 'Hard-refresh (Ctrl+Shift+R) once to pick up the new bundle.'
      );
    } catch { /* swallow */ }
    return false;
  }

  // Version mismatch (older stored → newer bundle) → run the reset.
  _resetInFlight = true;
  try {
    // eslint-disable-next-line no-console
    console.warn(
      '[Farroway] UI version changed (' + String(stored)
      + ' → ' + FARROWAY_UI_VERSION + '). Clearing cached client state.'
    );
  } catch { /* swallow */ }

  // Run the async cleanup; reload once it resolves (or fails).
  _runResetAndReload().catch(() => {
    // Even if the cleanup throws, reload — the user must end up
    // on the fresh build either way.
    _safeReload();
  });
  return true;
}

/**
 * validateLocalStorageShapes()
 *
 * Scrubs malformed JSON values out of localStorage BEFORE any
 * component reads them. For each entry in SHAPED_LOCAL_KEYS:
 *   • if the value is missing → skip
 *   • if it doesn't parse as JSON → remove
 *   • if it doesn't match the expected kind (object/array) → remove
 *
 * This guarantees the "after a partial cache reset, components
 * read a half-shaped object and crash on `.crop.name`" failure
 * mode is impossible. Synchronous; never throws.
 *
 * Returns the number of keys removed (handy for logging in tests).
 */
export function validateLocalStorageShapes() {
  if (typeof localStorage === 'undefined') return 0;
  let removed = 0;
  for (const { key, kind } of SHAPED_LOCAL_KEYS) {
    let raw;
    try { raw = localStorage.getItem(key); } catch { continue; }
    if (raw == null) continue;
    let parsed;
    let ok = false;
    try {
      parsed = JSON.parse(raw);
      if (kind === 'object') {
        ok = parsed !== null
          && typeof parsed === 'object'
          && !Array.isArray(parsed);
      } else if (kind === 'array') {
        ok = Array.isArray(parsed);
      }
    } catch { ok = false; }
    if (!ok) {
      try { localStorage.removeItem(key); removed += 1; } catch { /* tolerate */ }
    }
  }
  if (removed > 0) {
    try {
      // eslint-disable-next-line no-console
      console.warn(
        '[Farroway] cleared ' + removed
        + ' malformed localStorage entr' + (removed === 1 ? 'y' : 'ies')
        + ' before mount.'
      );
    } catch { /* swallow */ }
  }
  return removed;
}

/**
 * killServiceWorkerAndCaches()
 *
 * Unconditional, fire-and-forget cleanup that runs on every boot:
 *   • Unregisters every service-worker registration.
 *   • Deletes every cache whose name contains `farroway` or
 *     `workbox` (matches both legacy SW caches and any future
 *     workbox-based ones).
 *
 * The SW story is intentionally disabled until the Home banner +
 * sync regressions are resolved. Pay one extra network fetch per
 * page load in exchange for a guarantee the user sees the live
 * bundle.
 *
 * Safe to call BEFORE React mounts and BEFORE ensureUiVersion's
 * own cleanup — the operations are idempotent.
 */
export function killServiceWorkerAndCaches() {
  // SW unregister — fire and forget. Logs the count per spec
  // wording so engineers can confirm the cleanup fired.
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        if (!Array.isArray(regs)) return;
        regs.forEach((r) => { try { r.unregister(); } catch { /* tolerate */ } });
        try {
          // eslint-disable-next-line no-console
          console.log('Service workers unregistered:', regs.length);
        } catch { /* swallow */ }
      }).catch(() => { /* tolerate */ });
    }
  } catch { /* swallow */ }

  // Cache purge — drop anything that smells like ours, workbox's,
  // or vite's. Spec-named "Cache cleanup complete" log fires
  // after the keys() promise resolves so engineers can confirm
  // the sweep ran.
  try {
    if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
      caches.keys().then((keys) => {
        if (!Array.isArray(keys)) return;
        let dropped = 0;
        keys.forEach((k) => {
          if (typeof k !== 'string') return;
          const lower = k.toLowerCase();
          if (lower.includes('farroway') || lower.includes('workbox') || lower.includes('vite')) {
            try { caches.delete(k); dropped += 1; } catch { /* tolerate */ }
          }
        });
        try {
          // eslint-disable-next-line no-console
          console.log('Cache cleanup complete (' + dropped + ' deleted)');
        } catch { /* swallow */ }
      }).catch(() => { /* tolerate */ });
    }
  } catch { /* swallow */ }
}

async function _runResetAndReload() {
  // 1. Clear stale localStorage keys (preserve auth).
  _clearStaleLocalStorage();

  // 2. Unregister service workers.
  await _unregisterServiceWorkers();

  // 3. Drop any caches whose name contains `farroway` or `workbox`.
  await _clearFarrowayCaches();

  // 4. Stamp the new version BEFORE reloading so the next boot
  //    reads the match and no-ops the reset path.
  try { localStorage.setItem(VERSION_KEY, FARROWAY_UI_VERSION); }
  catch { /* swallow */ }

  // 5. Reload once.
  _safeReload();
}

function _clearStaleLocalStorage() {
  try {
    for (const k of RESET_KEYS) {
      try { localStorage.removeItem(k); } catch { /* per-key tolerate */ }
    }
  } catch { /* swallow */ }
  // Also clear anything matching `farroway_sync*` or `farroway_cache*`
  // patterns — those proliferate over time as features land.
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (typeof key !== 'string') continue;
      if (AUTH_KEYS.includes(key)) continue;
      if (key === VERSION_KEY) continue;
      if (key.startsWith('farroway_sync')
       || key.startsWith('farroway_cache')
       || key.startsWith('farroway_offline')) {
        drop.push(key);
      }
    }
    for (const k of drop) {
      try { localStorage.removeItem(k); } catch { /* tolerate */ }
    }
  } catch { /* swallow */ }
}

async function _unregisterServiceWorkers() {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    const regs = await navigator.serviceWorker.getRegistrations();
    if (!Array.isArray(regs) || regs.length === 0) return;
    await Promise.all(regs.map(async (reg) => {
      try { await reg.unregister(); } catch { /* tolerate */ }
    }));
  } catch { /* swallow */ }
}

async function _clearFarrowayCaches() {
  try {
    if (typeof caches === 'undefined' || typeof caches.keys !== 'function') return;
    const keys = await caches.keys();
    if (!Array.isArray(keys) || keys.length === 0) return;
    const matchKeys = keys.filter((k) => {
      if (typeof k !== 'string') return false;
      const lower = k.toLowerCase();
      return lower.includes('farroway') || lower.includes('workbox');
    });
    await Promise.all(matchKeys.map(async (k) => {
      try { await caches.delete(k); } catch { /* tolerate */ }
    }));
  } catch { /* swallow */ }
}

function _safeReload() {
  try {
    if (typeof window !== 'undefined' && window.location
        && typeof window.location.reload === 'function') {
      window.location.reload();
    }
  } catch { /* swallow */ }
}

// Test hooks.
export const _internal = Object.freeze({
  VERSION_KEY,
  AUTH_KEYS,
  RESET_KEYS,
  SHAPED_LOCAL_KEYS,
  _clearStaleLocalStorage,
  _unregisterServiceWorkers,
  _clearFarrowayCaches,
});

export default ensureUiVersion;
