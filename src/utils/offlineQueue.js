/**
 * IndexedDB-backed offline mutation queue.
 * When a POST/PATCH/PUT fails due to network error, the mutation is queued here.
 * On reconnect, queued mutations are replayed in order.
 *
 * Data safety guarantees:
 *   - Every mutation carries an idempotencyKey (caller or auto-generated)
 *   - Mutations include entityType + actionType for filtering and diagnostics
 *   - Abandoned mutations (max retries) are marked 'abandoned', NOT deleted
 *   - Expired mutations (>14 days) are marked 'expired', NOT deleted
 *   - Only successfully synced mutations are removed from the queue
 *   - getAbandoned() recovers mutations that were given up on
 *
 * LIMITATION: Sync failures stay local (IndexedDB + pilotTracker). Admins see
 * the SyncStatus banner but not individual failure details. Server-side
 * opsEvent('workflow', ...) fires when the replayed request eventually succeeds
 * or fails, which flows to the Railway log drain.
 */

import { trackPilotEvent } from './pilotTracker.js';

const DB_NAME = 'farroway-offline';
const STORE_NAME = 'mutations';
const DB_VERSION = 2; // Bumped from 1 — adds syncStatus field support

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      // V2: no structural change to the store itself — new fields are just
      // additional properties on the stored objects. IndexedDB is schemaless
      // for object properties.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDB().then(db => {
    const t = db.transaction(STORE_NAME, mode);
    return t.objectStore(STORE_NAME);
  });
}

const MAX_RETRIES = 5;   // After 5 failed syncs, mutation is marked 'abandoned'
const EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days — extended from 7 for safety

// ─── Sync status values ─────────────────────────────────────
// Used for filtering + diagnostics. Stored on each mutation record.
export const SYNC_STATUS = {
  PENDING:   'pending',    // Waiting to sync
  SYNCING:   'syncing',    // Currently being synced (in-flight)
  SYNCED:    'synced',     // Successfully synced — will be removed
  ABANDONED: 'abandoned',  // Max retries exceeded — kept for recovery
  EXPIRED:   'expired',    // Older than EXPIRY_MS — kept for recovery
  CONFLICT:  'conflict',   // Server returned 409 — already processed
  REJECTED:  'rejected',   // Server returned 4xx/5xx — won't succeed on retry
};

/**
 * Enqueue a failed mutation with full metadata.
 *
 * @param {Object} mutation
 * @param {string} mutation.method - HTTP method (POST/PATCH/PUT)
 * @param {string} mutation.url - API endpoint
 * @param {Object} mutation.data - Request body
 * @param {string} [mutation.entityType] - e.g. 'task', 'profile', 'harvest', 'cost', 'stage'
 * @param {string} [mutation.actionType] - e.g. 'complete', 'create', 'update'
 * @param {string} [mutation.idempotencyKey] - Caller-provided key. Auto-generated if absent.
 * @param {Object} [mutation.headers] - Additional request headers
 * @returns {Promise<number>} Record ID, or -1 if deduplicated
 */
export async function enqueue(mutation) {
  // Prevent exact-same mutation from being queued twice rapidly (e.g. double-tap)
  const existing = await getAll();
  const now = Date.now();

  // Dedup by idempotencyKey (strongest) or url+method within 10s window (fallback)
  if (mutation.idempotencyKey) {
    const hasSameKey = existing.some(m =>
      m.idempotencyKey === mutation.idempotencyKey &&
      m.syncStatus !== SYNC_STATUS.SYNCED
    );
    if (hasSameKey) return -1;
  } else {
    const isDupe = existing.some(m =>
      m.method === mutation.method &&
      m.url === mutation.url &&
      (now - m.createdAt) < 10000
    );
    if (isDupe) return -1;
  }

  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({
      method: mutation.method,
      url: mutation.url,
      data: mutation.data,
      headers: mutation.headers || null,
      entityType: mutation.entityType || null,
      actionType: mutation.actionType || null,
      idempotencyKey: mutation.idempotencyKey || _generateKey(),
      syncStatus: SYNC_STATUS.PENDING,
      createdAt: now,
      retryCount: 0,
      lastAttemptAt: null,
      lastError: null,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get all pending mutations (excludes synced) */
export async function getAll() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      // Filter out already-synced items (kept briefly before cleanup)
      resolve((req.result || []).filter(m => m.syncStatus !== SYNC_STATUS.SYNCED));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Get only pending mutations (ready to sync) */
export async function getPending() {
  const all = await getAll();
  return all.filter(m => m.syncStatus === SYNC_STATUS.PENDING);
}

/** Get abandoned mutations (for recovery UI or diagnostics) */
export async function getAbandoned() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      resolve((req.result || []).filter(m =>
        m.syncStatus === SYNC_STATUS.ABANDONED || m.syncStatus === SYNC_STATUS.EXPIRED
      ));
    };
    req.onerror = () => reject(req.error);
  });
}

/** Remove a mutation by id (only for confirmed synced items) */
export async function remove(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Update a mutation record in-place */
async function _update(mutation) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.put(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best-effort
    });
  } catch { /* best-effort */ }
}

/** Count pending mutations (ready to sync) */
export async function count() {
  const pending = await getPending();
  return pending.length;
}

