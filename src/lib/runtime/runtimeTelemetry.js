/**
 * runtimeTelemetry — single tagged channel for runtime failure
 * counters (scan failures, image failures, URL failures, fallback
 * usage, retry counts). All emissions carry the [FARROWAY_RUNTIME]
 * prefix so ops can grep production logs for one tag.
 *
 *   import {
 *     trackRuntimeEvent, getRuntimeCounters, resetRuntimeCounters,
 *     RUNTIME_KINDS,
 *   } from '../lib/runtime/runtimeTelemetry.js';
 *
 *   trackRuntimeEvent(RUNTIME_KINDS.IMAGE_FALLBACK, { src: oldUrl });
 *   trackRuntimeEvent(RUNTIME_KINDS.INVALID_URL,    { value: badInput });
 *   trackRuntimeEvent(RUNTIME_KINDS.SCAN_FAILURE,   { stage: 'upload' });
 *
 *   getRuntimeCounters();
 *   //   { image_fallback: 3, invalid_url: 1, scan_failure: 0, ... }
 *
 * Why a dedicated namespace
 *   The Runtime Hardening + Asset Recovery Fix §8 calls for a
 *   single tagged surface so QA + ops can grep [FARROWAY_RUNTIME]
 *   in DevTools / Sentry without filtering through a dozen
 *   ad-hoc log prefixes. This module is the canonical emitter +
 *   the counters store for a future debug panel.
 *
 * Strict-rule audit
 *   * Pure JS. SSR-safe. Never throws.
 *   * Counters are in-memory (no storage, no network). Production
 *     analytics piped through the existing safeTrack layer when
 *     the host wires it.
 *   * Throttling: identical event types fire AT MOST 5 console
 *     lines per session per kind so a broken hero asset can't
 *     produce 100+ log entries.
 *   * No PII. The safe-payload allow-list mirrors the existing
 *     scanPipelineLogger pattern.
 */

export const RUNTIME_KINDS = Object.freeze({
  IMAGE_FALLBACK:   'image_fallback',
  INVALID_URL:      'invalid_url',
  SCAN_FAILURE:     'scan_failure',
  RETRY_ATTEMPT:    'retry_attempt',
  EXTENSION_NOISE:  'extension_noise',
  FETCH_TIMEOUT:    'fetch_timeout',
  BOUNDARY_CAUGHT:  'boundary_caught',
});

const _SAFE_KEYS = new Set([
  'src', 'value', 'stage', 'kind', 'reason', 'status',
  'attempt', 'durationMs', 'size', 'mime',
  'swappedTo', 'path', 'origin', 'count',
]);

const _MAX_LINES_PER_KIND = 5;

const _state = {
  counters:    {},  // kind -> total fired
  logCounters: {},  // kind -> console emissions
};

// Initialise counters so consumers see every kind with a 0.
for (const k of Object.values(RUNTIME_KINDS)) {
  _state.counters[k] = 0;
  _state.logCounters[k] = 0;
}

function _safePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const out = {};
  for (const k of Object.keys(payload)) {
    if (!_SAFE_KEYS.has(k)) continue;
    const v = payload[k];
    if (v == null) { out[k] = null; continue; }
    const t = typeof v;
    if (t === 'number' || t === 'boolean') { out[k] = v; continue; }
    if (t === 'string') out[k] = v.length > 160 ? v.slice(0, 160) + '…' : v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function _isDev() {
  try {
    return !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV);
  } catch { return false; }
}

/**
 * Emit a runtime event. Increments the in-memory counter
 * unconditionally; emits a tagged console line in dev (throttled
 * to MAX_LINES_PER_KIND per kind per session).
 *
 * @param {string} kind     one of RUNTIME_KINDS.*
 * @param {object} [payload]
 */
export function trackRuntimeEvent(kind, payload) {
  try {
    if (typeof kind !== 'string' || !kind.trim()) return;
    const safeKind = kind.trim();
    _state.counters[safeKind] = (_state.counters[safeKind] || 0) + 1;
    if (!_isDev()) return;
    const logCount = _state.logCounters[safeKind] || 0;
    if (logCount >= _MAX_LINES_PER_KIND) return;
    _state.logCounters[safeKind] = logCount + 1;
    const safePayload = _safePayload(payload);

    if (safePayload) console.log('[FARROWAY_RUNTIME]', { kind: safeKind, ...safePayload });
    else             console.log('[FARROWAY_RUNTIME]', { kind: safeKind });
  } catch { /* swallow */ }
}

/** @returns {object} snapshot of every counter */
export function getRuntimeCounters() {
  return { ..._state.counters };
}

/** Test seam — zero every counter. */
export function resetRuntimeCounters() {
  for (const k of Object.keys(_state.counters)) {
    _state.counters[k] = 0;
    _state.logCounters[k] = 0;
  }
}

/**
 * @returns {boolean} whether a given kind has been throttled
 *                    (useful for tests + the future debug panel)
 */
export function isThrottled(kind) {
  return (_state.logCounters[kind] || 0) >= _MAX_LINES_PER_KIND;
}

const _module = {
  RUNTIME_KINDS,
  trackRuntimeEvent,
  getRuntimeCounters,
  resetRuntimeCounters,
  isThrottled,
};
export default _module;
