/**
 * optimization/index.js — single import surface for the
 * auto-optimization loop.
 *
 *   import {
 *     extractOptimizationSignals, computeAdjustments,
 *     applyRecommendationOptimization, applyTaskUrgencyOptimization,
 *     applyConfidenceOptimization, applyListingQualityOptimization,
 *     buildOptimizationSnapshot,
 *     MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
 *     MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
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
