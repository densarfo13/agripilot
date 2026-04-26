/**
 * offlineQueue.js — lightweight, additive localStorage action queue.
 *
 * Sits alongside the heavy IndexedDB sync engine in `src/lib/sync/*`.
 * Used by the new low-literacy farmer flows (voice navigation,
 * IconActionCard taps, simple harvest/farm tweaks). Production-grade
 * mutations still go through the IndexedDB engine.
 *
 * Entry shape (v2 — backwards compatible)
 * ───────────────────────────────────────
 *   {
 *     id:              string   uuid
 *     idempotencyKey:  string   uuid — sent as Idempotency-Key header so
 *                                       a re-fired entry after a lost
 *                                       network response is a server-
 *                                       side no-op (exactly-once)
 *     version:         number   schema version of `action.payload`
 *     queuedAt:        number   ms-epoch when first persisted
 *     attempts:        number   how many flush attempts have run
 *     lastError:       string?  last error message (truncated)
 *     nextRetryAt:     number   ms-epoch — entry not eligible until ≥ now
 *     status:          'pending' | 'abandoned'
 *     action:          object   caller-defined payload
 *   }
 *
 * Old v1 entries (just `{ id, queuedAt, action }`) keep working:
 * `_normalize()` upgrades them in-memory on read with sensible
 * defaults (`status: 'pending'`, `attempts: 0`, `nextRetryAt: 0`,
 * `version: 1`). They get persisted in v2 shape on the next mutation.
 *
 * Public API
 * ──────────
 *   addToQueue(action)           — append a new pending entry
 *   getQueue()                   — read all entries (copy)
 *   getDueEntries(now?)          — pending entries whose nextRetryAt ≤ now
 *   getAbandoned()               — entries the manager gave up on
 *   markAttempt(id, { error })   — increment attempts, schedule retry,
 *                                   mark abandoned past MAX_ATTEMPTS
 *   removeFromQueue(id)          — drop a single entry (success path)
 *   setQueue(arr)                — replace entire queue (used internally)
 *   clearQueue()                 — remove the localStorage key entirely
 *   queueLength()                — total entries (pending + abandoned)
 *
 * Storage
 * ───────
 *   localStorage[STORAGE_KEY] = JSON.stringify(entries[])
 *
 * Every mutation dispatches the global event
 * `farroway:offlineQueueChange` so live UI (banner / toasts) can
 * refresh immediately instead of polling.
 *
 * Never throws. Quota / private-mode / corrupt JSON all become
 * silent no-ops; render paths stay safe.
 */

export const STORAGE_KEY = 'farroway_offline_queue';
export const SCHEMA_VERSION = 2;

// Backoff schedule (seconds) — applied to `attempts - 1`. The last
// step is reused once we exceed the array; an entry hits MAX_ATTEMPTS
// before reaching the long tail anyway.
const BACKOFF_SECONDS = [1, 5, 15, 60, 300, 900, 1800, 3600];
export const MAX_ATTEMPTS = BACKOFF_SECONDS.length;

const EVENT = 'farroway:offlineQueueChange';

function _now() { return Date.now(); }

function _uuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* ignore */ }
  return 'q_' + _now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function _truncate(msg, max = 240) {
  if (typeof msg !== 'string') return null;
  return msg.length > max ? msg.slice(0, max) + '…' : msg;
}

function _normalize(raw) {
  // Accept v1 entries `{ id, queuedAt, action }` and decorate them
  // with the v2 fields so the rest of the code only sees one shape.
  if (!raw || typeof raw !== 'object') return null;
  return {
    id:              raw.id || _uuid(),
    idempotencyKey:  raw.idempotencyKey || raw.id || _uuid(),
    version:         Number.isFinite(raw.version) ? raw.version : 1,
    queuedAt:        Number.isFinite(raw.queuedAt) ? raw.queuedAt : _now(),
    attempts:        Number.isFinite(raw.attempts) ? raw.attempts : 0,
    lastError:       typeof raw.lastError === 'string' ? raw.lastError : null,
    nextRetryAt:     Number.isFinite(raw.nextRetryAt) ? raw.nextRetryAt : 0,
    status:          raw.status === 'abandoned' ? 'abandoned' : 'pending',
    action:          raw.action,
  };
}

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(_normalize).filter(Boolean);
  } catch {
    return [];
  }
}

