/**
 * memoryStore.js — small persisted memory of the farmer's last
 * action so the Today screen can surface a calm "Yesterday you
 * checked your farm" line.
 *
 *   recordLastTask({ taskId, date })
 *   recordLastLabel({ kind, value, date })
 *   getLastTask()
 *   getLastLabel()
 *
 * Storage
 *   localStorage[`farroway_last_task`]  : { taskId, date }
 *   localStorage[`farroway_last_label`] : { kind, value, date }
 *
 * Why a tiny dedicated module
 *   The retention engine wants to render a one-line memory
 *   ("Yesterday you checked your farm") without scanning the
 *   full event log on every render. Two small persisted slots
 *   are O(1) reads + match the spec's contract exactly.
 *
 * Strict-rule audit
 *   * Every read goes through safeParse — corrupt entries
 *     produce null, never a crash
 *   * Every write try/catch wrapped — quota / private mode
 *     silently no-ops
 *   * Pure: no I/O beyond the two localStorage keys
 *   * Coexists with src/data/eventLogger.js — does NOT
 *     replace the event log; that's the canonical training
 *     dataset source. memoryStore is a UX-only mirror.
 */

import { safeParse } from '../utils/safeParse.js';

export const LAST_TASK_KEY  = 'farroway_last_task';
export const LAST_LABEL_KEY = 'farroway_last_label';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeWrite(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}

/**
 * recordLastTask({ taskId, date }) → boolean (write succeeded?)
 * date defaults to Date.now(); pass through when you want to
 * align with an existing log entry.
 */
export function recordLastTask({ taskId, date } = {}) {
  if (!taskId) return false;
  const payload = {
    taskId: String(taskId),
    date:   Number.isFinite(date) ? date : Date.now(),
  };
  return _safeWrite(LAST_TASK_KEY, JSON.stringify(payload));
}

export function recordLastLabel({ kind, value, date } = {}) {
  if (!kind || !value) return false;
  const payload = {
    kind:  String(kind),
    value: String(value),
    date:  Number.isFinite(date) ? date : Date.now(),
  };
  return _safeWrite(LAST_LABEL_KEY, JSON.stringify(payload));
}

export function getLastTask() {
  const raw = _safeRead(LAST_TASK_KEY);
  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.taskId) return null;
  if (!Number.isFinite(parsed.date)) return null;
  return parsed;
}

export function getLastLabel() {
  const raw = _safeRead(LAST_LABEL_KEY);
  const parsed = safeParse(raw, null);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.kind || !parsed.value) return null;
  if (!Number.isFinite(parsed.date)) return null;
  return parsed;
}

/**
 * isYesterday(timestamp) → boolean
 *
 * Calendar-day comparison (toDateString) so a completion at
 * 11:55pm and a render at 00:05am next day count as
 * "yesterday" — not a 6-minute-old event. Works around DST
 * edges + timezone shifts because the comparison is in local
 * time.
 */
export function isYesterday(timestamp) {
  if (!Number.isFinite(timestamp)) return false;
  try {
    const yesterdayKey = new Date(Date.now() - MS_PER_DAY).toDateString();
    return new Date(timestamp).toDateString() === yesterdayKey;
  } catch { return false; }
}

export function isToday(timestamp) {
  if (!Number.isFinite(timestamp)) return false;
  try {
    return new Date(timestamp).toDateString() === new Date().toDateString();
  } catch { return false; }
}

export default {
  recordLastTask,
  recordLastLabel,
  getLastTask,
  getLastLabel,
  isYesterday,
  isToday,
};
