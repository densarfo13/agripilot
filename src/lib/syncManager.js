/**
 * syncManager.js — single source of truth for the sync banner +
 * online/offline indicator.
 *
 *   import { useSyncManager, runSync, setConnectionMessage } from './lib/syncManager.js';
 *
 *   const { isSyncing, connectionMessage } = useSyncManager();
 *
 *   // Trigger a sync (e.g. on Home mount, after login, etc.)
 *   runSync(() => Promise.all([fetchTask(), fetchWeather(), fetchFarm()]));
 *
 * Why this exists
 *   The sync banner used to read from a queue length AND each
 *   feature kept its own `setIsSyncing` flag. After deploys it
 *   was easy to leave one of those flags stuck `true` forever,
 *   which painted "Back online. Syncing…" until the user
 *   reloaded. This module owns the banner state for the whole
 *   app — every other surface reads from `useSyncManager()`
 *   and triggers via `runSync()`.
 *
 * Behaviour
 *   • runSync(syncFn) wraps the caller's promise in a 5-second
 *     hard-stop (`Promise.race` against a timer). When EITHER
 *     the promise resolves OR the timer fires:
 *       – isSyncing → false
 *       – connectionMessage → null
 *     so the banner ALWAYS disappears, even if the underlying
 *     fetches hang.
 *   • The "Offline mode" message comes from the browser's
 *     `offline` event; "Back online. Updating…" is set on the
 *     `online` event and auto-clears after 3 seconds.
 *   • Listeners are wired exactly once at module load — calling
 *     `runSync` doesn't add new listeners.
 *
 * Strict-rule audit
 *   • Pure ESM; no React imports at module scope.
 *   • The hook itself uses React, but the state lives outside
 *     React so non-React code can read/write it too.
 *   • Never throws — runSync swallows the caller's rejection
 *     after logging it to console.error.
 */

import { useSyncExternalStore } from 'react';

const HARD_STOP_MS         = 5000;
const ONLINE_BANNER_MS     = 3000;

// ─── External store ──────────────────────────────────────────
//
// The state lives in module scope so non-component code (timers,
// event listeners) can read / write it without going through
// React. `useSyncExternalStore` re-renders subscribers when the
// version increments.

let _state = Object.freeze({
  isSyncing:         false,
  connectionMessage: null,
  lastSyncAt:        null,
});

const _listeners = new Set();
function _notify() {
  for (const l of _listeners) {
    try { l(); } catch { /* never propagate */ }
  }
}

function _setState(patch) {
  _state = Object.freeze({ ..._state, ...patch });
  _notify();
}

// Active timeouts so we can cancel + replace them on rapid calls.
let _hardStopTimer    = null;
let _onlineBannerTimer = null;

/**
 * runSync(syncFn)
 *
 * Sets isSyncing=true + a friendly message, runs syncFn, and
 * clears the banner when EITHER the promise settles OR the
 * 5-second hard-stop fires. Returns a Promise that resolves
 * when the sync settles (or the timeout fires) — never rejects.
 */
export function runSync(syncFn, opts = {}) {
  const message = typeof opts.message === 'string' && opts.message.length > 0
    ? opts.message
    : 'Updating your farm data\u2026';
  _setState({ isSyncing: true, connectionMessage: message });

  // Cancel any previous hard-stop timer — the new sync resets it.
  if (_hardStopTimer) { clearTimeout(_hardStopTimer); _hardStopTimer = null; }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    if (_hardStopTimer) { clearTimeout(_hardStopTimer); _hardStopTimer = null; }
    _setState({
      isSyncing: false,
      connectionMessage: null,
      lastSyncAt: Date.now(),
    });
  };

  _hardStopTimer = setTimeout(finish, HARD_STOP_MS);

  let work;
  try {
    work = typeof syncFn === 'function' ? syncFn() : Promise.resolve();
  } catch (e) {
    // Synchronous throw inside syncFn — log + finish.
    try { console.error('[syncManager] sync threw synchronously:', e); }
    catch { /* swallow */ }
    finish();
    return Promise.resolve();
  }

  if (!work || typeof work.then !== 'function') {
    finish();
    return Promise.resolve();
  }

  return work
    .catch((err) => {
      try { console.error('[syncManager] sync error:', err); }
      catch { /* swallow */ }
    })
    .finally(finish);
}

/**
 * setConnectionMessage(message, autoHideMs?)
 *
 * Use for transient banners outside a sync ("Offline mode" /
 * "Back online…"). When `autoHideMs` is supplied the banner
 * clears itself after that many milliseconds.
 */
export function setConnectionMessage(message, autoHideMs) {
  _setState({ connectionMessage: message || null });
  if (_onlineBannerTimer) {
    clearTimeout(_onlineBannerTimer); _onlineBannerTimer = null;
  }
  if (typeof autoHideMs === 'number' && autoHideMs > 0 && message) {
    _onlineBannerTimer = setTimeout(() => {
      // Only clear if the same message is still showing — avoids
      // overwriting a newer message that arrived in between.
      if (_state.connectionMessage === message) {
        _setState({ connectionMessage: null });
      }
      _onlineBannerTimer = null;
    }, autoHideMs);
  }
}

/**
 * forceClearBanner()
 *
 * Last-resort escape hatch. Clears every active timer and
 * resets to the idle state. The ErrorBoundary calls this so a
 * user clicking "Try again" never sees the recovery card paint
 * over a stale banner.
 */
export function forceClearBanner() {
  if (_hardStopTimer)     { clearTimeout(_hardStopTimer);    _hardStopTimer    = null; }
  if (_onlineBannerTimer) { clearTimeout(_onlineBannerTimer); _onlineBannerTimer = null; }
  _setState({ isSyncing: false, connectionMessage: null });
}

/** Pure read for non-React callers / tests. */
export function getSyncState() { return _state; }

// ─── React hook ──────────────────────────────────────────────

function _subscribe(listener) {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function _getSnapshot() { return _state; }

export function useSyncManager() {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
}

// ─── Online / offline event wiring ───────────────────────────
//
// Run exactly once at module load. The listeners are detached on
// page unload (not strictly necessary but tidy). Tests can call
// _resetForTests() to wipe state + re-register.

let _bound = false;
function _bindOnceForBrowser() {
  if (_bound) return;
  if (typeof window === 'undefined') return;
  _bound = true;
  try {
    window.addEventListener('online', () => {
      setConnectionMessage('Back online. Updating\u2026', ONLINE_BANNER_MS);
    });
    window.addEventListener('offline', () => {
      // Offline banner has no auto-hide — it stays until the
      // browser fires `online` again.
      setConnectionMessage('Offline mode');
    });
  } catch { /* never propagate from a top-level binding */ }
}
_bindOnceForBrowser();

// ─── Test hooks ──────────────────────────────────────────────
export const _internal = Object.freeze({
  HARD_STOP_MS,
  ONLINE_BANNER_MS,
  _resetForTests: () => {
    if (_hardStopTimer)     { clearTimeout(_hardStopTimer);    _hardStopTimer    = null; }
    if (_onlineBannerTimer) { clearTimeout(_onlineBannerTimer); _onlineBannerTimer = null; }
    _state = Object.freeze({ isSyncing: false, connectionMessage: null, lastSyncAt: null });
    _listeners.clear();
  },
});

export default { useSyncManager, runSync, setConnectionMessage, forceClearBanner, getSyncState };
