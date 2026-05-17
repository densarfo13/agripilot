/**
 * impactMetrics.js (core/impact) — pilot impact reporting facade
 * (Final Readiness §7).
 *
 *   import { getPilotImpactReport }
 *     from 'src/core/impact/impactMetrics.js';
 *
 * Why this file is a FACADE, not a new engine
 * ───────────────────────────────────────────
 *   The canonical impact math already lives in
 *   `src/metrics/impactMetrics.js` (NGO summary, CSV export,
 *   honest "not a yield guarantee" wording) and retention cohorts
 *   live in `src/core/retention/retentionEngine.js`. Re-implementing
 *   either here would duplicate engines — against the project rule.
 *
 *   This module simply re-exports the canonical impact helpers at
 *   the spec-requested path AND adds one combined report that
 *   stitches impact + retention together for NGO / grant reporting.
 *
 * Strict-rule audit
 *   • Pure. Never throws. No I/O — events/farms are passed in.
 */

// Re-export the canonical impact helpers so callers can import
// them from the core/impact path.
export {
  summariseImpact,
  computeImpactSummary,
  computeNgoEngagementSummary,
  computeActiveFarmers7d,
  computeTasksCompleted7d,
  computeTaskCompletionRate,
  engagementToCsv,
  impactSummaryToCsv,
  IMPACT_EVENTS,
} from '../../metrics/impactMetrics.js';

import { computeNgoEngagementSummary } from '../../metrics/impactMetrics.js';
import {
  computeRetentionMetrics,
  computeRetentionCohorts,
} from '../retention/retentionEngine.js';

/**
 * One combined pilot-impact report for NGO / grant reporting —
 * farmer engagement + retention in a single object.
 *
 * @param {object} [args]
 * @param {Array}  [args.events]  the canonical event log
 * @param {Array}  [args.farms]   the farm list
 * @returns {object}
 */
export function getPilotImpactReport({ events = [], farms = [] } = {}) {
  let engagement;
  try {
    engagement = computeNgoEngagementSummary({ events, farms });
  } catch {
    engagement = null;
  }
  let retention;
  let cohorts;
  try { retention = computeRetentionMetrics(); } catch { retention = null; }
  try { cohorts = computeRetentionCohorts(); } catch { cohorts = null; }

  return Object.freeze({
    engagement,
    retention,
    cohorts,
    generatedAt: new Date().toISOString(),
    note: 'Monitoring + activity metrics. Not a guarantee of yield or income.',
  });
}

const _module = { getPilotImpactReport };
export default _module;
