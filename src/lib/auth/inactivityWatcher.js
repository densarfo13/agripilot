/**
 * inactivityWatcher.js — fires a logout callback after N minutes of
 * no user activity. Designed for shared NGO kiosks / agent phones
 * where farmer A might walk away without tapping logout.
 *
 *   startInactivityWatcher({
 *     onTimeout,       // () => void  — called once when the deadline hits
 *     timeoutMs = 600_000,             // default 10 minutes
 *     enabled  = true,                 // gate via user preference
 *     events   = DEFAULT_EVENTS,
 *   }) → stop()
 *
 * Activity any of these events refresh the deadline:
 *   pointermove / pointerdown / keydown / wheel / touchstart /
 *   visibilitychange (when tab becomes visible).
 *
 * Contract
 *   • Pure plumbing — does NOT call logout itself; the caller passes
 *     a logout callback. That keeps this file decoupled from
 *     AuthContext + makes it trivially testable.
 *   • Returns a `stop()` cleanup so React effects can detach.
 *   • SSR-safe: returns a no-op stop when window is unavailable.
 *   • Tab visibility: a hidden tab does NOT count as activity, so a
 *     phone in a pocket still times out at the right moment when
 *     the screen wakes.
 *   • Cross-tab safe: persists the last activity timestamp under
 *     `farroway:lastActivityAt` so two tabs of the same farmer
 *     agree on when "10 minutes idle" started.
 */

const DEFAULT_EVENTS = Object.freeze([
  'pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart',
]);
const STORAGE_KEY = 'farroway:lastActivityAt';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const TICK_MS = 30 * 1000;                  // check every 30s

export function startInactivityWatcher({
  onTimeout,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  enabled   = true,
  events    = DEFAULT_EVENTS,
} = {}) {
  if (typeof window === 'undefined') return () => {};
  if (!enabled || typeof onTimeout !== 'function') return () => {};

  let fired = false;
  let intervalId = null;

  function stamp(now = Date.now()) {
    try { window.localStorage.setItem(STORAGE_KEY, String(now)); } catch { /* private mode */ }
  }
  function readStamp() {
    try {
      const v = Number(window.localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(v) && v > 0 ? v : Date.now();
    } catch { return Date.now(); }
  }

  function onActivity() {
    if (fired) return;
    stamp();
  }

  function onVisibility() {
    // When the tab becomes visible we DON'T treat it as activity —
    // the user may have been away. We just check the deadline now
    // so a long-pocketed phone logs out as soon as it wakes.
    if (document.visibilityState === 'visible') checkDeadline();
  }

  function checkDeadline() {
    if (fired) return;
    const last = readStamp();
    if (Date.now() - last >= timeoutMs) {
      fired = true;
      try { onTimeout('inactivity'); } catch { /* never propagate */ }
      stop();
    }
  }

  // Seed the timestamp so `enabled=true` from a fresh login starts
  // the clock now, not at 1970.
  stamp();

  for (const evt of events) {
    window.addEventListener(evt, onActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', onVisibility);

  intervalId = setInterval(checkDeadline, TICK_MS);

  function stop() {
    for (const evt of events) {
      try { window.removeEventListener(evt, onActivity); } catch { /* ignore */ }
    }
    try { document.removeEventListener('visibilitychange', onVisibility); }
    catch { /* ignore */ }
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  return stop;
}

export const _internal = Object.freeze({
  DEFAULT_EVENTS, STORAGE_KEY, DEFAULT_TIMEOUT_MS, TICK_MS,
});
