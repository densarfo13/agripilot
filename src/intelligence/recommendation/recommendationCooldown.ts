/**
 * recommendationCooldown — re-export the canonical cooldown
 * table from `src/governance/orchestrationRules.ts`.
 *
 * Single source of truth lives in the governance module. This
 * file exists so the recommendation directory has the spec's
 * named entry point.
 */

export {
  RECOMMENDATION_COOLDOWNS,
  withinCooldown,
} from '../../governance/orchestrationRules.js';
export type { RecommendationKind } from '../../governance/orchestrationRules.js';
