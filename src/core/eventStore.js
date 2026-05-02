/**
 * eventStore.js — local-first event log for the Farroway data
 * moat (Data Moat Layer §2).
 *
 *   import {
 *     saveEvent, getEvents, clearSyncedEvents, summarizeEvents,
 *   } from '../core/eventStore.js';
 *
 *   saveEvent({
 *     name: 'task_completed',
 *     payload: { ... },          // enriched by analytics.js
 *     timestamp: Date.now(),
 *   });
 *
 *   const events = getEvents();
 *   const summary = summarizeEvents(events);   // counts per name
 *
 * Storage
 * ───────
 *   farroway_events  →  JSON array of frozen event records.
 *   Capped at MAX_EVENTS so a long-running session can't fill
 *   localStorage. Oldest entries drop when the cap is hit.
 *
 * Why a separate store from src/analytics/analyticsStore.js
 * ──────────────────────────────────────────────────────────
 * The legacy analyticsStore was scoped to the older feature-
 * flag-gated behavior tracker (one buffered queue with its
 * own key + drain logic). The new eventStore is the canonical
 * surface the data-moat layer reads — userMemory, the engine's
 * memory-aware adaptation, and the regional insight aggregator
 * all consume `getEvents()`. Both stores coexist; analytics.js
 * fans events out to BOTH so existing surfaces that read from
 * the legacy store keep working without code changes.
 *
 * Strict-rule audit
 *   • Pure outside the localStorage I/O. Every read/write
 *     wrapped in try/catch — never throws.
 *   • SSR-safe: typeof localStorage check before every access.
 *   • Idempotent on shape: a malformed prior payload is
 *     dropped on read, not propagated.
 *   • No personal sensitive data. The payload is whatever the
 *     caller (analytics.js) built — privacy enforcement lives
 *     at the enrichment layer, not the storage layer.
 */

import { safeParse } from '../utils/safeParse.js';

export const EVENT_STORE_KEY = 'farroway_events';
const MAX_EVENTS = 1000;

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(EVENT_STORE_KEY);
    if (!raw) return [];
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = Array.isArray(list) ? list.slice(-MAX_EVENTS) : [];
    localStorage.setItem(EVENT_STORE_KEY, JSON.stringify(trimmed));
  } catch { /* swallow — quota / private mode */ }
}

let _idSeq = 0;
function _mintId() {
  _idSeq = (_idSeq + 1) % 1_000_000;
  return `${Date.now()}-${_idSeq}`;
}

/**
 * saveEvent({ name, payload?, timestamp? }) → stored | null.
 *
 * Returns the persisted record (frozen) so the caller can
 * forward an id to the offline queue or any other consumer.
 * Returns null when the event is malformed (missing name or
 * non-string name); callers should treat null as "ignored".
 *
 * The store does NOT enrich the payload — that's the job of
 * the analytics service. eventStore is purely a typed
 * append-only log.
 */
export function saveEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const name = typeof event.name === 'string' ? event.name.trim() : '';
  if (!name) return null;
  const ts = (typeof event.timestamp === 'number' && Number.isFinite(event.timestamp))
    ? event.timestamp : Date.now();
  const record = Object.freeze({
    id:        _mintId(),
    name,
    payload:   (event.payload && typeof event.payload === 'object') ? event.payload : null,
    timestamp: ts,
    synced:    false,
  });
  const list = _safeRead();
  list.push(record);
  _safeWrite(list);
  return record;
}

/**
 * getEvents({ since?, name?, limit? }) → array of frozen records.
 *
 * @param {object} [opts]
 * @param {number} [opts.since]  — filter to events with timestamp >= since.
 * @param {string|string[]} [opts.name] — filter to one or more event names.
 * @param {number} [opts.limit]  — return at most this many (newest first).
 * @returns {Array}
 */
export function getEvents(opts = {}) {
  const list = _safeRead();
  const since = (typeof opts.since === 'number' && Number.isFinite(opts.since))
    ? opts.since : null;
  const names = Array.isArray(opts.name)
    ? new Set(opts.name)
    : (typeof opts.name === 'string' ? new Set([opts.name]) : null);
  let out = list;
  if (since != null)  out = out.filter((e) => e && e.timestamp >= since);
  if (names != null)  out = out.filter((e) => e && names.has(e.name));
  if (typeof opts.limit === 'number' && opts.limit > 0) {
    // Newest-first when limit is set so a "recent activity"
    // surface gets the latest N entries.
    out = out.slice(-opts.limit).reverse();
  }
  return out;
}

/**
 * clearSyncedEvents() → number dropped.
 *
 * Drops entries whose `synced === true`. Used when a server
 * sync drains the queue: the caller marks individual entries
 * with markEventSynced (below) then calls this to reclaim
 * localStorage. Returns the number of entries removed.
 *
 * The store does NOT auto-mark entries synced — that's the
 * caller's responsibility (the data-moat layer is local-first
 * and the server route may not exist yet).
 */
export function clearSyncedEvents() {
  const list = _safeRead();
  const next = list.filter((e) => !e || e.synced !== true);
  const dropped = list.length - next.length;
  if (dropped > 0) _safeWrite(next);
  return dropped;
}

/**
 * markEventSynced(id) → boolean (success).
 *
 * Flips the synced flag on a single entry. Used by a future
 * server-sync worker; not consumed by any local surface today.
 */
export function markEventSynced(id) {
  if (!id) return false;
  const list = _safeRead();
  let changed = false;
  const next = list.map((e) => {
    if (e && e.id === id && e.synced !== true) {
      changed = true;
      return Object.freeze({ ...e, synced: true });
    }
    return e;
  });
  if (changed) _safeWrite(next);
  return changed;
}

/**
 * summarizeEvents(events?) → { total, byName, last7d, byExperience }
 *
 * Cheap rollup the userMemory + insightAggregator modules
 * consume to derive their views without re-reading localStorage
 * each time. Accepts an optional pre-loaded events array;
 * falls back to getEvents() when omitted.
 */
export function summarizeEvents(events) {
  const list = Array.isArray(events) ? events : _safeRead();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const byName        = Object.create(null);
  const byExperience  = Object.create(null);
  let total = 0;
  let last7d = 0;
  for (const e of list) {
    if (!e || typeof e.name !== 'string') continue;
    total += 1;
    byName[e.name] = (byName[e.name] || 0) + 1;
    if (typeof e.timestamp === 'number' && e.timestamp >= cutoff) last7d += 1;
    const exp = (e.payload && e.payload.activeExperience) || 'unknown';
    byExperience[exp] = (byExperience[exp] || 0) + 1;
  }
  return { total, byName, last7d, byExperience };
}

/** Wipe the event log. Used by clearFarrowayActivityData. */
export function resetEventStore() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(EVENT_STORE_KEY);
  } catch { /* swallow */ }
}

export default {
  saveEvent,
  getEvents,
  clearSyncedEvents,
  markEventSynced,
  summarizeEvents,
  resetEventStore,
};
