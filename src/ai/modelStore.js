/**
 * modelStore.js — load + cache trained model JSON; fall back to
 * the cold-start defaults when no model is wired yet.
 *
 *   loadModel(task, opts?)             async; returns a valid
 *                                       modelSpec
 *   getCachedModel(task)               sync; cache or default
 *   saveModelToCache(task, modelSpec)  persist a freshly-fetched
 *                                       model so reloads are
 *                                       offline-friendly
 *
 * Tasks: 'pest' | 'drought'.
 *
 * Storage: localStorage `farroway_model_<task>`.
 * Source : a static JSON file shipped at /models/<task>.json
 *          (the Python pipeline writes there). Network failure
 *          falls back to cache; cache miss falls back to the
 *          cold-start defaults from modelSpec.js.
 *
 * Strict-rule audit
 *   * works offline: cache + cold-start defaults make the
 *     predictor usable on day one
 *   * never throws: every IO call try/catch wrapped
 *   * lightweight: one tiny JSON per task
 *   * structured: validates loaded JSON via isValidModelSpec
 *     before adopting it
 */

import {
  PEST_DEFAULT_MODEL,
  DROUGHT_DEFAULT_MODEL,
  isValidModelSpec,
} from './modelSpec.js';

const TASK = Object.freeze({ PEST: 'pest', DROUGHT: 'drought' });

const DEFAULTS = Object.freeze({
  [TASK.PEST]:    PEST_DEFAULT_MODEL,
  [TASK.DROUGHT]: DROUGHT_DEFAULT_MODEL,
});

const URLS = Object.freeze({
  [TASK.PEST]:    '/models/pest.json',
  [TASK.DROUGHT]: '/models/drought.json',
});

function _cacheKey(task) { return `farroway_model_${task}`; }

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow */ }
}

function _safeRemove(key) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch { /* swallow */ }
}

function _normaliseTask(t) {
  const s = String(t || '').toLowerCase();
  return s === TASK.PEST || s === TASK.DROUGHT ? s : TASK.PEST;
}

/**
 * getCachedModel(task)
 *   -> modelSpec
 *
 * Synchronous read. Always returns a usable spec:
 *   1. cached + valid -> return it
 *   2. otherwise      -> return the cold-start default
 *
 * Render code can call this directly without awaiting.
 */
export function getCachedModel(task) {
  const t = _normaliseTask(task);
  const raw = _safeGet(_cacheKey(t));
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidModelSpec(parsed)) return parsed;
    } catch { /* fall through */ }
    _safeRemove(_cacheKey(t));
  }
  return DEFAULTS[t];
}

/**
 * saveModelToCache(task, modelSpec)
 *   Persist a model that arrived over the network (or via an
 *   admin upload). Validation runs first - bad JSON never
 *   replaces the cold-start defaults.
 */
export function saveModelToCache(task, modelSpec) {
  if (!isValidModelSpec(modelSpec)) return false;
  const t = _normaliseTask(task);
  try { _safeSet(_cacheKey(t), JSON.stringify(modelSpec)); return true; }
  catch { return false; }
}

/**
 * loadModel(task, opts?)
 *   -> Promise<modelSpec>
 *
 * Cache-first composer:
 *   1. Read cache. If a valid trained model is cached, return
 *      it immediately - never blocks.
 *   2. Attempt to fetch /models/<task>.json with a hard 5s
 *      abort.
 *   3. On success: validate, cache, return.
 *   4. On any failure: return the cached or cold-start spec.
 *
 * opts:
 *   force        bypass cache and refetch
 *   timeoutMs    fetch abort timeout (default 5000)
 */
export async function loadModel(task, opts = {}) {
  const { force = false, timeoutMs = 5000 } = opts || {};
  const t = _normaliseTask(task);

  if (!force) {
    // Use cache only if it's an actual trained model (cold-start
    // defaults are never cached).
    const cachedRaw = _safeGet(_cacheKey(t));
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (isValidModelSpec(cached)) return cached;
      } catch { /* fall through */ }
    }
  }

  if (typeof fetch !== 'function') return DEFAULTS[t];

  let ctl = null;
  try {
    if (typeof AbortController === 'function') {
      ctl = new AbortController();
      setTimeout(() => { try { ctl.abort(); } catch { /* swallow */ } }, timeoutMs);
    }
  } catch { /* ignore */ }

  let res;
  try { res = await fetch(URLS[t], ctl ? { signal: ctl.signal } : undefined); }
  catch { return getCachedModel(t); }
  if (!res || !res.ok) return getCachedModel(t);

  let json;
  try { json = await res.json(); }
  catch { return getCachedModel(t); }

  if (!isValidModelSpec(json)) return getCachedModel(t);
  saveModelToCache(t, json);
  return json;
}

/** Test / admin "clear cached models" helper. */
export function clearModelCache() {
  for (const t of Object.values(TASK)) _safeRemove(_cacheKey(t));
}

export const MODEL_TASK = TASK;
export const _internal = Object.freeze({ DEFAULTS, URLS, _cacheKey });
