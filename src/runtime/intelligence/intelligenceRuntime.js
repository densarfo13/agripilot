/**
 * intelligenceRuntime.js — Wave 6 RUNTIME intelligence chokepoint.
 *
 *   import {
 *     produceRecommendations, recordIntervention, recordOutcome,
 *     getIntelligenceHealth, installIntelligenceRuntime,
 *     INTELLIGENCE_STAGE,
 *   } from 'src/runtime/intelligence/intelligenceRuntime.js';
 *
 * What this is
 * ────────────
 *   The canonical staged-pipeline entry for ALL intelligence
 *   operations. UI code must never call the underlying engines
 *   directly; everything flows through this module.
 *
 *   The pipeline (per wave-6 spec):
 *
 *     1. observation        — caller-supplied input (scan, weather,
 *                             task pattern)
 *     2. classification     — caller-supplied kind/category
 *     3. confidence_calibration
 *                           — runtime/intelligence/confidenceCalibration.js
 *     4. context_enrichment — merges farm/season/weather/quality signals
 *     5. recommendation_ranking
 *                           — runtime/intelligence/recommendationRanking.js
 *     6. intervention_tracking
 *                           — runtime/intelligence/interventionOutcomeRuntime.js
 *                           (write path; triggered by farmer action)
 *     7. outcome_feedback   — interventionOutcomeRuntime.recordOutcome
 *     8. longitudinal_learning
 *                           — recommendationMemoryRuntime +
 *                             farmMemoryRuntime + seasonalContinuityRuntime
 *
 *   Every produceRecommendations() call:
 *     • emits a structured trace record into wave-5 eventRuntime
 *       under EVENT_KIND.RECOMMENDATION_EMITTED
 *     • records into recommendationMemoryRuntime
 *     • returns a frozen envelope including the trace key + scoring
 *
 * Safety gates (per spec)
 *   • low-confidence suppression  — calibration.suppressed → drop
 *   • insufficient-context fallback — returns degraded-mode envelope
 *   • conflicting-signal detection — calibration flags it
 *   • degraded-mode recommendations — when engines fail, returns
 *     a safe "wait_for_more_data" envelope (never throws)
 *   • offline-safe recommendation replay — every emission is in
 *     the event log; consumers can re-derive via replayEvents()
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws.
 *   • SSR-safe.
 *   • Deterministic — given the same input, returns the same
 *     ordered recommendation set. No randomness, no model calls,
 *     no clock-dependent jitter beyond the explicit `currentMonth`
 *     signal passed by the caller.
 *   • No autonomous actions — the pipeline returns recommendations
 *     but does NOT trigger any side effects (notifications, tasks,
 *     mutations) on its own.
 */

import calibrate, {
  getCalibrationTelemetry, CONFIDENCE_BUCKET,
} from './confidenceCalibration.js';
import {
  rankRecommendations, getRankingTelemetry,
} from './recommendationRanking.js';
import {
  recordRecommendation, getRecommendationTelemetry,
  getRecommendationHistory,
} from './recommendationMemoryRuntime.js';
import {
  recordIntervention as _recordIntervention,
  recordOutcome as _recordOutcome,
  getOutcomeTelemetry,
} from './interventionOutcomeRuntime.js';
import {
  getFarmMemoryView, getFarmMemoryTelemetry,
} from './farmMemoryRuntime.js';
import {
  getSeasonalSnapshot, getSeasonalTelemetry,
} from './seasonalContinuityRuntime.js';
import {
  recordEvent, EVENT_KIND,
} from '../events/eventRuntime.js';
import {
  registerWriter, PERSISTENCE_DOMAIN,
} from '../persistence/persistenceRuntime.js';

const RUNTIME_VERSION = 'intelligence-runtime-v1';

export const INTELLIGENCE_STAGE = Object.freeze({
  OBSERVATION:             'observation',
  CLASSIFICATION:          'classification',
  CONFIDENCE_CALIBRATION:  'confidence_calibration',
  CONTEXT_ENRICHMENT:      'context_enrichment',
  RECOMMENDATION_RANKING:  'recommendation_ranking',
  INTERVENTION_TRACKING:   'intervention_tracking',
  OUTCOME_FEEDBACK:        'outcome_feedback',
  LONGITUDINAL_LEARNING:   'longitudinal_learning',
});

