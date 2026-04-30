/**
 * streakStore.js — pure helpers for the daily retention loop.
 *
 * Coexists with the existing `computeDailyLoopFacts()` used by
 * FarmerTodayPage. THIS module owns one tiny localStorage entry:
 *
 *   farroway:retention:visit = {
 *     lastVisitISO:      '2026-04-29',  // YYYY-MM-DD
 *     lastCompletionISO: '2026-04-28',  // last day a task was completed
 *     streakDays:        3,             // consecutive days with ≥1 completion
 *     reminderShownISO:  '2026-04-29',  // last day the daily reminder fired
 *   }
 *
 * Why a separate store
 * ────────────────────
 * The richer farmer loop (`useFarmerLoop`, `farmerLoopService`,
 * `computeDailyLoopFacts`) already manages task state. We don't
 * touch it. This module only stores the tiny extra facts the
 * retention layer needs (last visit date string, reminder-shown
 * flag, lightweight streak counter that survives even when the
 * loop service hasn't loaded yet).
 *
 * Strict rules honoured
 * ─────────────────────
 *   • No backend calls.
 *   • No mutation of the heavy loop state.
 *   • Never throws — quota / private-mode / corrupt JSON degrade
 *     to a fresh-state object.
 *   • Idempotent: calling `recordVisit()` twice on the same day is
 *     a no-op (returns the cached value).
 */

const KEY = 'farroway:retention:visit';

function _todayISO(now = new Date()) {
  // Local-day key — the spec defines streak by the user's local day.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _yesterdayISO(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return _todayISO(d);
}

