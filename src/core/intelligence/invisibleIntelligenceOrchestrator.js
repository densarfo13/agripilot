/**
 * invisibleIntelligenceOrchestrator.js — Phase 2 §7.
 *
 *   import { runInvisibleIntelligence }
 *     from 'src/core/intelligence/invisibleIntelligenceOrchestrator.js';
 *
 *   const v = runInvisibleIntelligence({
 *     activeFarm, governance, scanInput, yieldInput, ngoInput,
 *   });
 *
 *   v = {
 *     oneBestAction,            — single calm tile (deterministic remains primary)
 *     confidenceTone,           — 'high_confidence' | 'medium_confidence' | 'needs_review'
 *     reason,                   — { key, fallback, params }
 *     suppressedInsights,       — [{ kind, reason }]
 *     invisibleSignalsUsed,     — array of advanced signals that participated
 *     fallbackUsed,             — true if any advanced engine fell back
 *     engineVersion:'invisible-orchestrator-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   The SAFETY-FIRST composer. Calls every Phase-2 engine in
 *   PARALLEL but consults the deterministic recommendation
 *   governance FIRST. Advanced signals can only:
 *     • re-rank a deterministic candidate set
 *     • downgrade confidence
 *     • add a calm "what to monitor" follow-up
 *
 *   They CANNOT:
 *     • override an urgent safety rule (crop survival, disease serious)
 *     • introduce new candidates outside the deterministic set
 *     • surface raw model scores
 *
 *   Surfaces receive ONE recommendation envelope — same shape as
 *   `runRecommendationGovernance` — so calling code is identical.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Deterministic fallback always available.
 */

import { runRecommendationGovernance }
  from '../recommendations/recommendationGovernanceEngine.js';
import { runMlRanking } from '../ml/mlRankingEngine.js';
import { calibrateDiseaseConfidence }
  from '../scan/diseaseConfidenceCalibration.js';
import { runPredictiveYield } from '../yield/predictiveYieldEngine.js';
import { buildNgoIntelligence } from '../ngo/ngoIntelligenceEngine.js';

const ENGINE_VERSION = 'invisible-orchestrator-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Urgent safety candidate ids — these can NEVER be overridden by
// the ML ranker or calibration downgrade.
const _PROTECTED_CANDIDATES = new Set([
  'crop_survival_frost',
  'crop_survival_wind',
  'crop_survival_flood',
  'disease_escalation',
]);

function _isProtected(action) {
  if (!_isObj(action)) return false;
  return _PROTECTED_CANDIDATES.has(_str(action.candidateId));
}

/**
 * Compose every Phase-2 engine into ONE calm recommendation
 * envelope. Always returns a frozen envelope; never throws.
 */
