/**
 * verificationDB.js — IndexedDB-backed photo storage for
 * the v3 Verification System.
 *
 *   await putPhoto(id, blob)  → 'idb:<id>'  (sentinel)
 *   await getPhoto(id)        → Blob | null
 *   await deletePhoto(id)     → boolean
 *
 * Why this exists
 * ───────────────
 *   The first cut of verificationStore stored photos as
 *   data URLs in localStorage with a 200 KB cap. That kept
 *   the 5 MB quota safe but threw away most of the photo
 *   evidence on real-world devices (a single phone shot is
 *   2–4 MB). This module persists Blobs in IndexedDB
 *   (~50 % of disk quota on most browsers) so a pilot can
 *   carry hundreds of full-resolution photos without
 *   pressure.
 *
 *   The store keeps a `photoUrl: 'idb:<id>'` sentinel on
 *   the VerificationRecord; `getPhoto(id)` resolves the
 *   actual blob when a UI needs to render it. No UI today
 *   renders the photo (admin surfaces only show the badge
 *   level), but the wiring is in place for when one does.
 *
 * Strict-rule audit
 *   * Never throws. Every IDB call is try/catch wrapped
 *     and falls through to a no-op return on failure
 *     (private mode, quota, locked DB). Caller treats
 *     `null` return as "no photo".
 *   * Single object store (`photos`) keyed on the
 *     verificationId — keeps the schema trivially
 *     migratable.
 *   * Soft-fail open + graceful degradation: when IDB is
 *     unavailable the store falls back to data URLs in
 *     localStorage with the original 200 KB cap.
 */

const DB_NAME    = 'farroway_verification';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

let _dbPromise = null;
let _ENABLED   = true;          // flips off after the first hard failure

/**
 * Open (or create) the database. Memoised — repeat calls
 * return the same promise. Resolves null when IDB is
 * unavailable.
 */
function _openDb() {
  if (!_ENABLED) return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;

  if (typeof indexedDB === 'undefined') {
    _ENABLED = false;
    return Promise.resolve(null);
  }

  _dbPromise = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch { _ENABLED = false; resolve(null); return; }

    req.onerror = () => {
      // Private mode / blocked / corrupt DB. Disable for the
      // session so we don't keep retrying.
      _ENABLED = false;
      resolve(null);
    };

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);     // keyed by id (string)
      }
    };

    req.onsuccess = (e) => {
      try { resolve(e.target.result); }
      catch { _ENABLED = false; resolve(null); }
    };
  });

  return _dbPromise;
}

function _withStore(mode, fn) {
  return _openDb().then((db) => {
    if (!db) return null;
    return new Promise((resolve) => {
      let tx;
      try { tx = db.transaction(STORE_NAME, mode); }
      catch { resolve(null); return; }
      const store = tx.objectStore(STORE_NAME);
      let result = null;
      try { result = fn(store); }
      catch { resolve(null); return; }
      tx.oncomplete = () => resolve(result);
      tx.onerror    = () => resolve(null);
      tx.onabort    = () => resolve(null);
    });
  });
}

/**
 * Persist a Blob/File at the given key. Returns the
 * sentinel reference that the verificationStore stores in
 * `photoUrl`. Returns null when storage is unavailable —
 * caller should keep the record without a photo (level 0/1/2).
 */
export async function putPhoto(id, blob) {
  if (!id || !blob) return null;
  if (!(blob instanceof Blob)) return null;

  // The actual put is wrapped in a request callback so we
  // can capture the request error separately from the
  // transaction abort.
  return new Promise((resolve) => {
    _openDb().then((db) => {
      if (!db) { resolve(null); return; }
      let tx;
      try { tx = db.transaction(STORE_NAME, 'readwrite'); }
      catch { resolve(null); return; }
      const store = tx.objectStore(STORE_NAME);
      let req;
      try { req = store.put(blob, id); }
      catch { resolve(null); return; }
      req.onsuccess = () => resolve(`idb:${id}`);
      req.onerror   = () => resolve(null);
      tx.onabort    = () => resolve(null);
    });
  });
}

/**
 * Retrieve a Blob by id. Returns null on miss or any failure.
 */
export async function getPhoto(id) {
  if (!id) return null;
  // Strip the optional 'idb:' prefix so callers can pass
  // either the raw id or the sentinel.
  const key = String(id).replace(/^idb:/, '');
  return new Promise((resolve) => {
    _openDb().then((db) => {
      if (!db) { resolve(null); return; }
      let tx;
      try { tx = db.transaction(STORE_NAME, 'readonly'); }
      catch { resolve(null); return; }
      const store = tx.objectStore(STORE_NAME);
      let req;
      try { req = store.get(key); }
      catch { resolve(null); return; }
      req.onsuccess = () => {
        const v = req.result;
        resolve(v instanceof Blob ? v : null);
      };
      req.onerror   = () => resolve(null);
    });
  });
}

/**
 * Best-effort delete — used when the parent verification
 * record is removed. Never throws.
 */
export async function deletePhoto(id) {
  if (!id) return false;
  const key = String(id).replace(/^idb:/, '');
  return _withStore('readwrite', (store) => {
    try { store.delete(key); } catch { /* ignore */ }
    return true;
  }).then((v) => Boolean(v));
}

/**
 * Returns true when IndexedDB is reachable on this device.
 * Used by the store to decide whether to write a Blob (IDB)
 * or fall back to a data URL (localStorage).
 */
export async function isAvailable() {
  const db = await _openDb();
  return Boolean(db);
}
