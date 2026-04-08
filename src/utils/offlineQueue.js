/**
 * IndexedDB-backed offline mutation queue.
 * When a POST/PATCH/PUT fails due to network error, the mutation is queued here.
 * On reconnect, queued mutations are replayed in order.
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

/** Enqueue a failed mutation */
export async function enqueue(mutation) {
  const store = await tx('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add({
      ...mutation,
      createdAt: Date.now(),
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

/** Replay all queued mutations in order. Called on reconnect. */
export async function syncAll(apiClient) {
  if (syncing) return;
  syncing = true;
  notify({ syncing: true });

  const mutations = await getAll();
  let synced = 0;
  let failed = 0;

  for (const m of mutations) {
    try {
      if (m.method === 'POST') {
        await apiClient.post(m.url, m.data);
      } else if (m.method === 'PATCH') {
        await apiClient.patch(m.url, m.data);
      } else if (m.method === 'PUT') {
        await apiClient.put(m.url, m.data);
      }
      await remove(m.id);
      synced++;
    } catch (err) {
      // If it's still a network error, stop — we're still offline
      if (!err.response) {
        failed++;
        break;
      }
      // Server rejected it (4xx/5xx) — remove from queue, it won't succeed on retry
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
