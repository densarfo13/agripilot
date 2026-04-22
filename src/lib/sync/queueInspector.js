/**
 * queueInspector.js — read-only + retry helpers for ops surfaces.
 *
 *   getQueueStats()
 *     → { total, pending, synced, failed, oldestPendingAt,
 *         byType: [{ type, pending, failed }] }
 *
 *   listFailedEntries()
 *     → Array<QueueEntry>  (pending entries with attempts > 0)
 *
 *   retryOne(id, { transport })
 *     → drives a single entry through the sync engine and returns
 *       the engine's per-entry report
 *
 *   dismissEntry(id)
 *     → removes an entry from the queue entirely (e.g. ops decided
 *       a validation-error entry is unrecoverable)
 *
 *   retryAllFailed({ transport })
 *     → { attempted, succeeded, failed }
 *
 * Kept intentionally small — the admin page calls these directly
 * and the existing offlineQueue + syncEngine do the heavy lifting.
 */

import {
  listQueue, markSynced, markFailure, pendingCount,
  _internal,
} from './offlineQueue.js';
import { syncPending } from './syncEngine.js';

// ─── Read helpers ────────────────────────────────────────────────
export function getQueueStats() {
  const all = listQueue({ limit: 500 });
  const pendingRows = all.filter((e) => e && !e.synced);
  const failedRows  = pendingRows.filter((e) => (e.attempts || 0) > 0);
  const syncedRows  = all.filter((e) => e && e.synced);

  const byType = new Map();
  for (const e of pendingRows) {
    if (!byType.has(e.type)) byType.set(e.type, { type: e.type, pending: 0, failed: 0 });
    byType.get(e.type).pending += 1;
    if ((e.attempts || 0) > 0) byType.get(e.type).failed += 1;
  }

  return Object.freeze({
    total:    all.length,
    pending:  pendingRows.length,
    synced:   syncedRows.length,
    failed:   failedRows.length,
    oldestPendingAt: pendingRows.length
      ? new Date(Math.min(...pendingRows.map((e) => e.createdAt))).toISOString()
      : null,
    byType:   Array.from(byType.values()).sort((a, b) => b.pending - a.pending),
  });
}

export function listFailedEntries({ limit = 50 } = {}) {
  return listQueue({ pendingOnly: true, limit })
    .filter((e) => e && (e.attempts || 0) > 0);
}

export function listAllEntries({ limit = 200 } = {}) {
  return listQueue({ limit });
}

// ─── Mutation helpers ────────────────────────────────────────────
/**
 * dismissEntry(id)
 *   Remove an entry from the queue. The offlineQueue module doesn't
 *   expose a public delete — we round-trip through the raw readers
 *   exported via _internal so we don't have to extend the public API
 *   just for ops tooling.
 */
export function dismissEntry(id) {
  if (!id) return null;
  const list = _internal.readRaw ? _internal.readRaw() : [];
  const idx = list.findIndex((e) => e && e.id === id);
  if (idx < 0) return null;
  const [removed] = list.splice(idx, 1);
  if (_internal.writeRaw) _internal.writeRaw(list);
  return removed;
}

export async function retryOne(id, { transport } = {}) {
  if (!id) return { ok: false, reason: 'missing_id' };
  // We can't hand-pick a single queued action through the sync
  // engine's batch drain — instead, temporarily mark everything
  // else "synced" before calling syncPending, then restore. That
  // inverts the normal flow; simpler to call transport.send
  // directly and update the queue row afterwards.
  const list = _internal.readRaw ? _internal.readRaw() : [];
  const entry = list.find((e) => e && e.id === id);
  if (!entry) return { ok: false, reason: 'not_found' };
  if (entry.synced) return { ok: false, reason: 'already_synced' };
  if (!transport || typeof transport.send !== 'function') {
    return { ok: false, reason: 'no_transport' };
  }

  let result = null;
  try {
    result = await transport.send(entry);
  } catch (err) {
    result = { ok: false, code: 'transport_threw', message: err && err.message };
  }

  if (result && result.ok) {
    markSynced(id);
    return { ok: true };
  }
  if (result && (result.code === 'duplicate' || result.code === 'already_synced')) {
    markSynced(id);
    return { ok: true, code: 'duplicate' };
  }
  const reason = (result && (result.code || result.message)) || 'unknown';
  markFailure(id, new Error(String(reason)));
  return { ok: false, reason };
}

export async function retryAllFailed({ transport, maxBatch = 25 } = {}) {
  const failing = listFailedEntries({ limit: maxBatch });
  let succeeded = 0, failed = 0;
  for (const entry of failing) {
    const out = await retryOne(entry.id, { transport });
    if (out.ok) succeeded += 1; else failed += 1;
  }
  return { attempted: failing.length, succeeded, failed };
}

export async function drainAll({ transport } = {}) {
  return syncPending({ transport, isOnline: true });
}

export { pendingCount };
