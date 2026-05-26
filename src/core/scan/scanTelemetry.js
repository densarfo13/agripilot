/**
 * scanTelemetry.js — append-only event log for the scan pipeline.
 *
 *   import {
 *     emitScanEvent, getScanEventLog, clearScanEventLog,
 *     SCAN_EVENTS,
 *   } from 'src/core/scan/scanTelemetry.js';
 *
 *   emitScanEvent(SCAN_EVENTS.SCAN_START, { sessionId, source });
 *   emitScanEvent(SCAN_EVENTS.IMAGE_NORMALIZED, { mime, w, h });
 *
 *   // From DevTools (after installProductionDiagnostics):
 *   window.__scanTelemetry()
 *
 * Why this exists
 * ───────────────
 *   The production incident playbook (spec §8) requires a 12-event
 *   telemetry stream that survives across navigations + tab
 *   refreshes so a field operator can reconstruct the exact stage
 *   the scan failed at. localStorage-backed; rolling buffer of the
 *   last 200 events (covers ~25 full scans).
 *
 *   Pure structural data — no image bytes, no PII. Each event row:
 *
 *     { event, sessionId, timestampMs, monoMs, payload }
 *
 *   `monoMs` is performance.now() so cross-event durations are
 *   accurate even when the system clock jumps.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Idempotent install. No external network calls.
 */

export const SCAN_EVENTS = Object.freeze({
  SCAN_START:            'SCAN_START',
  IMAGE_CAPTURED:        'IMAGE_CAPTURED',
  IMAGE_NORMALIZED:      'IMAGE_NORMALIZED',
  PREVIEW_READY:         'PREVIEW_READY',
  UPLOAD_STARTED:        'UPLOAD_STARTED',
  UPLOAD_SUCCESS:        'UPLOAD_SUCCESS',
  UPLOAD_FAILED:         'UPLOAD_FAILED',
  AI_REQUEST_STARTED:    'AI_REQUEST_STARTED',
  AI_RESPONSE_RECEIVED:  'AI_RESPONSE_RECEIVED',
  AI_REQUEST_FAILED:     'AI_REQUEST_FAILED',
  RESULT_RENDERED:       'RESULT_RENDERED',
  SESSION_RECOVERED:     'SESSION_RECOVERED',
  PREVIEW_RESTORED:      'PREVIEW_RESTORED',
  SCAN_CANCELLED:        'SCAN_CANCELLED',
});

const STORAGE_KEY = 'farroway:scanTelemetry:v1';
const MAX_EVENTS  = 200;

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function _safeSet(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota / privacy mode — degrade silently */ }
}

function _mono() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch { /* swallow */ }
  return Date.now();
}

/**
 * Append a single event. Returns true on success. Never throws.
 *
 * @param {string} event       — SCAN_EVENTS.* value
 * @param {object} [payload]   — small JSON-serialisable object
 */
export function emitScanEvent(event, payload) {
  try {
    if (typeof event !== 'string' || !event) return false;
    const row = Object.freeze({
      event,
      sessionId: (payload && typeof payload === 'object' && payload.sessionId) || null,
      timestampMs: Date.now(),
      monoMs: _mono(),
      payload: (payload && typeof payload === 'object') ? _stripPayload(payload) : null,
    });
    const arr = _safeGet();
    arr.push(row);
    if (arr.length > MAX_EVENTS) arr.splice(0, arr.length - MAX_EVENTS);
    _safeSet(arr);
    return true;
  } catch { return false; }
}

// Strip large fields (dataURL, blob) so the event log doesn't blow
// past localStorage quota. We keep size/length hints instead.
function _stripPayload(p) {
  const out = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (typeof v === 'string') {
      if (v.length > 200) {
        out[k] = '<' + v.length + ' chars>';
      } else { out[k] = v; }
    } else if (v == null || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = '<array len=' + v.length + '>';
    } else if (typeof v === 'object') {
      try { out[k] = JSON.parse(JSON.stringify(v)).constructor === Object ? v : '<object>'; }
      catch { out[k] = '<object>'; }
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

/** Read the event log (latest first OR insertion order). Latest-last
 * by default so reading from index 0 gives the oldest event. */
export function getScanEventLog() { return _safeGet(); }

/** Drop every recorded event. */
export function clearScanEventLog() { _safeSet([]); }

/**
 * Convenience: events for a single session id. Useful when one
 * device runs many scans and you want to isolate one.
 */
export function getEventsForSession(sessionId) {
  if (!sessionId) return [];
  return _safeGet().filter((r) => r && r.sessionId === sessionId);
}

const _module = {
  SCAN_EVENTS,
  emitScanEvent, getScanEventLog, clearScanEventLog,
  getEventsForSession,
};
export default _module;
