/**
 * applyOptimization.js — runtime integration. Takes the
 * adjustments computed by the optimization engine and applies
 * them AT the OPTIMIZATION stage of the decision pipeline.
 *
 * Three rules enforced here, not in docs:
 *
 *   1. Base rules + guardrails ALWAYS win. This file only
 *      nudges values that upstream stages didn't lock.
 *   2. Every output is clamped — a delta can't push a score
 *      outside [0, 1] or a confidence outside [0, 100].
 *   3. No mutation of caller state. Every function returns a new
 *      object.
 *
 * Exposed functions:
 *   applyRecommendationOptimization(scores, adjustment, locks?)
 *   applyTaskUrgencyOptimization(task, adjustment)
 *   applyConfidenceOptimization(confidence, adjustment)
 *   applyListingQualityOptimization(listing, adjustment)
 */

import { adjustmentForKey, zeroAdjustment } from './optimizationEngine.js';
import {
  MAX_RECOMMENDATION_DELTA, MAX_CONFIDENCE_DELTA,
} from './optimizationThresholds.js';

const URGENCY_RANK = ['low', 'medium', 'high'];

/**
 * applyRecommendationOptimization — nudge each crop's score by
 * the recommendationDelta of its (crop, country, mode) context.
 *
 * Guardrail respect:
 *   If `locks` contains `crop:<name>`, that crop's score is NOT
 *   touched. The pipeline's guardrail stage uses those locks to
 *   exclude crops; optimization must never re-score them in.
 *
 * @param {Object} baseScores — { crop: score in [0,1] }
 * @param {Object} adjustmentsByKey — either the full adjustments
 *        object or a single adjustment; we check both shapes
 * @param {{ country?, mode?, locks? }} opts
 */
export function applyRecommendationOptimization(baseScores = {}, adjustmentsByKey = {}, opts = {}) {
  if (!baseScores || typeof baseScores !== 'object') return {};
  const country = (opts.country || '').toLowerCase();
  const mode    = (opts.mode || '').toLowerCase();
  const locks   = opts.locks || {};
  const out = {};

  for (const [crop, score] of Object.entries(baseScores)) {
    const lockKey = `crop:${crop.toLowerCase()}`;
    if (locks[lockKey]) { out[crop] = score; continue; }   // locked → untouched

    const cKey = buildCropKey({ crop, country, mode });
    const adj = findAdjustment(adjustmentsByKey, cKey);
    const delta = clamp(adj.recommendationDelta, -MAX_RECOMMENDATION_DELTA, MAX_RECOMMENDATION_DELTA);
    const next = Number(score) + delta;
    out[crop] = clamp(next, 0, 1);
  }
  return out;
}

/**
 * applyConfidenceOptimization — add the per-context confidence
 * delta to a { level, score, reasons[] } confidence object.
 * The level is re-derived from the adjusted score so dashboards
 * match what the UI renders.
 */
export function applyConfidenceOptimization(confidence, adjustment, opts = {}) {
  if (!confidence || typeof confidence !== 'object') return confidence;
  const delta = clamp((adjustment && adjustment.confidenceDelta) || 0,
                      -MAX_CONFIDENCE_DELTA, MAX_CONFIDENCE_DELTA);
  const rawScore = Number.isFinite(confidence.score)
    ? Number(confidence.score)
    : levelToScore(confidence.level);
  const nextScore = clamp(rawScore + delta, 0, 100);
  const level = nextScore >= (opts.highThreshold ?? 75) ? 'high'
              : nextScore >= (opts.mediumThreshold ?? 45) ? 'medium'
              : 'low';
  const reasons = [...(Array.isArray(confidence.reasons) ? confidence.reasons : [])];
  if (delta !== 0) reasons.push(`opt_confidence_delta:${delta.toFixed(2)}`);
  return { ...confidence, level, score: nextScore, reasons };
}

/**
 * applyTaskUrgencyOptimization — nudge the task's urgency
 * (low/medium/high) up or down by the optimization delta.
 *
 * urgencyDelta ∈ [-1, +1]. We map:
 *   > +0.5  → step up one level (capped at 'high')
 *   < -0.5  → step down one level (floored at 'low')
 *   otherwise → unchanged
 */
export function applyTaskUrgencyOptimization(task, adjustment) {
  if (!task || typeof task !== 'object') return task;
  const delta = Number(adjustment?.urgencyDelta) || 0;
  const urgency = normalizeUrgency(task.urgency);
  let idx = URGENCY_RANK.indexOf(urgency);
  if (idx < 0) idx = 1; // default medium
  if (delta >= 0.5)  idx = Math.min(URGENCY_RANK.length - 1, idx + 1);
  if (delta <= -0.5) idx = Math.max(0, idx - 1);
  return { ...task, urgency: URGENCY_RANK[idx] };
}

/**
 * applyListingQualityOptimization — raise the completeness
 * floor the UI nudges sellers toward. The delta is non-negative,
 * so this rule only TIGHTENS quality expectations — it never
 * relaxes them.
 */
export function applyListingQualityOptimization(listing, adjustment, opts = {}) {
  if (!listing || typeof listing !== 'object') return listing;
  const baseFloor = Number(opts.baseFloor ?? 0.6);
  const delta = Math.max(0, Number(adjustment?.listingQualityDelta) || 0);
  const floor = Math.min(1, baseFloor + delta);
  return {
    ...listing,
    completenessFloor: floor,
    // Set a flag the UI can read to decide whether to nudge harder.
    stricterQuality: delta > 0,
  };
}

// ─── internals ────────────────────────────────────────────
function buildCropKey({ crop, country, mode }) {
  // Matches `buildRecommendationContextKey` from contextKey.js:
  //   crop | country | state('') | mode | month('')
  const c  = String(crop || '').toLowerCase();
  const co = String(country || '').toLowerCase();
  const m  = String(mode || '').toLowerCase();
  return `${c}|${co}||${m}|`;
}

function findAdjustment(adjustmentsByKey, key) {
  if (adjustmentsByKey && adjustmentsByKey.byContext) {
    return adjustmentForKey(adjustmentsByKey, key);
  }
  if (adjustmentsByKey && adjustmentsByKey[key]) return adjustmentsByKey[key];
  return zeroAdjustment(key);
}

function clamp(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function levelToScore(level) {
  if (level === 'high') return 80;
  if (level === 'low')  return 30;
  return 55;
}

function normalizeUrgency(u) {
  const v = String(u || '').toLowerCase();
  return URGENCY_RANK.includes(v) ? v : 'medium';
}

export const _internal = {
  URGENCY_RANK, buildCropKey, findAdjustment, clamp,
  levelToScore, normalizeUrgency,
};
