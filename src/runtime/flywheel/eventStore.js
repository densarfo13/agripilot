/**
 * runtime/flywheel/eventStore.js — Phase 14 replay/offline-safe
 * event log helpers.
 *
 *   import {
 *     appendEvent, mergeEventLogs, replayEvents, dedupeEvents,
 *   } from 'src/runtime/flywheel/eventStore.js';
 *
 * What this is
 * ────────────
 *   Pure helpers around the event log. Does NOT hold state;
 *   callers (wave-5 single-writer persistence) own the log array.
 *
 *   • appendEvent(log, e)         — returns a new log with `e`
 *     appended, normalized + deduped.
 *   • mergeEventLogs(local, remote) — replay-safe merge for offline
 *     sync. Output is sorted by timestamp, deduped by eventId.
 *   • replayEvents(log, init, fn) — left-fold; for rebuilding
 *     materialized state (memory graphs) from the log.
 *   • dedupeEvents(log)           — removes duplicate eventIds,
 *     keeping the earliest occurrence.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Inputs are not mutated.
 *   • No persistence writes — caller owns the writer path.
 *   • Output arrays are frozen.
 */

import { normalizeEvent, validateEvent } from './eventEngine.js';

export const EVENT_STORE_VERSION = 'event-store-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _tsMs(e) {
  const t = _safe(() => new Date(_str(e && e.timestamp)).getTime(), NaN);
  return Number.isFinite(t) ? t : 0;
}

export function dedupeEvents(log) {
  return _safe(() => {
    const seen = new Set();
    const out  = [];
    for (const e of _arr(log)) {
      if (!_isObj(e)) continue;
      const id = _str(e.eventId);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(e);
    }
    return Object.freeze(out);
  }, Object.freeze([]));
}

export function appendEvent(log, raw) {
  return _safe(() => {
    const normalized = normalizeEvent(raw);
    if (!normalized) return Object.freeze(_arr(log).slice());
    const v = validateEvent(normalized);
    if (!v.ok) return Object.freeze(_arr(log).slice());
    // Reject duplicate eventId
    for (const e of _arr(log)) {
      if (_isObj(e) && e.eventId === normalized.eventId) {
        return Object.freeze(_arr(log).slice());
      }
    }
    return Object.freeze(_arr(log).concat([normalized]));
  }, Object.freeze(_arr(log).slice()));
}

export function mergeEventLogs(localLog, remoteLog) {
  return _safe(() => {
    const merged = _arr(localLog).concat(_arr(remoteLog));
    const deduped = dedupeEvents(merged);
    const sorted = deduped.slice().sort((a, b) => _tsMs(a) - _tsMs(b));
    return Object.freeze(sorted);
  }, Object.freeze([]));
}

/**
 * Left-fold the event log into a reducer. `init` is returned
 * unchanged if the log is empty or the reducer throws.
 */
export function replayEvents(log, init, reducer) {
  return _safe(() => {
    if (typeof reducer !== 'function') return init;
    let acc = init;
    for (const e of _arr(log)) {
      if (!_isObj(e)) continue;
      const next = _safe(() => reducer(acc, e), acc);
      acc = next === undefined ? acc : next;
    }
    return acc;
  }, init);
}
