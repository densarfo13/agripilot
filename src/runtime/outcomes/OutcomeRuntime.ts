/**
 * src/runtime/outcomes/OutcomeRuntime.ts — Composite + health.
 */

import { OUTCOME_RUNTIME_VERSION } from './outcomeContracts';
import {
  recordRecommendationOutcome, listRecommendationOutcomes,
  recommendationOutcomeSummary, RECOMMENDATION_OUTCOME_VERSION,
} from './RecommendationOutcomeTracker';
import {
  recordInterventionOutcome, INTERVENTION_OUTCOME_VERSION,
} from './InterventionOutcomeTracker';

export {
  recordRecommendationOutcome, listRecommendationOutcomes,
  recommendationOutcomeSummary,
  recordInterventionOutcome,
  OUTCOME_RUNTIME_VERSION,
};

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function outcomeHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion: OUTCOME_RUNTIME_VERSION,
    initialized:                 true,
    recommendationTrackingReady: true,
    interventionTrackingReady:   true,
    learningSignalsReady:        true,
    snapshot: recommendationOutcomeSummary(),
    versions: Object.freeze({
      recommendation: RECOMMENDATION_OUTCOME_VERSION,
      intervention:   INTERVENTION_OUTCOME_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: OUTCOME_RUNTIME_VERSION,
    initialized: false,
    recommendationTrackingReady: false,
    interventionTrackingReady: false,
    learningSignalsReady: false,
  }));
}

export function installOutcomeRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeHealth !== 'function') {
      w.__outcomeHealth = function () {
        const out = outcomeHealth();
        try { console.log('[Farroway · Outcomes]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
