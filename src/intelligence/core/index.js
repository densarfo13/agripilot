/**
 * intelligence/core — invisible intelligence architecture.
 *
 *   import { getFarmerInsight, analyseContext } from
 *     'src/intelligence/core/index.js';
 *
 * MODULE MAP
 *   intelligenceTypes        — frozen constants + JSDoc types
 *   intelligenceContext      — buildIntelligenceContext(input)
 *   confidence               — tier helpers + label
 *   scoring                  — scoreRecommendation / rankRecommendations
 *   risk                     — estimateCropRisk (soft risk engine)
 *   prediction               — predictNextBestAction (rule-based)
 *   trust                    — estimateTrustSignals (INTERNAL)
 *   feedbackLoop             — recordUserOutcome / countRecent
 *   optimization             — applyOutcomeAdjustment + guardrails
 *   farmerInsightAdapter     — toFarmerFriendlyInsight (final mile)
 *   intelligenceOrchestrator — analyseContext / getFarmerInsight
 *
 * RULES
 *   • Every export here is pure / SSR-safe / never-throws.
 *   • Constants are Object.frozen so callers can't mutate shared shape.
 *   • Farmer UI MUST go through `getFarmerInsight` only — that's
 *     the single path that runs every safety filter.
 */

export {
  CONFIDENCE,
  CONFIDENCE_BANDS,
  PRIORITY,
  RISK_TYPE,
  RISK_BAND,
  PREDICTION_TYPE,
  OUTCOME_EVENT,
  TRUST_FLAG,
  VERIFICATION_STATE,
  SOURCE,
  FORBIDDEN_USER_WORDING,
} from './intelligenceTypes.js';

export {
  buildIntelligenceContext,
  contextSignalStrength,
} from './intelligenceContext.js';

export {
  confidenceTier,
  confidenceFromSignals,
  confidenceLabel,
  isUsableConfidence,
} from './confidence.js';

export {
  scoreRecommendation,
  rankRecommendations,
} from './scoring.js';

export {
  estimateCropRisk,
} from './risk.js';

export {
  predictNextBestAction,
} from './prediction.js';

export {
  estimateTrustSignals,
  farmerVerificationCopy,
} from './trust.js';

export {
  STORAGE_KEY as FEEDBACK_STORAGE_KEY,
  MAX_EVENTS  as FEEDBACK_MAX_EVENTS,
  recordUserOutcome,
  getRecentEvents,
  countRecent,
  clearEvents,
} from './feedbackLoop.js';

export {
  applyOutcomeAdjustment,
  isOptimizationAllowed,
  isOptimizationForbidden,
  ALLOWED_AUTO_ADJUSTMENTS,
  FORBIDDEN_AUTO_ADJUSTMENTS,
} from './optimization.js';

export {
  toFarmerFriendlyInsight,
  forbiddenWordingFilter,
} from './farmerInsightAdapter.js';

export {
  analyseContext,
  getFarmerInsight,
} from './intelligenceOrchestrator.js';
