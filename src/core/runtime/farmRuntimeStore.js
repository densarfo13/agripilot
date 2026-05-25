/**
 * farmRuntimeStore.js — single source of truth for the Farroway
 * runtime state.
 *
 *   import {
 *     getRuntimeState, setRuntimeSlice, subscribe,
 *     SLICE,
 *   } from 'src/core/runtime/farmRuntimeStore.js';
 *
 *   subscribe('weather', (next) => render(next));
 *   setRuntimeSlice('weather', { temperatureC: 32, daysSinceRain: 8 });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small reactive in-memory store that holds the snapshot every
 *   intelligence module + surface reads from. No more "the scan
 *   module has its own weather cache, the home page has another."
 *
 *   It is NOT Redux / Zustand / MobX — just a typed object + a
 *   per-slice subscriber list. Tiny by design (≤ 200 lines) so a
 *   reviewer can audit the whole state surface in one read.
 *
 *   Persistence is OPT-IN: pass `{ persist: true }` to setRuntimeSlice
 *   to mirror the slice into localStorage. The store rehydrates each
 *   persisted slice at module load when localStorage is available.
 *
 *   It is NOT the eventBus (events fire on transitions /
 *   user-driven actions; the store holds the current snapshot).
 *   Pair the two: subscribe to a store slice for "render-on-change",
 *   subscribe to an event for "react-to-action".
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe (guards window + localStorage).
 *   • Subscriber list is cleaned on unsubscribe; no leaks.
 *   • No PII written to localStorage by default — surfaces opt in
 *     per slice and are responsible for excluding sensitive fields.
 */

export const SLICE = Object.freeze({
  USER:               'user',
  FARM:               'farm',
  CROP:               'crop',
  LIFECYCLE:          'lifecycle',
  WEATHER:            'weather',
  SOIL:               'soil',
  SCAN_HISTORY:       'scanHistory',
  DISEASE_STATE:      'diseaseState',
  COMPLETED_TASKS:    'completedTasks',
  PENDING_TASKS:      'pendingTasks',
  MARKETPLACE:        'marketplace',
  SUPPLIER:           'supplier',
  FUNDING:            'funding',
  NGO:                'ngo',
  LANGUAGE:           'language',
  NETWORK:            'network',
  OFFLINE_QUEUE:      'offlineQueue',
  RECOMMENDATION_MEMORY: 'recommendationMemory',
  LAST_BEST_ACTION:   'lastBestAction',
  SUPPRESSION_HISTORY:'suppressionHistory',
  INTELLIGENCE_FLAGS: 'intelligenceFlags',
});

const _VALID = new Set(Object.values(SLICE));
const _LS_PREFIX = 'farroway_runtime_';

function _safeLs() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

function _rehydrate() {
  const ls = _safeLs();
  if (!ls) return {};
  const out = {};
  for (const slice of _VALID) {
    try {
      const raw = ls.getItem(_LS_PREFIX + slice);
      if (raw == null) continue;
      out[slice] = JSON.parse(raw);
    } catch { /* skip corrupt slice */ }
  }
  return out;
}

// In-memory state — initialised from localStorage when present.
const _state = Object.create(null);
Object.assign(_state, _rehydrate());

// Per-slice subscriber sets.
const _subscribers = Object.create(null);

/**
 * Get the full state snapshot OR a single slice.
 *
 * @param {string} [slice]
 * @returns {object}
 */
export function getRuntimeState(slice) {
  try {
    if (slice == null) {
      // Return a shallow clone so callers can't mutate internal state.
      const out = {};
      for (const k of Object.keys(_state)) out[k] = _state[k];
      return out;
    }
    if (!_VALID.has(slice)) return undefined;
    return _state[slice];
  } catch { return slice == null ? {} : undefined; }
}

/**
 * Replace a slice + notify its subscribers. Pass `{ persist: true }`
 * to mirror the slice into localStorage.
 *
 * @param {string} slice
 * @param {any} value
 * @param {{ persist?: boolean }} [opts]
 * @returns {boolean}
 */
export function setRuntimeSlice(slice, value, opts) {
  try {
    if (!_VALID.has(slice)) return false;
    _state[slice] = value;
    if (opts && opts.persist) {
      const ls = _safeLs();
      if (ls) {
        try { ls.setItem(_LS_PREFIX + slice, JSON.stringify(value)); }
        catch { /* quota or serialise error — silently skip */ }
      }
    }
    const subs = _subscribers[slice];
    if (subs) {
      for (const fn of Array.from(subs)) {
        try { fn(value); } catch { /* never let one subscriber break others */ }
      }
    }
    return true;
  } catch { return false; }
}

/**
 * Patch a slice (shallow merge into existing object value). Returns
 * the new value or null on bad input.
 */
export function patchRuntimeSlice(slice, partial, opts) {
  try {
    if (!_VALID.has(slice)) return null;
    const prev = _state[slice];
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(prev) || !isObj(partial)) {
      // Fall back to replace when either side isn't an object.
      setRuntimeSlice(slice, partial, opts);
      return _state[slice];
    }
    const next = { ...prev, ...partial };
    setRuntimeSlice(slice, next, opts);
    return next;
  } catch { return null; }
}

/**
 * Subscribe to a slice. Returns an unsubscribe function.
 *
 * @param {string} slice
 * @param {(value: any) => void} handler
 * @returns {() => void}  unsubscribe
 */
export function subscribe(slice, handler) {
  try {
    if (!_VALID.has(slice) || typeof handler !== 'function') return () => {};
    if (!_subscribers[slice]) _subscribers[slice] = new Set();
    _subscribers[slice].add(handler);
    return () => {
      try { _subscribers[slice].delete(handler); } catch { /* ignore */ }
    };
  } catch { return () => {}; }
}

/**
 * Reset the in-memory store. localStorage retained unless `clearLs`
 * is true. Test-only helper.
 */
export function _resetRuntimeStoreForTests({ clearLs = false } = {}) {
  for (const k of Object.keys(_state)) delete _state[k];
  for (const k of Object.keys(_subscribers)) delete _subscribers[k];
  if (clearLs) {
    const ls = _safeLs();
    if (ls) {
      for (const slice of _VALID) {
        try { ls.removeItem(_LS_PREFIX + slice); } catch { /* ignore */ }
      }
    }
  }
}

const _module = {
  SLICE,
  getRuntimeState, setRuntimeSlice, patchRuntimeSlice, subscribe,
  _resetRuntimeStoreForTests,
};
export default _module;
