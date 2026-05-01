/**
 * habitNotifications.js — single daily reminder for the habit
 * system.
 *
 * Spec coverage (Daily habit system §1)
 *   • 1 notification per day, task or opportunity.
 *
 * Behaviour
 *   • On `setupHabitNotification()`, registers ONE timer that fires
 *     at the user's preferred hour (default 7am local).
 *   • Per-day deduplication — re-mounts of the strip never re-fire.
 *   • Returns a teardown function so the React effect can clean up.
 *
 * Position
 *   This is the V2 alternative to `engagementReminders.js` (which
 *   fires morning + afternoon). When the `dailyHabit` flag is on,
 *   `EngagementStrip` swaps the dual reminder for this single one.
 *   Both helpers share the underlying `scheduleReminder()`
 *   delivery path so analytics + permissions stay consistent.
 *
 * Storage
 *   farroway_habit_daily_anchor : YYYY-MM-DD last fired
 *
 * Strict-rule audit
 *   • Never throws — every storage + Date op try/catch wrapped.
 *   • Returns a teardown function for clean unmounting.
 *   • Idempotent on re-call within the same session (cancels the
 *     previous timer before scheduling a new one).
 *   • No-op when localStorage / setTimeout unavailable.
 */

import { scheduleReminder } from '../utils/reminder.js';

export const HABIT_DAILY_ANCHOR_KEY = 'farroway_habit_daily_anchor';

const DEFAULT_HOUR = 7;
const MS_PER_DAY   = 86_400_000;

function _todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value || ''));
  } catch { /* swallow */ }
}

function _msUntilHour(hour, now = new Date()) {
  try {
    const target = new Date(now);
    target.setHours(hour, 0, 0, 0);
    let delta = target.getTime() - now.getTime();
    if (delta <= 0) delta += MS_PER_DAY;
    return Math.max(0, delta);
  } catch {
    return MS_PER_DAY;
  }
}

function _alreadyShown() {
  return _safeGet(HABIT_DAILY_ANCHOR_KEY) === _todayISO();
}

function _stampShown() {
  _safeSet(HABIT_DAILY_ANCHOR_KEY, _todayISO());
}

/**
 * setupHabitNotification({ hour?, copy? }) → teardown()
 *
 *   copy = { title, body }   pre-localized via tStrict by the
 *                            caller; this module stays i18n-free.
 */
export function setupHabitNotification({
  hour = DEFAULT_HOUR,
  copy = {},
} = {}) {
  if (typeof setTimeout !== 'function') {
    return () => { /* noop */ };
  }
  if (_alreadyShown()) {
    return () => { /* noop */ };
  }

  const delay = _msUntilHour(hour);
  const teardown = scheduleReminder({
    delayMs: delay,
    title:   copy.title || 'Your priority for today',
    body:    copy.body  || 'Open Farroway to see today\u2019s priority action.',
  });
  // Stamp on schedule, not on fire — same trade-off the engagement
  // reminder helper makes. Worst case: a reminder is missed if the
  // device sleeps past the hour.
  _stampShown();

  return () => {
    try { teardown && teardown(); } catch { /* swallow */ }
  };
}

/** Test / admin: clear the per-day stamp. */
export function _resetHabitNotification() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HABIT_DAILY_ANCHOR_KEY);
    }
  } catch { /* swallow */ }
}

export default { setupHabitNotification };
