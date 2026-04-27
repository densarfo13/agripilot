/**
 * init.js — Farroway core wake-up (spec section 10).
 *
 * Wires `runDailyReminder` to a 60-second tick. NOT auto-firing on
 * import: callers explicitly call `initFarrowayCore()` at the
 * mount point of their choice (typically src/main.jsx). This keeps
 * us from clashing with the existing reminderEngine which has its
 * own scheduling loop.
 *
 *   import { initFarrowayCore } from '../core/farroway';
 *   const stop = initFarrowayCore();
 *   // ... later, optional:
 *   stop();
 *
 * Strict rules respected:
 *   * idempotent - calling twice doesn't double-fire (the second
 *     call returns the existing teardown without scheduling a new
 *     interval)
 *   * never crashes if window/setInterval are missing (SSR, tests)
 *   * never throws from the tick handler
 */

import { runDailyReminder } from './notificationSystem.js';

export const TICK_INTERVAL_MS = 60_000;

let _activeTimer = null;
let _activeStop  = null;

export function initFarrowayCore() {
  if (_activeStop) return _activeStop;
  if (typeof setInterval !== 'function') {
    return () => { /* noop teardown when no scheduler */ };
  }

  _activeTimer = setInterval(() => {
    try { runDailyReminder(); }
    catch (err) {
      try { console.warn('[FARROWAY_TICK_FAILED]', err?.message); }
      catch { /* console missing */ }
    }
  }, TICK_INTERVAL_MS);

  _activeStop = () => {
    try { clearInterval(_activeTimer); }
    catch { /* swallow */ }
    _activeTimer = null;
    _activeStop  = null;
  };

  return _activeStop;
}

/** Test / hot-reload helper: stop the active loop if any. */
export function stopFarrowayCore() {
  if (_activeStop) _activeStop();
}
