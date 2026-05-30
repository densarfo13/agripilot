/**
 * src/runtime/outcomeComparison/index.ts — barrel.
 */

export {
  evaluate, getLatestComparisonForPlant,
  outcomeComparisonHealth, installOutcomeComparisonGlobal,
  type OutcomeComparisonEvaluateInput,
} from './OutcomeComparisonRuntime';

export {
  OUTCOME_COMPARISON_RUNTIME_VERSION,
  COMPARISON_STATUS,
  OUTCOME_COMPARISON_STORAGE_KEY,
  OUTCOME_COMPARISON_HISTORY_CAP,
  type ComparisonStatusValue,
  type OutcomeComparisonResult,
  type OutcomeComparisonHealth,
} from './outcomeComparisonContracts';
