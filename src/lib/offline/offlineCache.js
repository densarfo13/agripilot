/**
 * offlineCache.js — single source of truth for the small bundle of
 * cached farmer data we need to keep the app usable offline.
 *
 * Storage:
 *   localStorage['farroway.offlineCache.v1'] = {
 *     farm, user, language,
 *     tasks,           // today's plan (duplicate of dailyTasks.v1 for speed)
 *     farmSummary,     // { crop, stage, size, countryCode, farmType }
 *     weatherInsight,  // last weatherAction payload
 *     riskInsight,     // last riskInsight payload
 *     progress,        // { streak, score, todaySummary, nextAction }
 *     updatedAt: { … per key ISO strings … }
 *   }
 *
 * Writers call `updateCache({ key, value })` — they never mutate the
 * whole blob. Readers call `getCached(key)` — always returns
 * something (the default per-key) so callers can render without
 * branching.
 *
 * The cache is a *mirror* of server truth, not a replacement for
 * it. When the app is online, fresh data overwrites the cache on
 * every successful read. When offline, the cached version is what
 * the UI shows — stamped with "updated when online" from
 * `updatedAt`.
 */

const KEY = 'farroway.offlineCache.v1';

const DEFAULTS = Object.freeze({
  farm:            null,
  user:            null,
  language:        'en',
  tasks:           [],
  farmSummary:     null,
  weatherInsight:  null,
  riskInsight:     null,
  progress:        null,
});

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readRaw() {
  if (!hasStorage()) return { ...DEFAULTS, updatedAt: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULTS, updatedAt: {} };
    return {
      ...DEFAULTS, ...parsed,
      updatedAt: (parsed.updatedAt && typeof parsed.updatedAt === 'object')
        ? parsed.updatedAt : {},
    };
  } catch { return { ...DEFAULTS, updatedAt: {} }; }
}

function writeRaw(store) {
  if (!hasStorage()) return false;
  try { window.localStorage.setItem(KEY, JSON.stringify(store)); return true; }
  catch { return false; }
}

/**
 * updateCache — write a single key. Other keys are preserved.
 *
 *   updateCache({ key: 'farm', value: { id, name, crop, … } })
 */
export function updateCache({ key, value } = {}) {
  if (!key || !(key in DEFAULTS)) return null;
  const store = readRaw();
  store[key] = value;
  store.updatedAt = { ...(store.updatedAt || {}), [key]: new Date().toISOString() };
  writeRaw(store);
  return value;
}

/**
 * updateCacheBulk — write several keys at once. Useful right after
 * `/me` or a page-level data fetch resolves.
 */
export function updateCacheBulk(partial) {
  if (!partial || typeof partial !== 'object') return null;
  const store = readRaw();
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(partial)) {
    if (!(k in DEFAULTS)) continue;
    store[k] = v;
    store.updatedAt = { ...(store.updatedAt || {}), [k]: now };
  }
  writeRaw(store);
  return { ...store };
}

export function getCached(key) {
  const store = readRaw();
  if (key == null) return store;
  if (!(key in DEFAULTS)) return null;
  return store[key] === undefined ? DEFAULTS[key] : store[key];
}

export function getCacheUpdatedAt(key) {
  const store = readRaw();
  if (!store.updatedAt) return null;
  return store.updatedAt[key] || null;
}

export function clearCache() {
  if (!hasStorage()) return false;
  try { window.localStorage.removeItem(KEY); return true; }
  catch { return false; }
}

export const _internal = Object.freeze({ KEY, DEFAULTS });
