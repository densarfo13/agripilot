/**
 * confidenceCalibration.js — Wave 6 RUNTIME confidence layer.
 *
 *   import {
 *     calibrateConfidence, bucketize, isSuppressed,
 *     CONFIDENCE_BUCKET,
 *   } from 'src/runtime/intelligence/confidenceCalibration.js';
 *
 * What this is
 * ────────────
 *   The canonical calibration step every recommendation passes
 *   through. Existing intelligence engines emit a raw "confidence"
 *   in inconsistent shapes (0-1 floats, 0-100 ints, "high"/
 *   "medium"/"low" strings). This module normalizes them, assigns
 *   a bucket, runs the safety gates, and emits a frozen envelope
 *   the pipeline downstream can rely on.
 *
 *   Safety gates implemented here:
 *     • low-confidence suppression — bucket=low + uncertaintyScore
 *       too high → suppressed: true (UI shows "needs more data")
 *     • insufficient-data detection — observation count below
 *       threshold → forced bucket=low with reason
 *     • conflicting-signal detection — caller supplies signals
 *       that disagree → suppressed + reason
 *
 *   This layer DOES NOT make recommendations. It only normalizes
 *   the confidence number every consumer reads.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Deterministic — same input always yields same envelope.
 *   • Output is frozen. Callers cannot mutate.
 */

const RUNTIME_VERSION = 'confidence-calibration-v1';

export const CONFIDENCE_BUCKET = Object.freeze({
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
  UNKNOWN: 'unknown',
});

const HIGH_THRESHOLD = 0.70;
const MEDIUM_THRESHOLD = 0.40;
const SUPPRESS_THRESHOLD = 0.30;
const INSUFFICIENT_DATA_OBS = 3;

const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _normalize(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const k = raw.toLowerCase();
    if (k === 'high' || k === 'high_confidence')   return 0.85;
    if (k === 'medium' || k === 'medium_confidence') return 0.55;
    if (k === 'low' || k === 'needs_review')        return 0.25;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return _normalize(parsed);
    return null;
  }
  if (!_isNum(raw)) return null;
  // 0-100 → 0-1
  if (raw > 1.5 && raw <= 100) return raw / 100;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

export function bucketize(normalized) {
  if (!_isNum(normalized)) return CONFIDENCE_BUCKET.UNKNOWN;
  if (normalized >= HIGH_THRESHOLD)   return CONFIDENCE_BUCKET.HIGH;
  if (normalized >= MEDIUM_THRESHOLD) return CONFIDENCE_BUCKET.MEDIUM;
  return CONFIDENCE_BUCKET.LOW;
}

/**
 * Calibrate a raw confidence + context into the canonical envelope.
 *
 *   @param {{
 *     raw?: number|string,
 *     observationCount?: number,
 *     conflictingSignals?: Array<string>,
 *     signalQuality?: number,    // 0-1; lowers confidence multiplicatively
 *   }} input
 *   @returns {Object} frozen envelope
 */
