/**
 * optimizationEngine.js — converts extracted signals into
 * bounded, per-context adjustment deltas. This is the layer that
 * sits between the event stream and the runtime pipeline.
 *
 * Contract:
 *   computeAdjustments(extractionResult) → {
 *     byContext: { [key]: Adjustment },
 *     totals:    { contexts, adjusted, skippedBelowThreshold },
 *   }
 *
 * Adjustment shape:
 *   {
 *     contextKey,
 *     recommendationDelta,    // [-0.15, +0.15]
 *     confidenceDelta,        // [-10, +10]   on 0..100 scale
 *     urgencyDelta,           // [-1, +1]
 *     listingQualityDelta,    // [0, +0.2]
 *     meetsThreshold: {
 *       recommendation, harvest, task, listing,
 *     },
 *     reasons: string[],     // which rules fired
 *     counts: { ... },       // raw signal counts
 *   }
 *
 * Rules:
 *   • Below-threshold signal families contribute 0 to their delta
 *   • All deltas are clamped via clampDelta / clampNonNegativeDelta
 *   • An "empty" adjustment (no-op) is still emitted so callers can
 *     iterate over every context without null checks
 *   • Reasons are human-readable so dashboards show WHY a delta fired
 */

import {
  MIN_RECOMMENDATION_SIGNALS, MIN_HARVEST_SIGNALS,
  MIN_TASK_SIGNALS, MIN_LISTING_SIGNALS,
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
  MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
  clampDelta, clampNonNegativeDelta,
} from './optimizationThresholds.js';

/**
 * computeAdjustments — batch over every context in the extraction
 * result and emit one Adjustment per context.
 */
export function computeAdjustments(extraction = {}) {
  const byContext = {};
  const totals = { contexts: 0, adjusted: 0, skippedBelowThreshold: 0 };

  const input = extraction.byContext || {};
  for (const [contextKey, bucket] of Object.entries(input)) {
    totals.contexts += 1;
    const adj = computeAdjustmentForContext(contextKey, bucket);
    byContext[contextKey] = adj;
    if (isActive(adj)) totals.adjusted += 1;
    else if (hasAnySignal(bucket)) totals.skippedBelowThreshold += 1;
  }

  return { byContext, totals };
}

/**
 * computeAdjustmentForContext — the single-context rule set.
 *
 * Recommendation delta:
 *   ratio = (accepted - rejected) / (accepted + rejected)
 *   delta = ratio × MAX / 2           (so a perfect split maxes out at half the cap)
 *   only fires when accepted + rejected ≥ MIN_RECOMMENDATION_SIGNALS
 *
 * Confidence delta:
 *   ratio = (good - bad) / (good + bad)
 *   delta = ratio × MAX               (can reach the full ±10 at 100% good/bad)
 *   only fires when good + bad ≥ MIN_HARVEST_SIGNALS
 *
 * Urgency delta:
 *   If repeat_skipped is high, urgency decreases (don't nag).
 *   If completed:skipped ratio is high, urgency can rise slightly.
 *   only fires when completed + skipped ≥ MIN_TASK_SIGNALS
 *
 * Listing quality delta (non-negative):
 *   If expired-unsold dominates interest/sold, raise the
 *   completeness floor a bit so we nudge sellers harder.
 *   only fires when interest + sold + expired ≥ MIN_LISTING_SIGNALS
 */
