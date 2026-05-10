/**
 * intelligence — barrel for the next-generation intelligence layer.
 *
 *   import {
 *     getPrimaryGuidance,
 *     getRecommendation,
 *     isSatelliteEnabled,
 *     isPredictionEnabled,
 *     isAdaptationEnabled,
 *     isVerificationEnabled,
 *   } from 'src/intelligence';
 *
 * What lives here
 * ───────────────
 *   • recommendation/     — 7 typed modules wrapping the canonical
 *                           orchestrator + memory + cooldowns.
 *   • satellite/          — feature-flag-gated foundation (off).
 *   • predictions/        — feature-flag-gated foundation (off).
 *   • adaptation/         — feature-flag-gated foundation (off).
 *   • verification/       — feature-flag-gated foundation (off).
 *   • data-quality/       — real runtime checks (always on).
 *   • getPrimaryGuidance  — headline §2 API; one screen / one call.
 *
 * What does NOT live here
 * ───────────────────────
 *   • The runtime authority lives in src/orchestration/orchestrator.js.
 *     This directory is the typed surface new callers should bind to;
 *     the orchestrator itself is unchanged.
 *   • Governance rules live in src/governance/ (recommendationRules,
 *     orchestrationRules, notificationRules, …). This directory
 *     CONSUMES the rules; it does not redefine them.
 */

export { getPrimaryGuidance } from './getPrimaryGuidance.js';
export type {
  PrimaryGuidance,
  PrimaryGuidanceContext,
  PrimaryGuidanceOptions,
} from './getPrimaryGuidance.js';

export { getRecommendation, FALLBACK_RECOMMENDATION }
  from './recommendation/recommendationEngine.js';
export type {
  RecommendationEnvelope,
  RecommendationContext,
  RecommendationOptions,
} from './recommendation/recommendationEngine.js';

export {
  toConfidenceTone,
  describeTone,
} from './recommendation/recommendationConfidence.js';
export type {
  ConfidenceTier,
  ConfidenceTone,
} from './recommendation/recommendationConfidence.js';

export {
  isExpired,
  dropExpired,
  EXPIRY_WINDOWS,
} from './recommendation/recommendationExpiry.js';

export { resolveConflicts } from './recommendation/recommendationConflictResolver.js';

export {
  rememberShown,
  wasRecentlyShown,
  forgetAll,
} from './recommendation/recommendationMemory.js';

// ── Feature-gated foundations ──────────────────────────────────
export { isSatelliteEnabled }    from './satellite/index.js';
export { isPredictionEnabled }   from './predictions/index.js';
export { isAdaptationEnabled }   from './adaptation/index.js';
export { isVerificationEnabled } from './verification/index.js';

// ── Always-on data quality layer ────────────────────────────────
export {
  imageQualityHint,
  isStaleWeather,
  normalizeLocation,
  isValidCropStage,
  shouldGateScanResult,
  dedupeKey,
} from './data-quality/index.js';
