/**
 * src/runtime/outcomes/outcomeContracts.ts — Outcome-tracking
 * contracts (canonical enterprise version — supersedes the
 * intelligenceLoop-local OutcomeTracker for cross-runtime use).
 */

export const OUTCOME_RUNTIME_VERSION = 'farroway-outcome-runtime-v1';

export const OUTCOME_EVENTS = Object.freeze([
  'recommendation_shown',
  'recommendation_accepted',
  'recommendation_completed',
  'task_completed',
  'followup_scan_done',
  'plant_health_improved',
  'plant_health_declined',
  'intervention_completed',
  'intervention_outcome_recorded',
] as const);
export type OutcomeEvent = (typeof OUTCOME_EVENTS)[number];

export const OUTCOME_SIGNALS = Object.freeze([
  'helpful', 'not_helpful',
  'improved', 'stable', 'declined',
  'completed', 'cancelled',
] as const);
