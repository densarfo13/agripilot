/**
 * confidence — pure helpers for the three-tier confidence ladder.
 *
 * SPEC §12
 *   • Tiers: low | medium | high
 *   • Farmer UI shows confidence ONLY when helpful
 *   • Low → "Needs review" copy in the adapter
 *   • Admin/NGO surfaces may see the raw tier + numeric score
 *
 * IMPLEMENTATION NOTES
 *   • All helpers pure — no side effects, never throw.
 *   • Uses `CONFIDENCE_BANDS` from intelligenceTypes so band
 *     thresholds live in one place.
 */

import { CONFIDENCE, CONFIDENCE_BANDS } from './intelligenceTypes.js';

/**
 * Convert a 0..1 numeric score to a tier label. Out-of-range
 * inputs clamp to the nearest band; non-finite inputs return LOW
 * so the adapter never rounds an `undefined` into HIGH.
 *
 * @param {number} score
 * @returns {'low'|'medium'|'high'}
 */
export function confidenceTier(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return CONFIDENCE.LOW;
  if (n >= CONFIDENCE_BANDS.MEDIUM_MAX) return CONFIDENCE.HIGH;
  if (n >= CONFIDENCE_BANDS.LOW_MAX)    return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

/**
 * Combine multiple 0..1 signals into a single confidence tier
 * via a weighted-average. Missing weights default to 1 so the
 * caller can pass `[0.6, 0.8, 0.4]` without bookkeeping.
 *
 * @param {Array<number>|Array<{score:number,weight?:number}>} signals
 * @returns {'low'|'medium'|'high'}
 */
export function confidenceFromSignals(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return CONFIDENCE.LOW;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of signals) {
    if (typeof s === 'number') {
      const n = Number(s);
      if (Number.isFinite(n)) {
        weightedSum += n;
        totalWeight += 1;
      }
      continue;
    }
    if (s && typeof s === 'object') {
      const score  = Number(s.score);
      const weight = Number.isFinite(Number(s.weight)) ? Number(s.weight) : 1;
      if (Number.isFinite(score) && weight > 0) {
        weightedSum += score * weight;
        totalWeight += weight;
      }
    }
  }
  if (totalWeight <= 0) return CONFIDENCE.LOW;
  return confidenceTier(weightedSum / totalWeight);
}

/**
 * Calm farmer-facing label for a confidence tier. The adapter
 * uses this when (and only when) showing confidence helps the
 * user judge a result — e.g. on a scan card.
 *
 * @param {'low'|'medium'|'high'|null} tier
 * @returns {string}
 */
export function confidenceLabel(tier) {
  if (tier === CONFIDENCE.HIGH)   return 'High confidence';
  if (tier === CONFIDENCE.MEDIUM) return 'Medium confidence';
  if (tier === CONFIDENCE.LOW)    return 'Needs review';
  return '';
}

/**
 * True when the tier is HIGH or MEDIUM. Used as a render guard
 * for "we'll commit to this" UI affordances; LOW always falls
 * through to the calm "Needs review" path.
 */
export function isUsableConfidence(tier) {
  return tier === CONFIDENCE.HIGH || tier === CONFIDENCE.MEDIUM;
}

const _module = {
  confidenceTier,
  confidenceFromSignals,
  confidenceLabel,
  isUsableConfidence,
};
export default _module;
