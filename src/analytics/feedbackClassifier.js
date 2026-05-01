/**
 * feedbackClassifier.js — pure rule-based mapper from a single
 * feedback row → { bucket, severity, suggestedFix } (final
 * feedback-loop spec §3).
 *
 * Buckets:
 *   unclear_priority  — user didn't know what to click
 *   scan_visibility   — scan wasn't obvious / discoverable
 *   task_overload     — too many tasks shown at once
 *   unclear_result    — scan / recommendation result was opaque
 *   low_value         — user wouldn't return
 *   manual_review     — "other" with free-form text
 *
 * Severity bands:
 *   critical — directly affects launch retention (low_value,
 *              unclear_priority on the first action)
 *   high     — blocks the canonical happy path (scan_visibility,
 *              unclear_result, task_overload)
 *   medium   — noise that warrants a re-read (manual_review)
 *
 * Strict-rule audit
 *   * Pure function. No I/O.
 *   * Defensive against unknown feedbackType — falls back to
 *     manual_review with medium severity.
 *   * Suggested-fix copy is fixed in the codebase, not user-
 *     visible — this surface is admin-only.
 */

const BUCKETS = Object.freeze({
  UNCLEAR_PRIORITY: 'unclear_priority',
  SCAN_VISIBILITY:  'scan_visibility',
  TASK_OVERLOAD:    'task_overload',
  UNCLEAR_RESULT:   'unclear_result',
  LOW_VALUE:        'low_value',
  MANUAL_REVIEW:    'manual_review',
});

const SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
});

const _MAP = Object.freeze({
  unclear_click:    {
    bucket:   BUCKETS.UNCLEAR_PRIORITY,
    severity: SEVERITY.CRITICAL,
    suggestedFix:
      'Show one Today\u2019s Priority and one primary CTA.',
  },
  scan_not_obvious: {
    bucket:   BUCKETS.SCAN_VISIBILITY,
    severity: SEVERITY.HIGH,
    suggestedFix:
      'Move Scan higher and make it a primary action.',
  },
  too_many_tasks: {
    bucket:   BUCKETS.TASK_OVERLOAD,
    severity: SEVERITY.HIGH,
    suggestedFix:
      'Show one main task and collapse other tasks.',
  },
  unclear_result: {
    bucket:   BUCKETS.UNCLEAR_RESULT,
    severity: SEVERITY.HIGH,
    suggestedFix:
      'Rewrite result into Possible issue + What to do now.',
  },
  low_value: {
    bucket:   BUCKETS.LOW_VALUE,
    severity: SEVERITY.CRITICAL,
    suggestedFix:
      'Improve first value moment after scan/setup.',
  },
  other: {
    bucket:   BUCKETS.MANUAL_REVIEW,
    severity: SEVERITY.MEDIUM,
    suggestedFix:
      'Read the free-form note and decide if it warrants a new bucket.',
  },
});

/**
 * classifyFeedback(row) → { bucket, severity, suggestedFix }
 *
 * Pure. Falls back to manual_review when feedbackType is
 * unknown (so a future option name doesn't crash analytics).
 */
export function classifyFeedback(row) {
  const type = String((row && row.feedbackType) || '').toLowerCase();
  const hit = _MAP[type];
  if (hit) return { ...hit };
  return {
    bucket:   BUCKETS.MANUAL_REVIEW,
    severity: SEVERITY.MEDIUM,
    suggestedFix:
      'Unknown feedback type \u2014 read the row manually and decide if a new bucket is needed.',
  };
}

/**
 * classifyAll(rows) → Map<bucket, { count, severityWeight, examples, fix }>
 *
 * Aggregates a list of feedback rows into a per-bucket roll-up
 * so the priority engine + admin dashboard can read one shape.
 */
export function classifyAll(rows) {
  const out = new Map();
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const c = classifyFeedback(row);
    const cur = out.get(c.bucket) || {
      bucket:        c.bucket,
      count:         0,
      severityWeight: 0,
      examples:      [],
      fix:           c.suggestedFix,
      severity:      c.severity, // last-write wins, all rows in a bucket share severity
    };
    cur.count += 1;
    cur.severityWeight += _SEVERITY_WEIGHT[c.severity] || 1;
    if (cur.examples.length < 3 && row && row.feedbackText) {
      cur.examples.push({
        text:   String(row.feedbackText).slice(0, 200),
        screen: row.screen || null,
        ts:     row.timestamp || null,
      });
    }
    out.set(c.bucket, cur);
  }
  return out;
}

const _SEVERITY_WEIGHT = Object.freeze({
  critical: 3,
  high:     2,
  medium:   1,
});

export const FEEDBACK_BUCKETS = BUCKETS;
export const FEEDBACK_SEVERITY = SEVERITY;
export default classifyFeedback;
