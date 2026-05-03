/**
 * exitTracking.js — captures `last_screen_viewed` + `exit_point`
 * for the User Behavior Tracking spec §4.
 *
 *   recordScreenView(path)
 *     • Logs the current route as the "last screen viewed". Stores
 *       the value in sessionStorage so the exit handler can read
 *       it during page unload (when normal React state is gone).
 *
 *   installExitTracking({ trackEvent })
 *     • Wires beforeunload + visibilitychange + pagehide handlers
 *       so we fire `exit_point` exactly once per session, no matter
 *       which the browser fires first. Returns a teardown function
 *       so the caller can clean up on hot-reload.
 *
 * Why a separate module
 * ─────────────────────
 *   The existing funnelEvents.js owns first-visit / first-action
 *   stamps. Exit tracking is a different concern — it runs on
 *   page unload, fires once, and reads from sessionStorage rather
 *   than localStorage. Living in its own file keeps both small.
 *
 * Strict-rule audit
 *   • Never throws — every browser API call wrapped.
 *   • SSR-safe — every browser global is feature-checked.
 *   • Idempotent install — repeated calls return the same teardown
 *     so a hot-reload doesn't pile up listeners.
 *   • One-shot exit_point per session — guarded by a closure flag
 *     so a beforeunload + pagehide double-fire still emits once.
 */

const LAST_SCREEN_KEY    = 'farroway:lastScreenViewed';
const SESSION_STARTED_KEY = 'farroway:sessionStartedAt';

let _installed = false;
let _exitFired = false;
let _teardown  = () => {};

function _safeSession(key, value) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null)      sessionStorage.removeItem(key);
    else                     sessionStorage.setItem(key, String(value));
    return value;
  } catch { return null; }
}

/**
 * Stamp the current route as last_screen_viewed. Call from a
 * top-level route observer (App.jsx useEffect on useLocation()).
 *
 * @param {string} path — typically `location.pathname`
 */
export function recordScreenView(path) {
  if (!path) return;
  _safeSession(LAST_SCREEN_KEY, String(path));
}

/**
 * Read the most recently stamped route. Used by the exit handler
 * to attach the screen the user was on when they left.
 */
export function getLastScreenViewed() {
  return _safeSession(LAST_SCREEN_KEY);
}

/**
 * Install browser-side exit listeners. Idempotent — second call
 * returns the same teardown function. Caller passes `trackEvent`
 * so the module stays decoupled from the analytics pipeline
 * (also makes unit testing trivial — pass a spy).
 *
 * Returns a teardown function that removes all listeners.
 */
export function installExitTracking({ trackEvent } = {}) {
  if (_installed) return _teardown;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Stamp session start once so exit_point can compute duration.
  if (!_safeSession(SESSION_STARTED_KEY)) {
    _safeSession(SESSION_STARTED_KEY, String(Date.now()));
  }

  const fireExit = (reason) => {
    if (_exitFired) return;
    _exitFired = true;
    let durationMs = null;
    try {
      const start = Number(_safeSession(SESSION_STARTED_KEY) || 0);
      if (Number.isFinite(start) && start > 0) {
        durationMs = Math.max(0, Date.now() - start);
      }
    } catch { durationMs = null; }
    try {
      if (typeof trackEvent === 'function') {
        trackEvent('exit_point', {
          lastScreen: getLastScreenViewed() || null,
          reason,
          durationMs,
        });
      }
    } catch { /* swallow — analytics never blocks unload */ }
  };

  // Fire on the FIRST of pagehide / visibilitychange(hidden) /
  // beforeunload — different browsers prioritise different events.
  // The closure flag (_exitFired) ensures only one fires.
  const onPageHide       = () => fireExit('pagehide');
  const onBeforeUnload   = () => fireExit('beforeunload');
  const onVisibility     = () => {
    if (document.visibilityState === 'hidden') fireExit('visibilitychange');
  };

  try { window.addEventListener('pagehide',         onPageHide); }
  catch { /* ignore */ }
  try { window.addEventListener('beforeunload',     onBeforeUnload); }
  catch { /* ignore */ }
  try { document.addEventListener('visibilitychange', onVisibility); }
  catch { /* ignore */ }

  _installed = true;
  _teardown = () => {
    try { window.removeEventListener('pagehide',         onPageHide); }
    catch { /* ignore */ }
    try { window.removeEventListener('beforeunload',     onBeforeUnload); }
    catch { /* ignore */ }
    try { document.removeEventListener('visibilitychange', onVisibility); }
    catch { /* ignore */ }
    _installed = false;
    _exitFired = false;
    _teardown  = () => {};
  };
  return _teardown;
}

/** Test seam — drops the cached state so unit tests can re-install. */
export function _resetForTests() {
  _installed = false;
  _exitFired = false;
  _teardown  = () => {};
  _safeSession(LAST_SCREEN_KEY, null);
  _safeSession(SESSION_STARTED_KEY, null);
}

export const _internal = Object.freeze({
  LAST_SCREEN_KEY, SESSION_STARTED_KEY,
});

export default { recordScreenView, getLastScreenViewed, installExitTracking };