function _write(arr) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
    _emitChange();
    return true;
  } catch {
    return false;
  }
}

function _emitChange() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT));
    }
  } catch { /* ignore */ }
}

/**
 * Append an action. The caller may either pass:
 *   • a bare payload object (gets wrapped at v2 defaults), or
 *   • a tagged object `{ type, payload, version? }`.
 *
 * Returns the persisted entry (v2 shape) so callers can show a
 * non-blocking "saved for later" toast.
 */
export function addToQueue(action) {
  const entry = _normalize({
    id:              _uuid(),
    idempotencyKey:  _uuid(),
    version:         (action && Number.isFinite(action.version)) ? action.version : 1,
    queuedAt:        _now(),
    attempts:        0,
    lastError:       null,
    nextRetryAt:     0,        // due immediately
    status:          'pending',
    action,
  });
  const queue = _read();
  queue.push(entry);
  _write(queue);
  return entry;
}

/** All entries, normalized v2. */
export function getQueue() {
  return _read();
}

/** Pending entries whose backoff window has elapsed. */
export function getDueEntries(now = _now()) {
  return _read().filter(e => e.status === 'pending' && (e.nextRetryAt || 0) <= now);
}

/** Entries the sync manager gave up on (max attempts reached). */
export function getAbandoned() {
  return _read().filter(e => e.status === 'abandoned');
}

/** Replace the whole queue (used by the manager after a flush). */
export function setQueue(arr) {
  _write(Array.isArray(arr) ? arr.map(_normalize).filter(Boolean) : []);
}

/** Drop everything. */
export function clearQueue() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
    _emitChange();
  } catch { /* ignore */ }
}

/** Total count (pending + abandoned). */
export function queueLength() {
  return _read().length;
}

/**
 * Drop a single entry by id (success path). Returns true if the
 * entry was found and removed.
 */
export function removeFromQueue(id) {
  if (!id) return false;
  const queue = _read();
  const idx = queue.findIndex(e => e.id === id);
  if (idx === -1) return false;
  queue.splice(idx, 1);
  _write(queue);
  return true;
}

/**
 * Record a failed flush attempt. Increments `attempts`, stamps
 * `lastError`, and schedules the next retry per BACKOFF_SECONDS.
 * Once `attempts >= MAX_ATTEMPTS` the entry transitions to
 * `status: 'abandoned'` (kept around for inspection / replay rather
 * than silently dropped — mirrors the IndexedDB engine's behaviour).
 *
 * Returns the updated entry (or null if the id was unknown).
 */
export function markAttempt(id, { error } = {}) {
  if (!id) return null;
  const queue = _read();
  const idx = queue.findIndex(e => e.id === id);
  if (idx === -1) return null;
  const entry = queue[idx];
  const attempts = (entry.attempts || 0) + 1;
  const idxBackoff = Math.min(attempts - 1, BACKOFF_SECONDS.length - 1);
  const delaySec = BACKOFF_SECONDS[idxBackoff];
  const next = {
    ...entry,
    attempts,
    lastError: _truncate(error && error.message ? error.message : (typeof error === 'string' ? error : null)),
    nextRetryAt: _now() + (delaySec * 1000),
    status: attempts >= MAX_ATTEMPTS ? 'abandoned' : 'pending',
  };
  queue[idx] = next;
  _write(queue);
  return next;
}

/**
 * Manually move an abandoned entry back to pending — the recovery
 * hook a debug screen could expose ("retry abandoned"). No-op on
 * unknown id or on entries that are already pending.
 */
export function retryAbandoned(id) {
  if (!id) return null;
  const queue = _read();
  const idx = queue.findIndex(e => e.id === id);
  if (idx === -1) return null;
  if (queue[idx].status !== 'abandoned') return queue[idx];
  queue[idx] = {
    ...queue[idx],
    status: 'pending',
    attempts: 0,
    nextRetryAt: 0,
    lastError: null,
  };
  _write(queue);
  return queue[idx];
}
