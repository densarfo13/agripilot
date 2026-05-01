/**
 * printFeedbackSummary.js — dev-console helper.
 *
 *   import { printFeedbackSummary, attachWindowHelper }
 *     from '.../utils/printFeedbackSummary.js';
 *
 *   printFeedbackSummary();  // logs the rollup to console
 *
 * In dev builds the helper is auto-attached to
 * `window.__farrowayPrintFeedback` so engineers can paste
 * `__farrowayPrintFeedback()` into the browser console without
 * an import.
 *
 * Logs (final feedback-loop spec §7):
 *   * total feedback count
 *   * top 3 buckets (with counts)
 *   * top 3 screens (with counts)
 *   * recommended next fix
 *
 * Strict-rule audit
 *   * Never throws — every store read is wrapped.
 *   * No I/O beyond `console.log`. Safe to call from any context.
 *   * Idempotent attach: calling attachWindowHelper twice is a no-op.
 */

import {
  getFeedback, getFeedbackByScreen,
} from '../analytics/userFeedbackStore.js';
import { computeFeedbackPriority } from '../analytics/feedbackPriority.js';

/**
 * printFeedbackSummary() — logs the current rollup. Returns the
 * structured data so callers can use it programmatically.
 */
export function printFeedbackSummary() {
  let rows;
  try { rows = getFeedback() || []; } catch { rows = []; }

  const total = rows.length;
  const priority = (() => {
    try { return computeFeedbackPriority({ rows }); }
    catch {
      return { topIssue: null, ranking: [], recommendedNextFix: '' };
    }
  })();

  const topBuckets = (priority.ranking || [])
    .slice(0, 3)
    .map((r) => ({ bucket: r.bucket, count: r.count, severity: r.severity }));

  const byScreen = (() => {
    try { return getFeedbackByScreen() || {}; }
    catch { return {}; }
  })();
  const topScreens = Object.entries(byScreen)
    .map(([screen, list]) => ({ screen, count: Array.isArray(list) ? list.length : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const summary = {
    total,
    topBuckets,
    topScreens,
    recommendedNextFix: priority.recommendedNextFix || '',
  };

  try {
    // eslint-disable-next-line no-console
    console.log('[farroway feedback summary]', summary);
  } catch { /* swallow */ }

  return summary;
}

/**
 * attachWindowHelper() — exposes `printFeedbackSummary` on
 * `window.__farrowayPrintFeedback` for in-console use during
 * dev. Safe to call multiple times.
 */
export function attachWindowHelper() {
  try {
    if (typeof window === 'undefined') return false;
    window.__farrowayPrintFeedback = printFeedbackSummary;
    return true;
  } catch { return false; }
}

// Auto-attach in dev builds so engineers can paste the helper
// into the console without an import. Production tree-shakes
// this out via `import.meta.env.DEV`.
try {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    attachWindowHelper();
  }
} catch { /* swallow */ }

export default printFeedbackSummary;
