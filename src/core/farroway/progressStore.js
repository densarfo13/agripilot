/**
 * progressStore.js — Farroway core progress log (spec section 4).
 *
 * Storage key: farroway_progress
 *
 * Append-only-style record of completed tasks, used by:
 *   * the TodayCard "Done" button
 *   * the NGO alert engine (LOW_ACTIVITY check)
 *
 * Defensive on every read: corrupt or missing data returns an
 * empty list, never throws.
 */

import { safeRead, safeWrite } from './safeStorage.js';

export const PROGRESS_KEY = 'farroway_progress';

const EMPTY = Object.freeze({ done: [] });

/** Read the full progress log. Always returns { done: [...] }. */
export function getProgress() {
  const raw = safeRead(PROGRESS_KEY, EMPTY);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.done)) {
    return { done: [] };
  }
  return { done: raw.done };
}

/** Mark a task complete. Returns the new progress record. */
export function markTaskDone(task) {
  if (!task) return getProgress();
  const data = getProgress();
  data.done.push({ task, date: new Date().toISOString() });
  safeWrite(PROGRESS_KEY, data);
  return data;
}

/** Reset the log (useful for tests, optional UI). */
export function resetProgress() {
  safeWrite(PROGRESS_KEY, { done: [] });
}

/** Convenience: how many tasks have been completed in the log. */
export function getCompletedCount() {
  return getProgress().done.length;
}
