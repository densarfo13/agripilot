/**
 * optimizationReportingService.js — surfaces the optimization
 * loop's internal state so the dev panel + admin dashboards can
 * show WHAT is being adjusted and WHY.
 *
 * Functions:
 *   getTopAcceptedRecommendations(extraction, n?)
 *   getMostRejectedRecommendations(extraction, n?)
 *   getTaskSkipPatterns(extraction, n?)
 *   getBestConvertingListingContexts(extraction, n?)
 *   buildOptimizationSnapshot({ extraction, adjustments })
 *
 * Every function is a pure read over the extraction + adjustment
 * output — no side effects, no persistence.
 */

import { parseContextKey } from './contextKey.js';

/**
 * getTopAcceptedRecommendations — top N contexts by
 * rec_accepted count. Ties broken by (accepted - rejected).
 */
export function getTopAcceptedRecommendations(extraction = {}, n = 10) {
  const rows = collectRows(extraction, (c) => (c.rec_accepted || 0) > 0);
  rows.sort((a, b) => {
    const diffA = (a.counts.rec_accepted || 0) - (a.counts.rec_rejected || 0);
    const diffB = (b.counts.rec_accepted || 0) - (b.counts.rec_rejected || 0);
    return (b.counts.rec_accepted - a.counts.rec_accepted) || (diffB - diffA);
  });
  return rows.slice(0, n).map(toRecRow);
}

/**
 * getMostRejectedRecommendations — top N contexts by
 * rec_rejected count.
 */
export function getMostRejectedRecommendations(extraction = {}, n = 10) {
  const rows = collectRows(extraction, (c) => (c.rec_rejected || 0) > 0);
  rows.sort((a, b) => (b.counts.rec_rejected || 0) - (a.counts.rec_rejected || 0));
  return rows.slice(0, n).map(toRecRow);
}

/**
 * getTaskSkipPatterns — which modes have the highest task-skip
 * pressure. Returns rows sorted by (skipped + 2*repeat_skipped).
 */
export function getTaskSkipPatterns(extraction = {}, n = 10) {
  const rows = collectRows(extraction, (c) =>
    (c.task_skipped || 0) > 0 || (c.task_repeat_skipped || 0) > 0);
  rows.sort((a, b) => {
    const scoreB = (b.counts.task_skipped || 0) + 2 * (b.counts.task_repeat_skipped || 0);
    const scoreA = (a.counts.task_skipped || 0) + 2 * (a.counts.task_repeat_skipped || 0);
    return scoreB - scoreA;
  });
  return rows.slice(0, n).map((r) => {
    const ctx = parseContextKey(r.contextKey);
    return {
      contextKey: r.contextKey,
      mode: ctx.mode || null,
      completed: r.counts.task_completed || 0,
      skipped:   r.counts.task_skipped || 0,
      repeatSkipped: r.counts.task_repeat_skipped || 0,
      lastSignalAt: r.lastSignalAt,
    };
  });
}

/**
 * getBestConvertingListingContexts — rank regions by (sold) /
 * (interest + sold + expired). Only rows with at least one sale
 * are returned; dashboards use this to highlight traits that
 * correlate with conversion.
 */
export function getBestConvertingListingContexts(extraction = {}, n = 10) {
  const rows = collectRows(extraction, (c) => (c.listing_sold || 0) > 0);
  for (const r of rows) {
    const total = (r.counts.listing_interest || 0)
                + (r.counts.listing_sold || 0)
                + (r.counts.listing_expired_unsold || 0);
    r._conversion = total > 0 ? (r.counts.listing_sold / total) : 0;
  }
  rows.sort((a, b) => b._conversion - a._conversion);
  return rows.slice(0, n).map((r) => {
    const ctx = parseContextKey(r.contextKey);
    return {
      contextKey: r.contextKey,
      country: ctx.country || null,
      state:   ctx.state   || null,
      interest: r.counts.listing_interest || 0,
      sold:     r.counts.listing_sold || 0,
      expired:  r.counts.listing_expired_unsold || 0,
      conversionRate: +r._conversion.toFixed(4),
    };
  });
}

/**
 * buildOptimizationSnapshot — full payload for the dev panel.
 * Includes every list the panel renders plus a count of active
 * adjustments grouped by delta family.
 */
export function buildOptimizationSnapshot({ extraction = {}, adjustments = {}, now = Date.now() } = {}) {
  const byContext = adjustments.byContext || {};
  const active = {
    recommendation: 0, confidence: 0, urgency: 0, listingQuality: 0,
  };
  for (const adj of Object.values(byContext)) {
    if (adj.recommendationDelta !== 0)  active.recommendation += 1;
    if (adj.confidenceDelta !== 0)      active.confidence += 1;
    if (adj.urgencyDelta !== 0)         active.urgency += 1;
    if (adj.listingQualityDelta !== 0)  active.listingQuality += 1;
  }
  return {
    generatedAt: now,
    extraction: {
      totalEvents: extraction.totalEvents ?? 0,
      familyTotals: extraction.familyTotals ?? {},
      contextCount: Object.keys(extraction.byContext || {}).length,
    },
    adjustmentTotals: adjustments.totals || {},
    activeAdjustments: active,
    topAccepted:   getTopAcceptedRecommendations(extraction, 10),
    topRejected:   getMostRejectedRecommendations(extraction, 10),
    taskSkipTop:   getTaskSkipPatterns(extraction, 10),
    bestConverts:  getBestConvertingListingContexts(extraction, 10),
    // Compact by-context view for the panel — just the deltas
    // and top reason per context, capped so the payload stays
    // sane.
    activeByContext: Object.values(byContext)
      .filter((a) => isActive(a))
      .map((a) => ({
        contextKey: a.contextKey,
        deltas: {
          rec: a.recommendationDelta,
          conf: a.confidenceDelta,
          urg: a.urgencyDelta,
          list: a.listingQualityDelta,
        },
        reason: (a.reasons && a.reasons[0]) || null,
      }))
      .slice(0, 50),
  };
}

// ─── internals ────────────────────────────────────────────
function collectRows(extraction, filterFn) {
  const byContext = extraction.byContext || {};
  const out = [];
  for (const [contextKey, bucket] of Object.entries(byContext)) {
    const counts = bucket.counts || {};
    if (filterFn && !filterFn(counts)) continue;
    out.push({
      contextKey,
      counts,
      lastSignalAt: bucket.lastSignalAt || null,
    });
  }
  return out;
}

function toRecRow(r) {
  const ctx = parseContextKey(r.contextKey);
  return {
    contextKey: r.contextKey,
    crop: ctx.crop || null,
    country: ctx.country || null,
    mode: ctx.mode || null,
    accepted: r.counts.rec_accepted || 0,
    rejected: r.counts.rec_rejected || 0,
    net: (r.counts.rec_accepted || 0) - (r.counts.rec_rejected || 0),
    lastSignalAt: r.lastSignalAt,
  };
}

function isActive(adj) {
  return (adj.recommendationDelta !== 0)
      || (adj.confidenceDelta !== 0)
      || (adj.urgencyDelta !== 0)
      || (adj.listingQualityDelta !== 0);
}
