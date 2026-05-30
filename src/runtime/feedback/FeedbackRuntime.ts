/**
 * src/runtime/feedback/FeedbackRuntime.ts — Farroway Feedback
 * Intelligence v1 read-side runtime.
 *
 *   import {
 *     list, countByType, helpfulRatio, feedbackHealth,
 *     FEEDBACK_RUNTIME_READ_VERSION,
 *   } from 'src/runtime/feedback/FeedbackRuntime';
 *
 *   window.__feedbackHealth()
 *
 * What this is
 * ────────────
 *   Read-only composition over the rows persisted by
 *   FeedbackCollector. Computes the count-by-type table, the
 *   helpful ratio, and the frozen health envelope consumed by
 *   window.__feedbackHealth().
 *
 * Strict-rule audit
 *   • Read-only. Never writes localStorage from this module.
 *   • SSR-safe. Never throws.
 *   • Frozen envelopes everywhere.
 *   • No PII in the envelope — only the hashed userId is ever
 *     visible, and even that is not surfaced in the health view.
 */

import {
  FEEDBACK_RUNTIME_VERSION,
  type FeedbackRow, type FeedbackType,
  type FeedbackCountsByType, type FeedbackHealth,
} from './feedbackContracts';
import { _internalReadRows } from './FeedbackCollector';

export const FEEDBACK_RUNTIME_READ_VERSION = 'farroway-feedback-runtime-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _EMPTY_COUNTS: Readonly<FeedbackCountsByType> = Object.freeze({
  scan_result:     0,
  recommendation:  0,
  task_completion: 0,
});

const _HEALTH_FAIL: FeedbackHealth = Object.freeze({
  runtimeVersion: FEEDBACK_RUNTIME_VERSION,
  feedbackReady:  true as const,
  storedCount:    0,
  helpfulRatio:   null,
  countsByType:   _EMPTY_COUNTS,
});

/**
 * list — return a frozen, ordered (oldest → newest) snapshot of
 * the stored rows. Each row is itself frozen. Never throws.
 */
export function list(): ReadonlyArray<Readonly<FeedbackRow>> {
  return _safe(() => {
    const rows = _internalReadRows();
    const out: Array<Readonly<FeedbackRow>> = [];
    for (let i = 0; i < rows.length; i++) {
      out.push(Object.freeze({ ...rows[i] }));
    }
    return Object.freeze(out);
  }, Object.freeze([] as ReadonlyArray<Readonly<FeedbackRow>>));
}

/**
 * countByType — frozen { scan_result, recommendation,
 * task_completion } table. Unknown types are silently ignored
 * (the collector should already have rejected them).
 */
export function countByType(): Readonly<FeedbackCountsByType> {
  return _safe(() => {
    const rows = _internalReadRows();
    let scan = 0, rec = 0, task = 0;
    for (let i = 0; i < rows.length; i++) {
      const t: FeedbackType = rows[i].t;
      if (t === 'scan_result')          scan++;
      else if (t === 'recommendation')  rec++;
      else if (t === 'task_completion') task++;
    }
    return Object.freeze({
      scan_result:     scan,
      recommendation:  rec,
      task_completion: task,
    });
  }, _EMPTY_COUNTS);
}

/**
 * helpfulRatio — fraction of rows with helpful === true, in
 * [0, 1]. Returns null when there are zero rows (avoids 0/0
 * masquerading as a real signal). Never throws.
 */
export function helpfulRatio(): number | null {
  return _safe(() => {
    const rows = _internalReadRows();
    if (rows.length === 0) return null;
    let helpful = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].h === true) helpful++;
    }
    return helpful / rows.length;
  }, null);
}

/**
 * feedbackHealth — frozen envelope consumed by the pinned
 * window.__feedbackHealth() global. Never throws.
 *
 * Contains:
 *   • runtimeVersion
 *   • feedbackReady: true
 *   • storedCount
 *   • helpfulRatio (null when no rows)
 *   • countsByType { scan_result, recommendation, task_completion }
 *
 * Never contains PII or hashed user ids.
 */
export function feedbackHealth(): FeedbackHealth {
  return _safe(() => {
    const rows  = _internalReadRows();
    const total = rows.length;

    let scan = 0, rec = 0, task = 0, helpful = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.t === 'scan_result')          scan++;
      else if (r.t === 'recommendation')  rec++;
      else if (r.t === 'task_completion') task++;
      if (r.h === true) helpful++;
    }

    const ratio: number | null = total === 0 ? null : (helpful / total);

    return Object.freeze({
      runtimeVersion: FEEDBACK_RUNTIME_VERSION,
      feedbackReady:  true as const,
      storedCount:    total,
      helpfulRatio:   ratio,
      countsByType:   Object.freeze({
        scan_result:     scan,
        recommendation:  rec,
        task_completion: task,
      }),
    });
  }, _HEALTH_FAIL);
}
