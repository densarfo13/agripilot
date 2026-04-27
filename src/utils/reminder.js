/**
 * reminder.js — light-touch "come back to your farm" nudge.
 *
 * The spec asks for a 6-hour reminder triggered on app open. We
 * implement that with two improvements over a raw `setTimeout(...,
 * alert(...))`:
 *
 *   1. The toast goes through the Notification API when the
 *      browser supports it (less invasive than alert(), works
 *      while the page is backgrounded). alert() is the fallback.
 *   2. We track the last reminder fire-day in localStorage so a
 *      tab that's been open for 12 hours doesn't fire twice in
 *      one day.
 *
 * Strict rules respected:
 *   * lightweight  - no third-party scheduler, no service worker
 *                    registration; one setTimeout per app session
 *   * works offline- Notification API is local-first
 *   * never throws - all browser API calls try/catch wrapped
 */

const LAST_REMINDER_KEY    = 'farroway_last_reminder_day';
const REMINDER_DELAY_MS    = 6 * 60 * 60 * 1000; // 6 hours
const REMINDER_TITLE       = 'Farroway';
const REMINDER_BODY        = 'Check your farm tasks today';

let _activeTimer = null;

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value == null ? '' : value));
  } catch { /* swallow */ }
}

function _today() { return new Date().toDateString(); }

function _firedToday() {
  return _safeGet(LAST_REMINDER_KEY) === _today();
}

function _stampToday() {
  _safeSet(LAST_REMINDER_KEY, _today());
}

function _notify(title, body) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      // eslint-disable-next-line no-new
      new Notification(title, { body });
      return true;
    }
  } catch { /* swallow */ }
  // Soft fallback: alert() ONLY if the page is foregrounded - we
  // don't want to spam a backgrounded tab with modal dialogs.
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      // eslint-disable-next-line no-alert
      alert(`${title}: ${body}`);
      return true;
    }
  } catch { /* swallow */ }
  return false;
}

/**
 * scheduleReminder({ delayMs?, title?, body? })
 *   -> a teardown function that cancels the pending timer.
 *
 * Idempotent within a single app session: a subsequent call
 * cancels the previous timer before starting a new one. Idempotent
 * across days: the timer no-ops when a reminder already fired
 * today (so re-mounts of App.jsx don't re-fire).
 */
export function scheduleReminder({
  delayMs = REMINDER_DELAY_MS,
  title   = REMINDER_TITLE,
  body    = REMINDER_BODY,
} = {}) {
  // Cancel any pending timer from a previous mount.
  if (_activeTimer) {
    try { clearTimeout(_activeTimer); }
    catch { /* swallow */ }
    _activeTimer = null;
  }

  if (typeof setTimeout !== 'function') return () => { /* noop */ };
  if (_firedToday()) return () => { /* noop */ };

  _activeTimer = setTimeout(() => {
    if (_firedToday()) return;
    const ok = _notify(title, body);
    if (ok) _stampToday();
    _activeTimer = null;
  }, Math.max(0, delayMs));

  return () => {
    if (_activeTimer) {
      try { clearTimeout(_activeTimer); }
      catch { /* swallow */ }
      _activeTimer = null;
    }
  };
}

/** Test / admin helper. */
export function resetReminderStamp() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LAST_REMINDER_KEY);
    }
  } catch { /* swallow */ }
}

export const _internal = Object.freeze({
  LAST_REMINDER_KEY, REMINDER_DELAY_MS,
});
