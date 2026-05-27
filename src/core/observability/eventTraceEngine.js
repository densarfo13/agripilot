/**
 * eventTraceEngine.js — unified event trace ring buffer (spec §9).
 *
 *   import {
 *     traceEvent, getTrace, clearTrace, installTraceHook,
 *     TRACE_CATEGORY,
 *   } from 'src/core/observability/eventTraceEngine.js';
 *
 *   traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'capture_complete', { sessionId, ms });
 *   const recent = getTrace({ category: TRACE_CATEGORY.SCAN_LIFECYCLE, limit: 50 });
 *
 *   // From DevTools, any device:
 *   window.__farrowayTrace()
 *
 * What this is
 * ────────────
 *   A single ring buffer of structural events spanning the whole
 *   app — scan lifecycle, locale transitions, recommendation
 *   generation, suppression decisions, outcome confirmations,
 *   predictive triggers, retries, offline recovery, memory updates.
 *
 *   The buffer is in-memory (cap 200 entries) — never persisted —
 *   so it never leaks PII across sessions and never holds raw image
 *   bytes. Every row is a structural envelope:
 *
 *     { at, category, name, durationMs?, payload, sessionId? }
 *
 *   `window.__farrowayTrace()` dumps the current ring + a per-
 *   category counter. Field-debug uses this to capture the last 60s
 *   of activity when a user reports "scan stuck".
 *
 *   Composes with the existing diagnostic surface
 *   (productionDiagnostics, scanDebugOverlay, i18nStateDevHook) —
 *   does NOT replace any of them. Other diagnostic hooks can READ
 *   the trace via getTrace() to enrich their snapshots.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • In-memory only — no localStorage, no IndexedDB. Buffer reset
 *     on page reload (by design).
 *   • Capped at 200 entries — never grows unbounded.
 *   • No PII: payload field is stringified to ≤ 240 chars per value
 *     and reject objects with image/blob fields.
 */

const ENGINE_VERSION = 'event-trace-v1';
const MAX_TRACE = 200;

export const TRACE_CATEGORY = Object.freeze({
  SCAN_LIFECYCLE:     'scan_lifecycle',
  LOCALE_LIFECYCLE:   'locale_lifecycle',
  RECOMMENDATION:     'recommendation',
  SUPPRESSION:        'suppression',
  OUTCOME:            'outcome',
  PREDICTION:         'prediction',
  RETRY:              'retry',
  OFFLINE:            'offline',
  MEMORY:             'memory',
  DEPLOYMENT:         'deployment',
  ERROR:              'error',
});

const _VALID_CATEGORIES = new Set(Object.values(TRACE_CATEGORY));

// ─── Ring buffer ─────────────────────────────────────────────

const _ring = [];

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const _DROP_KEYS = new Set([
  'image', 'imageData', 'blob', 'buffer', 'pixels',
  'src', 'dataUrl', 'objectUrl', 'photoBytes',
]);

function _sanitizePayload(p) {
  if (!_isObj(p)) return null;
  const out = {};
  for (const k of Object.keys(p)) {
    if (_DROP_KEYS.has(k)) continue;
    let v = p[k];
    // Coerce + cap stringified values to 240 chars.
    if (typeof v === 'string') {
      out[k] = v.length > 240 ? v.slice(0, 240) + '…' : v;
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = '[Array(' + v.length + ')]';
    } else if (_isObj(v)) {
      out[k] = '[Object]';
    } else {
      out[k] = String(v).slice(0, 240);
    }
  }
  return Object.freeze(out);
}

// ─── Public — recording ──────────────────────────────────────

/**
 * Record one trace event. Drops silently on invalid category or
 * non-string name (no throw).
 *
 * @param {string} category — TRACE_CATEGORY.*
 * @param {string} name
 * @param {object} [payload]
 * @param {object} [meta]   — { durationMs?, sessionId? }
 * @returns {object|null}
 */
export function traceEvent(category, name, payload, meta) {
  return _safe(() => {
    if (!_VALID_CATEGORIES.has(category)) return null;
    if (typeof name !== 'string' || !name) return null;
    const m = _isObj(meta) ? meta : {};
    const row = Object.freeze({
      at:         Date.now(),
      category,
      name:       name.slice(0, 80),
      durationMs: typeof m.durationMs === 'number' && Number.isFinite(m.durationMs) ? m.durationMs : null,
      sessionId:  typeof m.sessionId === 'string' ? m.sessionId.slice(0, 64) : null,
      payload:    _sanitizePayload(payload),
    });
    _ring.push(row);
    if (_ring.length > MAX_TRACE) _ring.splice(0, _ring.length - MAX_TRACE);
    return row;
  }, null);
}

// ─── Public — reading ────────────────────────────────────────

/**
 * Read the current ring buffer with optional filters.
 *
 * @param {object} [opts]
 * @param {string} [opts.category]
 * @param {number} [opts.sinceMs]
 * @param {number} [opts.limit]   — newest-first; defaults to all
 * @returns {Array<object>}
 */
export function getTrace(opts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    const cat = typeof o.category === 'string' ? o.category : null;
    const since = typeof o.sinceMs === 'number' && Number.isFinite(o.sinceMs) ? o.sinceMs : 0;
    let rows = _ring.slice();
    if (cat) rows = rows.filter((r) => r.category === cat);
    if (since) rows = rows.filter((r) => r.at >= since);
    rows.reverse();
    if (Number.isFinite(o.limit) && o.limit > 0) rows = rows.slice(0, o.limit);
    return rows;
  }, []);
}

/** Per-category event counts in the current ring. */
export function getTraceCounts() {
  return _safe(() => {
    const counts = Object.create(null);
    for (const cat of Object.values(TRACE_CATEGORY)) counts[cat] = 0;
    for (const r of _ring) counts[r.category] = (counts[r.category] || 0) + 1;
    return Object.freeze({ ...counts, _total: _ring.length });
  }, Object.freeze({ _total: 0 }));
}

export function clearTrace() {
  _ring.length = 0;
}

// ─── Public — DevTools hook ──────────────────────────────────

/**
 * Pin `window.__farrowayTrace()` for field debugging. Idempotent.
 *
 *   window.__farrowayTrace()                — dump everything + counts
 *   window.__farrowayTrace('scan_lifecycle')— filter by category
 *   window.__farrowayTrace({ limit: 20 })   — newest 20
 */
export function installTraceHook() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (window.__farrowayTrace) return true;
    window.__farrowayTrace = function (arg) {
      const opts = (typeof arg === 'string')
        ? { category: arg }
        : (_isObj(arg) ? arg : {});
      const snapshot = {
        engineVersion: ENGINE_VERSION,
        counts: getTraceCounts(),
        events: getTrace(opts),
        generatedAt: new Date().toISOString(),
      };
      try {
        console.log('[Farroway Trace]', snapshot);
      } catch { /* swallow */ }
      return snapshot;
    };
    return true;
  }, false);
}

export const _internal = Object.freeze({
  _sanitizePayload, _ring, _DROP_KEYS, ENGINE_VERSION, MAX_TRACE,
});

const _module = {
  TRACE_CATEGORY,
  traceEvent, getTrace, getTraceCounts, clearTrace, installTraceHook,
  _internal,
};
export default _module;
