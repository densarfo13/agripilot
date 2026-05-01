/**
 * engagementHistory.js — local-first completion log feeding the
 * daily engagement layer.
 *
 * Storage
 *   farroway_engagement_history  : Array<{
 *     taskId:       string,
 *     plantId:      string | null,
 *     completedAt:  ISO timestamp,
 *     kind:         'engine' | 'scan' | 'fallback',
 *     source?:      'plan_card' | 'scan_card' | string,
 *   }>
 *   Capped at 200 entries (≈ 90 days at 2/day) — older entries
 *   roll off so the key never balloons.
 *
 *   Streak persistence is intentionally delegated to the existing
 *   `src/utils/streak.js` so we don't fork the source of truth that
 *   WeeklySummary / NotificationEngine already read.
 *
 * Cross-system mirror
 *   When available, calls `saveTaskCompletion()` from
 *   `src/store/farrowayLocal.js` so the existing API/sync layer
 *   sees the same event. Mirror failures never propagate.
 *
 * Strict-rule audit
 *   • Never throws — every storage op try/catch wrapped.
 *   • Works offline.
 *   • Idempotent — duplicate (taskId, dayISO) pairs collapse.
 *   • Emits a `farroway:engagement_changed` window event so
 *     surfaces (StreakChip / EngagementPlanCard) can refresh
 *     without a parent re-render.
 */

import { updateStreak } from '../utils/streak.js';

export const HISTORY_KEY = 'farroway_engagement_history';
const MAX_ENTRIES = 200;
const CHANGE_EVENT = 'farroway:engagement_changed';

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(entries) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* swallow quota / private mode */ }
}

function _emitChange() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    }
  } catch { /* swallow */ }
}

function _todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * markTaskCompleted — record a completion + bump streak.
 *
 * @param {string} taskId
 * @param {object} [opts]
 * @param {string} [opts.plantId]
 * @param {string} [opts.kind]    engine | scan | fallback
 * @param {string} [opts.source]  plan_card | scan_card | …
 * @param {string} [opts.farmId]  optional, mirrored to farrowayLocal
 * @returns {{ entry: object, streak: number }}
 */
export function markTaskCompleted(taskId, opts = {}) {
  const id = String(taskId || '').trim();
  if (!id) return { entry: null, streak: 0 };

  const today = _todayISO();
  const existing = _safeRead();

  // Idempotent on (taskId, dayISO) — re-tapping a completed task in
  // the same day doesn't bump streak twice or duplicate the row.
  const already = existing.find((e) =>
    e && e.taskId === id && String(e.completedAt || '').slice(0, 10) === today,
  );

  let entry = already;
  let next = existing;
  if (!already) {
    entry = {
      taskId:      id,
      plantId:     opts.plantId || null,
      completedAt: new Date().toISOString(),
      kind:        opts.kind   || 'engine',
      source:      opts.source || 'plan_card',
    };
    next = existing.concat(entry);
    _safeWrite(next);
  }

  // Bump streak via the existing canonical helper. Idempotent same-day.
  let streak = 0;
  try { streak = updateStreak(); } catch { streak = 0; }

  // Cross-system mirror — non-blocking.
  if (opts.farmId) {
    (async () => {
      try {
        const mod = await import('../store/farrowayLocal.js');
        if (mod && typeof mod.saveTaskCompletion === 'function') {
          mod.saveTaskCompletion({ taskId: id, farmId: opts.farmId });
        }
      } catch { /* swallow */ }
    })();
  }

  _emitChange();
  return { entry, streak };
}

/** Recent completions (default last 7 days). Returns newest-first. */
export function getRecentCompletions(days = 7) {
  const cutoff = Date.now() - Math.max(0, Number(days) || 7) * 86_400_000;
  const all = _safeRead();
  return all
    .filter((e) => {
      const t = Date.parse(e?.completedAt || '');
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

/** Did the user complete at least one task today? */
export function hadActivityToday() {
  const today = _todayISO();
  const all = _safeRead();
  return all.some((e) =>
    String(e?.completedAt || '').slice(0, 10) === today,
  );
}

/** Count of completions on a specific YYYY-MM-DD. */
export function completionsOnDay(dayISO) {
  const all = _safeRead();
  return all.filter((e) =>
    String(e?.completedAt || '').slice(0, 10) === dayISO,
  ).length;
}

/** Test/admin: clear history. Streak is left to its own resetter. */
export function _resetEngagementHistory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HISTORY_KEY);
    }
  } catch { /* swallow */ }
  _emitChange();
}

export const ENGAGEMENT_CHANGE_EVENT = CHANGE_EVENT;

export default {
  HISTORY_KEY,
  ENGAGEMENT_CHANGE_EVENT,
  markTaskCompleted,
  getRecentCompletions,
  hadActivityToday,
  completionsOnDay,
};
