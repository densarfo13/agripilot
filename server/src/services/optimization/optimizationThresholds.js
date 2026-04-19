/**
 * optimizationThresholds.js — MINIMUM event counts per signal
 * family before any adjustment is allowed to fire, plus the HARD
 * CAPS on the deltas we're willing to emit.
 *
 * Rules the file enforces (via constants other modules import):
 *
 *   1. Below-threshold contexts get zeroed-out deltas. We never
 *      move recommendations based on 2 clicks.
 *   2. Every delta is bounded to a small range. A single context
 *      can nudge — it can't flip the default.
 *   3. Signals older than MAX_AGE_DAYS are ignored entirely
 *      (pre-filtered at extraction time).
 *
 * These are the knobs a product team would tune. They live in
 * one file so tests and dashboards can import them.
 */

// ─── Minimum counts per signal family ─────────────────────
export const MIN_RECOMMENDATION_SIGNALS = 10;  // accepted + rejected combined
export const MIN_HARVEST_SIGNALS        = 5;   // good + bad outcomes
export const MIN_TASK_SIGNALS           = 8;   // completed + skipped combined
export const MIN_LISTING_SIGNALS        = 15;  // interest + sold + expired combined

// ─── Bounded delta caps ───────────────────────────────────
// All four deltas are expressed in the UNITS of the surface they
// nudge. recommendationDelta is multiplied into a 0..1 score;
// confidenceDelta is added to a 0..100 confidence score;
// urgencyDelta is added to a -1..+1 urgency scale;
// listingQualityDelta raises the completeness floor for a region.
export const MAX_RECOMMENDATION_DELTA = 0.15;   // [-0.15, +0.15]
export const MAX_CONFIDENCE_DELTA     = 10;     // [-10, +10] on 0..100
export const MAX_URGENCY_DELTA        = 1;      // [-1, +1]
export const MAX_LISTING_QUALITY_DELTA = 0.2;   // [0, +0.2]

// ─── Signal age window (for extractor pre-filter) ────────
export const MAX_SIGNAL_AGE_DAYS = 90;

// ─── Exponential decay half-life (optional) ──────────────
// Used by the weighted aggregator so a signal from 60 days ago
// counts for roughly half of a signal from today. Keep it long
// enough that seasonal crops still contribute.
export const DECAY_HALF_LIFE_DAYS = 45;

/**
 * clampDelta — single canonical helper every module uses so no
 * one silently emits an over-bounds value.
 */
export function clampDelta(value, max) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(-max, Math.min(max, v));
}

/** Non-negative variant for listing quality (never decrease a floor). */
export function clampNonNegativeDelta(value, max) {
  const v = Number(value);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(max, v));
}

export const _internal = {
  MIN_RECOMMENDATION_SIGNALS, MIN_HARVEST_SIGNALS,
  MIN_TASK_SIGNALS, MIN_LISTING_SIGNALS,
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
  MAX_URGENCY_DELTA, MAX_LISTING_QUALITY_DELTA,
  MAX_SIGNAL_AGE_DAYS, DECAY_HALF_LIFE_DAYS,
};
