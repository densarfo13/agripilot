/**
 * src/runtime/review/ReviewRuntime.ts — Composite review runtime.
 *
 * Re-exports HumanReviewRuntime under the spec name so the
 * runtime barrel + spec gate both resolve to a single source
 * of truth. Adds a small health probe for the spec types.
 *
 * Pure runtime: no React, no fetch.
 */

export {
  humanReviewHealth,
  installHumanReviewGlobal,
  HUMAN_REVIEW_RUNTIME_VERSION,
} from './HumanReviewRuntime';

export {
  submitForReview,
  updateReviewStatus,
  listReviews,
  reviewQueueSnapshot,
  REVIEW_QUEUE_VERSION,
} from './ReviewQueue';

export {
  HUMAN_REVIEW_VERSION,
  REVIEW_TYPES,
  REVIEW_STATUSES,
} from './reviewContracts';

export const REVIEW_RUNTIME_VERSION =
  'farroway-review-runtime-v1';

/**
 * Spec-facing alias so consumers using the new naming
 * (`installReviewRuntime`) hit the same composite as legacy
 * callers using `installHumanReviewGlobal`.
 */
export { installHumanReviewGlobal as installReviewRuntime } from './HumanReviewRuntime';