/** Clear all mutations (use with caution — only for testing/reset) */
export async function clear() {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retry an abandoned mutation (moves it back to pending).
 * @param {number} id - Mutation record ID
 */
export async function retryAbandoned(id) {
  const store = await tx('readonly');
  const mutation = await new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!mutation) return;
  await _update({
    ...mutation,
    syncStatus: SYNC_STATUS.PENDING,
    retryCount: 0,
    lastError: null,
  });
}

// ─── Sync failure logging (client-side ring buffer) ──────

function logSyncFailure(reason, mutation, extra = {}) {
  try {
    const LOG_KEY = 'farroway:sync_failures';
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    prev.push({
      ts: new Date().toISOString(),
      reason,
      method: mutation.method,
      url: mutation.url,
      entityType: mutation.entityType,
      idempotencyKey: mutation.idempotencyKey,
      ...extra,
    });
    // Keep last 50 entries (increased from 30)
    if (prev.length > 50) prev.splice(0, prev.length - 50);
    localStorage.setItem(LOG_KEY, JSON.stringify(prev));
  } catch { /* storage full — ignore */ }
}

// ─── Sync engine ──────────────────────────────────────────

let syncing = false;
let listeners = [];

export function onSyncChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}

function notify(status) {
  listeners.forEach(fn => fn(status));
}

/** Mark expired mutations (>14 days) — keeps them for recovery instead of deleting */
export async function purgeExpired() {
  const now = Date.now();
  const store = await tx('readonly');
  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  let marked = 0;
  for (const m of all) {
    if (m.createdAt && (now - m.createdAt) > EXPIRY_MS && m.syncStatus === SYNC_STATUS.PENDING) {
      logSyncFailure('expired_after_14_days', m, { age: now - m.createdAt });
      await _update({ ...m, syncStatus: SYNC_STATUS.EXPIRED });
      marked++;
    }
  }
  return marked;
}

/** Replay all queued mutations in order. Called on reconnect. */
export async function syncAll(apiClient) {
  if (syncing) return; // Prevents double-sync from rapid online events
  syncing = true;
  notify({ syncing: true });

  // Mark expired before syncing
  await purgeExpired();

  const mutations = await getPending();
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];

    // Max retry guard — mark as abandoned (NOT deleted)
    if ((m.retryCount || 0) >= MAX_RETRIES) {
      logSyncFailure('max_retries_exceeded', m, { retryCount: m.retryCount });
      await _update({ ...m, syncStatus: SYNC_STATUS.ABANDONED });
      trackPilotEvent('offline_sync_abandoned', {
        url: m.url, entityType: m.entityType, retryCount: m.retryCount,
      });
      failed++;
      continue;
    }

    // Exponential backoff between items (skip delay for first item)
    if (i > 0 && failed > 0) {
      const delay = Math.min(1000 * Math.pow(2, failed - 1), 8000);
      await new Promise(r => setTimeout(r, delay));
    }

    // Mark as syncing
    await _update({ ...m, syncStatus: SYNC_STATUS.SYNCING, lastAttemptAt: Date.now() });

    try {
      // Attach idempotency key as header
      const headers = { ...(m.headers || {}) };
      if (m.idempotencyKey) {
        headers['X-Idempotency-Key'] = m.idempotencyKey;
      }
      const config = { headers };

      if (m.method === 'POST') {
        await apiClient.post(m.url, m.data, config);
      } else if (m.method === 'PATCH') {
        await apiClient.patch(m.url, m.data, config);
      } else if (m.method === 'PUT') {
        await apiClient.put(m.url, m.data, config);
      }

      // Success — remove from queue
      await remove(m.id);
      synced++;
      trackPilotEvent('offline_synced', {
        url: m.url, method: m.method, entityType: m.entityType,
      });
    } catch (err) {
      // If it's still a network error, stop — we're still offline
      if (!err.response) {
        await _update({
          ...m,
          syncStatus: SYNC_STATUS.PENDING,
          retryCount: (m.retryCount || 0) + 1,
          lastError: 'network_offline',
          lastAttemptAt: Date.now(),
        });
        failed++;
        logSyncFailure('network_still_offline', m);
        trackPilotEvent('offline_sync_failed', { reason: 'network_still_offline', url: m.url });
        break;
      }

      const status = err.response?.status;

      // 409 Conflict — server already processed this (idempotency hit)
      if (status === 409) {
        logSyncFailure('conflict_already_processed', m, { status });
        await remove(m.id); // Safe to remove — server has the data
        synced++;
        continue;
      }

      // Other server rejections (4xx/5xx) — mark as rejected (NOT deleted)
      logSyncFailure('server_rejected', m, { status, error: err.response?.data?.error });
      trackPilotEvent('offline_sync_failed', { reason: 'server_rejected', url: m.url, status });
      await _update({
        ...m,
        syncStatus: SYNC_STATUS.REJECTED,
        lastError: `${status}: ${err.response?.data?.error || 'unknown'}`,
        lastAttemptAt: Date.now(),
      });
      failed++;
    }
  }

  syncing = false;
  const remaining = await count();
  notify({ syncing: false, synced, failed, remaining });
  return { synced, failed, remaining };
}

// ─── Auto-sync on reconnect ──────────────────────────────

let autoSyncApi = null;

export function initAutoSync(apiClient) {
  autoSyncApi = apiClient;
  window.addEventListener('online', () => {
    if (autoSyncApi) syncAll(autoSyncApi);
  });
}

export function isOnline() {
  return navigator.onLine;
}

// ─── Internal helpers ────────────────────────────────────

function _generateKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
