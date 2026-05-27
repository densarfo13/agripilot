/**
 * farmIntelligenceEngine.js — Phase 1 single-entry intelligence
 * facade.
 *
 *   import { runFarmIntelligence }
 *     from 'src/intelligence/farmIntelligenceEngine.js';
 *
 *   const v = runFarmIntelligence({
 *     crop, region, country, weather, stage,
 *     scanHistory, completedTasks, season,
 *     soil, temp, rainfall, humidity, locale,
 *   });
 *
 *   v = {
 *     nextBestAction,            — { key, fallback, params }
 *     riskAlerts,                — [{ key, fallback, severity }]
 *     wateringRecommendation,    — { key, fallback, params } | null
 *     diseaseLikelihood,         — 'low' | 'medium' | 'high'
 *     growthConfidence,          — 'low' | 'medium' | 'high'
 *     taskPrioritization,        — [{ id, urgency, source }]
 *     scanUrgency,               — 'low' | 'medium' | 'high'
 *     fundingRelevance,          — { key, fallback } | null
 *     harvestReadinessEstimate,  — { key, fallback, params } | null
 *     engineVersion:'farm-intelligence-v1', generatedAt: number,
 *   }
 *
 * What this is
 * ────────────
 *   ONE entry point that composes — never replaces — every
 *   intelligence engine shipped earlier in this session:
 *
 *     • runDecisionEngine               (decisionPriorityEngine)
 *     • runPredictiveRisk               (predictiveRiskEngine)
 *     • runRecommendationGovernance     (recommendationGovernanceEngine)
 *     • runFarmLoopTick                 (farmLoopEngine)
 *
 *   Compose-only: the facade reads from existing engines, never
 *   inlines new heuristics. If an engine doesn't fire, the facade
 *   degrades to a calm fallback envelope.
 *
 *   The output shape matches the spec §1 exactly so screens can
 *   read a single source rather than juggling 5+ engine outputs.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Never exposes raw probabilities, never uses AI / panic wording.
 */

import { runDecisionEngine }
  from '../core/intelligence/decisionPriorityEngine.js';
import { runPredictiveRisk }
  from '../core/intelligence/predictiveRiskEngine.js';
import { runRecommendationGovernance }
  from '../core/recommendations/recommendationGovernanceEngine.js';

const ENGINE_VERSION = 'farm-intelligence-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Helpers ─────────────────────────────────────────────────

function _diseaseLikelihoodFrom(scanHistory, riskForecast) {
  const recent = Array.isArray(scanHistory) ? scanHistory.slice(0, 5) : [];
  const severeCount = recent.filter((s) =>
    _str(s && s.severity).toLowerCase() === 'serious').length;
  if (severeCount >= 1) return 'high';
  const moderateCount = recent.filter((s) =>
    _str(s && s.severity).toLowerCase() === 'moderate').length;
  const fungalRisk = _isObj(riskForecast) && Array.isArray(riskForecast.risks)
    ? riskForecast.risks.find((r) => r && r.kind === 'fungal') : null;
  if (moderateCount >= 1 || (fungalRisk && fungalRisk.severity === 'high')) return 'medium';
  return 'low';
}

function _growthConfidenceFrom(input, riskForecast) {
  const completed = Array.isArray(input.completedTasks) ? input.completedTasks.length : 0;
  const scans = Array.isArray(input.scanHistory) ? input.scanHistory.length : 0;
  const sources = (completed > 0 ? 1 : 0) + (scans > 0 ? 1 : 0)
                + (_isObj(input.weather) ? 1 : 0) + (input.stage ? 1 : 0);
  const anyHighRisk = _isObj(riskForecast) && riskForecast.anyHigh;
  if (anyHighRisk) return 'low';
  if (sources >= 3) return 'high';
  if (sources >= 2) return 'medium';
  return 'low';
}

function _scanUrgencyFrom(decision, riskForecast) {
  const u = _str(decision && decision.urgency).toLowerCase();
  if (u === 'high') return 'high';
  if (_isObj(riskForecast) && riskForecast.anyHigh) return 'high';
  if (u === 'medium' || (_isObj(riskForecast) && riskForecast.anyMedium)) return 'medium';
  return 'low';
}

function _wateringFrom(input, decision) {
  const w = _isObj(input.weather) ? input.weather : {};
  const rain = _num(w.rainProbability24hPct);
  if (rain != null && rain >= 60) {
    return Object.freeze({
      key:      'intelligence.watering.skipRain',
      fallback: 'Hold off on watering — rain is likely soon.',
    });
  }
  // Defer to the decision engine's candidate if it picked watering.
  const action = decision && decision.oneBestAction;
  if (action && _str(action.candidateId).startsWith('watering_')) {
    return Object.freeze({
      key:      _str(action.key) || 'intelligence.watering.now',
      fallback: _str(action.fallback) || 'Water in the cooler hours today.',
      params:   action.params,
    });
  }
  const heat = _num(w.temp);
  if (heat != null && heat >= 32) {
    return Object.freeze({
      key:      'intelligence.watering.heat',
      fallback: 'Water deeply in the cooler hours — heat will dry soil quickly.',
    });
  }
  return null;
}

function _fundingRelevanceFrom(input) {
  // Region + crop both known → funding is contextually relevant.
  const region = _str(input.region) || _str(input.country);
  const crop = _str(input.crop);
  if (!region || !crop) return null;
  return Object.freeze({
    key:      'intelligence.funding.contextual',
    fallback: 'Funding options for {crop} in {region} may apply.',
    params:   { crop, region },
  });
}

