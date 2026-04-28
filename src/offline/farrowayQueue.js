/**
 * farrowayQueue.js — single-key offline queue facade.
 *
 *   enqueue({ type, payload })   — append a job to farroway_queue
 *   list()                       — read everything currently queued
 *   remove(id)                   — drop one job by id
 *   clear()                      — wipe the queue
 *   flush(sender)                — send pending jobs in order, drop
 *                                  on success, leave on failure
 *
 * Why this module exists
 *   The spec asks for a single localStorage queue at the key
 *   `farroway_queue` with three job types: task_complete, label,
 *   scan. The codebase already has TWO queue surfaces:
 *     * src/utils/offlineQueue.js (IDB, multi-table, V1 mutations)
 *     * src/lib/sync/offlineQueue.js (localStorage farroway.
 *       offlineQueue.v1, narrower mutations + idempotency keys)
 *   Both are battle-tested. This facade is a THIN wrapper that
 *   gives the new Today / LabelPrompt / Scan flows the simple
 *   `enqueue({ type, payload })` shape the spec describes,
 *   stored at the spec's key, without duplicating any of the
 *   sync logic that already lives in the older modules. A
 *   future migration can collapse the three into one — for now
 *   the facade keeps the new contract clean while the legacy
 *   queues continue to handle their own job types.
 *
 * Strict-rule audit
 *   * Never throws — every read/write goes through safeParse +
 *     try/catch. A corrupt queue entry is dropped, not
 *     propagated.
 *   * Works offline — enqueue is sync localStorage; flush
 *     sends through the caller-supplied transport so a missing
 *     network just leaves the jobs in place.
 *   * No error UI — flush failures stay silent; the caller
 *     decides whether to surface anything (the OfflineBanner
 *     in app shell already handles "back online, syncing now"
 *     for the legacy queues).
 *   * No localStorage.clear() anywhere.
 *   * Idempotent ids — every enqueued job gets a unique id so
 *     the sender can dedupe cross-device replays.
 */

import { safeParse } from '../utils/safeParse.js';

export const FARROWAY_QUEUE_KEY = 'farroway_queue';
export const MAX_QUEUE_LENGTH   = 500;

const VALID_TYPES = Object.freeze(new Set([
  'task_complete',
  'label',
  'scan',
]));

function _readRaw() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(FARROWAY_QUEUE_KEY);
  } catch { return null; }
}

function _writeRaw(value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(FARROWAY_QUEUE_KEY, value);
    return true;
  } catch { return false; }
}

function _readJobs() {
  const raw = _readRaw();
  const arr = safeParse(raw, []);
  return Array.isArray(arr) ? arr : [];
}

function _writeJobs(jobs) {
  const trimmed = Array.isArray(jobs)
    ? jobs.slice(-MAX_QUEUE_LENGTH)
    : [];
  return _writeRaw(JSON.stringify(trimmed));
}

let _idSeq = 0;
function _mintId() {
  _idSeq = (_idSeq + 1) % 1_000_000;
  return `${Date.now()}-${_idSeq}`;
}

function _broadcast(detail) {
  try {
    if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('farroway:queueChanged', { detail }));
  } catch { /* dispatch is best-effort */ }
}

/**
 * enqueue({ type, payload }) → { id, type, payload, ts } | null
 *
 * Pushes a single job onto the queue. Returns the persisted job
 * (with id + timestamp) so the caller can refer to it for
 * optimistic-UI bookkeeping. Returns null on:
 *   - missing/empty type
 *   - unknown type (must be one of task_complete / label / scan)
 *   - storage write failure
 */
export function enqueue({ type, payload } = {}) {
  if (!type || typeof type !== 'string') return null;
  if (!VALID_TYPES.has(type)) return null;
  const job = Object.freeze({
    id:      _mintId(),
    type,
    payload: payload != null ? payload : null,
    ts:      Date.now(),
  });
  const jobs = _readJobs();
  jobs.push(job);
  if (!_writeJobs(jobs)) return null;
  _broadcast({ kind: 'enqueued', job });
  return job;
}

export function list() {
  return _readJobs();
}

export function pendingCount() {
  return _readJobs().length;
}

export function remove(id) {
  if (!id) return false;
  const jobs = _readJobs();
  const next = jobs.filter((j) => j && j.id !== id);
  if (next.length === jobs.length) return false;
  _writeJobs(next);
  _broadcast({ kind: 'removed', id });
  return true;
}

export function clear() {
  _writeJobs([]);
  _broadcast({ kind: 'cleared' });
}

/**
 * flush(sender) — drains the queue in order, calling sender(job)
 * per entry. The sender contract is async + idempotent:
 *
 *   sender(job) -> Promise<boolean>
 *     true  -> job was sent successfully, drop it
 *     false -> leave it in place; flush stops to preserve order
 *
 * Throws are swallowed and treated as `false`. The whole flush
 * is no-op when the device is offline so a logged-out caller
 * hitting flush() doesn't fire a series of doomed requests.
 */
export async function flush(sender) {
  if (typeof sender !== 'function') return { sent: 0, remaining: pendingCount() };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { sent: 0, remaining: pendingCount() };
  }
  let sent = 0;
  // Read once per loop — sender may write side-effects, but we
  // intentionally process the snapshot we entered with so a
  // burst of new enqueue() calls during flush waits for the
  // next tick.
  let jobs = _readJobs();
  for (const job of jobs) {
    let ok = false;
    try { ok = !!(await sender(job)); }
    catch { ok = false; }
    if (!ok) break;
    sent += 1;
    // Re-read + drop the head so a parallel enqueue isn't lost.
    jobs = _readJobs();
    const idx = jobs.findIndex((j) => j && j.id === job.id);
    if (idx >= 0) {
      jobs.splice(idx, 1);
      _writeJobs(jobs);
    }
  }
  if (sent > 0) _broadcast({ kind: 'flushed', sent });
  return { sent, remaining: pendingCount() };
}

/**
 * onChange(fn) — subscribe to queue mutations. Returns an
 * unsubscribe function. Useful for a Today-screen "queued offline"
 * indicator without polling.
 */
export function onChange(fn) {
  if (typeof window === 'undefined' || typeof fn !== 'function') return () => {};
  const handler = (e) => { try { fn(e.detail || null); } catch { /* swallow */ } };
  window.addEventListener('farroway:queueChanged', handler);
  return () => window.removeEventListener('farroway:queueChanged', handler);
}

export const QUEUE_TYPES = Object.freeze({
  TASK_COMPLETE: 'task_complete',
  LABEL:         'label',
  SCAN:          'scan',
});

export default { enqueue, list, remove, clear, flush, onChange, QUEUE_TYPES };
