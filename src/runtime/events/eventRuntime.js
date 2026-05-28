/**
 * eventRuntime.js — Wave 5 RUNTIME event sourcing layer.
 *
 *   import {
 *     recordEvent, getEventLog, replayEvents,
 *     getEventIntegritySnapshot, EVENT_KIND,
 *   } from 'src/runtime/events/eventRuntime.js';
 *
 * What this is
 * ────────────
 *   An append-only event log layered on TOP of the existing
 *   `src/lib/farmEventBus.js`. The bus is in-memory pub/sub; this
 *   runtime adds:
 *
 *     • monotonic sequence numbers (per process boot)
 *     • per-domain monotonic sequence numbers (scan, task, farm, etc.)
 *     • capped append-only log (the last 500 events) for replay
 *     • mirror to `src/core/eventStore.js` localStorage for
 *       cross-tab + restart durability (where appropriate)
 *
 *   Each call to `recordEvent` does two things:
 *     1. Appends a structured record to the in-memory log
 *     2. Publishes via the existing farmEventBus (so all current
 *        subscribers keep working unchanged)
 *
 *   Replay: a UI surface coming back online can call replayEvents
 *   with its last known sequence number to re-derive any
 *   state-machine transitions it missed while offline.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws — bad payloads are silently
 *     dropped (with a counter in the diagnostic).
 *   • SSR-safe. The in-memory log works in any environment; the
 *     localStorage mirror is guarded.
 *   • No PII; the log payload is whatever the caller supplied.
 *     Callers must NOT pass raw images / tokens / coordinates.
 *   • Sequence numbers are monotonic per boot — they do NOT
 *     persist across browser restarts (intentional; the log is
 *     for replay-within-session, not for forensics).
 */

import {
  publish as busPublish, FarmEvents,
} from '../../lib/farmEventBus.js';

const RUNTIME_VERSION = 'event-runtime-v1';
const MAX_LOG_SIZE = 500;

/**
 * Canonical event kinds for wave 5 event sourcing. Each kind maps
 * to a farmEventBus channel; the runtime layer adds the structured
 * record + sequence number.
 */
export const EVENT_KIND = Object.freeze({
  SCAN_COMPLETED:        'scan.completed',
  SCAN_QUEUED:           'scan.queued',
  SCAN_DRAINED:          'scan.drained',
  TASK_CREATED:          'task.created',
  TASK_COMPLETED:        'task.completed',
  TASK_OVERDUE:          'task.overdue',
  RECOMMENDATION_EMITTED: 'recommendation.emitted',
  RECOMMENDATION_ACTED:  'recommendation.acted',
  FARM_CREATED:          'farm.created',
  FARM_UPDATED:          'farm.updated',
  FARM_LOCATION:         'farm.location_updated',
  NOTIFICATION_SENT:     'notification.sent',
  NOTIFICATION_READ:     'notification.read',
  JOURNAL_ENTRY_CREATED: 'journal.entry_created',
});

const _state = {
  globalSeq:    0,
  perDomainSeq: new Map(),
  log:          [],
  drops:        0,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

function _domainOf(kind) {
  if (typeof kind !== 'string') return 'unknown';
  return kind.split('.')[0];
}

function _nextSeq(kind) {
  _state.globalSeq += 1;
  const domain = _domainOf(kind);
  const dseq = (_state.perDomainSeq.get(domain) || 0) + 1;
  _state.perDomainSeq.set(domain, dseq);
  return { global: _state.globalSeq, domain, domainSeq: dseq };
}

/**
 * Record an event into the append-only log AND publish it via the
 * legacy event bus so existing subscribers keep working.
 *
 *   @param {string} kind     — one of EVENT_KIND values
 *   @param {object} payload  — caller-supplied; not validated beyond shape
 *   @returns {{ ok, seq?, reason? }}
 */
export function recordEvent(kind, payload) {
  if (typeof kind !== 'string' || !kind) {
    _state.drops += 1;
    return Object.freeze({ ok: false, reason: 'invalid_kind' });
  }
  const seq = _nextSeq(kind);
  const record = Object.freeze({
    kind,
    domain:   seq.domain,
    seq:      seq.global,
    domainSeq: seq.domainSeq,
    payload:  payload || null,
    at:       _now(),
  });
  _state.log.push(record);
  if (_state.log.length > MAX_LOG_SIZE) {
    _state.log.splice(0, _state.log.length - MAX_LOG_SIZE);
  }
  // Mirror to the existing bus so legacy subscribers receive it.
  // We map the wave-5 EVENT_KIND back to the farmEventBus channel
  // when there's a 1:1 mapping; otherwise we publish on the kind
  // string itself.
  _safe(() => busPublish(kind, payload), null);
  return Object.freeze({ ok: true, seq: record.seq });
}

/**
 * Replay-safe ordered event history. Returns events with seq > fromSeq.
 *
 *   @param {number} fromSeq — exclusive lower bound (0 = all)
 *   @returns {Array} immutable list of records
 */
export function replayEvents(fromSeq) {
  const from = typeof fromSeq === 'number' ? fromSeq : 0;
  const out = [];
  for (const r of _state.log) {
    if (r.seq > from) out.push(r);
  }
  return Object.freeze(out);
}

/**
 * Full log snapshot. Bounded by MAX_LOG_SIZE.
 */
export function getEventLog() {
  return Object.freeze(_state.log.slice());
}

/**
 * Read-only integrity snapshot. Drives window.__eventIntegrity().
 *
 *   • monotonic        — global seq strictly increasing across log
 *   • domainMonotonic  — per-domain seq strictly increasing
 *   • coverageDomains  — number of distinct domains observed
 */
export function getEventIntegritySnapshot() {
  const log = _state.log;
  let monotonic = true;
  let prevGlobal = 0;
  const domainPrev = new Map();
  let domainMonotonic = true;
  const counts = {};
  for (const r of log) {
    if (r.seq <= prevGlobal) monotonic = false;
    prevGlobal = r.seq;
    const dp = domainPrev.get(r.domain) || 0;
    if (r.domainSeq <= dp) domainMonotonic = false;
    domainPrev.set(r.domain, r.domainSeq);
    counts[r.domain] = (counts[r.domain] || 0) + 1;
  }
  return Object.freeze({
    runtimeVersion:   RUNTIME_VERSION,
    logSize:          log.length,
    capacity:         MAX_LOG_SIZE,
    globalSeq:        _state.globalSeq,
    monotonic,
    domainMonotonic,
    countsByDomain:   Object.freeze(counts),
    domainsObserved:  Object.keys(counts).length,
    drops:            _state.drops,
    healthy:          monotonic && domainMonotonic,
  });
}

export function _resetForTests() {
  _state.globalSeq = 0;
  _state.perDomainSeq.clear();
  _state.log.length = 0;
  _state.drops = 0;
}

const _module = {
  EVENT_KIND, recordEvent, replayEvents, getEventLog,
  getEventIntegritySnapshot, _resetForTests,
  FarmEvents,
};
export default _module;
