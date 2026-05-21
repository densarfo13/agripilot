/**
 * offlineQueue.js — durable queue of pending offline actions.
 *
 *   import { enqueue, peek, drain, markSynced, getPending,
 *            QUEUE_KIND }
 *     from 'src/core/offline/offlineQueue.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small queue layer ON TOP of the existing `offlineStore` —
 *   not a replacement. `offlineStore` is a generic key/value
 *   wrapper; this module gives the scan / task / journal /
 *   watering / feedback flows a single queue with stable IDs,
 *   timestamps, dedupe, and a sync handler protocol.
 *
 * Rules (spec §5)
 *   • Each enqueued item gets a stable client-generated id so a
 *     retry never produces a duplicate.
 *   • Timestamps are preserved across reconnect (createdAt).
 *   • `drain(handler)` calls `handler(entry)` for each pending
 *     item; success removes it, failure leaves it queued.
 *   • Handler failures are caught — they never break the loop.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (offlineStore guards localStorage).
 */

import { saveOffline, getOffline } from './offlineStore.js';

const QUEUE_KEY = 'queue_pending_v1';
const MAX_ITEMS = 500; // bounded — drop oldest if exceeded

export const QUEUE_KIND = Object.freeze({
  SCAN:           'scan',
  TASK_COMPLETE:  'task_complete',
  JOURNAL:        'journal',
  WATERING:       'watering',
  FEEDBACK:       'feedback',
});

function _newId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fallthrough */ }
  return `q_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function _readQueue() {
  try {
    const entry = getOffline(QUEUE_KEY);
    return entry && Array.isArray(entry.data) ? entry.data : [];
  } catch { return []; }
}

function _writeQueue(list) {
  try {
    const bounded = Array.isArray(list) ? list.slice(-MAX_ITEMS) : [];
    saveOffline(QUEUE_KEY, bounded);
  } catch { /* ignore */ }
}

function _normalize(entry) {
  return {
    id:        entry.id || _newId(),
    kind:      String(entry.kind || '').toLowerCase(),
    payload:   entry.payload && typeof entry.payload === 'object' ? entry.payload : {},
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
    attempts:  Number.isFinite(entry.attempts) ? entry.attempts : 0,
  };
}

/**
 * Enqueue an action. Returns the normalised entry (with stable
 * id). Idempotent on (kind, payload.id) — the same logical action
 * never queues twice, so retries can safely call enqueue again.
 */
export function enqueue(entry) {
  try {
    if (!entry || typeof entry !== 'object') return null;
    const norm = _normalize(entry);
    if (!norm.kind) return null;

    const list = _readQueue();
    // Dedupe by (kind, payload.id) — only when payload.id present.
    const payloadId = norm.payload && norm.payload.id;
    if (payloadId) {
      const dup = list.find((e) => e && e.kind === norm.kind
        && e.payload && e.payload.id === payloadId);
      if (dup) return dup;
    }
    // Also dedupe by full id (caller-supplied).
    if (entry.id) {
      const byId = list.find((e) => e && e.id === entry.id);
      if (byId) return byId;
    }

    list.push(norm);
    _writeQueue(list);
    return norm;
  } catch {
    return null;
  }
}

/** Read-only snapshot of pending entries. */
export function getPending() {
  return _readQueue().map((e) => ({ ...e }));
}

/** Number of pending entries. */
export function pendingCount() {
  return _readQueue().length;
}

/** Peek the first pending entry without removing it. */
export function peek() {
  const list = _readQueue();
  return list.length > 0 ? { ...list[0] } : null;
}

/** Remove an entry by id (called after a successful sync). */
export function markSynced(id) {
  try {
    if (!id) return false;
    const list = _readQueue().filter((e) => e && e.id !== id);
    _writeQueue(list);
    return true;
  } catch { return false; }
}

/**
 * Drain pending entries by calling `handler(entry)` for each.
 * `handler` returns (or resolves to) a boolean — true = synced
 * (entry is removed), false = leave queued. A throwing handler
 * is treated as failure and the entry stays queued.
 *
 * Returns `{ synced, failed, total }`.
 */
export async function drain(handler) {
  try {
    if (typeof handler !== 'function') return { synced: 0, failed: 0, total: 0 };
    const list = _readQueue();
    let synced = 0, failed = 0;
    const remaining = [];
    for (const entry of list) {
      try {
        const ok = await handler({ ...entry });
        if (ok === true) {
          synced += 1;
        } else {
          remaining.push({ ...entry, attempts: (entry.attempts || 0) + 1 });
          failed += 1;
        }
      } catch {
        // Handler crash — keep the entry, bump attempts.
        remaining.push({ ...entry, attempts: (entry.attempts || 0) + 1 });
        failed += 1;
      }
    }
    _writeQueue(remaining);
    return { synced, failed, total: list.length };
  } catch {
    return { synced: 0, failed: 0, total: 0 };
  }
}

/** Wipe the queue (test hook / hard reset). */
export function clearQueue() {
  _writeQueue([]);
}

const _module = {
  QUEUE_KIND,
  enqueue, peek, drain, markSynced, getPending, pendingCount, clearQueue,
};
export default _module;