export function runInvisibleIntelligence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const farm = _isObj(safe.activeFarm) ? safe.activeFarm : {};

    // 1) Deterministic governance — primary, ALWAYS runs.
    const governance = _isObj(safe.governance)
      ? safe.governance
      : _safe(() => runRecommendationGovernance({
          decisionInput: safe.decisionInput || {},
          farmMemory:    safe.farmMemory,
          mode:          safe.mode,
        }), null);

    const oneBestAction = (governance && governance.oneBestAction) || null;
    const reason        = (governance && governance.reason) || null;
    const baseUrgency   = _str(governance && governance.urgency) || 'low';
    let confidenceTone  = _str(governance && governance.confidenceTone) || 'medium_confidence';

    // 2) ML ranking — never overrides protected candidates.
    const ml = _safe(() => runMlRanking({
      baseRecommendations: oneBestAction ? [{
        ...oneBestAction,
        urgency: baseUrgency,
      }] : [],
      activeFarm:           farm,
      crop:                 _str(farm.cropId || farm.crop),
      region:               _str(farm.region),
      lifecycleStage:       _str(farm.lifecycleStage || farm.stage),
      weather:              safe.weather,
      scanHistory:          safe.scanHistory,
      taskHistory:          safe.taskHistory,
      outcomeHistory:       safe.outcomeHistory,
      recommendationHistory:safe.recommendationHistory,
      offlineState:         safe.offlineState,
    }), null);

    // 3) Disease calibration — only if a scan input was provided.
    const calibration = _isObj(safe.scanInput)
      ? _safe(() => calibrateDiseaseConfidence(safe.scanInput), null) : null;

    // Apply calibration to confidenceTone — downgrade-only, never upgrade
    // past 'high_confidence' if calibration says 'Needs review'.
    if (calibration && calibration.confidenceToneRaw === 'Needs review'
        && !_isProtected(oneBestAction)) {
      confidenceTone = 'needs_review';
    }

    // 4) Yield risk — read-only signal, never overrides oneBestAction.
    const yieldResult = _isObj(safe.yieldInput)
      ? _safe(() => runPredictiveYield(safe.yieldInput), null) : null;

    // 5) NGO intelligence — strictly aggregate, no UI effect.
    const ngo = _isObj(safe.ngoInput)
      ? _safe(() => buildNgoIntelligence(safe.ngoInput), null) : null;

    const invisibleSignalsUsed = [];
    if (ml && !ml.fallbackUsed) invisibleSignalsUsed.push('ml_ranking');
    if (calibration && !calibration.fallbackUsed) invisibleSignalsUsed.push('disease_calibration');
    if (yieldResult && !yieldResult.fallbackUsed) invisibleSignalsUsed.push('predictive_yield');
    if (ngo && ngo.exportReady) invisibleSignalsUsed.push('ngo_intelligence');

    const fallbackUsed = (ml && ml.fallbackUsed)
      || (calibration && calibration.fallbackUsed)
      || (yieldResult && yieldResult.fallbackUsed);

    // Suppressed insights — surface to admin diagnostics ONLY.
    const suppressedInsights = [];
    if (calibration && calibration.uncertaintyFactors
        && calibration.uncertaintyFactors.length > 0) {
      suppressedInsights.push(Object.freeze({
        kind:   'calibration_downgrade',
        reason: 'photo_quality_or_crop_mismatch',
      }));
    }
    if (yieldResult && yieldResult.yieldRisk === 'unknown') {
      suppressedInsights.push(Object.freeze({
        kind:   'yield_risk_unknown',
        reason: 'insufficient_data',
      }));
    }

    return Object.freeze({
      engineVersion:        ENGINE_VERSION,
      oneBestAction:        oneBestAction || Object.freeze({
        key:      'decision.action.calm',
        fallback: 'Walk your field and check crop health.',
      }),
      confidenceTone,
      reason:               reason || Object.freeze({
        key: 'decision.reason.calm', fallback: 'No urgent signals today.',
      }),
      suppressedInsights:   Object.freeze(suppressedInsights),
      invisibleSignalsUsed: Object.freeze(invisibleSignalsUsed),
      fallbackUsed:         !!fallbackUsed,
      // Advanced layer results — for admin diagnostics, never UI.
      _ml:                  ml,
      _calibration:         calibration,
      _yield:               yieldResult,
      _ngo:                 ngo,
      generatedAt:          Date.now(),
    });
  }, Object.freeze({
    engineVersion:        ENGINE_VERSION,
    oneBestAction:        Object.freeze({
      key: 'decision.action.calm',
      fallback: 'Walk your field and check crop health.',
    }),
    confidenceTone:       'medium_confidence',
    reason: Object.freeze({
      key: 'decision.reason.calm', fallback: 'No urgent signals today.',
    }),
    suppressedInsights:   Object.freeze([]),
    invisibleSignalsUsed: Object.freeze([]),
    fallbackUsed:         true,
    generatedAt:          Date.now(),
  }));
}

export const _internal = Object.freeze({
  _isProtected, _PROTECTED_CANDIDATES, ENGINE_VERSION,
});

const _module = { runInvisibleIntelligence, _internal };
export default _module;
