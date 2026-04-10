/**
 * IndexedDB-backed offline mutation queue.
 * When a POST/PATCH/PUT fails due to network error, the mutation is queued here.
 * On reconnect, queued mutations are replayed in order.
 *
 * LIMITATION: Sync failures stay local (IndexedDB + pilotTracker). Admins see
 * the SyncStatus banner but not individual failure details. Server-side
 * opsEvent('workflow', ...) fires when the replayed request eventually succeeds
 * or fails, which flows to the Railway log drain.
 */

const DB_NAME = 'farroway-offline';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
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

const MAX_RETRIES = 5; // After 5 failed syncs, mutation is abandoned and logged

/** Enqueue a failed mutation (deduplicates by url+method within 10s window) */
export async function enqueue(mutation) {
  // Prevent exact-same mutation from being queued twice rapidly (e.g. double-tap)
  const existing = await getAll();
  const now = Date.now();
  const isDupe = existing.some(m =>
    m.method === mutation.method &&
    m.url === mutation.url &&
    (now - m.createdAt) < 10000 // within 10 seconds
  );
  if (isDupe) return -1; // silently skip duplicate

  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({
      ...mutation,
      createdAt: now,
      retryCount: 0,
    });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Get all pending mutations */
export async function getAll() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a mutation by id */
export async function remove(id) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Count pending mutations */
export async function count() {
  const store = await tx('readonly');
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Clear all pending mutations */
export async function clear() {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
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
      ...extra,
    });
    // Keep last 30 entries
    if (prev.length > 30) prev.splice(0, prev.length - 30);
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

/** Increment retry count for a mutation in-place via IDB update */
async function incrementRetry(mutation) {
  try {
    const store = await tx('readwrite');
    return new Promise((resolve) => {
      const req = store.put({ ...mutation, retryCount: (mutation.retryCount || 0) + 1 });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best-effort
    });
  } catch { /* best-effort */ }
}

/** Replay all queued mutations in order. Called on reconnect. */
export async function syncAll(apiClient) {
  if (syncing) return; // Prevents double-sync from rapid online events
  syncing = true;
  notify({ syncing: true });

  const mutations = await getAll();
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < mutations.length; i++) {
    const m = mutations[i];

    // Max retry guard — abandon mutations that have failed too many times
    if ((m.retryCount || 0) >= MAX_RETRIES) {
      logSyncFailure('max_retries_exceeded', m, { retryCount: m.retryCount });
      await remove(m.id);
      failed++;
      continue;
    }

    // Exponential backoff between items (skip delay for first item)
    if (i > 0 && failed > 0) {
      const delay = Math.min(1000 * Math.pow(2, failed - 1), 8000); // 1s, 2s, 4s, 8s cap
      await new Promise(r => setTimeout(r, delay));
    }

    try {
      const config = m.headers ? { headers: m.headers } : undefined;
      if (m.method === 'POST') {
        await apiClient.post(m.url, m.data, config);
      } else if (m.method === 'PATCH') {
        await apiClient.patch(m.url, m.data, config);
      } else if (m.method === 'PUT') {
        await apiClient.put(m.url, m.data, config);
      }
      await remove(m.id);
      synced++;
    } catch (err) {
      // If it's still a network error, stop — we're still offline
      if (!err.response) {
        await incrementRetry(m);
        failed++;
        logSyncFailure('network_still_offline', m);
        break;
      }
      const status = err.response?.status;
      // 409 Conflict — server already processed this (idempotency hit or state conflict)
      // Safe to remove from queue
      if (status === 409) {
        logSyncFailure('conflict_already_processed', m, { status });
        await remove(m.id);
        synced++; // Count as synced — server already has the data
        continue;
      }
      // Other server rejections (4xx/5xx) — remove from queue, it won't succeed on retry
      logSyncFailure('server_rejected', m, { status, error: err.response?.data?.error });
      await remove(m.id);
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
