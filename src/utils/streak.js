/**
 * streak.js — daily streak counter for the engagement loop.
 *
 * Storage keys
 *   farroway_streak          numeric streak (int >= 0)
 *   farroway_streak_anchor   Date.toDateString() of the day the
 *                            streak last counted
 *
 * Why a separate anchor key
 * ────────────────────────
 * The spec section 3 calls `markCheckedIn()` BEFORE
 * `updateStreak()`. If the streak math read the same
 * `farroway_last_checkin` key, the comparison would already see
 * "today" by the time it ran, and the streak would never advance.
 * We avoid that pitfall by giving the streak its OWN anchor key.
 * Net effect: dailyCheckin and streak are commutative - calling
 * them in any order on the same boot produces the same result.
 *
 * Streak rules
 *   * If the anchor is today    -> already counted, no change.
 *   * If the anchor is yesterday -> streak += 1 (chain extends).
 *   * Otherwise                  -> streak = 1 (gap or first time).
 *
 * Strict rules respected:
 *   * never throws          - every storage call try/catch wrapped
 *   * works offline         - localStorage only
 *   * idempotent same-day   - safe to call multiple times per boot
 *   * no punishment         - missed days reset to 1, not zero
 */

export const STREAK_KEY        = 'farroway_streak';
export const STREAK_ANCHOR_KEY = 'farroway_streak_anchor';

const MS_PER_DAY = 86_400_000;

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

function _todayString() { return new Date().toDateString(); }
function _yesterdayString() { return new Date(Date.now() - MS_PER_DAY).toDateString(); }

/** Current streak count. Always returns a non-negative integer. */
export function getStreak() {
  const raw = _safeGet(STREAK_KEY);
  const n = Number(raw || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/**
 * Update the streak for today. Returns the new streak count.
 * Safe to call any number of times within the same calendar day -
 * subsequent calls are no-ops.
 */
export function updateStreak() {
  const today     = _todayString();
  const anchor    = _safeGet(STREAK_ANCHOR_KEY);
  const yesterday = _yesterdayString();

  // Already counted today -> idempotent return.
  if (anchor === today) return getStreak();

  let streak = getStreak();
  if (anchor === yesterday) {
    streak += 1;
  } else {
    // No anchor, OR anchor older than yesterday = gap. Reset to 1.
    streak = 1;
  }

  _safeSet(STREAK_KEY, String(streak));
  _safeSet(STREAK_ANCHOR_KEY, today);
  return streak;
}

/**
 * Did the user miss at least one day since their last counted
 * streak? Used by the "no punishment" missed-day banner.
 *
 *   anchor empty                         -> false (never started)
 *   anchor === today  || === yesterday   -> false (chain healthy)
 *   anchor older than yesterday           -> true  (banner-worthy)
 */
export function hasMissedYesterday() {
  const anchor = _safeGet(STREAK_ANCHOR_KEY);
  if (!anchor) return false;
  if (anchor === _todayString())     return false;
  if (anchor === _yesterdayString()) return false;
  return true;
}

/** Test / admin "redo" helper. */
export function resetStreak() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STREAK_KEY);
      localStorage.removeItem(STREAK_ANCHOR_KEY);
    }
  } catch { /* swallow */ }
}
