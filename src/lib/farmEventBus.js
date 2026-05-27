/**
 * farmEventBus.js — typed pub/sub event bus + built-in event log
 * for the event-driven intelligence architecture.
 *
 *   import { FarmEvents, publish, subscribe } from './farmEventBus.js';
 *
 *   const unsub = subscribe(FarmEvents.SCAN_COMPLETED, (payload) => {
 *     // do work
 *   });
 *
 *   publish(FarmEvents.SCAN_COMPLETED, { scanId, severity, crop });
 *
 *   unsub();   // cleanup
 *
 * Why a bus
 * ──────────
 *   The codebase has grown by feature, with each surface (scan,
 *   tasks, weather, journal, briefing) reading from its own store
 *   and re-deriving signals. The event bus lets new features plug
 *   into existing flows WITHOUT each surface having to know who's
 *   listening. Adoption is INCREMENTAL — existing code keeps
 *   working unchanged; new wiring sits next to the old calls.
 *
 *   We deliberately ship a small, in-process, synchronous bus.
 *   The spec lists "background AI workers" but starting with the
 *   sync bus + a tiny worker registry (separate module) is enough
 *   for everything Farroway needs today. Web Workers / Service
 *   Workers are honest follow-ups when concrete bottlenecks emerge.
 *
 * Strict-rule audit
 *   • All API surface is pure or fire-and-forget. publish() never
 *     throws even when a subscriber throws — bad listeners can't
 *     crash the publisher's call site.
 *   • Built-in rolling event log (capped at 100) so a future
 *     debug panel can render the recent traffic. The log is
 *     opt-in for inspection — it never blocks normal flow.
 *   • Wildcard subscribers ('*') receive every event so the
 *     telemetry layer can register once and observe all traffic.
 *   • Re-entrancy safe: if a handler publishes another event,
 *     that second publish queues + drains normally. We cap the
 *     re-entrancy depth at MAX_REENTRANCY to break runaway loops.
 */

// ─── Typed event constants ────────────────────────────────────

export const FarmEvents = Object.freeze({
  WEATHER_UPDATED:         'weather.updated',
  WEATHER_CHANGED:         'weather.updated',     // spec alias — same channel
  SCAN_COMPLETED:          'scan.completed',
  TASK_CREATED:            'task.created',
  TASK_COMPLETED:          'task.completed',
  TASK_OVERDUE:            'task.overdue',
  TASK_MISSED:             'task.overdue',        // spec alias — same channel
  FARM_CREATED:            'farm.created',
  FARM_UPDATED:            'farm.updated',
  LOCATION_UPDATED:        'farm.location_updated',
  CROP_ADDED:              'farm.crop_added',
  // Production hardening §4 — canonical events the page-level
  // subscribers (Home / Tasks / Progress / Journal) react to so
  // cross-screen continuity stays in lock-step with the Zustand
  // canonical farm store.
  CROP_UPDATED:            'farm.crop_updated',
  LANGUAGE_CHANGED:        'app.language_changed',
  DISEASE_DETECTED:        'disease.detected',
  OUTBREAK_DETECTED:       'outbreak.detected',
  SOIL_UPDATED:            'soil.updated',
  MARKET_UPDATED:          'market.updated',
  HARVEST_READY:           'harvest.ready',
  IRRIGATION_RISK:         'irrigation.risk',
  USER_LOCATION_CHANGED:   'user.location_changed',
  FOLLOW_UP_DUE:           'followup.due',
  PRODUCE_LISTED:          'produce.listed',
  JOURNAL_ENTRY_CREATED:   'journal.entry_created',

  // Internal observability events the bus publishes about itself.
  HANDLER_FAILED:          'bus.handler_failed',
});

export const ALL_EVENT_NAMES = Object.freeze(
  // dedupe: a few public-facing keys (WEATHER_CHANGED, TASK_MISSED)
  // are aliases that share a channel with the canonical name.
  Array.from(new Set(
    Object.values(FarmEvents).filter((n) => !n.startsWith('bus.')),
  )),
);

// ─── Internal state ───────────────────────────────────────────

const _handlers = new Map();   // event -> Set<handler>
const _wildcardHandlers = new Set();
const _eventLog = [];
const EVENT_LOG_CAP = 100;
const MAX_REENTRANCY = 16;
let _reentrancyDepth = 0;

function _isKnown(event) {
  return typeof event === 'string' && (
    event.startsWith('bus.') ||
    ALL_EVENT_NAMES.includes(event)
  );
}

function _now() { try { return Date.now(); } catch { return 0; } }

// ─── Public API ──────────────────────────────────────────────

/**
 * Subscribe to a specific event or to '*' for every event.
 *
 * @param {string} event       — one of FarmEvents.* or '*'
 * @param {(payload, meta) => void} handler
 * @returns {() => void}       — unsubscribe function (idempotent)
 */
export function subscribe(event, handler) {
  if (typeof handler !== 'function') return () => {};
  if (event === '*') {
    _wildcardHandlers.add(handler);
    return () => { _wildcardHandlers.delete(handler); };
  }
  if (typeof event !== 'string' || !event) return () => {};
  let set = _handlers.get(event);
  if (!set) {
    set = new Set();
    _handlers.set(event, set);
  }
  set.add(handler);
  return () => {
    const s = _handlers.get(event);
    if (s) s.delete(handler);
  };
}