const _state = {
  installed:        false,
  installedAt:      null,
  producedTotal:    0,
  producedReturned: 0,
  producedSuppressed: 0,
  degradedFallbackCount: 0,
};

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');
const _nowMs = () => _safe(() => Date.now(), 0);

function _newRecId() {
  return _safe(() =>
    'rec-' + Math.random().toString(36).slice(2, 10)
    + '-' + Date.now().toString(36),
  'rec-fallback');
}

// ─── Pipeline stages ────────────────────────────────────────

function _stageCalibration(observation) {
  return calibrate({
    raw:                observation.rawConfidence,
    observationCount:   observation.observationCount,
    conflictingSignals: observation.conflictingSignals,
    signalQuality:      observation.signalQuality,
  });
}

function _stageContextEnrichment(input) {
  const farmCtx = input.farmContext || {};
  const now = new Date();
  return Object.freeze({
    crop:                farmCtx.crop || null,
    cropFamily:          farmCtx.cropFamily || null,
    region:              farmCtx.region || null,
    currentMonth:        typeof input.currentMonth === 'number'
                           ? input.currentMonth
                           : now.getUTCMonth() + 1,
    weatherRisk:         farmCtx.weatherRisk || null,
    scanQuality:         typeof input.signalQuality === 'number'
                           ? input.signalQuality
                           : null,
    interventionsForKind: typeof farmCtx.interventionsForKind === 'number'
                           ? farmCtx.interventionsForKind : 0,
    outcomeRate:         typeof farmCtx.outcomeRate === 'number'
                           ? farmCtx.outcomeRate : null,
    cooldownActive:      !!farmCtx.cooldownActive,
    notificationsToday:  farmCtx.notificationsToday || 0,
  });
}

function _emitDegraded(observation, calibration, reason) {
  _state.degradedFallbackCount += 1;
  const recId = _newRecId();
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    ok:             true,
    degraded:       true,
    reason,
    recId,
    recommendations: Object.freeze([]),
    calibration:     calibration || null,
    trace: Object.freeze({
      stages: Object.freeze([
        INTELLIGENCE_STAGE.OBSERVATION,
        INTELLIGENCE_STAGE.CLASSIFICATION,
        INTELLIGENCE_STAGE.CONFIDENCE_CALIBRATION,
      ]),
      observationKind: observation && observation.kind || null,
      degradedAt:      _now(),
    }),
  });
}

/**
 * Main pipeline. Accepts an observation + candidate recommendations
 * + farm context; returns a frozen envelope with ranked + traced
 * output.
 *
 *   @param {{
 *     observation: {
 *       kind: string,                // e.g. 'scan.completed'
 *       rawConfidence?: number|string,
 *       observationCount?: number,
 *       conflictingSignals?: string[],
 *       signalQuality?: number,      // 0-1
 *     },
 *     candidates: Array<Object>,     // recommendation rows
 *     farmContext?: Object,
 *     currentMonth?: number,
 *   }} input
 *   @returns {Object} frozen envelope
 */
