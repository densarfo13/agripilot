/**
 * src/runtime/intelligenceLoop/intelligenceLoopContracts.ts —
 * Frozen contracts for the Intelligence Loop.
 *
 *   Loop: Observe → Orient → Decide → Act → Track → Learn
 *
 *   import {
 *     INTELLIGENCE_LOOP_VERSION, LOOP_SOURCES,
 *     LOOP_PRIORITY, LOOP_OUTCOME_KINDS,
 *     loopIdempotencyKey,
 *   } from 'src/runtime/intelligenceLoop/intelligenceLoopContracts';
 *
 * Strict-rule audit
 *   • Pure data. No engine imports.
 *   • SSR-safe. Never throws.
 */

export const INTELLIGENCE_LOOP_VERSION = 'farroway-intelligence-loop-v1';

/** Where the loop was triggered from. */
export const LOOP_SOURCES = Object.freeze([
  'scan',
  'task',
  'weather',
  'plant_profile',
  'daily_briefing',
  'manual_entry',
  'offline_sync',
] as const);
export type LoopSource = (typeof LOOP_SOURCES)[number];

/** Decision priority bands surfaced to growers. */
export const LOOP_PRIORITY = Object.freeze({
  DO_NOW:   'do_now',
  DO_TODAY: 'do_today',
  CAN_WAIT: 'can_wait',
});
export type LoopPriority = (typeof LOOP_PRIORITY)[keyof typeof LOOP_PRIORITY];

/** Outcome kinds the OutcomeTracker records. */
export const LOOP_OUTCOME_KINDS = Object.freeze([
  'recommendation_shown',
  'recommendation_accepted',
  'recommendation_completed',
  'task_completed',
  'scan_followup_done',
  'plant_health_changed',
  'issue_resolved',
  'issue_worsened',
] as const);
export type LoopOutcomeKind = (typeof LOOP_OUTCOME_KINDS)[number];

/** Feedback signals — thumbs up/down on a recommendation. */
export const FEEDBACK_SIGNAL = Object.freeze({
  HELPFUL:     'helpful',
  NOT_HELPFUL: 'not_helpful',
});

/** Idempotency-key shape per the spec §13. */
export function loopIdempotencyKey(source: string, entityId: string,
                                     hash: string): string {
  return 'loop:' + source + ':' + entityId + ':' + hash;
}

export function feedbackIdempotencyKey(recommendationId: string,
                                         userId: string): string {
  return 'feedback:' + recommendationId + ':' + userId;
}

/** Safe wording — recommendations MUST use these only. */
export const SAFE_WORDS = Object.freeze([
  'likely', 'possible', 'recommended', 'monitor',
  'expected', 'observed',
]);

/** Banned wording — never appears in any grower-facing copy. */
export const BANNED_WORDS = Object.freeze([
  'guaranteed', 'confirmed', 'will cure', 'will heal',
  'certainly', 'definitely',
]);
