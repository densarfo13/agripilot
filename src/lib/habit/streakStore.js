/**
 * streakStore.js — local-first daily streak counter.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_daily_streak_v1
 *
 * SHAPE
 * ─────
 *   {
 *     streak:            number   consecutive days with ≥1 completion
 *     lastCompletedDate: string   'YYYY-MM-DD' of last completion, or null
 *   }
 *
 * STREAK RULES (spec)
 * ───────────────────
 *   • Same-day completion  → no change (idempotent)
 *   • Completed yesterday  → streak + 1
 *   • Missed 1 day         → streak preserved (not penalised for one miss)
 *   • Missed ≥ 2 days      → streak resets to 1 (fresh start on next completion)
 *   • Never incremented    → start at 1 on first completion
 *
 * RULES
 * ─────
 *   • Never throws — corrupt JSON → safe default { streak: 0, lastCompletedDate: null }.
 *   • No network calls. No React imports.
 *   • Dispatches 'farroway:dailyHabitChanged' on every write for cross-tab sync.
 *   • Works in SSR (localStorage guard).
 */

export const STREAK_KEY = 'farroway_daily_streak_v1';
const CHANGE_EVENT = 'farroway:dailyHabitChanged';

// ─── Date helper ────────────────────────────────────────────────

/** Return 'YYYY-MM-DD' in the user's local timezone. */
export function todayIsoDate(now) {
  const d = now instanceof Date ? now : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whole-day difference between two 'YYYY-MM-DD' strings.
 * Positive when bISO is later than aISO. Returns null on bad input.
 */
function _daysBetween(aISO, bISO) {
  if (!aISO || !bISO) return null;
  const [ya, ma, da] = aISO.split('-').map(Number);
  const [yb, mb, db] = bISO.split('-').map(Number);
  const A = Date.UTC(ya, (ma || 1) - 1, da || 1);
  const B = Date.UTC(yb, (mb || 1) - 1, db || 1);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}

// ─── Storage helpers ────────────────────────────────────────────

const _SAFE_DEFAULT = Object.freeze({ streak: 0, lastCompletedDate: null });

function _read() {
  try {
    if (typeof localStorage === 'undefined') return { ..._SAFE_DEFAULT };
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { ..._SAFE_DEFAULT };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ..._SAFE_DEFAULT };
    }
    const streak = Number.isFinite(Number(parsed.streak)) && Number(parsed.streak) >= 0
      ? Math.floor(Number(parsed.streak))
      : 0;
    const lastCompletedDate =
      typeof parsed.lastCompletedDate === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastCompletedDate)
        ? parsed.lastCompletedDate
        : null;
    return { streak, lastCompletedDate };
  } catch {
    return { ..._SAFE_DEFAULT };
  }
}

function _write(data) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STREAK_KEY, JSON.stringify(data));
    _broadcast();
  } catch { /* quota / private mode — non-fatal */ }
}

function _broadcast() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch { /* ignore */ }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Read the raw stored state. Never throws.
 * @returns {{ streak: number, lastCompletedDate: string|null }}
 */
export function readStreakState() {
  return _read();
}

/**
 * Compute what the streak value SHOULD display right now.
 *
 * If the farmer missed ≥ 2 days since their last completion, the
 * streak is displayed as 0 (will become 1 on next completion).
 * Does NOT mutate storage — call recordCompletion() for that.
 *
 * @param {string} [today] ISO date override (for testing)
 * @returns {number}
 */
export function computeEffectiveStreak(today) {
  const state = _read();
  if (!state.lastCompletedDate) return 0;
  const t = today || todayIsoDate();
  const gap = _daysBetween(state.lastCompletedDate, t);
  if (gap == null) return state.streak; // bad data — trust stored value
  if (gap > 2) return 0;               // missed ≥ 2 days → display 0
  return state.streak;
}

/**
 * Record a task completion for today and increment the streak.
 *
 * Idempotent within a calendar day — calling it twice today is a
 * no-op; the streak only increments once per day.
 *
 * @param {string} [today] ISO date override (for testing)
 * @returns {number} the new streak value
 */
export function recordCompletion(today) {
  const t = today || todayIsoDate();
  const state = _read();

  // Already counted today — no-op.
  if (state.lastCompletedDate === t) return state.streak;

  const gap = _daysBetween(state.lastCompletedDate, t);
  let next;
  if (state.lastCompletedDate == null) {
    next = 1; // first-ever completion
  } else if (gap != null && gap <= 2) {
    // Completed within 1–2 days — chain extends.
    next = state.streak + 1;
  } else {
    // Gap ≥ 3 days or bad gap → fresh start.
    next = 1;
  }

  _write({ streak: next, lastCompletedDate: t });
  return next;
}

/** Wipe the streak completely (sign-out / debug). */
export function clearStreak() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STREAK_KEY);
    _broadcast();
  } catch { /* ignore */ }
}

export const HABIT_CHANGE_EVENT = CHANGE_EVENT;