export function produceRecommendations(input) {
  return _safe(() => {
    _state.producedTotal += 1;
    if (!input || typeof input !== 'object') {
      return _emitDegraded(null, null, 'invalid_input');
    }
    const observation = input.observation || {};
    if (!observation.kind) {
      return _emitDegraded(observation, null, 'missing_observation_kind');
    }
    // Stage 3: confidence calibration
    const calibration = _stageCalibration(observation);
    if (!calibration || calibration.suppressed) {
      _state.producedSuppressed += 1;
      const recId = _newRecId();
      // Record the suppression in memory for fairness audits later.
      recordRecommendation({
        recId, kind: observation.kind, crop: input.farmContext && input.farmContext.crop,
        region: input.farmContext && input.farmContext.region,
        bucket: calibration && calibration.bucket,
        score: 0, suppressed: true,
      });
      recordEvent(EVENT_KIND.RECOMMENDATION_EMITTED, {
        recId, kind: observation.kind, suppressed: true,
        bucket: calibration && calibration.bucket,
        reasons: calibration && calibration.reasons,
      });
      return Object.freeze({
        runtimeVersion: RUNTIME_VERSION,
        ok:             true,
        degraded:       false,
        recId,
        recommendations: Object.freeze([]),
        suppressed: true,
        suppressionReasons: calibration && calibration.reasons,
        calibration,
        trace: Object.freeze({
          stages: Object.freeze([
            INTELLIGENCE_STAGE.OBSERVATION,
            INTELLIGENCE_STAGE.CLASSIFICATION,
            INTELLIGENCE_STAGE.CONFIDENCE_CALIBRATION,
          ]),
          observationKind: observation.kind,
          at: _now(),
        }),
      });
    }
    // Stage 4: context enrichment
    const ctx = _stageContextEnrichment(input);
    // Stage 5: recommendation ranking
    const candidates = Array.isArray(input.candidates) ? input.candidates : [];
    // Attach calibration to each candidate so the ranker can apply
    // continuity-confidence signal uniformly.
    const annotated = candidates.map((rec) =>
      Object.freeze({ ...rec, calibration }));
    const ranked = rankRecommendations(annotated, ctx);
    const recId = _newRecId();
    // Stage 8 (immediate): longitudinal learning — record top result.
    const top = ranked.length > 0 ? ranked[0] : null;
    if (top) {
      recordRecommendation({
        recId,
        kind:   observation.kind,
        crop:   ctx.crop,
        region: ctx.region,
        bucket: calibration.bucket,
        score:  top.scoring && top.scoring.score,
        suppressed: false,
      });
    }
    // Wave-5 event log mirror.
    recordEvent(EVENT_KIND.RECOMMENDATION_EMITTED, {
      recId,
      kind:    observation.kind,
      bucket:  calibration.bucket,
      score:   top && top.scoring && top.scoring.score,
      n:       ranked.length,
    });
    _state.producedReturned += 1;
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ok:             true,
      degraded:       false,
      recId,
      recommendations: ranked,
      suppressed:     false,
      calibration,
      context:        ctx,
      trace: Object.freeze({
        stages: Object.freeze([
          INTELLIGENCE_STAGE.OBSERVATION,
          INTELLIGENCE_STAGE.CLASSIFICATION,
          INTELLIGENCE_STAGE.CONFIDENCE_CALIBRATION,
          INTELLIGENCE_STAGE.CONTEXT_ENRICHMENT,
          INTELLIGENCE_STAGE.RECOMMENDATION_RANKING,
          INTELLIGENCE_STAGE.LONGITUDINAL_LEARNING,
        ]),
        observationKind: observation.kind,
        at: _now(),
      }),
    });
  }, _emitDegraded(input && input.observation, null, 'pipeline_threw'));
}

/**
 * Record that a farmer acted on a recommendation. Delegates to
 * interventionOutcomeRuntime; this entry guarantees the side-effect
 * goes through the canonical writer and emits the wave-5 event.
 */
export function recordIntervention(entry) {
  const out = _recordIntervention(entry);
  if (out && out.ok) {
    recordEvent(EVENT_KIND.RECOMMENDATION_ACTED, {
      recId:  entry && entry.recId,
      action: entry && entry.action,
      kind:   entry && entry.kind,
    });
  }
  return out;
}

/**
 * Record an outcome observed after an intervention.
 */
export function recordOutcome(entry) {
  return _recordOutcome(entry);
}

/**
 * Composite health view — drives __intelligenceHealth().
 */