export function calibrateConfidence(input) {
  return _safe(() => {
    const i = input || {};
    const normalized = _normalize(i.raw);
    const obsCount = _isNum(i.observationCount) ? i.observationCount : null;
    const sq = _isNum(i.signalQuality)
      ? Math.max(0, Math.min(1, i.signalQuality)) : null;
    const conflicts = Array.isArray(i.conflictingSignals)
      ? i.conflictingSignals.filter(Boolean) : [];

    // Signal-quality discount — bad imagery / weak coverage scales
    // the confidence down. This is multiplicative because a high
    // raw confidence from a low-quality input shouldn't survive.
    const discounted = (normalized != null && sq != null)
      ? normalized * (0.5 + 0.5 * sq) // sq=0 halves; sq=1 keeps
      : normalized;

    const bucket = bucketize(discounted);

    // Suppression gates.
    const reasons = [];
    let suppressed = false;
    if (obsCount != null && obsCount < INSUFFICIENT_DATA_OBS) {
      suppressed = true;
      reasons.push('insufficient_observation_count');
    }
    if (conflicts.length >= 2) {
      suppressed = true;
      reasons.push('conflicting_signals');
    }
    if (discounted != null && discounted < SUPPRESS_THRESHOLD) {
      suppressed = true;
      reasons.push('below_suppression_threshold');
    }
    if (discounted == null) {
      suppressed = true;
      reasons.push('no_raw_confidence');
    }

    // Uncertainty = how far from the bucket midpoint, scaled.
    const uncertainty = discounted == null ? 1
      : _safe(() => {
          if (bucket === CONFIDENCE_BUCKET.HIGH)   return 1 - discounted;
          if (bucket === CONFIDENCE_BUCKET.MEDIUM) return Math.abs(0.55 - discounted) * 1.5;
          return 1 - discounted; // low → high uncertainty
        }, 1);

    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      raw:            i.raw == null ? null : i.raw,
      normalized:     discounted,
      bucket,
      suppressed,
      uncertainty:    Math.max(0, Math.min(1, uncertainty)),
      reasons:        Object.freeze(reasons),
      sufficientData: obsCount == null
        ? null
        : obsCount >= INSUFFICIENT_DATA_OBS,
      signalQuality:  sq,
      conflictCount:  conflicts.length,
    });
  }, Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    raw:            null,
    normalized:     null,
    bucket:         CONFIDENCE_BUCKET.UNKNOWN,
    suppressed:     true,
    uncertainty:    1,
    reasons:        Object.freeze(['calibration_threw']),
    sufficientData: null,
    signalQuality:  null,
    conflictCount:  0,
  }));
}

/**
 * Convenience predicate for downstream consumers.
 */
export function isSuppressed(envelope) {
  return !!(envelope && envelope.suppressed);
}

// ─── Telemetry counters ─────────────────────────────────────
//
// Module-level counters surfaced by the diagnostic.

const _telemetry = {
  totalCalls:           0,
  suppressedCount:      0,
  insufficientDataCount: 0,
  conflictCount:        0,
  byBucket:             { high: 0, medium: 0, low: 0, unknown: 0 },
};

// Wrap calibrateConfidence with telemetry — the public export is
// the wrapped version. Pure semantics unchanged.
const _calibrate = calibrateConfidence;
export default function (input) {
  const env = _calibrate(input);
  _telemetry.totalCalls += 1;
  if (env.suppressed) _telemetry.suppressedCount += 1;
  if (env.reasons && env.reasons.includes('insufficient_observation_count')) {
    _telemetry.insufficientDataCount += 1;
  }
  if (env.reasons && env.reasons.includes('conflicting_signals')) {
    _telemetry.conflictCount += 1;
  }
  if (env.bucket && _telemetry.byBucket[env.bucket] != null) {
    _telemetry.byBucket[env.bucket] += 1;
  }
  return env;
}

export function getCalibrationTelemetry() {
  return Object.freeze({
    runtimeVersion:        RUNTIME_VERSION,
    totalCalls:            _telemetry.totalCalls,
    suppressedCount:       _telemetry.suppressedCount,
    insufficientDataCount: _telemetry.insufficientDataCount,
    conflictCount:         _telemetry.conflictCount,
    byBucket:              Object.freeze({ ..._telemetry.byBucket }),
    thresholds: Object.freeze({
      high:    HIGH_THRESHOLD,
      medium:  MEDIUM_THRESHOLD,
      suppress: SUPPRESS_THRESHOLD,
      insufficientDataObs: INSUFFICIENT_DATA_OBS,
    }),
  });
}

export function _resetForTests() {
  _telemetry.totalCalls = 0;
  _telemetry.suppressedCount = 0;
  _telemetry.insufficientDataCount = 0;
  _telemetry.conflictCount = 0;
  _telemetry.byBucket.high = 0;
  _telemetry.byBucket.medium = 0;
  _telemetry.byBucket.low = 0;
  _telemetry.byBucket.unknown = 0;
}
