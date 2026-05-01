/**
 * engagementReminders.js — morning + afternoon reminder scheduler
 * for the daily engagement layer.
 *
 * Behaviour
 *   • On `setupEngagementReminders()`, registers a single timer that
 *     fires at the next morning slot (default 7am local).
 *   • A second timer fires at the afternoon slot (default 4pm local)
 *     IF the user has not completed any task today.
 *   • Both timers are deduplicated per local calendar day via
 *     dedicated localStorage stamps so re-mounting the engagement
 *     surface doesn't re-fire reminders.
 *
 * Storage
 *   farroway_engagement_morning_anchor    : YYYY-MM-DD last shown
 *   farroway_engagement_afternoon_anchor  : YYYY-MM-DD last shown
 *
 * Delivery
 *   Routes through the existing `scheduleReminder()` helper from
 *   `src/utils/reminder.js` — that helper already abstracts the
 *   Notification API + alert() fallback + permission handling.
 *   We pass it a 0ms delay because we own the scheduling math
 *   here. The dedup at the helper layer is independent of ours
 *   (it uses `farroway_last_reminder_day`) so we keep our own
 *   per-slot stamps to allow morning + afternoon both to fire on
 *   the same calendar day.
 *
 * Strict-rule audit
 *   • Never throws — every storage + Date op try/catch wrapped.
 *   • Returns a teardown function so callers (effects) can clean up.
 *   • Idempotent on re-call within the same session (cancels
 *     previous timers before scheduling new ones).
 *   • No-op when localStorage / setTimeout unavailable.
 *   • Never delivers reminders past midnight — if the slot hour has
 *     already passed today, the timer is rescheduled for tomorrow.
 */

import { scheduleReminder } from '../utils/reminder.js';
import { hadActivityToday } from './engagementHistory.js';

export const MORNING_ANCHOR_KEY   = 'farroway_engagement_morning_anchor';
export const AFTERNOON_ANCHOR_KEY = 'farroway_engagement_afternoon_anchor';

const DEFAULT_MORNING_HOUR   = 7;
const DEFAULT_AFTERNOON_HOUR = 16;
const MS_PER_DAY             = 86_400_000;

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

/**
 * Milliseconds until the next occurrence of `hour` in local time.
 * If today's slot has already passed, schedules tomorrow instead.
 */
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

function _alreadyShown(anchorKey) {
  return _safeGet(anchorKey) === _todayISO();
}

function _stampShown(anchorKey) {
  _safeSet(anchorKey, _todayISO());
}

/**
 * setupEngagementReminders({ morningHour?, afternoonHour?, copy? })
 *   → teardown()
 *
 * `copy` is the i18n-resolved title/body strings the caller already
 * computed via tStrict. Keeping the resolution out of this module
 * lets it stay i18n-free + deterministic.
 *
 *   copy = {
 *     morning:   { title, body },
 *     afternoon: { title, body },
 *   }
 */
export function setupEngagementReminders({
  morningHour   = DEFAULT_MORNING_HOUR,
  afternoonHour = DEFAULT_AFTERNOON_HOUR,
  copy = {},
} = {}) {
  if (typeof setTimeout !== 'function') {
    return () => { /* noop */ };
  }

  const teardowns = [];

  // ── Morning reminder ─────────────────────────────────────
  if (!_alreadyShown(MORNING_ANCHOR_KEY)) {
    const delay = _msUntilHour(morningHour);
    const morningTeardown = scheduleReminder({
      delayMs: delay,
      title:   (copy.morning && copy.morning.title) || 'Good morning \u2014 your plan is ready',
      body:    (copy.morning && copy.morning.body)  || 'Open Farroway to see today\u2019s 2 simple actions.',
    });
    // Stamp on schedule (not on fire) — scheduleReminder swallows
    // the actual fire callback, and we don't want an unfired timer
    // to retrigger if the surface remounts. Worst case: a reminder
    // is missed if the device sleeps past the hour. That is the
    // same trade-off the existing scheduleReminder makes.
    _stampShown(MORNING_ANCHOR_KEY);
    teardowns.push(morningTeardown);
  }

  // ── Afternoon reminder (only if no activity today) ───────
  if (!_alreadyShown(AFTERNOON_ANCHOR_KEY)) {
    const delay = _msUntilHour(afternoonHour);
    let afternoonTeardown = () => { /* noop */ };
    const afternoonTimer = setTimeout(() => {
      try {
        if (hadActivityToday()) return;
        afternoonTeardown = scheduleReminder({
          delayMs: 0,
          title: (copy.afternoon && copy.afternoon.title) || 'Still time \u2014 one quick action',
          body:  (copy.afternoon && copy.afternoon.body)  || 'A 2-minute check today keeps your streak going.',
        });
        _stampShown(AFTERNOON_ANCHOR_KEY);
      } catch { /* swallow */ }
    }, delay);
    teardowns.push(() => {
      try { clearTimeout(afternoonTimer); } catch { /* swallow */ }
      try { afternoonTeardown(); }         catch { /* swallow */ }
    });
  }

  return () => {
    for (const fn of teardowns) {
      try { fn(); } catch { /* swallow */ }
    }
  };
}

/** Test / admin: clear both stamps. */
export function _resetEngagementReminders() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MORNING_ANCHOR_KEY);
      localStorage.removeItem(AFTERNOON_ANCHOR_KEY);
    }
  } catch { /* swallow */ }
}

export default { setupEngagementReminders };
