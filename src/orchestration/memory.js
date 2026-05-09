/**
 * orchestration/memory — continuity memory for the orchestrator.
 *
 *   rememberShown(rec)  → mark a recommendation as shown
 *   wasRecentlyShown()  → suppress repeat within window
 *   forgetAll()         → reset (sign-out / debug)
 *
 * SPEC §8
 *   The orchestrator runs every time the Home/Tasks/Progress
 *   surfaces re-render, so without continuity memory it would
 *   re-show the same weather hint every minute. This module
 *   tracks the last recommendation per slot:
 *
 *     • last_recommendation_shown      (any slot)
 *     • last_recommendation_completed
 *     • last_scan_issue
 *     • last_soil_issue
 *     • last_weather_intervention
 *     • last_buyer_prompt
 *     • last_funding_prompt
 *
 *   Each slot keeps the most recent timestamp + a small
 *   identifying key (e.g. the recommendation's `kind:variant`
 *   id). The orchestrator queries `wasRecentlyShown(kind, key)`
 *   before re-rendering and falls through to a different
 *   priority candidate when the cooldown is active.
 *
 * STORAGE
 *   localStorage key: `farroway_orch_memory_v1`
 *   Shape: `{ slot: { key, timestamp } }`
 *   Corruption-safe + SSR-safe.
 *
 * COOLDOWNS (per slot, ms)
 *   weather:       4 h    — same rain/heat hint won't repeat all day
 *   task_nudge:    3 h
 *   scan_followup: 12 h
 *   soil_followup: 12 h
 *   buyer_prompt:  6 h
 *   funding:       24 h
 *   progress:      6 h
 *   default:       6 h
 *
 *   These are TIGHTER than the notification dedup cooldowns
 *   (which guard the push channel). The orchestration cooldowns
 *   guard the in-app card surface, where re-showing is even
 *   more annoying because the user is already looking at it.
 */

export const MEMORY_KEY = 'farroway_orch_memory_v1';

export const MEMORY_COOLDOWNS_MS = Object.freeze({
  weather:       4  * 60 * 60 * 1000,
  task_nudge:    3  * 60 * 60 * 1000,
  scan_followup: 12 * 60 * 60 * 1000,
  soil_followup: 12 * 60 * 60 * 1000,
  buyer_prompt:  6  * 60 * 60 * 1000,
  funding:       24 * 60 * 60 * 1000,
  progress:      6  * 60 * 60 * 1000,
  default:       6  * 60 * 60 * 1000,
});

function _read() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch { return {}; }
}

function _write(map) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MEMORY_KEY, JSON.stringify(map));
  } catch { /* quota / private mode — non-fatal */ }
}

function _now(when) {
  if (when instanceof Date) return when.getTime();
  if (Number.isFinite(when)) return when;
  return Date.now();
}

function _cooldownFor(kind) {
  const ms = MEMORY_COOLDOWNS_MS[String(kind)];
  return Number.isFinite(ms) ? ms : MEMORY_COOLDOWNS_MS.default;
}

/**
 * Mark `(kind, key)` as just shown to the user. The kind groups
 * a family of recommendations (e.g. "weather") so we don't
 * repeat across rain/heat/wind variants of the same idea.
 *
 * @param {string} kind  - 'weather' | 'task_nudge' | 'scan_followup' | …
 * @param {string} [key] - optional narrowing id (e.g. scan id)
 * @param {Date|number} [when]
 */
export function rememberShown(kind, key = '', when = Date.now()) {
  if (!kind) return;
  const map = _read();
  map[String(kind)] = { key: String(key || ''), timestamp: _now(when) };
  _write(map);
}

/**
 * True when `(kind, key)` was shown inside its cooldown window.
 * Optional `key` lets you require an exact match; without it,
 * any recent shown entry of the same kind suppresses.
 *
 * @returns {boolean}
 */
export function wasRecentlyShown(kind, key = '', when = Date.now()) {
  if (!kind) return false;
  const map = _read();
  const slot = map[String(kind)];
  if (!slot || !Number.isFinite(slot.timestamp)) return false;
  // If a key is supplied, only suppress when keys match — a
  // *different* scan-followup is still worth showing.
  if (key && slot.key !== String(key)) return false;
  const elapsed = _now(when) - slot.timestamp;
  return elapsed < _cooldownFor(kind);
}

/**
 * Read the last-shown record for a slot — used by the
 * orchestrator's prioritization rules ("did we already show
 * weather today? then prefer scan follow-up").
 *
 * @returns {{key:string, timestamp:number}|null}
 */
export function lastShown(kind) {
  if (!kind) return null;
  const map = _read();
  const slot = map[String(kind)];
  return (slot && Number.isFinite(slot.timestamp)) ? slot : null;
}

/**
 * Forget every memory slot — sign-out + test helper.
 */
export function forgetAll() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MEMORY_KEY);
    }
  } catch { /* swallow */ }
}

const _module = {
  MEMORY_KEY,
  MEMORY_COOLDOWNS_MS,
  rememberShown,
  wasRecentlyShown,
  lastShown,
  forgetAll,
};
export default _module;
