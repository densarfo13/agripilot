/**
 * feedbackPriority.js — rank issue buckets by frequency,
 * severity and launch impact (final feedback-loop spec §6).
 *
 *   import { computeFeedbackPriority } from '.../feedbackPriority.js';
 *   const { topIssue, reason, recommendedNextFix, ranking } =
 *     computeFeedbackPriority();
 *
 * Ranking inputs (per bucket):
 *   * frequency      — count of rows in the bucket
 *   * severityWeight — sum of severity weights (critical=3,
 *                      high=2, medium=1) — set by the classifier
 *   * launchImpact   — fixed weight from the spec's
 *                      ordering, in case ties happen on count
 *
 * Spec priority order (used as the launch-impact tie-break):
 *   1. unclear_priority   — onboarding confusion
 *   2. scan_visibility    — scan visibility
 *   3. task_overload      — too many tasks
 *   4. unclear_result     — unclear scan result
 *   5. low_value          — low return intent
 *   6. manual_review      — fallback
 *
 * Strict-rule audit
 *   * Pure. Reads via injected `getFeedback` so tests can pass
 *     fixture rows without touching localStorage.
 *   * Never throws; empty input → null topIssue.
 *   * Tie-breaks deterministically by spec order so the same
 *     dataset always returns the same recommendation.
 */

import { getFeedback as _getFeedback } from './userFeedbackStore.js';
import { classifyAll, FEEDBACK_BUCKETS } from './feedbackClassifier.js';

// Spec §6 priority ordering. Lower index = higher launch impact.
const SPEC_ORDER = Object.freeze([
  FEEDBACK_BUCKETS.UNCLEAR_PRIORITY,
  FEEDBACK_BUCKETS.SCAN_VISIBILITY,
  FEEDBACK_BUCKETS.TASK_OVERLOAD,
  FEEDBACK_BUCKETS.UNCLEAR_RESULT,
  FEEDBACK_BUCKETS.LOW_VALUE,
  FEEDBACK_BUCKETS.MANUAL_REVIEW,
]);

function _launchImpact(bucket) {
  const idx = SPEC_ORDER.indexOf(bucket);
  if (idx < 0) return 0;
  // Largest weight for the highest priority. Range 6..1.
  return SPEC_ORDER.length - idx;
}

/**
 * computeFeedbackPriority({ rows? } = {})
 *
 * Returns:
 *   {
 *     topIssue:           bucket | null,
 *     reason:             string,
 *     recommendedNextFix: string,
 *     ranking:            Array<{ bucket, count, severityWeight, score, fix }>,
 *     totalRows:          number,
 *   }
 *
 * Score = (frequency × 1) + severityWeight + launchImpact. Ties
 * resolve by spec order, then by frequency descending.
 */
export function computeFeedbackPriority({ rows } = {}) {
  let safeRows;
  try { safeRows = Array.isArray(rows) ? rows : (_getFeedback() || []); }
  catch { safeRows = []; }

  if (!safeRows.length) {
    return {
      topIssue:           null,
      reason:             'no_feedback_yet',
      recommendedNextFix: 'No feedback collected yet — keep watching the dashboard.',
      ranking:            [],
      totalRows:          0,
    };
  }

  const grouped = classifyAll(safeRows);
  const ranking = [];
  for (const entry of grouped.values()) {
    const launch = _launchImpact(entry.bucket);
    const score  = entry.count + entry.severityWeight + launch;
    ranking.push({
      bucket:         entry.bucket,
      count:          entry.count,
      severityWeight: entry.severityWeight,
      launchImpact:   launch,
      score,
      severity:       entry.severity,
      fix:            entry.fix,
      examples:       entry.examples || [],
    });
  }

  ranking.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-break: spec order (lower index wins → smaller indexOf).
    const ai = SPEC_ORDER.indexOf(a.bucket);
    const bi = SPEC_ORDER.indexOf(b.bucket);
    if (ai !== bi) return ai - bi;
    // Final tie-break: frequency descending.
    return b.count - a.count;
  });

  const top = ranking[0] || null;
  return {
    topIssue:           top ? top.bucket : null,
    reason: top
      ? `${top.count} report(s) in "${top.bucket}" with ${top.severity} severity`
      : 'no_top_issue',
    recommendedNextFix: top ? top.fix : 'No specific fix recommended.',
    ranking,
    totalRows:          safeRows.length,
  };
}

export default computeFeedbackPriority;
