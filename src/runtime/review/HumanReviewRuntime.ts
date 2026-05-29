/**
 * src/runtime/review/HumanReviewRuntime.ts — Composite + health
 * for the Human Review queue.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Diagnostic global: window.__humanReviewHealth()
 *   • In-memory persistence — durable backing is the single
 *     writer's responsibility (later wave).
 */

import { HUMAN_REVIEW_VERSION } from './reviewContracts';
import {
  submitForReview,
  updateReviewStatus,
  listReviews,
  reviewQueueSnapshot,
  REVIEW_QUEUE_VERSION,
} from './ReviewQueue';

export const HUMAN_REVIEW_RUNTIME_VERSION = HUMAN_REVIEW_VERSION;

export {
  submitForReview,
  updateReviewStatus,
  listReviews,
  reviewQueueSnapshot,
  HUMAN_REVIEW_VERSION,
};

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function humanReviewHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           HUMAN_REVIEW_RUNTIME_VERSION,
    initialized:              true,
    reviewQueueReady:         true,
    lowConfidenceScanReady:   true,
    evidenceReviewReady:      true,
    buyerDisputeLoggingReady: true,
    snapshot:                 reviewQueueSnapshot(),
    persistence:              'in_memory' as const,
    versions: Object.freeze({
      queue: REVIEW_QUEUE_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion:           HUMAN_REVIEW_RUNTIME_VERSION,
    initialized:              false,
    reviewQueueReady:         false,
    lowConfidenceScanReady:   false,
    evidenceReviewReady:      false,
    buyerDisputeLoggingReady: false,
    snapshot:                 null,
    persistence:              'in_memory' as const,
  }));
}

export function installHumanReviewGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__humanReviewHealth !== 'function') {
      w.__humanReviewHealth = function () {
        const out = humanReviewHealth();
        try { console.log('[Farroway · Human Review]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
