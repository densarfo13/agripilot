/**
 * feedbackLoop — local-first event store for the optimization loop.
 *
 * SPEC §5 + §11
 *   • Stores user-outcome events in a single localStorage slot:
 *       farroway_intelligence_events_v1
 *   • Capped at 500 events; oldest dropped first.
 *   • Never throws on quota / private-mode / corrupt JSON.
 *   • SSR-safe (every storage access is guarded).
 *   • Exposes pure read helpers so other engines can compute
 *     lightweight ranking heuristics WITHOUT a backend round-trip.
 *
 * SAFETY
 *   • No PII. Events carry only event-name + opaque metadata.
 *   • The optimizer NEVER auto-deletes / auto-publishes / auto-
 *     contacts buyers — it only ranks. See optimization.js
 *     guardrails (spec §14).
 */

import { OUTCOME_EVENT, SOURCE } from './intelligenceTypes.js';

export const STORAGE_KEY = 'farroway_intelligence_events_v1';
export const MAX_EVENTS  = 500;

// ─── Private storage helpers ─────────────────────────────────────

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
    const trimmed = list.length > MAX_EVENTS ? list.slice(list.length - MAX_EVENTS) : list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private mode — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _safeMeta(meta) {
  if (!meta || typeof meta !== 'object') return {};
  // Strip any value that is itself an object/array deeper than
  // one level — we never want to store nested PII or large
  // payloads in a localStorage event ring.
  const out = {};
  for (const k of Object.keys(meta)) {
    const v = meta[k];
    if (v == null) continue;
    if (typeof v === 'string')   { out[k] = v.slice(0, 240); continue; }
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
      continue;
    }
    // Skip arrays / nested objects — caller should flatten.
  }
  return out;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Record a user-outcome event. Idempotent on `eventId` when the
 * caller supplies one.
 *
 * @param {object} event
 * @param {string} event.type            - one of OUTCOME_EVENT.*
 * @param {string} [event.id]            - opt — caller-supplied id
 * @param {string} [event.source]        - default: SOURCE.USER_OUTCOME
 * @param {object} [event.meta]          - small flat metadata (max 240 char strings)
 * @returns {object} the stored entry
 */
export function recordUserOutcome(event = {}) {
  const safe = (event && typeof event === 'object') ? event : {};
  const type = String(safe.type || '');
  if (!type) return null;

  // Reject anything that isn't on the allow-list. Unknown event
  // names slipping in here would break ranking heuristics, so we
  // keep the surface tight.
  const allowed = new Set(Object.values(OUTCOME_EVENT));
  if (!allowed.has(type)) return null;

  const id = String(safe.id || (`evt_` + Date.now().toString(36) + '_'
    + Math.random().toString(36).slice(2, 8)));
  const list = _read();
  if (list.some((e) => e && e.id === id)) {
    return list.find((e) => e && e.id === id);
  }

  const entry = Object.freeze({
    id,
    type,
    source:    String(safe.source || SOURCE.USER_OUTCOME),
    timestamp: _isoNow(),
    meta:      _safeMeta(safe.meta),
  });
  list.push(entry);
  _write(list);
  return entry;
}

/**
 * All stored events, newest-first. Never throws.
 * @returns {Array<object>}
 */
export function getRecentEvents(limit = MAX_EVENTS) {
  const list = _read().slice().reverse();
  return list.slice(0, Math.max(0, Math.min(MAX_EVENTS, limit)));
}

/**
 * Count how many events of a given type happened in the last N
 * milliseconds. Used by ranking heuristics — e.g. an action that
 * the user has IGNORED 3 times in the last week should be down-
 * ranked next time the orchestrator considers it.
 *
 * @param {string} type
 * @param {number} [windowMs] - default 7 days
 * @returns {number}
 */
export function countRecent(type, windowMs = 7 * 24 * 60 * 60 * 1000) {
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
 * Clear all stored events. Intended for sign-out or test setup;
 * never called from app code automatically.
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
  recordUserOutcome,
  getRecentEvents,
  countRecent,
  clearEvents,
};
export default _module;
