/**
 * recommendationRules — governance for the orchestrator + every
 * surface that exposes a recommendation tile.
 *
 * Global rule
 *   ONE primary recommendation per screen. The system may rank
 *   many signals internally; the user sees the single most useful
 *   next action.
 *
 * Priority ladder (Garden + Farm share the first 6, Farm extends):
 *   1. Safety / weather risk
 *   2. Plant health
 *   3. Care timing
 *   4. Scan follow-up
 *   5. Growth continuity
 *   6. Seasonal adaptation
 *   7. Buyer / funding         (Farm only)
 *
 * Strict-rule audit
 *   • Pure data + thin helpers. Frozen exports.
 *   • Mirrors the existing `src/orchestration/orchestrator.js`
 *     LADDER constants without duplicating logic — engines stay
 *     authoritative; this file is the *contract* the audit runs
 *     against.
 */

export type ExperienceMode = 'garden' | 'farm' | 'both';

export interface RecommendationRule {
  readonly id: string;
  readonly rank: number;
  readonly label: string;
  readonly appliesTo: ExperienceMode;
  /** id from EXPERIENCE_PRINCIPLES */
  readonly principleId: string;
}

export const MAX_PRIMARY_RECOMMENDATIONS_PER_SCREEN = 1;

export const RECOMMENDATION_PRIORITY: ReadonlyArray<RecommendationRule> = Object.freeze([
  Object.freeze({ id: 'safety',       rank: 1, label: 'Safety / weather risk',
    appliesTo: 'both',   principleId: 'reassurance-over-alarm' }),
  Object.freeze({ id: 'plant-health', rank: 2, label: 'Plant health',
    appliesTo: 'both',   principleId: 'memory-over-data' }),
  Object.freeze({ id: 'care-timing',  rank: 3, label: 'Care timing',
    appliesTo: 'both',   principleId: 'timing-over-analytics' }),
  Object.freeze({ id: 'scan-followup', rank: 4, label: 'Scan follow-up',
    appliesTo: 'both',   principleId: 'continuity-over-novelty' }),
  Object.freeze({ id: 'growth-continuity', rank: 5, label: 'Growth continuity',
    appliesTo: 'both',   principleId: 'continuity-over-novelty' }),
  Object.freeze({ id: 'seasonal',     rank: 6, label: 'Seasonal adaptation',
    appliesTo: 'both',   principleId: 'continuity-over-novelty' }),
  Object.freeze({ id: 'buyer-funding', rank: 7, label: 'Buyer / funding',
    appliesTo: 'farm',   principleId: 'calm-over-complexity' }),
] as ReadonlyArray<RecommendationRule>);

/**
 * Filter the priority list for a given mode. Garden hides the
 * buyer/funding rank entirely; Farm sees all 7.
 */
export function priorityForMode(mode: string | null | undefined): ReadonlyArray<RecommendationRule> {
  const m = String(mode || '').toLowerCase();
  if (m === 'garden') {
    return RECOMMENDATION_PRIORITY.filter((r) => r.appliesTo !== 'farm');
  }
  return RECOMMENDATION_PRIORITY;
}

export interface RecommendationSetValidation {
  readonly ok: boolean;
  readonly reason: string | null;
}

/**
 * Validate that a candidate render-set obeys the per-screen cap.
 */
export function validateRecommendationSet(
  candidates: ReadonlyArray<{ rank?: number }> | null | undefined,
): RecommendationSetValidation {
  const arr = Array.isArray(candidates) ? candidates : [];
  if (arr.length > MAX_PRIMARY_RECOMMENDATIONS_PER_SCREEN) {
    return { ok: false, reason: 'too_many_primary' };
  }
  return { ok: true, reason: null };
}

export default Object.freeze({
  MAX_PRIMARY_RECOMMENDATIONS_PER_SCREEN,
  RECOMMENDATION_PRIORITY,
  priorityForMode,
  validateRecommendationSet,
});
