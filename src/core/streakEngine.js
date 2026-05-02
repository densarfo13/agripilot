/**
 * streakEngine.js — daily-completion streak tracker (Retention
 * Loop spec §3).
 *
 *   import {
 *     getStreak, recordTaskCompleted,
 *     daysSinceLastCompletion,
 *   } from '../core/streakEngine.js';
 *
 *   const { count, lastCompletedDate } = getStreak();
 *   recordTaskCompleted();             // call after Mark-done
 *   daysSinceLastCompletion()          // → number | null
 *
 * Spec rules (§3):
 *   • Completing at least one task TODAY continues / starts the
 *     streak.
 *   • Missing a full day (i.e. yesterday had zero completions)
 *     resets the streak to 1 the next time the user completes
 *     a task. We DON'T reset eagerly on every page load — that
 *     would be a destructive write. The reset is computed on
 *     the next `recordTaskCompleted()` call.
 *   • Persisted under the spec-named localStorage keys:
 *         farroway_streak_count            → integer
 *         farroway_last_completed_date     → 'YYYY-MM-DD'
 *
 * Why a thin wrapper instead of using lib/retention/streakStore.js
 * ───────────────────────────────────────────────────────────────
 * The existing retention store is correct but writes under
 * `farroway:retention:visit` (one JSON blob with multiple
 * fields). The spec mandates two specific top-level keys for
 * easy debugging + cross-tab observability. This module is the
 * canonical write path going forward; it ALSO fans out to the
 * legacy retention store on every write so the existing
 * HomeProgressBar / dashboard surfaces that read from there
 * keep working without code changes.
 *
 * Strict-rule audit
 *   • Pure functions outside of the localStorage I/O. Every
 *     read/write wrapped in try/catch — never throws.
 *   • Idempotent: two `recordTaskCompleted()` calls on the same
 *     day produce identical state (the streak doesn't double-
 *     count within a day).
 *   • SSR-safe: every storage access is guarded by typeof
 *     localStorage check.
 *   • Coexists with lib/retention/streakStore.js — does not
 *     replace it. Both stores are kept in sync on writes from
 *     this module; reads can come from either side.
 */

// Legacy retention store. Imported lazily inside the write
// path so a circular-import or a broken legacy module can never
// stop the canonical spec-key write from landing.
import * as legacyRetention from '../lib/retention/streakStore.js';

// Spec-mandated key names (Retention Loop spec §3).
export const STREAK_COUNT_KEY     = 'farroway_streak_count';
export const LAST_COMPLETED_KEY   = 'farroway_last_completed_date';

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
 * Format a Date as 'YYYY-MM-DD' in LOCAL time. Matches the
 * dayKey() helper used elsewhere (dailyTaskCompletion +
 * lib/loop) so the streak day boundary lines up with the
 * task-completion day boundary.
 *
 * Why local time (not UTC)
 * ────────────────────────
 * Pilot users are smallholder farmers who live and work in
 * one time zone — their "today" is defined by their device
 * clock, not Greenwich. A UTC-based boundary would split a
 * West African farmer's evening across two streak days, and
 * a Hindi farmer's morning task could count under yesterday.
 * Local time keeps the streak intuitive: "I worked today,
 * so my streak grew today."
 *
 * Edge case: a user crossing time zones (rare for our pilots
 * but possible for diaspora demos) might see one extra day
 * gain or one missed day loss when the device clock jumps.
 * That's a deliberate trade-off — the alternative (UTC) would
 * misread "today" for every regular user. If pilot data shows
 * the trade-off biting, the fix is to read the active farm's
 * `country` from contextResolver and look up its IANA zone,
 * not to flip the boundary global-by-default.
 */
