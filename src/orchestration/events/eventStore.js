/**
 * eventStore — ring buffer for orchestration events.
 *
 * Spec §1.
 *   • localStorage key: `farroway_orch_events_v1`
 *   • Capped at 500 events; oldest dropped first.
 *   • Tolerates corrupt JSON / quota / private mode.
 *   • SSR-safe (every storage access guarded).
 *   • Validates `type` against EVENT_TYPE_SET — unknown rejected.
 *
 * The orchestrator reads the recent tail to decide priorities;
 * the bus mirrors emissions here so consumers can replay if
 * they mounted late.
 */

import { EVENT_TYPE_SET } from './eventTypes.js';

export const STORAGE_KEY = 'farroway_orch_events_v1';
export const MAX_EVENTS  = 500;

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _write(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = list.length > MAX_EVENTS
      ? list.slice(list.length - MAX_EVENTS)
      : list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private-mode — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); }
  catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'oev_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'oev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Strip nested objects + arrays from a payload so localStorage
 * never holds large or sensitive blobs. The orchestrator only
 * needs flat hints anyway (rainProb, taskId, scanCategory…).
 */
function _safePayload(p) {
  if (!p || typeof p !== 'object') return {};
  const out = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v == null) continue;
    if (typeof v === 'string')  { out[k] = v.slice(0, 240); continue; }
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Append an event to the ring buffer. Idempotent on `id` —
 * a second append with the same id is a no-op.
 *
 * @param {object} event - partial event; this fn fills in id/timestamp.
 * @returns {object|null} the stored entry, or null if rejected.
 */
export function appendEvent(event) {
  const safe = (event && typeof event === 'object') ? event : {};
  const type = String(safe.type || '');
  if (!EVENT_TYPE_SET.has(type)) return null;

  const id = String(safe.id || _makeId());
  const list = _read();
  if (list.some((e) => e && e.id === id)) {
    return list.find((e) => e && e.id === id);
  }

  const entry = Object.freeze({
    id,
    userId:     safe.userId == null ? null : String(safe.userId),
    role:       safe.role == null ? null : String(safe.role).toLowerCase(),
    mode:       (safe.mode === 'farm' || safe.mode === 'garden') ? safe.mode : null,
    farmId:     safe.farmId == null ? null : String(safe.farmId),
    cropSlug:   safe.cropSlug == null ? null : String(safe.cropSlug),
    region:     safe.region == null ? null : String(safe.region),
    type,
    timestamp:  safe.timestamp || _isoNow(),
    source:     String(safe.source || ''),
    payload:    _safePayload(safe.payload),
    confidence: (safe.confidence === 'low' || safe.confidence === 'medium' || safe.confidence === 'high')
                  ? safe.confidence : null,
  });
  list.push(entry);
  _write(list);
  return entry;
}

/**
 * Most-recent-first slice of the ring buffer.
 */
export function getRecentEvents(limit = MAX_EVENTS) {
  const list = _read().slice().reverse();
  return list.slice(0, Math.max(0, Math.min(MAX_EVENTS, limit)));
}

/**
 * Return events of a specific type, newest-first.
 */
export function getEventsByType(type, limit = 50) {
  if (!type) return [];
  const out = [];
  const list = _read();
  for (let i = list.length - 1; i >= 0 && out.length < limit; i--) {
    if (list[i] && list[i].type === type) out.push(list[i]);
  }
  return out;
}

/**
 * Count events of a given type that fired inside `windowMs`.
 * Default window = 7 days.
 */
export function countEventsSince(type, windowMs = 7 * 24 * 60 * 60 * 1000) {
  if (!type) return 0;
  const cutoff = Date.now() - Math.max(0, windowMs);
  let n = 0;
  for (const e of _read()) {
    if (!e || e.type !== type) continue;
    const ts = Date.parse(e.timestamp || '');
    if (Number.isFinite(ts) && ts >= cutoff) n += 1;
  }
  return n;
}

/**
 * Clear the ring (sign-out / debug).
 */
export function clearEvents() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* swallow */ }
}

const _module = {
  STORAGE_KEY,
  MAX_EVENTS,
  appendEvent,
  getRecentEvents,
  getEventsByType,
  countEventsSince,
  clearEvents,
};
export default _module;
