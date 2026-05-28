/**
 * recommendationMemoryRuntime.js — Wave 6 RUNTIME longitudinal memory.
 *
 *   import {
 *     recordRecommendation, getRecommendationHistory,
 *     getRecommendationTelemetry,
 *   } from 'src/runtime/intelligence/recommendationMemoryRuntime.js';
 *
 * Records every recommendation the pipeline emits so future runs
 * can detect duplicates, measure success rate, and supply ranking
 * signals via the outcomes layer.
 *
 * Composes:
 *   • src/core/intelligence/recommendationLearning.js — task-action
 *     learning store (unchanged; ratcheted by waves 1+).
 *   • plus an in-memory rolling buffer (cap 200) for fast inspection
 *     via __recommendationTrace().
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • No PII; the recorded shape is rec id + crop + region + bucket
 *     + score + suppression flag. NEVER the rec body.
 */

import {
  getLearningSnapshot,
} from '../../core/intelligence/recommendationLearning.js';

const RUNTIME_VERSION = 'recommendation-memory-runtime-v1';
const MEMORY_CAP = 200;

const _state = { rolling: [], emittedCount: 0 };

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * Append a recommendation event to memory.
 *
 *   @param {{
 *     recId: string, kind?, crop?, region?, bucket?, score?,
 *     suppressed?: boolean,
 *   }} entry
 */
export function recordRecommendation(entry) {
  if (!entry || typeof entry !== 'object') {
    return Object.freeze({ ok: false, reason: 'invalid_entry' });
  }
  const recId = typeof entry.recId === 'string' ? entry.recId : '';
  if (!recId) {
    return Object.freeze({ ok: false, reason: 'no_rec_id' });
  }
  const record = Object.freeze({
    recId,
    kind:        entry.kind || null,
    crop:        entry.crop || null,
    region:      entry.region || null,
    bucket:      entry.bucket || null,
    score:       typeof entry.score === 'number' ? entry.score : null,
    suppressed:  !!entry.suppressed,
    at:          _now(),
  });
  _state.rolling.push(record);
  if (_state.rolling.length > MEMORY_CAP) {
    _state.rolling.splice(0, _state.rolling.length - MEMORY_CAP);
  }
  _state.emittedCount += 1;
  return Object.freeze({ ok: true, recId });
}

export function getRecommendationHistory(limit) {
  const n = typeof limit === 'number' && limit > 0 ? limit : 50;
  return Object.freeze(_state.rolling.slice(-n));
}

export function getRecommendationTelemetry() {
  const learning = _safe(() => getLearningSnapshot(), null);
  const recent = _state.rolling.slice(-50);
  const bucketCounts = { high: 0, medium: 0, low: 0, unknown: 0 };
  let suppressed = 0;
  for (const r of recent) {
    if (r.bucket && bucketCounts[r.bucket] != null) bucketCounts[r.bucket] += 1;
    if (r.suppressed) suppressed += 1;
  }
  return Object.freeze({
    runtimeVersion:        RUNTIME_VERSION,
    emittedTotal:          _state.emittedCount,
    bufferSize:            _state.rolling.length,
    capacity:              MEMORY_CAP,
    last50: Object.freeze({
      suppressedCount: suppressed,
      byBucket:        Object.freeze(bucketCounts),
    }),
    learningEngine:        learning ? Object.freeze(learning) : null,
  });
}

export function _resetForTests() {
  _state.rolling.length = 0;
  _state.emittedCount = 0;
}
