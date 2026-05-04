/**
 * forceUiReset.js — forced UI cache + state reset on version bump.
 *
 *   import { ensureUiVersion, FARROWAY_UI_VERSION } from './lib/forceUiReset.js';
 *
 *   // At the very top of main.jsx — before any other side-effect:
 *   const resetting = ensureUiVersion();
 *   if (!resetting) {
 *     // ... continue boot ...
 *   }
 *
 * Why this exists
 *   When we cut a deploy that materially changes the UI shell
 *   (banners, layouts, store keys), some farmers' browsers hang
 *   onto stale state — old localStorage, old service-worker
 *   caches, the old "Back online. Syncing..." banner — and the
 *   new build never visibly takes hold even after a reload.
 *
 *   This module bumps a single constant whenever we know a fresh
 *   UI must replace the cached one. On boot, it compares the
 *   stored version against the constant; if different, it
 *   PRESERVES the auth token + user, clears the known stale
 *   client-state keys, unregisters service workers, drops every
 *   `farroway*` cache, then reloads ONCE. After reload, the
 *   versions match and the routine no-ops.
 *
 * Strict-rule audit
 *   • Auth is never cleared — `farroway_token` + `farroway_user`
 *     remain in place so the user is NOT logged out.
 *   • Reload happens exactly once — guarded by the freshly-set
 *     `farroway_ui_version` value, so there's no loop risk.
 *   • Every step is wrapped in try/catch — any single failure
 *     falls through to the next step, then to the reload, so a
 *     locked storage or denied SW API never strands the user.
 *   • Pure browser-only — no-ops in SSR / non-window contexts.
 */

// Bump this whenever a deploy must force-clear stale client state.
// Format: YYYY-MM-DD-vN. Always increment N for same-day reissues.
export const FARROWAY_UI_VERSION = '2026-05-03-v4';

// localStorage key the version is stored under.
const VERSION_KEY = 'farroway_ui_version';

// Auth-related keys. NEVER clear these — they keep the user signed in.
const AUTH_KEYS = Object.freeze([
  'farroway_token',
  'farroway_user',
  // Step-up MFA + refresh state — preserve so the user doesn't
  // hit a re-verify prompt purely because the UI shell rotated.
  'farroway_refresh',
  'farroway_step_up',
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

// Console diagnostic — emitted on every boot so engineers can
// confirm the live UI version from DevTools.
function _stampVersion() {
  try {
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

  // Version mismatch → run the reset.
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

async function _runResetAndReload() {
  // 1. Clear stale localStorage keys (preserve auth).
  _clearStaleLocalStorage();

  // 2. Unregister service workers.
  await _unregisterServiceWorkers();

  // 3. Drop any caches whose name starts with `farroway`.
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
    const farrowayKeys = keys.filter((k) => typeof k === 'string'
      && k.toLowerCase().startsWith('farroway'));
    await Promise.all(farrowayKeys.map(async (k) => {
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
  _clearStaleLocalStorage,
  _unregisterServiceWorkers,
  _clearFarrowayCaches,
});

export default ensureUiVersion;
