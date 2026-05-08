/**
 * taskActionQueue.js — localStorage queue for offline task completions.
 *
 * PURPOSE
 * ───────
 * When the farmer marks a task done / skipped with no internet, the
 * action is written here instead of being lost. When the device
 * reconnects, safeOnlineSync.js drains this queue (max 1 retry,
 * 400s dropped) and removes each entry on success.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_offline_task_actions_v1
 *
 * ENTRY SHAPE
 * ───────────
 *   {
 *     id:        string   — unique id (used for removal)
 *     type:      'task_complete' | 'task_skip'
 *     taskId:    string
 *     farmId:    string?
 *     note:      string?  — optional completion note
 *     reason:    string?  — optional skip reason
 *     queuedAt:  number   — ms-epoch
 *     attempts:  number   — 0 on first enqueue; incremented per retry
 *   }
 *
 * MAX RETRY: 1 — entries with attempts >= 1 are dropped on the next
 * sync attempt (not re-queued). 400 responses drop immediately.
 *
 * RULES
 * ─────
 *   • Never throws — all reads/writes guarded with try/catch.
 *   • Idempotent enqueue — returns the persisted entry.
 *   • Dispatches 'farroway:offlineSafeQueueChange' on every mutation
 *     so the banner can react without polling.
 *   • Works in SSR (window/localStorage guard).
 */

export const TASK_QUEUE_KEY = 'farroway_offline_task_actions_v1';
const CHANGE_EVENT = 'farroway:offlineSafeQueueChange';

// ─── Helpers ─────────────────────────────────────────────────────

function _uuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'ta_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(TASK_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function _write(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(TASK_QUEUE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
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

// ─── Public API ──────────────────────────────────────────────────

/**
 * Append a task action to the queue.
 *
 * @param {{ type: 'task_complete'|'task_skip', taskId: string, farmId?: string, note?: string, reason?: string }} opts
 * @returns {{ id, type, taskId, farmId, note, reason, queuedAt, attempts }} | null
 */
export function enqueueTaskAction({ type, taskId, farmId, note, reason } = {}) {
  if (!type || !taskId) return null;
  const entry = {
    id:        _uuid(),
    type:      String(type),
    taskId:    String(taskId),
    farmId:    farmId ? String(farmId) : null,
    note:      note   ? String(note)   : null,
    reason:    reason ? String(reason) : null,
    queuedAt:  Date.now(),
    attempts:  0,
  };
  const queue = _read();
  queue.push(entry);
  _write(queue);
  return entry;
}

/** Read all queued task actions (copy). */
export function getTaskActions() {
  return _read();
}

/** Remove a single entry by id (success or abandon path). */
export function removeTaskAction(id) {
  if (!id) return false;
  const queue = _read();
  const next = queue.filter((e) => e && e.id !== id);
  if (next.length === queue.length) return false;
  _write(next);
  return true;
}

/** Increment the attempts counter on a failed entry. */
export function markTaskActionAttempt(id) {
  if (!id) return null;
  const queue = _read();
  const idx = queue.findIndex((e) => e && e.id === id);
  if (idx === -1) return null;
  queue[idx] = { ...queue[idx], attempts: (queue[idx].attempts || 0) + 1 };
  _write(queue);
  return queue[idx];
}

/** Drop ALL queued task actions. */
export function clearTaskActions() {
  _write([]);
}

/** How many actions are waiting to sync. */
export function taskActionCount() {
  return _read().length;
}
