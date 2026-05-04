/**
 * storageSafe.js — single safety layer for every localStorage
 * read/write the app does. NEVER call `JSON.parse` directly
 * on a localStorage value anywhere else in the codebase.
 *
 *   import {
 *     safeJsonParse, safeJsonSet,
 *     validateFarm, validateTask, validateWeather,
 *     removeFarrowayState,
 *   } from './lib/storageSafe.js';
 *
 *   const farm = safeJsonParse('farroway_active_farm', null);
 *   if (!validateFarm(farm)) { ... use default ... }
 *
 * Why this exists
 *   Render-time TypeErrors after a deploy or partial cache reset
 *   were caused by:
 *     • localStorage values that didn't parse as JSON
 *     • values that parsed but had the wrong shape
 *     • components reading nested fields without optional
 *       chaining
 *   This module collapses all three into one well-tested helper
 *   so consumer code never has to think about it.
 *
 * Strict-rule audit
 *   • Synchronous; never throws.
 *   • Bad data ALWAYS returns the caller's fallback — never
 *     surfaces a parse error to React.
 *   • Auth keys are excluded from removeFarrowayState() so the
 *     user is NEVER signed out by a state-cleanup pass.
 *   • The validators are forgiving by design — they accept "good
 *     enough" shapes (e.g. a crop string OR `{ name: 'tomato' }`)
 *     so old client data from earlier deploys still validates.
 */

// ─── Known app-state keys ───────────────────────────────────
//
// These are the only keys removeFarrowayState() touches. Auth-
// related keys are explicitly NOT in this list — they stay put
// across every reset path so the user remains signed in.

export const FARROWAY_STATE_KEYS = Object.freeze([
  'farroway_active_farm',
  'farroway_location',
  'farroway_events',
  'farroway_user_memory',
  'farroway_farmer_source',
  'farroway_sync_queue',
  'farroway_cached_tasks',
  'farroway_cached_weather',
  'farroway_offline_state',
  'farroway_selected_crop',
  'farroway_crop_stage',
]);

// Auth keys preserved across every reset.
export const FARROWAY_AUTH_KEYS = Object.freeze([
  'farroway_token',
  'farroway_user',
  'farroway_refresh',
  'farroway_step_up',
  'auth_token',
]);

// ─── safeJsonParse(key, fallback) ────────────────────────────
//
// Reads a localStorage value, JSON.parses it, returns the result
// when valid OR returns `fallback` when the value is missing /
// unparseable. On parse failure the bad key is REMOVED so the
// next reader sees a clean slate.

export function safeJsonParse(key, fallback = null) {
  if (typeof key !== 'string' || !key) return fallback;
  if (typeof localStorage === 'undefined') return fallback;
  let raw;
  try { raw = localStorage.getItem(key); } catch { return fallback; }
  if (raw == null) return fallback;
  try {
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    try { localStorage.removeItem(key); } catch { /* tolerate */ }
    return fallback;
  }
}

// ─── safeJsonSet(key, value) ────────────────────────────────
//
// JSON.stringifies value into localStorage. Returns true on
// success, false on any failure (locked storage / quota /
// circular ref). Never throws.

export function safeJsonSet(key, value) {
  if (typeof key !== 'string' || !key) return false;
  if (typeof localStorage === 'undefined') return false;
  try {
    const s = JSON.stringify(value);
    if (typeof s !== 'string') return false;
    localStorage.setItem(key, s);
    return true;
  } catch { return false; }
}

// ─── removeFarrowayState() ──────────────────────────────────
//
// Removes EVERY key in FARROWAY_STATE_KEYS plus any key whose
// name starts with `farroway_sync` / `farroway_cache` /
// `farroway_offline` (those proliferate over time). Auth keys
// are protected. Returns the count of keys removed.

export function removeFarrowayState() {
  if (typeof localStorage === 'undefined') return 0;
  let removed = 0;
  // Pass 1: explicit list.
  for (const k of FARROWAY_STATE_KEYS) {
    try {
      if (localStorage.getItem(k) != null) {
        localStorage.removeItem(k);
        removed += 1;
      }
    } catch { /* tolerate */ }
  }
  // Pass 2: pattern sweep for keys we don't enumerate explicitly
  // (sync queues, cache shards, offline ledgers).
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (typeof k !== 'string') continue;
      if (FARROWAY_AUTH_KEYS.includes(k)) continue;
      if (k === 'farroway_ui_version' || k === 'farroway_state_version') continue;
      if (k.startsWith('farroway_sync')
       || k.startsWith('farroway_cache')
       || k.startsWith('farroway_offline')) {
        drop.push(k);
      }
    }
    for (const k of drop) {
      try { localStorage.removeItem(k); removed += 1; } catch { /* tolerate */ }
    }
  } catch { /* swallow */ }
  return removed;
}

// ─── Shape validators ───────────────────────────────────────
//
// Forgiving. Each one returns `true` when the value is "shaped
// well enough" for the renderer to read without crashing.
// Every consumer is expected to use the value via getDisplayText
// or optional chaining — these validators just keep obviously
// broken shapes (arrays, strings, primitives) from being
// treated as a structured object.

function _isPlainObject(v) {
  return v !== null
    && typeof v === 'object'
    && !Array.isArray(v);
}

export function validateFarm(data) {
  if (!_isPlainObject(data)) return false;
  // Accept any farm-ish object. We don't require id+name+crop
  // because legacy clients only stored a subset; the renderer
  // pairs every read with getDisplayText / optional chaining.
  // The crop field is allowed to be a string OR an object OR null.
  if ('crop' in data) {
    const c = data.crop;
    if (c != null
        && typeof c !== 'string'
        && typeof c !== 'number'
        && typeof c !== 'object') return false;
  }
  if ('location' in data) {
    const l = data.location;
    if (l != null
        && typeof l !== 'string'
        && typeof l !== 'number'
        && typeof l !== 'object') return false;
  }
  return true;
}

export function validateTask(data) {
  if (!_isPlainObject(data)) return false;
  // A task only needs a renderable label. Title preferred; some
  // older payloads used `todayTaskTitle`. Either is fine.
  const hasLabel = (typeof data.title === 'string' && data.title.length > 0)
                || (typeof data.todayTaskTitle === 'string' && data.todayTaskTitle.length > 0)
                || (typeof data.primaryAction === 'string' && data.primaryAction.length > 0);
  return hasLabel;
}

export function validateWeather(data) {
  if (!_isPlainObject(data)) return false;
  // We accept any of the common shapes our weather adapters emit:
  //   • { temp, condition, ... }
  //   • { tempHighC, tempLowC, ... }
  //   • { summary, ... }
  // — anything that gives the renderer at least one truthy field.
  if ('temp' in data && (typeof data.temp === 'number' || data.temp == null)) return true;
  if ('tempHighC' in data) return true;
  if (typeof data.condition === 'string') return true;
  if (typeof data.summary === 'string') return true;
  return false;
}

// Test hooks.
export const _internal = Object.freeze({
  _isPlainObject,
});

export default {
  safeJsonParse,
  safeJsonSet,
  removeFarrowayState,
  validateFarm,
  validateTask,
  validateWeather,
  FARROWAY_STATE_KEYS,
  FARROWAY_AUTH_KEYS,
};
