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

// Fix 1 — Production-stability hardening §1: retry strategy.
//   MAX_ATTEMPTS = how many tries we make before giving up and
//   marking the action FAILED (terminal — visible in UI, not
//   silently dropped).
//   BACKOFF_MS  = exponential schedule in ms; index = attempt count.
//   Past the last entry we cap at the final value (30s).
export const MAX_ATTEMPTS = 6;
export const BACKOFF_MS  = Object.freeze([0, 1000, 3000, 10000, 30000, 30000, 30000]);

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
    // Terminal-failure marker (Fix 1): true once attempts ≥
    // MAX_ATTEMPTS. UI surfaces these as "needs attention" instead
    // of pretending they'll eventually go through.
    failed:     false,
    failedAt:   null,
    // Backoff gate: the next time the engine is allowed to retry
    // this row. Honours BACKOFF_MS[attempts]. The engine skips any
    // row whose nextAttemptAt is in the future.
    nextAttemptAt: 0,
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

/**
 * listQueue
 *   pendingOnly  = true  → only !synced && !failed && nextAttemptAt ≤ now
 *   pendingOnly  = false → every entry, no filtering
 *   includeFailed = true → also include FAILED entries (default false)
 */
export function listQueue({
  pendingOnly = false, type = null, limit = 200,
  includeFailed = false, now = Date.now(),
} = {}) {
  const list = readRaw();
  let out = list;
  if (pendingOnly) {
    out = out.filter((e) => e && !e.synced
      && (includeFailed || !e.failed)
      && (!e.nextAttemptAt || e.nextAttemptAt <= now));
  }
  if (type) out = out.filter((e) => e && e.type === type);
  return out.slice(0, Math.max(0, Math.min(MAX_ENTRIES, limit)));
}

export function hasPending() {
  return readRaw().some((e) => e && !e.synced && !e.failed);
}

export function pendingCount() {
  return readRaw().filter((e) => e && !e.synced && !e.failed).length;
}

/**
 * listFailed — terminal-failure rows the UI surfaces in a "needs
 * attention" badge. Pilot operators retry these manually via
 * retryFailed(id).
 */
export function listFailed() {
  return readRaw().filter((e) => e && e.failed);
}

export function failedCount() {
  return readRaw().filter((e) => e && e.failed).length;
}

/**
 * retryFailed(id) — reset attempts/nextAttemptAt on a FAILED row so
 * the next syncPending() picks it up. Returns the updated row, or
 * null when the id isn't found / wasn't failed.
 */
export function retryFailed(id) {
  if (!id) return null;
  const list = readRaw();
  const entry = list.find((e) => e && e.id === id);
  if (!entry || !entry.failed) return null;
  entry.failed = false;
  entry.failedAt = null;
  entry.attempts = 0;
  entry.lastError = null;
  entry.nextAttemptAt = 0;
  writeRaw(list);
  return { ...entry };
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

/**
 * markFailure — bump attempts, schedule the next retry per
 * BACKOFF_MS, and flip to terminal `failed` once the cap is hit.
 *   error: Error | string | null  — last failure reason for the UI
 *   permanent: boolean             — when true (e.g. validation_error
 *                                    from the server), skip backoff
 *                                    and go straight to FAILED
 */
export function markFailure(id, error, { permanent = false } = {}) {
  if (!id) return null;
  const list = readRaw();
  const entry = list.find((e) => e && e.id === id);
  if (!entry) return null;
  entry.attempts   = (entry.attempts || 0) + 1;
  entry.lastError  = error
    ? (error.message || String(error)) : 'unknown';
  // Schedule next retry — exponential backoff capped at the last
  // entry. The engine respects nextAttemptAt and won't drain rows
  // whose deadline is still in the future.
  const idx = Math.min(entry.attempts, BACKOFF_MS.length - 1);
  entry.nextAttemptAt = Date.now() + (BACKOFF_MS[idx] || 30000);
  // Terminal: hit the retry cap, OR caller marked the failure
  // permanent (validation/missing-resource = no point retrying).
  if (permanent || entry.attempts >= MAX_ATTEMPTS) {
    entry.failed   = true;
    entry.failedAt = Date.now();
  }
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

export const _internal = Object.freeze({
  KEY, MAX_ENTRIES, MAX_ATTEMPTS, BACKOFF_MS,
  genId, readRaw, writeRaw,
});