export function computeAdjustmentForContext(contextKey, bucket = {}) {
  const counts = bucket.counts || {};
  const reasons = [];

  // ── Recommendation ─────────────────────────────────
  const recTotal = (counts.rec_accepted || 0) + (counts.rec_rejected || 0);
  const recMeets = recTotal >= MIN_RECOMMENDATION_SIGNALS;
  let recommendationDelta = 0;
  if (recMeets && recTotal > 0) {
    const ratio = ((counts.rec_accepted || 0) - (counts.rec_rejected || 0)) / recTotal;
    recommendationDelta = clampDelta(ratio * (MAX_RECOMMENDATION_DELTA / 2),
                                     MAX_RECOMMENDATION_DELTA);
    if (recommendationDelta !== 0) {
      reasons.push(ratio > 0
        ? `recommendation_up_ratio:${ratio.toFixed(2)}`
        : `recommendation_down_ratio:${ratio.toFixed(2)}`);
    }
  }

  // ── Confidence (harvest outcomes) ──────────────────
  const harvestTotal = (counts.harvest_good || 0) + (counts.harvest_bad || 0);
  const harvestMeets = harvestTotal >= MIN_HARVEST_SIGNALS;
  let confidenceDelta = 0;
  if (harvestMeets && harvestTotal > 0) {
    const ratio = ((counts.harvest_good || 0) - (counts.harvest_bad || 0)) / harvestTotal;
    confidenceDelta = clampDelta(ratio * MAX_CONFIDENCE_DELTA, MAX_CONFIDENCE_DELTA);
    if (confidenceDelta !== 0) {
      reasons.push(ratio > 0
        ? `confidence_up_harvest_ratio:${ratio.toFixed(2)}`
        : `confidence_down_harvest_ratio:${ratio.toFixed(2)}`);
    }
  }

  // ── Urgency (task behavior) ─────────────────────────
  const completed = counts.task_completed || 0;
  const skipped   = counts.task_skipped || 0;
  const repeat    = counts.task_repeat_skipped || 0;
  const taskTotal = completed + skipped;
  const taskMeets = taskTotal >= MIN_TASK_SIGNALS;
  let urgencyDelta = 0;
  if (taskMeets && taskTotal > 0) {
    const completionRatio = completed / taskTotal;
    // Repeat skips drag urgency DOWN — the user is already
    // seeing this task and ignoring it; yelling louder won't help.
    const repeatShare = taskTotal > 0 ? repeat / (taskTotal + repeat) : 0;
    let raw = 0;
    if (repeatShare > 0.2) {
      raw -= Math.min(MAX_URGENCY_DELTA, repeatShare * MAX_URGENCY_DELTA);
      reasons.push(`urgency_down_repeat_skip_share:${repeatShare.toFixed(2)}`);
    }
    if (completionRatio >= 0.75) {
      raw += 0.3;   // small nudge up — user is responsive to tasks
      reasons.push(`urgency_up_high_completion:${completionRatio.toFixed(2)}`);
    } else if (completionRatio <= 0.3) {
      raw -= 0.3;
      reasons.push(`urgency_down_low_completion:${completionRatio.toFixed(2)}`);
    }
    urgencyDelta = clampDelta(raw, MAX_URGENCY_DELTA);
  }

  // ── Listing quality ────────────────────────────────
  const interest = counts.listing_interest || 0;
  const sold     = counts.listing_sold || 0;
  const expired  = counts.listing_expired_unsold || 0;
  const listingTotal = interest + sold + expired;
  const listingMeets = listingTotal >= MIN_LISTING_SIGNALS;
  let listingQualityDelta = 0;
  if (listingMeets && listingTotal > 0) {
    const expiredShare = expired / listingTotal;
    // High expired share → raise the completeness floor so the
    // product nudges sellers harder to fill missing fields.
    if (expiredShare >= 0.4) {
      listingQualityDelta = clampNonNegativeDelta(
        (expiredShare - 0.4) * MAX_LISTING_QUALITY_DELTA * 2,
        MAX_LISTING_QUALITY_DELTA,
      );
      if (listingQualityDelta > 0) {
        reasons.push(`listing_quality_up_expired_share:${expiredShare.toFixed(2)}`);
      }
    }
  }

  return {
    contextKey,
    recommendationDelta,
    confidenceDelta,
    urgencyDelta,
    listingQualityDelta,
    meetsThreshold: {
      recommendation: recMeets,
      harvest:        harvestMeets,
      task:           taskMeets,
      listing:        listingMeets,
    },
    reasons,
    counts: { ...counts },
  };
}

/**
 * adjustmentForKey — convenience: given the aggregated
 * adjustments map, return the specific context's adjustment or
 * a safe zero-adjustment object. Callers never need null checks.
 */
export function adjustmentForKey(adjustments = {}, contextKey) {
  const byContext = adjustments.byContext || adjustments;
  return byContext[contextKey] || zeroAdjustment(contextKey);
}

export function zeroAdjustment(contextKey = '') {
  return {
    contextKey,
    recommendationDelta: 0,
    confidenceDelta: 0,
    urgencyDelta: 0,
    listingQualityDelta: 0,
    meetsThreshold: {
      recommendation: false, harvest: false, task: false, listing: false,
    },
    reasons: [],
    counts: {},
  };
}

function isActive(adj) {
  return (adj.recommendationDelta !== 0)
      || (adj.confidenceDelta !== 0)
      || (adj.urgencyDelta !== 0)
      || (adj.listingQualityDelta !== 0);
}

function hasAnySignal(bucket) {
  if (!bucket || !bucket.counts) return false;
  for (const v of Object.values(bucket.counts)) {
    if (v > 0) return true;
  }
  return false;
}

export const _internal = { isActive, hasAnySignal };
