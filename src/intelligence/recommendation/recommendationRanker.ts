/**
 * recommendationRanker — wraps the canonical priority ladder from
 * `src/governance/recommendationRules.ts`.
 *
 * Re-export only — the governance module is the single source of
 * truth. This file exists so the recommendation directory has the
 * spec's named entry point + a stable import path for new callers.
 */

export {
  RECOMMENDATION_PRIORITY,
  MAX_PRIMARY_RECOMMENDATIONS_PER_SCREEN,
  priorityForMode,
  validateRecommendationSet,
} from '../../governance/recommendationRules.js';
export type {
  RecommendationRule,
  ExperienceMode,
  RecommendationSetValidation,
} from '../../governance/recommendationRules.js';
