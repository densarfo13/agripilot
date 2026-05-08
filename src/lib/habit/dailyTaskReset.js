/**
 * dailyTaskReset.js — persist task completion across page reloads
 * and detect when a new calendar day has begun.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_last_task_completed_date_v1
 *
 * SHAPE
 * ─────
 *   string — 'YYYY-MM-DD' of the last day the farmer marked a task done.
 *   (Not JSON-encoded — stored as a plain date string for simplicity.)
 *
 * PURPOSE
 * ───────
 * The previous implementation used sessionStorage which meant the
 * "marked as done" state was lost on every page reload. This module
 * moves persistence to localStorage keyed on the calendar date so:
 *
 *   • Refresh → completed state is preserved (same day).
 *   • Next-day open → `hasCompletedToday()` returns false → new task shown.
 *   • Corrupt data → `hasCompletedToday()` returns false (safe fallback).
 *
 * DAILY RESET LOGIC
 * ─────────────────
 *   `hasCompletedToday()` compares the stored date against the current
 *   local calendar date. If they differ (date changed), the UI shows
 *   the new task as incomplete. No cleanup write is needed — the old
 *   date is simply treated as stale.
 *
 * RULES
 * ─────
 *   • Never throws — all reads/writes guarded with try/catch.
 *   • Works in SSR (localStorage guard).
 *   • No network, no React imports.
 *   • Exports `todayIsoDate` so callers don't need to re-implement it.
 */

import { todayIsoDate } from './streakStore.js';

export { todayIsoDate } from './streakStore.js';

export const LAST_COMPLETED_KEY = 'farroway_last_task_completed_date_v1';

// ─── Helpers ─────────────────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LAST_COMPLETED_KEY);
    if (!raw || typeof raw !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
    return raw.trim();
  } catch {
    return null;
  }
}

function _write(value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LAST_COMPLETED_KEY, String(value));
  } catch { /* quota / private mode — non-fatal */ }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * The date string stored for the last task completion ('YYYY-MM-DD'),
 * or null if the farmer has never completed a task (or data is corrupt).
 *
 * @returns {string|null}
 */
export function getLastCompletedDate() {
  return _read();
}

/**
 * Mark today's task as completed. Idempotent within a calendar day.
 *
 * @param {string} [today] ISO date override (for testing)
 */
export function markTaskCompletedDate(today) {
  const t = today || todayIsoDate();
  _write(t);
}

/**
 * Returns true when the stored completion date equals today.
 * Returns false if the date has changed (new day) or data is corrupt.
 *
 * This is the primary "daily reset" gate — call on every render to
 * decide whether to show the task as complete or fresh.
 *
 * @param {string} [today] ISO date override (for testing)
 * @returns {boolean}
 */
export function hasCompletedToday(today) {
  const stored = _read();
  if (!stored) return false;
  const t = today || todayIsoDate();
  return stored === t;
}

/**
 * Remove the completion record (sign-out / debug).
 */
export function clearLastCompleted() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LAST_COMPLETED_KEY);
    }
  } catch { /* ignore */ }
}
