/**
 * causalLearningFacade.js — interface stubs for future causal ML.
 *
 *   import { probeCausalReadiness, CAUSAL_QUESTION }
 *     from 'src/core/intelligence/causalLearningFacade.js';
 *
 *   const v = probeCausalReadiness({
 *     question: CAUSAL_QUESTION.INTERVENTION_TO_OUTCOME,
 *     scope:    { crop, region },
 *     dataset:  { events, scans, outcomes },
 *   });
 *
 *   v = {
 *     causalReadiness,        — 'unavailable' | 'partial' | 'ready'
 *     dataSufficiency,        — 'thin' | 'developing' | 'rich'
 *     learningDepth,          — passthrough from multiSeasonMemory
 *     question,
 *     reasonHidden,           — internal-only — never shown to user
 *     engineVersion:'causal-facade-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   NO real causal inference. NO regression. NO graph learning.
 *   This file is the STABLE CONTRACT that downstream surfaces
 *   can call today and get a safe "not yet ready" envelope.
 *   When a real causal-ML provider lands, it swaps in behind
 *   the same signature — zero UI changes.
 *
 *   The four canonical causal questions the spec calls out are:
 *     INTERVENTION_TO_OUTCOME   — did the intervention cause recovery?
 *     WEATHER_DISEASE_CORR      — does weather pattern predict disease?
 *     RECOMMENDATION_RECOVERY   — does recommendation X shorten
 *                                  recovery time?
 *     REGION_YIELD_IMPACT       — does region predict yield band?
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Always returns `causalReadiness: 'unavailable'` until a real
 *     provider is registered via registerCausalProvider().
 */

import { FLAG, isFeatureFlagOn } from '../deployment/deploymentGovernance.js';

const ENGINE_VERSION = 'causal-facade-v1';

export const CAUSAL_QUESTION = Object.freeze({
  INTERVENTION_TO_OUTCOME: 'intervention_to_outcome',
  WEATHER_DISEASE_CORR:    'weather_disease_corr',
  RECOMMENDATION_RECOVERY: 'recommendation_recovery',
  REGION_YIELD_IMPACT:     'region_yield_impact',
});

const _VALID_QUESTIONS = new Set(Object.values(CAUSAL_QUESTION));

const _isObj = (v) => v != null && typeof v === 'object';
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

let _provider = null;

/**
 * Register a causal-inference provider. The provider receives
 * the same input as probeCausalReadiness and is expected to
 * return either an enriched envelope or null.
 *
 * Idempotent — registering null clears it.
 */
export function registerCausalProvider(provider) {
  _provider = (typeof provider === 'function') ? provider : null;
  return _provider != null;
}

function _dataSufficiencyFor(dataset) {
  if (!_isObj(dataset)) return 'thin';
  const events = Array.isArray(dataset.events) ? dataset.events.length : 0;
  const scans  = Array.isArray(dataset.scans)  ? dataset.scans.length : 0;
  const outcomes = Array.isArray(dataset.outcomes) ? dataset.outcomes.length : 0;
  const total = events + scans + outcomes;
  if (total >= 60) return 'rich';
  if (total >= 20) return 'developing';
  return 'thin';
}

/**
 * Probe causal readiness for a given question + scope. Always
 * returns a frozen envelope; never throws.
 */
export function probeCausalReadiness(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const question = _VALID_QUESTIONS.has(safe.question) ? safe.question : null;
    const flagOn = isFeatureFlagOn(FLAG.YIELD_PREDICTION)
                 || isFeatureFlagOn(FLAG.SCAN_V5_INVISIBLE);
    const sufficiency = _dataSufficiencyFor(safe.dataset);
    const learningDepth = _isObj(safe.learningDepth) || typeof safe.learningDepth === 'string'
      ? safe.learningDepth : sufficiency;

    if (!question) {
      return _freeze({
        causalReadiness: 'unavailable',
        dataSufficiency: sufficiency,
        learningDepth,
        question:        null,
        reasonHidden:    'no_question',
      });
    }
    if (!_provider) {
      return _freeze({
        causalReadiness: 'unavailable',
        dataSufficiency: sufficiency,
        learningDepth,
        question,
        reasonHidden:    'no_provider',
      });
    }
    if (!flagOn) {
      return _freeze({
        causalReadiness: 'unavailable',
        dataSufficiency: sufficiency,
        learningDepth,
        question,
        reasonHidden:    'flag_off',
      });
    }
    // With a provider registered AND flag on, defer to the
    // provider. Wrapped in try/catch so a failure degrades to
    // "partial".
    let providerVerdict = null;
    try { providerVerdict = _provider(safe); } catch { providerVerdict = null; }
    if (!_isObj(providerVerdict)) {
      return _freeze({
        causalReadiness: 'partial',
        dataSufficiency: sufficiency,
        learningDepth,
        question,
        reasonHidden:    'provider_returned_empty',
      });
    }
    return _freeze({
      causalReadiness: providerVerdict.causalReadiness || 'partial',
      dataSufficiency: providerVerdict.dataSufficiency || sufficiency,
      learningDepth,
      question,
      reasonHidden:    null,
    });
  }, _freeze({
    causalReadiness: 'unavailable',
    dataSufficiency: 'thin',
    learningDepth:   'thin',
    question:        null,
    reasonHidden:    'facade_error',
  }));
}

function _freeze(o) {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    ...o,
    generatedAt: Date.now(),
  });
}

export const _internal = Object.freeze({
  _dataSufficiencyFor, _VALID_QUESTIONS, ENGINE_VERSION,
  get _provider() { return _provider; },
});

const _module = {
  probeCausalReadiness, registerCausalProvider,
  CAUSAL_QUESTION, _internal,
};
export default _module;