/**
 * Publish an event. Never throws. Returns the number of handlers
 * the event was dispatched to so callers can detect "nobody listening."
 *
 * @param {string} event
 * @param {any} payload
 * @returns {number}  — handler-invocation count
 */
export function publish(event, payload) {
  if (typeof event !== 'string' || !event) return 0;
  // Re-entrancy guard — prevent infinite event loops (spec §7).
  if (_reentrancyDepth >= MAX_REENTRANCY) {
    _logToBuffer(event, payload, { dropped: 'reentrancy_cap' });
    return 0;
  }

  const meta = { event, ts: _now() };
  _logToBuffer(event, payload, meta);

  let count = 0;
  _reentrancyDepth += 1;
  try {
    const direct = _handlers.get(event);
    if (direct && direct.size > 0) {
      for (const h of Array.from(direct)) {
        try { h(payload, meta); count += 1; }
        catch (err) { _publishHandlerFailure(event, err); }
      }
    }
    if (_wildcardHandlers.size > 0) {
      for (const h of Array.from(_wildcardHandlers)) {
        try { h(payload, meta); count += 1; }
        catch (err) { _publishHandlerFailure(event, err); }
      }
    }
  } finally {
    _reentrancyDepth -= 1;
  }

  return count;
}

function _publishHandlerFailure(originalEvent, err) {
  // Avoid recursive publish loops if HANDLER_FAILED handlers throw —
  // the re-entrancy cap covers us, but we still skip self-publishing
  // when the original event IS HANDLER_FAILED.
  if (originalEvent === FarmEvents.HANDLER_FAILED) return;
  const errMsg = (err && err.message) ? String(err.message) : 'handler_error';
  // Use direct dispatch instead of publish() to avoid bumping the
  // event log twice when no listener is subscribed.
  const set = _handlers.get(FarmEvents.HANDLER_FAILED);
  if (set && set.size > 0) {
    for (const h of Array.from(set)) {
      try { h({ event: originalEvent, error: errMsg }, { event: FarmEvents.HANDLER_FAILED, ts: _now() }); }
      catch { /* swallow */ }
    }
  }
}

/**
 * Whether ANY handler is currently subscribed to this event.
 * Useful before computing an expensive payload.
 */
export function hasSubscriber(event) {
  if (event === '*') return _wildcardHandlers.size > 0;
  if (_wildcardHandlers.size > 0) return true;
  const set = _handlers.get(event);
  return !!(set && set.size > 0);
}

/**
 * Rolling event log — newest LAST. Capped at EVENT_LOG_CAP.
 * Returns a defensive copy so consumers can't mutate the buffer.
 */
export function getRecentEvents(limit) {
  const n = (typeof limit === 'number' && limit > 0) ? limit : EVENT_LOG_CAP;
  return _eventLog.slice(-n).map((e) => ({ ...e }));
}

/**
 * Clear all subscribers + the event log. Test helper.
 */
export function _resetBus() {
  _handlers.clear();
  _wildcardHandlers.clear();
  _eventLog.length = 0;
  _reentrancyDepth = 0;
}

// ─── Internal ─────────────────────────────────────────────────

function _logToBuffer(event, payload, meta) {
  _eventLog.push({
    event,
    payload: _safeSummarisePayload(payload),
    ts:      meta.ts || _now(),
    ...(meta.dropped ? { dropped: meta.dropped } : {}),
  });
  if (_eventLog.length > EVENT_LOG_CAP) {
    _eventLog.splice(0, _eventLog.length - EVENT_LOG_CAP);
  }
}

// Don't store the whole payload in the log — extremely large
// payloads (image base64) would blow memory. We summarise to keys
// + types + tiny string/number values.
function _safeSummarisePayload(p) {
  if (p == null) return null;
  if (typeof p !== 'object') return p;
  const out = {};
  let bytes = 0;
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v == null) { out[k] = v; continue; }
    if (typeof v === 'number' || typeof v === 'boolean') { out[k] = v; continue; }
    if (typeof v === 'string') {
      out[k] = v.length > 80 ? (v.slice(0, 80) + '…') : v;
      bytes += out[k].length;
    } else if (Array.isArray(v)) {
      out[k] = `Array(${v.length})`;
    } else if (typeof v === 'object') {
      out[k] = '{…}';
    }
    if (bytes > 500) break;
  }
  return out;
}

// ─── Diagnostics ──────────────────────────────────────────────

/**
 * @returns {{ events: number, handlers: number, wildcardHandlers: number, knownEvents: string[] }}
 */
export function busDiagnostics() {
  let handlerCount = 0;
  for (const set of _handlers.values()) handlerCount += set.size;
  return {
    events:           _eventLog.length,
    handlers:         handlerCount,
    wildcardHandlers: _wildcardHandlers.size,
    knownEvents:      ALL_EVENT_NAMES.slice(),
  };
}

/**
 * Validate that an event name is part of the typed registry. Useful
 * for catching typos at publish sites in development.
 */
export function isKnownEvent(event) {
  return _isKnown(event);
}

export default {
  FarmEvents,
  ALL_EVENT_NAMES,
  subscribe,
  publish,
  hasSubscriber,
  getRecentEvents,
  busDiagnostics,
  isKnownEvent,
  _resetBus,
};
