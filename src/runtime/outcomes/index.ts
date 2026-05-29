/**
 * src/runtime/outcomes/index.ts — Outcome Runtime barrel.
 */

export {
  OUTCOME_RUNTIME_VERSION, OUTCOME_EVENTS, OUTCOME_SIGNALS,
} from './outcomeContracts';
export {
  recordRecommendationOutcome, listRecommendationOutcomes,
  recommendationOutcomeSummary,
  RECOMMENDATION_OUTCOME_VERSION,
} from './RecommendationOutcomeTracker';
export type { OutcomeRecord } from './RecommendationOutcomeTracker';
export {
  recordInterventionOutcome, INTERVENTION_OUTCOME_VERSION,
} from './InterventionOutcomeTracker';
export {
  outcomeHealth, installOutcomeRuntimeGlobal,
} from './OutcomeRuntime';