function _daysBetween(aISO, bISO) {
  if (!aISO || !bISO) return null;
  // Parse YYYY-MM-DD as UTC midnight for stable diff (avoids DST
  // shifts adding/dropping a day around the spring-forward / fall-
  // back boundary).
  const [ya, ma, da] = aISO.split('-').map(Number);
  const [yb, mb, db] = bISO.split('-').map(Number);
  const A = Date.UTC(ya, (ma || 1) - 1, da || 1);
  const B = Date.UTC(yb, (mb || 1) - 1, db || 1);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function _write(value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read current retention state. Returns a fresh object when
 * nothing is stored — callers don't have to null-check.
 */
export function getRetentionState() {
  const cur = _read();
  return {
    lastVisitISO:       cur?.lastVisitISO       || null,
    lastCompletionISO:  cur?.lastCompletionISO  || null,
    streakDays:         Number.isFinite(cur?.streakDays) ? cur.streakDays : 0,
    reminderShownISO:   cur?.reminderShownISO   || null,
    // 7-day engagement loop additions:
    //   firstVisitISO    pinned on the very first recordVisit; never
    //                    advances afterwards. Used to derive
    //                    `dayNumber` (1 + local-day gap, capped to
    //                    avoid runaway counts on long-time users).
    firstVisitISO:      cur?.firstVisitISO      || null,
    tasksCompleted:     Number.isFinite(cur?.tasksCompleted) ? cur.tasksCompleted : 0,
  };
}

/**
 * Mark today as visited. Idempotent — second call on the same
 * local day returns the existing state unchanged. Detects a
 * missed-day gap and resets the streak when the gap is > 1 day
 * since the last completion (NOT since the last visit; opening the
 * app without completing a task should not break a streak).
 *
 * Side effect (7-day loop): pins `firstVisitISO` the very first
 * time the helper runs, so `dayNumber()` can derive a stable
 * 0/1/2/… progression without depending on per-call timing.
 *
 * Returns the updated state.
 */
export function recordVisit(now = new Date()) {
  const today = _todayISO(now);
  const cur = getRetentionState();
  if (cur.lastVisitISO === today && cur.firstVisitISO) return cur; // idempotent
  const next = {
    ...cur,
    lastVisitISO:  today,
    firstVisitISO: cur.firstVisitISO || today,
  };
  _write(next);
  return next;
}

/**
 * Mark a task completion against today. Updates `lastCompletionISO`
 * and rolls `streakDays` per the rules:
 *   • completion on the same day as the last completion → no change
 *   • completion exactly one day after the last → streak += 1
 *   • completion gap of > 1 day → streak reset to 1
 *   • first ever completion → streak = 1
 *
 * Returns the updated state.
 */
export function recordCompletion(now = new Date()) {
  const today = _todayISO(now);
  const cur = getRetentionState();

  let nextStreak;
  if (!cur.lastCompletionISO) {
    nextStreak = 1;
  } else if (cur.lastCompletionISO === today) {
    return cur; // idempotent — already counted today
  } else {
    const gap = _daysBetween(cur.lastCompletionISO, today);
    if (gap === 1) nextStreak = (cur.streakDays || 0) + 1;
    else nextStreak = 1;
  }

  const next = {
    ...cur,
    lastVisitISO:      today,
    lastCompletionISO: today,
    streakDays:        nextStreak,
    // 7-day loop: monotonic counter incremented on every
    // accepted completion (i.e. once per local day max). The
    // app reads this as the running total of "tasks done across
    // the whole 7-day loop"; for the per-day count, use the
    // existing taskScheduler's `done` derivation.
    tasksCompleted:    (cur.tasksCompleted || 0) + 1,
    firstVisitISO:     cur.firstVisitISO || today,
  };
  _write(next);
  return next;
}

/**
 * Record that the daily reminder banner has been shown today so the
 * UI doesn't repeat it on every navigation. Idempotent.
 */
export function markReminderShown(now = new Date()) {
  const today = _todayISO(now);
  const cur = getRetentionState();
  if (cur.reminderShownISO === today) return cur;
  const next = { ...cur, reminderShownISO: today };
  _write(next);
  return next;
}

/**
 * True when the user opened the app yesterday (or before) but did
 * not log a task completion the previous day — used for the "you
 * missed a task. Let's get back on track." reminder variant.
 */
export function missedYesterday(now = new Date()) {
  const cur = getRetentionState();
  if (!cur.lastVisitISO) return false;
  const yesterday = _yesterdayISO(now);
  // They were active yesterday or earlier, but didn't complete.
  if (cur.lastCompletionISO === yesterday) return false;
  // No completion ever, but visited at least once before today.
  if (!cur.lastCompletionISO) return cur.lastVisitISO !== _todayISO(now);
  // Last completion was strictly before yesterday → a clean miss.
  const gap = _daysBetween(cur.lastCompletionISO, _todayISO(now));
  return Number.isFinite(gap) && gap > 1;
}

/**
 * Days since the last visit (visit, not completion). Used by the
 * "We've prepared your next steps" return incentive — fires when
 * the gap is ≥ 2 days (per spec §7).
 */
export function daysSinceLastVisit(now = new Date()) {
  const cur = getRetentionState();
  if (!cur.lastVisitISO) return null;
  const today = _todayISO(now);
  return _daysBetween(cur.lastVisitISO, today);
}

/**
 * 7-day engagement-loop day counter.
 *
 *   • Day 0   — pre-onboarding (no firstVisitISO yet)
 *   • Day 1   — first visit (today)
 *   • Day N   — 1 + local days since firstVisitISO, capped at 7
 *
 * Capped at 7 so the unlock gates (Scan ≥ 3, Funding ≥ 5,
 * Sell ≥ 6) all stay green for long-time users — once a feature
 * unlocks it never re-locks. Returns 0 for users who have never
 * recorded a visit (still in onboarding).
 */
export function dayNumber(now = new Date()) {
  const cur = getRetentionState();
  if (!cur.firstVisitISO) return 0;
  const today = _todayISO(now);
  const gap = _daysBetween(cur.firstVisitISO, today);
  if (!Number.isFinite(gap) || gap < 0) return 1;
  return Math.min(7, gap + 1);
}

/**
 * True when the daily reminder has not yet been shown today.
 */
export function shouldShowReminderToday(now = new Date()) {
  const cur = getRetentionState();
  return cur.reminderShownISO !== _todayISO(now);
}

/**
 * Reset everything (debug / sign-out). Not called automatically.
 */
export function clearRetentionState() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

// ─── Test seam ─────────────────────────────────────────────
// Exported under `_internal` so tests can verify the date helpers
// without exercising the localStorage layer.
export const _internal = Object.freeze({
  _todayISO, _yesterdayISO, _daysBetween, KEY,
});
