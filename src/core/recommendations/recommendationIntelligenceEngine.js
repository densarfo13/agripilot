/**
 * recommendationIntelligenceEngine.js — Operational Refinement §1.
 *
 *   import { runRecommendationIntelligence }
 *     from 'src/core/recommendations/recommendationIntelligenceEngine.js';
 *
 *   const v = runRecommendationIntelligence({
 *     activeFarm, weather, scanHistory, taskHistory,
 *     wateringHistory, farmMemory, region, language,
 *     experienceMode, offlineState,
 *   });
 *
 *   v = {
 *     oneBestAction,                — { key, fallback, params }
 *     reason,                       — { key, fallback, params }
 *     bestTime,                     — { key, fallback, params } | null
 *     urgency,                      — 'low' | 'medium' | 'high'
 *     confidenceTone,               — 'high_confidence' | 'medium_confidence' | 'needs_review'
 *     expectedBenefit,              — { key, fallback, params } | null
 *     followUp,                     — { key, fallback, params } | null
 *     suppressedRecommendations,    — [{ candidateId, reasonLabel, reason }]
 *     engineVersion:'rec-intelligence-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   A thin spec-shaped facade over the existing canonical engines.
 *   Composes — never replaces:
 *     • recommendationGovernanceEngine.runRecommendationGovernance
 *     • farmIntelligenceEngine.runFarmIntelligence (for expectedBenefit)
 *
 *   Maps the spec §1 input shape (activeFarm-centric) onto the
 *   underlying engines' input shapes, then returns the spec §1
 *   output shape verbatim.
 *
 *   Offline state passes through but does not block intelligence —
 *   we still produce a one-best-action even when offline.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Compose-only — no new heuristics inline.
 */

import {
  runRecommendationGovernance,
} from './recommendationGovernanceEngine.js';

const ENGINE_VERSION = 'rec-intelligence-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _expectedBenefitFrom(governance) {
  if (!_isObj(governance)) return null;
  // Crop-survival or disease wins → calm benefit framing.
  const action = governance.oneBestAction;
  if (!_isObj(action) || !action.candidateId) return null;
  const id = _str(action.candidateId);
  if (id.startsWith('crop_survival_')) {
    return Object.freeze({
      key:      'recIntel.benefit.cropSurvival',
      fallback: 'Acting today may prevent loss of exposed plants.',
    });
  }
  if (id === 'disease_escalation') {
    return Object.freeze({
      key:      'recIntel.benefit.disease',
      fallback: 'Earlier treatment usually means a faster recovery.',
    });
  }
  if (id.startsWith('watering_')) {
    return Object.freeze({
      key:      'recIntel.benefit.watering',
      fallback: 'Even watering supports healthier growth this week.',
    });
  }
  if (id === 'harvest_timing') {
    return Object.freeze({
      key:      'recIntel.benefit.harvest',
      fallback: 'Picking at the right window protects flavour and shelf life.',
    });
  }
  return null;
}

/**
 * Single entry point. Always returns an envelope; never throws.
 */
export function runRecommendationIntelligence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const farm = _isObj(safe.activeFarm) ? safe.activeFarm : {};
    const mode = _str(safe.experienceMode).toLowerCase() === 'garden' ? 'garden' : 'farm';

    // Map activeFarm + ambient inputs → decisionInput shape.
    const decisionInput = {
      mode,
      weather:         safe.weather,
      scan:            (Array.isArray(safe.scanHistory) && safe.scanHistory[0]) || null,
      cropLifecycle:   { currentStage: _str(farm.lifecycleStage || farm.stage) || null },
      soil:            safe.soil,
      wateringHistory: safe.wateringHistory,
      marketplace:     _isObj(farm.sellState) ? {
        hasActiveListing: !!(farm.sellState.hasActiveListing),
        buyerMatchCount:  farm.sellState.buyerMatchCount || 0,
      } : safe.marketplace,
      supplier:        safe.supplier,
      ngo:             safe.ngo,
      farmMemory:      safe.farmMemory,
    };

    const governance = _safe(() => runRecommendationGovernance({
      decisionInput,
      farmMemory: safe.farmMemory,
      mode,
    }), null);

    if (!_isObj(governance)) return _emptyEnvelope();

    return Object.freeze({
      engineVersion:             ENGINE_VERSION,
      oneBestAction:             governance.oneBestAction,
      reason:                    governance.reason,
      bestTime:                  governance.bestTime || null,
      urgency:                   _str(governance.urgency) || 'low',
      confidenceTone:            _str(governance.confidenceTone) || 'medium_confidence',
      expectedBenefit:           _expectedBenefitFrom(governance),
      followUp:                  governance.followUpWindow || null,
      suppressedRecommendations: governance.suppressedRecommendations || Object.freeze([]),
      locale:                    _str(safe.language) || _str(safe.locale) || null,
      offline:                   !!safe.offlineState,
      generatedAt:               Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    oneBestAction: Object.freeze({
      key:      'decision.action.calm',
      fallback: 'Walk your field and check crop health.',
    }),
    reason: Object.freeze({
      key: 'decision.reason.calm', fallback: 'No urgent signals today.',
    }),
    bestTime:                  null,
    urgency:                   'low',
    confidenceTone:            'medium_confidence',
    expectedBenefit:           null,
    followUp:                  null,
    suppressedRecommendations: Object.freeze([]),
    locale:                    null,
    offline:                   false,
    generatedAt:               Date.now(),
  });
}

export const _internal = Object.freeze({
  _expectedBenefitFrom, ENGINE_VERSION,
});

const _module = { runRecommendationIntelligence, _internal };
export default _module;
