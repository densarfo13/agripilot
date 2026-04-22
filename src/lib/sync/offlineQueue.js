/**
 * offlineQueue.js — append-only queue of actions that need to hit
 * the server when connectivity comes back.
 *
 * Storage:
 *   localStorage['farroway.offlineQueue.v1'] = [
 *     {
 *       id,                  // stable UUID-ish (crypto.randomUUID or fallback)
 *       type,                // 'task_complete' | 'task_skip' | 'issue_report' | string
 *       farmId, taskId,      // optional — depend on type
 *       payload,             // freeform JSON, short-lived
 *       createdAt,           // epoch ms
 *       attempts,            // int — bumped by syncEngine on retry
 *       lastError,           // string | null — last failed reason (for UI retry badge)
 *       synced,              // bool — true once server accepted; pruned lazily
 *       syncedAt,            // epoch ms | null
 *     },
 *     …
 *   ]
 *
 * All operations are synchronous, SSR-safe, and quota-tolerant. The
 * queue is capped at 200 entries; oldest SYNCED entries are dropped
 * first, then any oldest pending items (extremely rare — 200 unsynced
 * actions means the farmer has been offline for a long time).
 */

const KEY = 'farroway.offlineQueue.v1';
const MAX_ENTRIES = 200;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function writeRaw(list) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  catch { return false; }
}

function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'q_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * enqueueAction — append a new queued action. Returns the frozen row.
 * Duplicate-safe: if the caller passes a `dedupKey` that matches an
 * existing unsynced entry, we return the existing row instead of
 * adding a second copy.
 *
 *   enqueueAction({ type, farmId, taskId, payload, dedupKey })
 */
export function enqueueAction({
  type,
  farmId  = null,
  taskId  = null,
  payload = null,
  dedupKey = null,
} = {}) {
  if (!type) return null;
  const list = readRaw();

  if (dedupKey) {
    const existing = list.find((e) => e && !e.synced && e.dedupKey === dedupKey);
    if (existing) return existing;
  }

  const row = {
    id:         genId(),
    type:       String(type),
    farmId:     farmId || null,
    taskId:     taskId || null,
    payload:    (payload && typeof payload === 'object') ? payload : null,
    dedupKey:   dedupKey || null,
    createdAt:  Date.now(),
    attempts:   0,
    lastError:  null,
    synced:     false,
    syncedAt:   null,
  };
  list.push(row);

  // Cap: drop oldest synced entries first, then oldest overall.
  while (list.length > MAX_ENTRIES) {
    const idx = list.findIndex((e) => e && e.synced);
    if (idx >= 0) list.splice(idx, 1);
    else list.shift();
  }
  writeRaw(list);
  return Object.freeze({ ...row });
}

export function listQueue({ pendingOnly = false, type = null, limit = 200 } = {}) {
  const list = readRaw();
  let out = list;
  if (pendingOnly) out = out.filter((e) => e && !e.synced);
  if (type)        out = out.filter((e) => e && e.type === type);
  return out.slice(0, Math.max(0, Math.min(MAX_ENTRIES, limit)));
}

export function hasPending() {
  return readRaw().some((e) => e && !e.synced);
}

export function pendingCount() {
  return readRaw().filter((e) => e && !e.synced).length;
}

export function markSynced(id) {
  if (!id) return null;
  const list = readRaw();
  const entry = list.find((e) => e && e.id === id);
  if (!entry || entry.synced) return entry || null;
  entry.synced  = true;
  entry.syncedAt = Date.now();
  entry.lastError = null;
  writeRaw(list);
  return { ...entry };
}

export function markFailure(id, error) {
  if (!id) return null;
  const list = readRaw();
  const entry = list.find((e) => e && e.id === id);
  if (!entry) return null;
  entry.attempts   = (entry.attempts || 0) + 1;
  entry.lastError  = error ? (error.message || String(error)) : 'unknown';
  writeRaw(list);
  return { ...entry };
}

/**
 * pruneSynced — drop synced entries older than `ageMs` (default 24h).
 * Keeps the queue file small on long-running sessions.
 */
export function pruneSynced({ ageMs = 24 * 60 * 60 * 1000 } = {}) {
  const list = readRaw();
  const cutoff = Date.now() - ageMs;
  const kept = list.filter((e) => !(e && e.synced && e.syncedAt && e.syncedAt < cutoff));
  if (kept.length !== list.length) writeRaw(kept);
  return list.length - kept.length;
}

export function clearQueue() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(KEY); return true; }
  catch { return false; }
}

export const _internal = Object.freeze({ KEY, MAX_ENTRIES, genId, readRaw, writeRaw });
