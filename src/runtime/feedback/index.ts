/**
 * src/runtime/feedback/index.ts — Farroway Feedback Intelligence
 * v1 barrel + boot install.
 *
 *   import {
 *     collect, list, countByType, helpfulRatio, feedbackHealth,
 *     installFeedbackRuntimeGlobal,
 *     FEEDBACK_RUNTIME_VERSION, FEEDBACK_TYPE,
 *   } from 'src/runtime/feedback';
 *
 *   installFeedbackRuntimeGlobal();
 *   window.__feedbackHealth()  // pinned after boot
 *
 * What this is
 * ────────────
 *   Single import surface for the Feedback Intelligence runtime.
 *   Auto-wires window.__feedbackHealth() so QA + admins can call
 *   from the production console to see how the helpful/unhelpful
 *   signal is trending without exposing any user ids.
 *
 * Strict-rule audit
 *   • Composition over the contracts + collector + runtime
 *     modules. No engine logic here.
 *   • Pins exactly one window global: __feedbackHealth.
 *   • SSR-safe. Never throws.
 *   • No PII surfaced by the global.
 */

import {
  FEEDBACK_RUNTIME_VERSION, FEEDBACK_TYPE, FEEDBACK_TYPES,
  FEEDBACK_STORAGE_KEY, FEEDBACK_MAX_ROWS,
  type FeedbackType, type FeedbackRow, type FeedbackInput,
  type FeedbackCountsByType, type FeedbackHealth,
} from './feedbackContracts';
import {
  collect, FEEDBACK_COLLECTOR_VERSION,
  type CollectReceipt,
} from './FeedbackCollector';
import {
  list, countByType, helpfulRatio, feedbackHealth,
  FEEDBACK_RUNTIME_READ_VERSION,
} from './FeedbackRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Pin __feedbackHealth() onto window so QA / admins can inspect
 * the stored count, helpful ratio, and counts-by-type from the
 * production console. Never returns raw user ids.
 *
 * Idempotent — if the global is already installed, leaves it.
 */
export function installFeedbackRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__feedbackHealth !== 'function') {
      w.__feedbackHealth = function () {
        const out = feedbackHealth();
        try { console.log('[Farroway · Feedback]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Contracts
  FEEDBACK_RUNTIME_VERSION, FEEDBACK_TYPE, FEEDBACK_TYPES,
  FEEDBACK_STORAGE_KEY, FEEDBACK_MAX_ROWS,
  // Collector
  collect, FEEDBACK_COLLECTOR_VERSION,
  // Runtime (read)
  list, countByType, helpfulRatio, feedbackHealth,
  FEEDBACK_RUNTIME_READ_VERSION,
};

export type {
  FeedbackType, FeedbackRow, FeedbackInput,
  FeedbackCountsByType, FeedbackHealth, CollectReceipt,
};