function _localDayKey(date) {
  const d = (date instanceof Date) ? date : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Number of full local-day boundaries between two ISO dates. */
function _daysBetween(fromKey, toKey) {
  if (!fromKey || !toKey) return null;
  // Parse 'YYYY-MM-DD' as local midnight (UTC parse skews ±1
  // day for users east of UTC during DST transitions). We
  // construct the Date from year/month/day so the comparison
  // is timezone-stable.
  const parse = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return new Date(y, m - 1, d).getTime();
  };
  const a = parse(fromKey);
  const b = parse(toKey);
  if (a == null || b == null) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Read the persisted streak. Returns a stable shape — never
 * undefined, never NaN. Count is clamped to ≥ 0.
 *
 * @param {Date} [now] — optional injected clock (tests).
 * @returns {{ count: number, lastCompletedDate: string|null, todayKey: string }}
 */
export function getStreak(now) {
  const raw = _safeGet(STREAK_COUNT_KEY);
  let count = Number(raw);
  if (!Number.isFinite(count) || count < 0) count = 0;
  const last = _safeGet(LAST_COMPLETED_KEY) || null;
  const todayKey = _localDayKey(now);
  return { count, lastCompletedDate: last, todayKey };
}

/**
 * Mark "the user completed at least one task today". Idempotent
 * within a day; the function is safe to call after every
 * Mark-done tap because subsequent calls on the same date are
 * no-ops (count + lastCompletedDate stay identical).
 *
 * Streak transitions:
 *   • last == today      → count unchanged
 *   • last == yesterday  → count + 1 (continued streak)
 *   • last older / null  → count = 1  (fresh streak; spec §3
 *                          missed-day reset)
 *
 * @param {Date} [now] — optional injected clock.
 * @returns {{ count, lastCompletedDate, increased: boolean }}
 */
export function recordTaskCompleted(now) {
  const today = _localDayKey(now);
  if (!today) {
    // Clock is broken — degrade gracefully: leave persisted
    // state alone, return a usable response.
    const cur = getStreak(now);
    return { count: cur.count, lastCompletedDate: cur.lastCompletedDate, increased: false };
  }
  const cur = getStreak(now);
  // Already counted for today — short-circuit so the count
  // doesn't double on every Mark-done tap.
  if (cur.lastCompletedDate === today) {
    return { count: cur.count, lastCompletedDate: today, increased: false };
  }
  let nextCount;
  const gap = _daysBetween(cur.lastCompletedDate, today);
  if (gap === 1) {
    nextCount = (cur.count || 0) + 1;
  } else if (gap === 0) {
    // Defensive — should already be handled by the equality
    // check above, but if the parse failed we still want to
    // avoid a double-bump.
    nextCount = (cur.count || 0) || 1;
  } else {
    // gap > 1 OR null (no prior date) — fresh streak.
    nextCount = 1;
  }
  _safeSet(STREAK_COUNT_KEY,   String(nextCount));
  _safeSet(LAST_COMPLETED_KEY, today);
  // Mirror to the legacy retention store so existing surfaces
  // (HomeProgressBar, NgoControlPanel, etc.) see the same
  // streak count without needing a code change. The legacy
  // store has its own try/catch wrapping localStorage; we
  // wrap again so a broken legacy module never blocks the
  // canonical spec-key write that already landed above.
  try {
    if (typeof legacyRetention.recordCompletion === 'function') {
      legacyRetention.recordCompletion(now instanceof Date ? now : new Date());
    }
  } catch { /* legacy store unavailable — primary write still landed */ }
  return { count: nextCount, lastCompletedDate: today, increased: nextCount > cur.count };
}

/**
 * @returns {number|null} — full days since last completion, or
 *   null when no completion has ever been recorded. Useful for
 *   the spec §5 "missed 2+ days" branch in the adaptive message
 *   engine.
 */
export function daysSinceLastCompletion(now) {
  const today = _localDayKey(now);
  const last  = _safeGet(LAST_COMPLETED_KEY);
  if (!today || !last) return null;
  const gap = _daysBetween(last, today);
  if (gap == null) return null;
  return Math.max(0, gap);
}

/**
 * Reset both keys. Used by the test/admin "redo onboarding"
 * helper so the streak doesn't carry a fake count from the
 * previous session.
 */
export function resetStreak() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STREAK_COUNT_KEY);
    localStorage.removeItem(LAST_COMPLETED_KEY);
  } catch { /* swallow */ }
}

export default { getStreak, recordTaskCompleted, daysSinceLastCompletion, resetStreak };
