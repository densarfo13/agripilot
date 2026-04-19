/**
 * optimization/index.js — single import surface for the
 * auto-optimization loop (base + hardening pass).
 *
 *   import {
 *     // Base loop
 *     extractOptimizationSignals, computeAdjustments,
 *     applyRecommendationOptimization, applyTaskUrgencyOptimization,
 *     applyConfidenceOptimization, applyListingQualityOptimization,
 *     buildOptimizationSnapshot,
 *
 *     // Hardening layer
 *     applyOptimizationPipeline,
 *     getOptimizationEligibility, isLowSignalContext, SCOPES,
 *     createEligibilityConfig, summarizeEligibility,
 *     filterSignalsByWindow, getWeightedCounts, getWeightedSignalScore,
 *     buildPersonalContextKey, splitSignalsByScope, mergeOptimizationLayers,
 *     interpretNegativeSignals, getNegativeAdjustmentEligibility,
 *     enforceModeIsolation, summarizeModeCoverage, validateModeAwareOptimization,
 *     getConfidenceAwareWording, resolveWording,
 *     buildOptimizationExplanation,
 *     createInMemoryAuditStore, wrapStore, buildAuditSummary,
 *   } from '../services/optimization';
 */

export {
  buildContextKey, parseContextKey,
  buildContextKeyFromEvent,
  buildRecommendationContextKey,
  buildRegionContextKey,
} from './contextKey.js';

export {
  MIN_RECOMMENDATION_SIGNALS, MIN_HARVEST_SIGNALS,
  MIN_TASK_SIGNALS, MIN_LISTING_SIGNALS,
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
  MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
  MAX_SIGNAL_AGE_DAYS, DECAY_HALF_LIFE_DAYS,
  clampDelta, clampNonNegativeDelta,
} from './optimizationThresholds.js';

export {
  extractOptimizationSignals, extractSignalsByContextKey,
} from './signalExtractors.js';

export {
  computeAdjustments, computeAdjustmentForContext,
  adjustmentForKey, zeroAdjustment,
} from './optimizationEngine.js';

export {
  applyRecommendationOptimization,
  applyTaskUrgencyOptimization,
  applyConfidenceOptimization,
  applyListingQualityOptimization,
} from './applyOptimization.js';

export {
  buildOptimizationSnapshot,
  getTopAcceptedRecommendations,
  getMostRejectedRecommendations,
  getTaskSkipPatterns,
  getBestConvertingListingContexts,
} from './optimizationReportingService.js';

// ─── Hardening layer ────────────────────────────────────
export {
  SCOPES,
  DEFAULT_PERSONAL_THRESHOLDS, DEFAULT_REGIONAL_THRESHOLDS,
  createEligibilityConfig,
  hasSufficientSignal,
  getOptimizationEligibility,
  isLowSignalContext,
  summarizeEligibility,
} from './optimizationEligibility.js';

export {
  DEFAULT_HALF_LIFE_DAYS, DEFAULT_WINDOW_DAYS,
  filterSignalsByWindow, applyRecencyWeight,
  getWeightedSignalScore, getWeightedCounts,
  ageBreakdown,
} from './recencyWeighting.js';

export {
  SCOPE,
  buildPersonalContextKey,
  parseScopeFromKey,
  regionalKeyFromPersonal,
  splitSignalsByScope,
  mergeOptimizationLayers,
} from './personalVsRegional.js';

export {
  interpretNegativeSignals,
  getNegativeAdjustmentEligibility,
  applyNegativeEligibilityToDelta,
} from './negativeSignalInterpreter.js';

export {
  MODES,
  enforceModeIsolation,
  validateModeAwareOptimization,
  stripListingDeltasForBackyard,
  enforceListingModeAllowlist,
  summarizeModeCoverage,
} from './modeIsolation.js';

export {
  getConfidenceAwareWording, isLowSignal, resolveWording,
} from './confidenceAwareWording.js';

export {
  buildOptimizationExplanation,
} from './optimizationExplanation.js';

export {
  createInMemoryAuditStore, wrapStore, buildAuditSummary,
} from './optimizationAuditService.js';

export {
  applyOptimizationPipeline,
} from './applyOptimizationPipeline.js';
