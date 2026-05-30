/**
 * src/runtime/outcomeComparison/outcomeComparisonContracts.ts —
 * frozen types for the Outcome Comparison runtime.
 */

export const OUTCOME_COMPARISON_RUNTIME_VERSION = 'outcome-comparison-v1';

export const COMPARISON_STATUS = Object.freeze({
  IMPROVED:   'improved',
  UNCHANGED:  'unchanged',
  WORSENED:   'worsened',
  UNKNOWN:    'unknown',
} as const);

export type ComparisonStatusValue =
  typeof COMPARISON_STATUS[keyof typeof COMPARISON_STATUS];

export interface OutcomeComparisonResult {
  plantId:           string;
  currentScanId:     string;
  previousScanId?:   string;
  status:            ComparisonStatusValue;
  confidence:        number;
  beforePhoto?:      string;
  afterPhoto?:       string;
  beforeSeverity?:   string;
  afterSeverity?:    string;
  recommendation:    string;     // safe-wording
  needsReview:       boolean;
  timestamp:         string;
}

export interface OutcomeComparisonHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  outcomeComparisonReady:   boolean;
  statusValues:             ReadonlyArray<string>;
}

export const OUTCOME_COMPARISON_STORAGE_KEY = 'farroway.outcomeComparison.history';
export const OUTCOME_COMPARISON_HISTORY_CAP = 200;
