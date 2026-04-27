/**
 * dailyCheckin.js — once-per-local-day check-in flag.
 *
 * Storage key: farroway_last_checkin   (Date.toDateString() value)
 *
 * The check-in flag is independent of the streak engine: this
 * module only answers "has the farmer opened the app today?".
 * The streak math lives in src/utils/streak.js and reads its own
 * anchor key, so the two stay decoupled - calling them in either
 * order produces the same result.
 *
 * Strict rules respected:
 *   * works offline  - localStorage only, no network
 *   * never throws    - every storage call try/catch wrapped
 *   * lightweight    - 4 small functions, no deps
 */

export const LAST_CHECKIN_KEY = 'farroway_last_checkin';

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
  } catch { /* swallow - quota / private mode */ }
}

/** Stable per-local-day key. */
export function getTodayKey() {
  return new Date().toDateString();
}

/** True when `markCheckedIn()` already fired today. */
export function hasCheckedInToday() {
  return _safeGet(LAST_CHECKIN_KEY) === getTodayKey();
}

/** Stamp today's check-in. Idempotent within the same local day. */
export function markCheckedIn() {
  _safeSet(LAST_CHECKIN_KEY, getTodayKey());
}

/** The last calendar day the farmer checked in, or null. */
export function getLastCheckinDay() {
  const v = _safeGet(LAST_CHECKIN_KEY);
  return v && v.trim() ? v : null;
}

/** Test / "redo" helper. Not wired into any UI. */
export function resetCheckin() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LAST_CHECKIN_KEY);
    }
  } catch { /* swallow */ }
}
