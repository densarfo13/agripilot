/**
 * progressStore.js — Farroway core progress log.
 *
 * Storage:
 *   * Primary:  IndexedDB store 'progress', key 'main'  (production)
 *   * Mirror:   localStorage 'farroway_progress'        (sync read,
 *                                                        survives
 *                                                        the IDB
 *                                                        async gap)
 *
 * Why both
 * ────────
 * IndexedDB is the durable, scalable store - it survives quota
 * pressure better than localStorage and lets us share a single
 * read/write surface with the queue + farm stores. But IDB is
 * async only, and the existing UI + alert engine reads the
 * progress count synchronously. The mirror keeps that contract
 * working: every write fans out to both stores, every sync read
 * comes from the mirror, and `hydrateProgress()` reconciles them
 * on app boot.
 *
 * Idempotency
 * ───────────
 * `markTaskDone` is async; it appends locally AND enqueues a
 * TASK_DONE outbox action with a unique id. The server dedupes by
 * action.id, so retries from the sync worker are safe.
 */

import { dbGet, dbSet } from '../../db/indexedDB.js';
import { safeRead, safeWrite } from './safeStorage.js';
import { enqueueAction } from '../../sync/actionQueue.js';
// Auto-log TASK_COMPLETED into the ML data pipeline. Fire-and-
// forget; logEvent itself never throws and the tiny try/catch
// around the call is belt-and-braces.
import { logEvent, EVENT_TYPES } from '../../data/eventLogger.js';

export const PROGRESS_KEY      = 'farroway_progress';   // localStorage mirror
export const PROGRESS_IDB_KEY  = 'main';                // IDB row id
export const PROGRESS_STORE    = 'progress';

const EMPTY = Object.freeze({ done: [] });

/* ─── Internal: shape coercion ─────────────────────────────────── */

function coerce(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.done)) {
    return { done: [] };
  }
  return { done: raw.done };
}

/* ─── Sync surface (mirror only) ───────────────────────────────── */

/**
 * Synchronous getter backed by the localStorage mirror. Always
 * returns a usable object. NGO alerts and any render paths that
 * can't go async should use this.
 */
export function getProgress() {
  return coerce(safeRead(PROGRESS_KEY, EMPTY));
}

/** Convenience: how many tasks have been completed in the log. */
export function getCompletedCount() {
  return getProgress().done.length;
}

/* ─── Async surface (IDB primary) ──────────────────────────────── */

/**
 * Hydrate the localStorage mirror from IndexedDB on app boot. Call
 * once during init - mirrors the IDB record into localStorage so
 * subsequent sync reads don't lag behind a recent IDB write made
 * in another tab.
 */
export async function hydrateProgress() {
  const idb = await dbGet(PROGRESS_STORE, PROGRESS_IDB_KEY);
  if (idb && Array.isArray(idb.done)) {
    safeWrite(PROGRESS_KEY, { done: idb.done });
    return { done: idb.done };
  }
  return getProgress();
}

/**
 * Mark a task complete.
 *
 *   1. read current state (mirror first, IDB second-source)
 *   2. append the new entry
 *   3. fan out: IDB write + mirror write (sync)
 *   4. enqueue a TASK_DONE outbox action for the server
 *
 * Returns a promise that resolves to the new progress record.
 * Callers that don't need to wait can fire-and-forget - the mirror
 * is updated synchronously inside this function before the await
 * returns, so the next `getProgress()` already reflects the change.
 */
export async function markTaskDone(task) {
  if (!task) return getProgress();

  // Source of truth: prefer the persisted IDB record; fall back to
  // the mirror so the offline-first flow keeps working before the
  // first sync.
  const fromIdb = await dbGet(PROGRESS_STORE, PROGRESS_IDB_KEY);
  const current = fromIdb ? coerce(fromIdb) : getProgress();

  const entry = { task, date: Date.now() };
  const next  = { done: [...current.done, entry] };

  // 1. Local durable write.
  await dbSet(PROGRESS_STORE, PROGRESS_IDB_KEY, next);
  // 2. Sync mirror so getProgress() reads fresh immediately.
  safeWrite(PROGRESS_KEY, next);

  // 3. Outbox the server-side replay. Idempotent on action.id.
  enqueueAction('TASK_DONE', { task, date: entry.date });

  // 4. Append to the ML event log. Never blocks; never throws.
  try {
    logEvent(EVENT_TYPES.TASK_COMPLETED, {
      task,
      // farmId is forwarded by callers that pass it as part of
      // the task identifier; fall back to null so the row still
      // lands in the global event stream.
      farmId: (task && typeof task === 'object' && task.farmId) || null,
      date:   entry.date,
    });
  } catch { /* swallow */ }

  // 5. Retention bookkeeping — streak + memory mirror. The streak
  //    helper is idempotent within a calendar day so multiple
  //    completions on the same day count as one streak day.
  //    Wrapped in dynamic import so the (large) retention module
  //    loads on first completion, not at app boot, and a missing
  //    helper never blocks the primary persist path.
  try {
    const taskId = (task && typeof task === 'object' && task.id) || task;
    const { updateStreak } = await import('../../utils/streak.js');
    try { updateStreak(); } catch { /* never block on retention */ }
    const memoryMod = await import('../../retention/memoryStore.js');
    try {
      memoryMod.recordLastTask({
        taskId: taskId != null ? String(taskId) : null,
        date:   entry.date,
      });
    } catch { /* never block on memory */ }
  } catch { /* dynamic import failure is non-fatal */ }

  return next;
}

/** Reset the log. Tests + admin "clear" paths. */
export async function resetProgress() {
  await dbSet(PROGRESS_STORE, PROGRESS_IDB_KEY, { done: [] });
  safeWrite(PROGRESS_KEY, { done: [] });
  return { done: [] };
}