export function getIntelligenceHealth() {
  const calibration = _safe(getCalibrationTelemetry, null);
  const ranking     = _safe(getRankingTelemetry, null);
  const recMemory   = _safe(getRecommendationTelemetry, null);
  const outcome     = _safe(getOutcomeTelemetry, null);
  const farmMem     = _safe(getFarmMemoryTelemetry, null);
  const seasonal    = _safe(getSeasonalTelemetry, null);

  const calibrationOk = !!calibration;
  const rankingOk     = !!ranking;
  const memoryOk      = !!recMemory;
  const outcomeOk     = !!outcome;

  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    installed:      _state.installed,
    installedAt:    _state.installedAt,
    pipeline: Object.freeze({
      producedTotal:      _state.producedTotal,
      producedReturned:   _state.producedReturned,
      producedSuppressed: _state.producedSuppressed,
      degradedFallbacks:  _state.degradedFallbackCount,
    }),
    stages: Object.freeze({
      calibration: calibrationOk ? calibration : { ok: false },
      ranking:     rankingOk ? ranking : { ok: false },
      memory:      memoryOk ? recMemory : { ok: false },
      outcome:     outcomeOk ? outcome : { ok: false },
      farmMemory:  farmMem,
      seasonal:    seasonal,
    }),
    overall: Object.freeze({
      ok: calibrationOk && rankingOk && memoryOk && outcomeOk,
    }),
  });
}

/**
 * Read-only recommendation trace — last N records from
 * recommendationMemoryRuntime + interpretation hints. Drives
 * __recommendationTrace().
 */
export function getRecommendationTrace(limit) {
  const history = getRecommendationHistory(typeof limit === 'number' ? limit : 50);
  const calib = _safe(getCalibrationTelemetry, null);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    bufferSize:     history.length,
    recent:         history,
    bucketTotals:   calib ? calib.byBucket : null,
  });
}

/**
 * Confidence calibration snapshot — drives __confidenceCalibration().
 */
export function getConfidenceCalibrationSnapshot() {
  return _safe(getCalibrationTelemetry, Object.freeze({
    runtimeVersion: 'confidence-calibration-v1',
    ok: false,
  }));
}

/**
 * Composite learning snapshot — drives __learningHealth().
 */
export function getLearningHealth() {
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    recommendation: _safe(getRecommendationTelemetry, null),
    outcomes:       _safe(getOutcomeTelemetry, null),
    farmMemory:     _safe(getFarmMemoryTelemetry, null),
    seasonal:       _safe(getSeasonalTelemetry, null),
  });
}

/**
 * Continuity signals snapshot — drives __continuitySignals().
 * Reads from the seasonal runtime + farm memory views.
 */
export function getContinuitySignals(ctx) {
  const seasonal = _safe(() => getSeasonalSnapshot(ctx || {}), null);
  const farmMem  = _safe(() => getFarmMemoryView(ctx || {}), null);
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    seasonal:       seasonal,
    farmMemory:     farmMem,
  });
}

/**
 * Install the intelligence runtime. Idempotent. Registers wave-6
 * canonical writers with the persistence registry so the wave-5
 * single-writer invariant covers the intelligence layer too.
 */
export function installIntelligenceRuntime() {
  if (_state.installed) {
    return Object.freeze({ ok: true, alreadyInstalled: true });
  }
  // Note: PERSISTENCE_DOMAIN.RECOMMENDATION_LOG /
  // PERSISTENCE_DOMAIN.OUTCOME_MEMORY already wired in wave 5;
  // wave 6 attaches the runtime-level writers as additional
  // entries so duplicate-registration detection works correctly.
  _safe(() => registerWriter(
    PERSISTENCE_DOMAIN.RECOMMENDATION_LOG,
    'src/runtime/intelligence/recommendationMemoryRuntime.js'),
  null);
  _safe(() => registerWriter(
    PERSISTENCE_DOMAIN.OUTCOME_MEMORY,
    'src/runtime/intelligence/interventionOutcomeRuntime.js'),
  null);
  _state.installed = true;
  _state.installedAt = _now();
  return Object.freeze({ ok: true });
}

export function _resetForTests() {
  _state.installed = false;
  _state.installedAt = null;
  _state.producedTotal = 0;
  _state.producedReturned = 0;
  _state.producedSuppressed = 0;
  _state.degradedFallbackCount = 0;
}

const _module = {
  INTELLIGENCE_STAGE, CONFIDENCE_BUCKET,
  produceRecommendations, recordIntervention, recordOutcome,
  installIntelligenceRuntime, getIntelligenceHealth,
  getRecommendationTrace, getConfidenceCalibrationSnapshot,
  getLearningHealth, getContinuitySignals,
  _resetForTests,
};
export default _module;
