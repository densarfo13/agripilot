/**
 * runtimeTelemetry.js — structured telemetry for the Runtime OS Layer.
 *
 *   import { trackTelemetry, telemetryCounters, METRIC }
 *     from 'src/core/telemetry/runtimeTelemetry.js';
 *
 *   trackTelemetry(METRIC.SCAN_SUCCEEDED);
 *   trackTelemetry(METRIC.RECOMMENDATION_IGNORED, { type: 'watering' });
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny in-process counter table + one-line structured log per
 *   tracked event. Lines flow to stdout (and therefore Railway
 *   logs); Sentry is invoked for failure-class metrics when the
 *   SDK is initialised.
 *
 *   It is NOT an analytics SDK. It does NOT batch/flush, does NOT
 *   buffer over time, and does NOT include PII. Counters live in
 *   memory; the admin status route can read them via
 *   `telemetryCounters()`.
 *
 *   Sentry integration: when `window.Sentry?.captureMessage` is
 *   available, FAILURE-class metrics get an additional capture
 *   call so the dashboard surfaces them. We never call captureException
 *   directly — telemetry is for trends, not specific exceptions.
 *
 * Strict-rule audit
 *   • Pure-ish — increments an in-memory counter + writes one
 *     console.log line. Never throws. SSR-safe.
 *   • No PII — payload schemas use type / outcome / count fields.
 *   • Counters are bounded per-metric × per-payload-key signature.
 */

export const METRIC = Object.freeze({
  SCAN_SUCCEEDED:                'scan.succeeded',
  SCAN_FAILED:                   'scan.failed',
  SCAN_UPLOAD_FAILED:            'scan.upload_failed',
  RECOMMENDATION_ACCEPTED:       'recommendation.accepted',
  RECOMMENDATION_IGNORED:        'recommendation.ignored',
  LANGUAGE_SWITCH_FAILED:        'i18n.switch_failed',
  OFFLINE_SYNC_FAILED:           'offline.sync_failed',
  OFFLINE_SYNC_OK:               'offline.sync_ok',
  SLOW_PAGE:                     'perf.slow_page',
  INTELLIGENCE_CONFLICT:         'intelligence.conflict',
  MARKETPLACE_INTERACTION:       'marketplace.interaction',
  TASK_COMPLETED:                'task.completed',
  TASK_SKIPPED:                  'task.skipped',
});

const _VALID = new Set(Object.values(METRIC));

// Metrics that count as "failures" — we mirror these to Sentry
// when the SDK is initialised. Everything else stays in stdout.
const _FAILURE = new Set([
  METRIC.SCAN_FAILED,
  METRIC.SCAN_UPLOAD_FAILED,
  METRIC.LANGUAGE_SWITCH_FAILED,
  METRIC.OFFLINE_SYNC_FAILED,
  METRIC.INTELLIGENCE_CONFLICT,
]);

// counters: { metric → { signature → count } }
const _counters = Object.create(null);

function _signature(payload) {
  if (!payload || typeof payload !== 'object') return '_';
  // Stable, sorted, structural signature — no values from free-text
  // fields, only enum-like keys.
  const safeKeys = ['type', 'outcome', 'reason', 'kind', 'engine'];
  const parts = [];
  for (const k of safeKeys) {
    const v = payload[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      parts.push(k + '=' + String(v).slice(0, 32));
    }
  }
  return parts.length ? parts.join('|') : '_';
}

function _increment(metric, signature) {
  if (!_counters[metric]) _counters[metric] = Object.create(null);
  const c = _counters[metric];
  c[signature] = (c[signature] || 0) + 1;
}

function _sentryCapture(metric, payload) {
  try {
    if (typeof window === 'undefined') return;
    const S = window.Sentry;
    if (!S || typeof S.captureMessage !== 'function') return;
    S.captureMessage('telemetry.' + metric, {
      level: 'warning',
      tags:  { metric, kind: 'runtime_telemetry' },
      // Payload signature — never raw payload.
      extra: { signature: _signature(payload) },
    });
  } catch { /* swallow */ }
}

/**
 * Track a metric. Increments the in-memory counter, writes a
 * one-line structured log, and (for failure metrics) optionally
 * captures to Sentry.
 *
 * @param {string} metric  one of METRIC.*
 * @param {object} [payload]  structured metadata (PII-free)
 * @returns {boolean}  true if accepted, false if unknown metric
 */
export function trackTelemetry(metric, payload) {
  try {
    if (!_VALID.has(metric)) return false;
    const sig = _signature(payload);
    _increment(metric, sig);
    try {
      // eslint-disable-next-line no-console
      console.log('[telemetry]', JSON.stringify({
        metric,
        signature: sig,
        ts: new Date().toISOString(),
      }));
    } catch { /* swallow */ }
    if (_FAILURE.has(metric)) _sentryCapture(metric, payload);
    return true;
  } catch { return false; }
}

/**
 * Snapshot the current counters. Returns a deep-copied object so
 * callers can't mutate internal state.
 */
export function telemetryCounters() {
  const out = {};
  for (const m of Object.keys(_counters)) {
    out[m] = { ..._counters[m] };
  }
  return out;
}

/** Test-only reset. */
export function _resetTelemetryForTests() {
  for (const k of Object.keys(_counters)) delete _counters[k];
}

const _module = {
  METRIC, trackTelemetry, telemetryCounters, _resetTelemetryForTests,
};
export default _module;
