/**
 * src/runtime/outcomes/InterventionOutcomeTracker.ts —
 * Specialised wrapper around the recommendation tracker for
 * NGO intervention outcomes.
 */

import {
  recordRecommendationOutcome, listRecommendationOutcomes,
  recommendationOutcomeSummary,
} from './RecommendationOutcomeTracker';

export const INTERVENTION_OUTCOME_VERSION =
  'intervention-outcome-tracker-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface InterventionCtx {
  userId:           string;
  interventionId:   string;
  programId?:       string;
  outcomeSignal?:   string;
  confidence?:      string;
  beforeState?:     Record<string, any>;
  afterState?:      Record<string, any>;
  /** When true, record the canonical intervention_completed
   *  event in addition to the outcome signal. */
  completed?:       boolean;
}

export function recordInterventionOutcome(ctx: InterventionCtx) {
  return _safe(() => {
    if (!_isObj(ctx)) {
      return Object.freeze({
        runtimeVersion: INTERVENTION_OUTCOME_VERSION,
        ok: false, reason: 'invalid_context', record: null,
      });
    }
    const userId         = _str(ctx.userId);
    const interventionId = _str(ctx.interventionId);
    if (!userId || !interventionId) {
      return Object.freeze({
        runtimeVersion: INTERVENTION_OUTCOME_VERSION,
        ok: false, reason: 'missing_fields', record: null,
      });
    }

    if (ctx.completed === true) {
      recordRecommendationOutcome({
        userId, interventionId,
        programId: ctx.programId,
        eventType: 'intervention_completed',
        beforeState: ctx.beforeState,
        afterState:  ctx.afterState,
        outcomeSignal: ctx.outcomeSignal,
        confidence:    ctx.confidence,
      });
    }
    return recordRecommendationOutcome({
      userId, interventionId,
      programId: ctx.programId,
      eventType: 'intervention_outcome_recorded',
      beforeState: ctx.beforeState,
      afterState:  ctx.afterState,
      outcomeSignal: ctx.outcomeSignal,
      confidence:    ctx.confidence,
    });
  }, Object.freeze({
    runtimeVersion: INTERVENTION_OUTCOME_VERSION,
    ok: false, reason: 'error', record: null,
  }));
}

export { listRecommendationOutcomes, recommendationOutcomeSummary };
