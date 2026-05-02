/**
 * dailyFreshness.js — once-per-day "your plan is updated" toast
 * tracker (Final Home + Review Copy Polish §5).
 *
 *   import { isFirstHomeOpenToday, markHomeOpenedToday } from
 *     '../core/dailyFreshness.js';
 *
 *   if (isFirstHomeOpenToday()) {
 *     showToast('Your plan is updated for today \u{1F331}');
 *     markHomeOpenedToday();
 *   }
 *
 * Spec rule (§5)
 *   • On Home load, if firstOpenToday === true, show the
 *     freshness toast.
 *   • Persist `farroway_last_home_open_date` (YYYY-MM-DD).
 *   • Only show once per day.
 *
 * Why a separate module
 * ─────────────────────
 * The DailyPlanCard already composes streak + progress +
 * adaptive + health-feedback engines on top of the v2 plan.
 * Threading "first open today" through any of those modules
 * would muddy their contracts (streak is about completions,
 * progress is about the current plan, etc.). The freshness
 * tracker is a tiny self-contained reader/writer pair.
 *
 * Strict-rule audit
 *   • Pure outside the localStorage I/O. Every read/write
 *     wrapped in try/catch — never throws.
 *   • SSR-safe: every storage access guarded by typeof
 *     localStorage check.
 *   • Idempotent: calling markHomeOpenedToday() twice on the
 *     same date is a no-op.
 */

export const LAST_HOME_OPEN_KEY = 'farroway_last_home_open_date';

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, String(value));
  } catch { /* swallow — quota / private mode */ }
}

/**
 * Format a Date as 'YYYY-MM-DD' in LOCAL time. Same boundary
 * the rest of the retention-loop modules use so "today" lines
 * up across all surfaces.
 */
function _localDayKey(date) {
  const d = (date instanceof Date) ? date : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * isFirstHomeOpenToday(now?) → boolean
 *
 * Returns true when no `farroway_last_home_open_date` value is
 * stored OR the stored value is older than today's local day.
 * The reader does NOT mutate state — call markHomeOpenedToday
 * separately so the caller can decide when to flip the flag
 * (e.g. after the toast actually rendered, not on every render).
 *
 * Returns false when the stored value === today, OR when the
 * clock is broken (defensive default — a broken clock should
 * NOT spam the user with a "fresh plan" toast on every render).
 */
export function isFirstHomeOpenToday(now) {
  const today = _localDayKey(now);
  if (!today) return false;
  const stored = _safeGet(LAST_HOME_OPEN_KEY);
  // No prior entry → first open ever today.
  if (!stored) return true;
  // Stored value matches today → already opened today.
  if (stored === today) return false;
  // Older value → first open today.
  return true;
}

/**
 * markHomeOpenedToday(now?) → 'YYYY-MM-DD' | null
 *
 * Persists the spec key. Returns the stored value so the
 * caller can confirm the write landed (useful for tests).
 * Returns null when localStorage is unavailable or the clock
 * is broken.
 */
export function markHomeOpenedToday(now) {
  const today = _localDayKey(now);
  if (!today) return null;
  _safeSet(LAST_HOME_OPEN_KEY, today);
  return today;
}

/**
 * Reset the flag. Used by test helpers + the admin "redo
 * onboarding" path so a returning tester sees the toast
 * again on the next Home open.
 */
export function resetHomeOpenedToday() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(LAST_HOME_OPEN_KEY);
  } catch { /* swallow */ }
}

export default {
  isFirstHomeOpenToday,
  markHomeOpenedToday,
  resetHomeOpenedToday,
};
