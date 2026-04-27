/**
 * indexedDB.js — minimal IndexedDB wrapper for the Farroway core.
 *
 * Same export surface the spec asks for (dbPromise + dbSet / dbGet /
 * dbGetAll / dbAddQueue / dbGetQueue / dbDeleteQueue) so call sites
 * read like the `idb` package examples — but implemented directly
 * over the browser's IndexedDB API. Avoids the npm dependency and
 * keeps the bundle a few KB lighter.
 *
 * Stores:
 *   farm       (out-of-line keys)            current farm record
 *   progress   (out-of-line keys)            done-task log
 *   queue      (in-line key path: 'id')      pending sync actions
 *
 * Every helper:
 *   * is async + returns a Promise
 *   * never throws synchronously
 *   * resolves to null/[] on environments without IndexedDB so the
 *     UI can keep going (SSR, very-old browser)
 */

export const DB_NAME    = 'farroway_db';
export const DB_VERSION = 1;

export const STORE = Object.freeze({
  FARM:     'farm',
  PROGRESS: 'progress',
  QUEUE:    'queue',
});

/* ─── Internal: open + cache the database ───────────────────────── */

let _dbPromise = null;

function _idbAvailable() {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/**
 * Lazily open the database. Cached on first call. Resolves to null
 * when IndexedDB isn't available - callers fall back to safe defaults.
 */
export function dbPromise() {
  if (_dbPromise) return _dbPromise;
  if (!_idbAvailable()) {
    _dbPromise = Promise.resolve(null);
    return _dbPromise;
  }
  _dbPromise = new Promise((resolve) => {
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch { return resolve(null); }

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE.FARM))     db.createObjectStore(STORE.FARM);
      if (!db.objectStoreNames.contains(STORE.PROGRESS)) db.createObjectStore(STORE.PROGRESS);
      if (!db.objectStoreNames.contains(STORE.QUEUE))    db.createObjectStore(STORE.QUEUE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return _dbPromise;
}

/** Wrap an IDBRequest in a promise. Resolves to undefined on error
 *  rather than rejecting - sync paths must never crash. */
function _req(request) {
  return new Promise((resolve) => {
    if (!request) return resolve(undefined);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => resolve(undefined);
  });
}

async function _withStore(name, mode, fn, fallback) {
  const db = await dbPromise();
  if (!db) return fallback;
  try {
    const tx    = db.transaction(name, mode);
    const store = tx.objectStore(name);
    return await fn(store);
  } catch {
    return fallback;
  }
}

/* ─── Public helpers ────────────────────────────────────────────── */

/**
 * dbSet(store, key, value)
 *
 * For out-of-line stores (farm, progress) the key is the second
 * argument. For in-line stores (queue, keyPath: 'id') pass null as
 * key and put the id on the value.
 */
export function dbSet(store, key, value) {
  return _withStore(store, 'readwrite', (s) => {
    return _req(key == null ? s.put(value) : s.put(value, key));
  }, undefined);
}

export function dbGet(store, key) {
  return _withStore(store, 'readonly', (s) => _req(s.get(key)), undefined);
}

export function dbGetAll(store) {
  return _withStore(store, 'readonly', (s) => _req(s.getAll()), []);
}

export function dbDelete(store, key) {
  return _withStore(store, 'readwrite', (s) => _req(s.delete(key)), undefined);
}

export function dbClear(store) {
  return _withStore(store, 'readwrite', (s) => _req(s.clear()), undefined);
}

/* ─── Queue-specific shortcuts (in-line key) ────────────────────── */

export function dbAddQueue(item) {
  if (!item || !item.id) return Promise.resolve(undefined);
  return _withStore(STORE.QUEUE, 'readwrite', (s) => _req(s.put(item)), undefined);
}

export function dbGetQueue() {
  return _withStore(STORE.QUEUE, 'readonly', (s) => _req(s.getAll()), []);
}

export function dbDeleteQueue(id) {
  if (id == null) return Promise.resolve(undefined);
  return _withStore(STORE.QUEUE, 'readwrite', (s) => _req(s.delete(id)), undefined);
}

/* ─── Test helper (unit-tests + dev tools only) ─────────────────── */

/** Forget the cached connection so the next call re-opens. */
export function _resetDbForTests() {
  _dbPromise = null;
}
