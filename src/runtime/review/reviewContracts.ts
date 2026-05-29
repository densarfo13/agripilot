/**
 * src/runtime/review/reviewContracts.ts — Frozen contracts for
 * the Human Review queue.
 *
 * Strict-rule audit
 *   • Pure data. No engine imports.
 *   • Frozen enums. No PII.
 */

export const HUMAN_REVIEW_VERSION = 'farroway-human-review-v1';

/** Reasons an item lands in the human review queue. */
export const REVIEW_TYPES = Object.freeze([
  // Spec review types (Farroway human review v1 spec).
  'scan_low_confidence',
  'scan_user_flagged',
  'plant_misidentified',
  'content_report',
  'safety_concern',
  // Legacy / domain-specific types — retained for back-compat.
  'low_confidence_scan',
  'evidence_needs_review',
  'artifact_rejected',
  'buyer_dispute',
  'report_exception',
] as const);
export type ReviewType = (typeof REVIEW_TYPES)[number];

/** Lifecycle states of a review item. */
export const REVIEW_STATUSES = Object.freeze([
  'pending',
  'in_review',
  'resolved',
  'rejected',
] as const);
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
