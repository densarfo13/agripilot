/**
 * outcomeTracking.js — lightweight local counters for the four
 * internal-only metrics the spec calls out:
 *
 *   tasks_completed_count
 *   tasks_skipped_count
 *   streak_days             — consecutive days with ≥1 completion
 *   last7_completion_rate   — completed / (completed + skipped)
 *                              over the most recent 7-day window
 *
 * The counters live in localStorage. Events (task_seen, task_done,
 * task_skipped, task_feedback) flow through the existing analytics
 * buffer via the caller-supplied `logEvent` function — this module
 * doesn't create a second analytics pipeline.
 *
 * The returned counters are NOT shown to farmers. They're for
 * internal/admin dashboards only.
 */

const STORAGE_KEY = 'farroway.outcomes.v1';
const DAY_MS      = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

function hasStorage() {
  try { return typeof window !== 'undefined' && !!window.localStorage; }
  catch { return false; }
}

function defaultState() {
  return {
    tasks_completed_count: 0,
    tasks_skipped_count:   0,
    streak_days:           0,
    // Per-day log for the rolling 7-day window. Each entry:
    //   { dayKey: 'YYYY-MM-DD', done: n, skipped: n }
    // Capped at 14 days so the file stays tiny.
    dailyLog: [],
    // Timestamps of events for the current streak calculation.
    lastCompletionAt: null,
    lastCompletionDay: null,   // 'YYYY-MM-DD'
  };
}

function dayKey(ts) {
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return null;
  // UTC date string so streak math is timezone-stable.
  return d.toISOString().slice(0, 10);
}

function consecutiveDays(aKey, bKey) {
  if (!aKey || !bKey) return false;
  const a = Date.parse(aKey + 'T00:00:00Z');
  const b = Date.parse(bKey + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(b - a) === DAY_MS;
}

function loadState() {
  if (!hasStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* noop */ }
}

function ensureDay(state, key) {
  // Keep the daily log trimmed to 14 entries; always return the
  // entry for the requested day.
  const existing = state.dailyLog.find((d) => d.dayKey === key);
  if (existing) return existing;
  const fresh = { dayKey: key, done: 0, skipped: 0 };
  state.dailyLog.push(fresh);
  state.dailyLog.sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1));
  while (state.dailyLog.length > 14) state.dailyLog.shift();
  return fresh;
}

/**
 * getCounters — snapshot of the four internal metrics. Pure
 * read; never throws.
 */
export function getCounters(now = Date.now()) {
  const s = loadState();
  const last7 = last7CompletionRate(s, now);
  return Object.freeze({
    tasks_completed_count: s.tasks_completed_count,
    tasks_skipped_count:   s.tasks_skipped_count,
    streak_days:           s.streak_days,
    last7_completion_rate: last7,
    last_completion_at:    s.lastCompletionAt,
  });
}

function last7CompletionRate(state, now) {
  const cutoffKey = dayKey(now - (WINDOW_DAYS - 1) * DAY_MS);
  let done = 0, skipped = 0;
  for (const d of state.dailyLog) {
    if (d.dayKey < cutoffKey) continue;
    done    += d.done    || 0;
    skipped += d.skipped || 0;
  }
  const total = done + skipped;
  if (total === 0) return null;
  return +((done / total).toFixed(3));
}

/**
 * recordTaskSeen — writes a `task_seen` analytics event via
 * the caller-supplied `logEvent` (so we don't double up on
 * analytics pipelines). Does NOT mutate counters.
 */
export function recordTaskSeen(task, { logEvent = null, now = Date.now() } = {}) {
  if (typeof logEvent === 'function') {
    logEvent('task_seen', {
      taskId: task?.id || task?.taskId || null,
      stage:  task?.stage || null,
      intent: task?.intent || null,
      at: now,
    });
  }
}

/**
 * recordTaskCompleted — increment counters, update streak,
 * log event.
 */
export function recordTaskCompleted(task, { logEvent = null, now = Date.now() } = {}) {
  const state = loadState();
  const k = dayKey(now);
  const day = ensureDay(state, k);
  day.done += 1;
  state.tasks_completed_count += 1;

  // Streak logic: today is a streak day; if yesterday already had
  // a completion, streak continues; else streak resets to 1.
  if (state.lastCompletionDay && state.lastCompletionDay === k) {
    // Already counted this day — streak doesn't grow further.
  } else if (state.lastCompletionDay && consecutiveDays(state.lastCompletionDay, k)) {
    state.streak_days += 1;
  } else {
    state.streak_days = 1;
  }
  state.lastCompletionDay = k;
  state.lastCompletionAt  = now;
  saveState(state);

  if (typeof logEvent === 'function') {
    logEvent('task_done', {
      taskId: task?.id || task?.taskId || null,
      stage:  task?.stage || null,
      intent: task?.intent || null,
      at: now,
    });
  }
  return state;
}

/**
 * recordTaskSkipped — increment skipped counter, log event.
 * Does NOT reset the streak (only a missed full day does).
 */
export function recordTaskSkipped(task, { logEvent = null, now = Date.now() } = {}) {
  const state = loadState();
  const day = ensureDay(state, dayKey(now));
  day.skipped += 1;
  state.tasks_skipped_count += 1;
  saveState(state);

  if (typeof logEvent === 'function') {
    logEvent('task_skipped', {
      taskId: task?.id || task?.taskId || null,
      stage:  task?.stage || null,
      intent: task?.intent || null,
      at: now,
    });
  }
  return state;
}

/**
 * recordTaskFeedback — pure event emit; no counter change.
 * Reason is optional (👍 Helpful has no reason; 👎 Not right
 * has one of "doesnt_match", "already_did", "not_clear").
 */
export function recordTaskFeedback(task, feedback, { logEvent = null, now = Date.now(),
                                                      countryCode = null, cropId = null, stage = null,
} = {}) {
  if (typeof logEvent === 'function') {
    logEvent('task_feedback', {
      taskId:  task?.id || task?.taskId || null,
      type:    feedback?.type || null,
      reason:  feedback?.reason || null,
      countryCode,
      cropId:  cropId || task?.cropId || null,
      stage:   stage  || task?.stage  || null,
      at: now,
    });
  }
}

/**
 * recalculateStreak — recompute streak from the daily log.
 * Useful when the user opens the app after missing a day —
 * the streak naturally breaks.
 */
export function recalculateStreak(now = Date.now()) {
  const state = loadState();
  if (!state.lastCompletionDay) {
    state.streak_days = 0;
    saveState(state);
    return state;
  }
  const today = dayKey(now);
  // If the last completion was more than 1 day ago, the streak
  // is over.
  const diffDays = Math.floor(
    (Date.parse(today + 'T00:00:00Z') - Date.parse(state.lastCompletionDay + 'T00:00:00Z')) / DAY_MS
  );
  if (diffDays > 1) state.streak_days = 0;
  saveState(state);
  return state;
}

export function resetOutcomes() {
  if (!hasStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { /* noop */ }
}

export const _internal = {
  STORAGE_KEY, DAY_MS, WINDOW_DAYS,
  dayKey, consecutiveDays, loadState, saveState, ensureDay, last7CompletionRate,
};
