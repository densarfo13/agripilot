/**
 * rankGuidance — re-exports the canonical priority ladder from
 * src/governance/recommendationRules so this directory has the
 * spec's named entry point. Single source of truth lives in
 * governance — never duplicated.
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