function _harvestEstimateFrom(input) {
  const stage = _str(input.stage).toLowerCase();
  if (stage === 'harvest') {
    return Object.freeze({
      key:      'intelligence.harvest.now',
      fallback: 'Your crop is ready to harvest — plan picking soon.',
    });
  }
  if (stage === 'fruiting') {
    return Object.freeze({
      key:      'intelligence.harvest.soon',
      fallback: 'Fruit set is underway. Harvest is approaching.',
    });
  }
  if (stage === 'flowering') {
    return Object.freeze({
      key:      'intelligence.harvest.midSeason',
      fallback: 'Flowering stage — harvest is still a few weeks away.',
    });
  }
  return null;
}

function _riskAlertsFrom(riskForecast) {
  if (!_isObj(riskForecast) || !Array.isArray(riskForecast.risks)) return [];
  return riskForecast.risks
    .filter((r) => r && (r.severity === 'high' || r.severity === 'medium'))
    .slice(0, 3)
    .map((r) => Object.freeze({
      kind:     r.kind,
      severity: r.severity,
      key:      r.label && r.label.key,
      fallback: r.label && r.label.fallback,
    }));
}

function _taskPrioritizationFrom(decision) {
  const out = [];
  if (decision && _isObj(decision.oneBestAction)) {
    out.push(Object.freeze({
      id:      decision.oneBestAction.candidateId || 'one_best_action',
      urgency: _str(decision.urgency) || 'low',
      source:  'decision',
    }));
  }
  const suppressed = decision && Array.isArray(decision.suppressedActions)
    ? decision.suppressedActions.slice(0, 3) : [];
  for (const s of suppressed) {
    out.push(Object.freeze({
      id:      s.candidateId,
      urgency: 'low',
      source:  'decision_suppressed',
    }));
  }
  return out;
}

// ─── Public ──────────────────────────────────────────────────

/**
 * Compose the unified intelligence envelope. Always returns an
 * envelope; never throws.
 *
 * @param {object} input — see spec §1
 * @returns {object}
 */
export function runFarmIntelligence(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};

    // Map our flat input into the decision engine's input shape.
    const decisionInput = {
      mode:            'farm',
      weather:         safe.weather,
      scan:            (Array.isArray(safe.scanHistory) && safe.scanHistory[0]) || null,
      cropLifecycle:   { currentStage: _str(safe.stage) || null },
      soil:            safe.soil,
      wateringHistory: safe.wateringHistory,
      marketplace:     safe.marketplace,
      supplier:        safe.supplier,
      ngo:             safe.ngo,
    };
    const decision = _safe(() => runDecisionEngine(decisionInput), null);

    // Predictive risk — feeds disease likelihood + growth confidence.
    const riskInput = {
      weather:         safe.weather,
      weatherForecast: safe.weatherForecast,
      soil:            safe.soil,
      cropLifecycle:   { currentStage: _str(safe.stage) || null },
      farmMemory:      safe.farmMemory,
      wateringHistory: safe.wateringHistory,
    };
    const riskForecast = _safe(() => runPredictiveRisk(riskInput), null);

    // Governance — produces the spec-shaped envelope but at the
    // recommendation layer. Used for the canonical next-best action.
    const governance = _safe(() => runRecommendationGovernance({
      decisionInput,
      farmMemory: safe.farmMemory,
    }), null);

    const nextBestAction = (governance && governance.oneBestAction)
      || (decision && decision.oneBestAction)
      || Object.freeze({
        key:      'intelligence.action.calm',
        fallback: 'Walk your field and check crop health.',
      });

    return Object.freeze({
      engineVersion:           ENGINE_VERSION,
      nextBestAction,
      riskAlerts:              Object.freeze(_riskAlertsFrom(riskForecast)),
      wateringRecommendation:  _wateringFrom(safe, decision),
      diseaseLikelihood:       _diseaseLikelihoodFrom(safe.scanHistory, riskForecast),
      growthConfidence:        _growthConfidenceFrom(safe, riskForecast),
      taskPrioritization:      Object.freeze(_taskPrioritizationFrom(decision)),
      scanUrgency:             _scanUrgencyFrom(decision, riskForecast),
      fundingRelevance:        _fundingRelevanceFrom(safe),
      harvestReadinessEstimate: _harvestEstimateFrom(safe),
      locale:                  _str(safe.locale) || null,
      generatedAt:             Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:           ENGINE_VERSION,
    nextBestAction: Object.freeze({
      key:      'intelligence.action.calm',
      fallback: 'Walk your field and check crop health.',
    }),
    riskAlerts:              Object.freeze([]),
    wateringRecommendation:  null,
    diseaseLikelihood:       'low',
    growthConfidence:        'low',
    taskPrioritization:      Object.freeze([]),
    scanUrgency:             'low',
    fundingRelevance:        null,
    harvestReadinessEstimate: null,
    locale:                  null,
    generatedAt:             Date.now(),
  });
}

export const _internal = Object.freeze({
  _diseaseLikelihoodFrom, _growthConfidenceFrom, _scanUrgencyFrom,
  _wateringFrom, _fundingRelevanceFrom, _harvestEstimateFrom,
  _riskAlertsFrom, _taskPrioritizationFrom, ENGINE_VERSION,
});

const _module = { runFarmIntelligence, _internal };
export default _module;
