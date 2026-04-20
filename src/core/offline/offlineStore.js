/**
 * offlineStore.js — spec §8. Minimal key/value wrapper that
 * stores JSON-safe data only, timestamps every write, and
 * returns `{ data, lastUpdatedAt }` reads.
 *
 * Backend is injectable — defaults to localStorage, but tests
 * (and native WebViews) can pass a mock.
 *
 * Keys are namespaced with `farroway.offline.` so they can't
 * collide with the auth token / legacy caches.
 */

const NAMESPACE = 'farroway.offline.';

function defaultBackend() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage || null; } catch { return null; }
}

function nsKey(key) {
  if (typeof key !== 'string' || !key) return null;
  return NAMESPACE + key;
}

/**
 * saveOffline(key, data, opts?) → { ok, at } | { ok: false, reason }
 *
 * Stores `{ data, at }` JSON-encoded. Rejects non-JSON-safe
 * values (circular refs, undefined-only) cleanly.
 */
export function saveOffline(key, data, opts = {}) {
  const full = nsKey(key);
  if (!full) return { ok: false, reason: 'bad_key' };
  const backend = opts.backend || defaultBackend();
  if (!backend) return { ok: false, reason: 'no_backend' };
  try {
    const at = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const wrapped = { data, at, v: 1 };
    backend.setItem(full, JSON.stringify(wrapped));
    return { ok: true, at };
  } catch (err) {
    return { ok: false, reason: 'serialize_failed', message: err?.message || 'unknown' };
  }
}

/**
 * getOffline(key, opts?) → { data, lastUpdatedAt, ageMs } | null
 *
 * Returns null on missing, malformed, or wrong-version entries.
 * Never throws.
 */
export function getOffline(key, opts = {}) {
  const full = nsKey(key);
  if (!full) return null;
  const backend = opts.backend || defaultBackend();
  if (!backend) return null;
  try {
    const raw = backend.getItem(full);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.v !== 1) return null;
    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const at = Number(parsed.at);
    return {
      data: parsed.data,
      lastUpdatedAt: Number.isFinite(at) ? at : null,
      ageMs: Number.isFinite(at) ? Math.max(0, now - at) : null,
    };
  } catch {
    return null;
  }
}

/** clearOffline — remove one key. Never throws. */
export function clearOffline(key, opts = {}) {
  const full = nsKey(key);
  if (!full) return false;
  const backend = opts.backend || defaultBackend();
  if (!backend) return false;
  try { backend.removeItem(full); return true; }
  catch { return false; }
}

/**
 * isStale — true when age exceeds threshold. `null` (no entry
 * or unknown age) counts as stale so callers degrade safely.
 */
export function isStale(entry, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!entry || typeof entry !== 'object') return true;
  if (entry.ageMs == null) return true;
  return entry.ageMs > maxAgeMs;
}

export const OFFLINE_KEYS = Object.freeze({
  LAST_FARM:      'last_farm',
  LAST_TASKS:     'last_tasks',
  LAST_WEATHER:   'last_weather',
  LAST_HOME:      'last_home',
});

export const _internal = { NAMESPACE };
