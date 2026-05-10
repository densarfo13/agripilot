/**
 * governance — barrel export for the experience governance layer.
 *
 *   import { gateFeature, runExperienceAudit } from 'src/governance';
 *
 * The 8 rule modules (one per spec section) are each exposed
 * under their canonical name. The audit utility is the single
 * entry point that consolidates every rule into a report.
 *
 * Strict-rule audit
 *   • Pure re-exports. No side effects on import.
 *   • Each underlying module is itself frozen + side-effect-free.
 */

export {
  EXPERIENCE_PRINCIPLES,
  FINAL_PRINCIPLE,
  getPrinciple,
} from './experiencePrinciples.js';

export {
  GATE_QUESTIONS,
  gateFeature,
  assertFeatureGate,
} from './featureGate.js';

export {
  MAX_PRIMARY_RECOMMENDATIONS_PER_SCREEN,
  RECOMMENDATION_PRIORITY,
  priorityForMode,
  validateRecommendationSet,
} from './recommendationRules.js';

export {
  FREQUENCY_LIMITS,
  FORBIDDEN_NOTIFICATION_PATTERNS,
  validateNotification,
} from './notificationRules.js';

export {
  FORBIDDEN_COLORS,
  FORBIDDEN_VISUAL_PATTERNS,
  ANIMATION_BUDGET_MS,
  findForbiddenColors,
} from './visualConsistencyRules.js';

export {
  MAX_ATMOSPHERE_LAYERS,
  ANIMATION_FRAME_BUDGET_MS,
  TINT_TRANSITION_MS,
  validateAtmosphereChange,
} from './atmosphereRules.js';

export {
  FORBIDDEN_TONE_PATTERNS,
  softenForGarden,
  findToneViolations,
  isToneViolation,
} from './emotionalToneRules.js';

export {
  RECOMMENDATION_COOLDOWNS,
  dedupeOrchestratedSet,
  withinCooldown,
} from './orchestrationRules.js';

export { runExperienceAudit } from './audit.js';
