/**
 * src/runtime/feedback/feedbackContracts.ts — Farroway Feedback
 * Intelligence v1 contracts.
 *
 *   import {
 *     FEEDBACK_RUNTIME_VERSION, FEEDBACK_TYPE,
 *     FEEDBACK_STORAGE_KEY, FEEDBACK_MAX_ROWS,
 *     type FeedbackType, type FeedbackRow, type FeedbackInput,
 *     type FeedbackCountsByType, type FeedbackHealth,
 *   } from 'src/runtime/feedback/feedbackContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types for the Feedback Intelligence runtime.
 *   Engines read these to know which feedback types are legal,
 *   what localStorage key owns the rows, and the row cap.
 *   Frozen at module load.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no imports of engines.
 *   • SSR-safe. Never throws.
 *   • No PII — types only carry hashed userId, never raw.
 */

export const FEEDBACK_RUNTIME_VERSION = 'farroway-feedback-v1';

/** localStorage key — single-writer, owned by FeedbackCollector. */
export const FEEDBACK_STORAGE_KEY = 'farroway.feedback';

/** Hard cap on stored rows — newest wins when trimming. */
export const FEEDBACK_MAX_ROWS = 500;

/** Canonical feedback type enum. */
export const FEEDBACK_TYPE = Object.freeze({
  SCAN_RESULT:     'scan_result',
  RECOMMENDATION:  'recommendation',
  TASK_COMPLETION: 'task_completion',
});

export type FeedbackType =
  (typeof FEEDBACK_TYPE)[keyof typeof FEEDBACK_TYPE];

/**
 * Set of legal feedback type strings — runtime guards check
 * incoming values against this set before persisting.
 */
export const FEEDBACK_TYPES: ReadonlyArray<FeedbackType> = Object.freeze([
  FEEDBACK_TYPE.SCAN_RESULT  as FeedbackType,
  FEEDBACK_TYPE.RECOMMENDATION as FeedbackType,
  FEEDBACK_TYPE.TASK_COMPLETION as FeedbackType,
]);

/**
 * Input shape accepted by FeedbackCollector.collect(). The
 * userId here is the raw identifier — the collector hashes it
 * before persisting so no raw user id ever lands in storage.
 */
export type FeedbackInput = {
  feedbackType: FeedbackType;
  entityId:     string;
  userId:       string;
  helpful:      boolean;
  /** Optional ms epoch. If absent, collector stamps Date.now(). */
  timestamp?:   number;
};

/**
 * Persisted row shape. Note: userId is the djb2 hash of the raw
 * id (a short non-crypto hash). entityId is kept as-is because
 * it refers to a scan / recommendation / task id, not PII.
 */
export type FeedbackRow = {
  t:  FeedbackType;   // feedbackType
  e:  string;         // entityId
  u:  string;         // hashed userId
  h:  boolean;        // helpful
  ts: number;         // timestamp (ms)
};

/** Per-type counts for the health envelope. */
export type FeedbackCountsByType = {
  scan_result:     number;
  recommendation:  number;
  task_completion: number;
};

/** Frozen health envelope returned by window.__feedbackHealth(). */
export type FeedbackHealth = Readonly<{
  runtimeVersion: string;
  feedbackReady:  true;
  storedCount:    number;
  helpfulRatio:   number | null;
  countsByType:   Readonly<FeedbackCountsByType>;
}>;
