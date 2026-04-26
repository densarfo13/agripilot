/**
 * localStore.js — tiny generic key/value store on top of
 * localStorage, used by the new local-first farmer surfaces.
 *
 * Why this exists alongside the heavier stores
 * ────────────────────────────────────────────
 * Farroway already has:
 *   • src/store/farrowayLocal.js — domain-specific helpers for
 *     task completions, feedback, and dismissed alerts; written
 *     directly via dedicated functions.
 *   • src/utils/offlineQueue.js / src/lib/sync/* — IndexedDB
 *     mutation queue with retries / abandonment.
 *
 * Neither is a fit when a new farmer-facing component just wants
 * a tiny "load this row → render → save it back" loop without
 * inventing a domain helper for every field. THIS module is that
 * minimal seam:
 *
 *   import { loadData, saveData, updateData } from '../store/localStore.js';
 *
 *   const farms = loadData('farms', []);
 *   saveData('farms', nextFarms);
 *   updateData('farms', (cur) => [...cur, newFarm]);
 *
 * Storage shape
 * ─────────────
 *   localStorage[`farroway:store:${key}`] = JSON.stringify(value)
 *
 * The `farroway:store:` prefix namespaces these entries so they
 * coexist with the project's other localStorage keys (lang,
 * lowLiteracyMode, offline queue, etc.) without colliding.
 *
 * Behaviour rules
 * ───────────────
 *   • Never throws. Quota exhaustion / corrupt JSON / private-mode
 *     all degrade silently to the in-memory default.
 *   • Every write dispatches `farroway:localstore:change` with
 *     `{ detail: { key } }` so subscribed components can re-render
 *     without polling. Use `subscribe(key, fn)` to consume.
 *   • `removeData(key)` clears a single entry; `clearAll()` wipes
 *     every namespaced entry but leaves untouched non-store
 *     localStorage keys.
 *   • Writes that would persist `undefined` are coerced to `null`
 *     so the JSON round-trip stays loss-free.
 */

const PREFIX = 'farroway:store:';
const EVENT  = 'farroway:localstore:change';

/**
 * safeParse — JSON.parse that NEVER throws. Used by `loadData` here
 * and by other modules that need to read potentially-corrupt
 * localStorage payloads. Re-exported so callers don't have to
 * duplicate the try/catch.
 *
 * Per HOTFIX requirement: a corrupt JSON value must not be allowed
 * to crash the React render tree. Returning `fallback` keeps the UI
 * alive; a single console.warn surfaces the issue in dev without
 * spamming on every re-render.
 */
export function safeParse(raw, fallback = null) {
  try {
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch (err) {
    try { console.warn('[storage parse failed]', err && err.message); }
    catch { /* never propagate from a warn */ }
    return fallback;
  }
}

function _key(name) {
  return PREFIX + String(name || '');
}

function _emit(name) {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: { key: name } }));
    }
  } catch { /* ignore */ }
}

/**
 * Read a value. When the slot is empty / corrupt / unavailable,
 * returns the supplied `fallback` (defaults to `null`).
 */
export function loadData(name, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(_key(name));
    return safeParse(raw, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Replace the whole value. `undefined` is coerced to `null` so the
 * read path doesn't need a separate undefined branch.
 */
export function saveData(name, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const v = value === undefined ? null : value;
    localStorage.setItem(_key(name), JSON.stringify(v));
    _emit(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Functional update. Reads the current value (with fallback),
 * passes it to `updater`, persists the result. Returns the new
 * value, or null on storage error.
 *
 *   updateData('farms', (list) => [...(list || []), newFarm]);
 */
export function updateData(name, updater, fallback = null) {
  if (typeof updater !== 'function') return null;
  let next = null;
  try {
    const cur = loadData(name, fallback);
    next = updater(cur);
  } catch {
    next = fallback;
  }
  saveData(name, next);
  return next;
}

/** Remove a single namespaced entry. */
export function removeData(name) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(_key(name));
    _emit(name);
  } catch { /* ignore */ }
}

/** Wipe every namespaced entry (does not touch non-store keys). */
export function clearAll() {
  try {
    if (typeof localStorage === 'undefined') return;
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
    _emit('*');
  } catch { /* ignore */ }
}

/**
 * Subscribe to writes against a specific key (or '*' for all).
 * Returns an unsubscribe function. Compatible with React `useEffect`
 * cleanup contracts.
 */
export function subscribe(name, handler) {
  if (typeof handler !== 'function' || typeof window === 'undefined') {
    return () => {};
  }
  const filter = String(name || '*');
  const listener = (e) => {
    const k = e?.detail?.key;
    if (filter === '*' || k === filter) {
      try { handler(loadData(k)); } catch { /* never propagate */ }
    }
  };
  window.addEventListener(EVENT, listener);
  // Cross-tab sync: storage events fire on writes from other tabs.
  const storageListener = (e) => {
    if (!e || !e.key || !e.key.startsWith(PREFIX)) return;
    const k = e.key.slice(PREFIX.length);
    if (filter === '*' || k === filter) {
      try { handler(loadData(k)); } catch { /* never propagate */ }
    }
  };
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', storageListener);
  };
}
