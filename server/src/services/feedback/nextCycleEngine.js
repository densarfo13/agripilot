/**
 * nextCycleEngine.js — post-harvest "what next" logic.
 *
 *   applyOutcomeToRiskBaseline(outcome, base?) → new base risk band
 *     Good outcomes trim the baseline; failed / high-risk cycles lift
 *     it so the next cycle's Today engine starts cautious.
 *
 *   getNextCycleAdjustments(outcome)           → { confidenceMultiplier,
 *                                                  riskBaseline,
 *                                                  recommendationHints[] }
 *     A single blob the recommendation service reads when the farmer
 *     kicks off the next cycle.
 *
 *   getNextCycleRecommendations({ outcome, cycle, region, farmType,
 *                                 beginnerLevel, growingStyle,
 *                                 currentMonth, pastOutcomes })
 *     → { headline, options: [ {type, cropKey, reason, …}, … ] }
 *     Suggests up to three next-step options the farmer can tap:
 *       - repeat crop with an improved plan
 *       - switch to a better-fit crop
 *       - delay planting until the next window
 *
 * Pure function. No I/O. The HTTP route composes past harvest rows
 * and hands them in via `pastOutcomes`.
 */

import { applyOutcomeToConfidence, OUTCOME_CLASS, deriveOutcomeClass } from './learningEngine.js';
import { scoreAllCrops } from '../scoring/cropScoringEngine.js';

const RISK_ORDER = { low: 0, medium: 1, high: 2 };

function bumpBand(band, delta) {
  const idx = RISK_ORDER[band] ?? 0;
  const next = Math.max(0, Math.min(2, idx + delta));
  return ['low', 'medium', 'high'][next];
}

/**
 * applyOutcomeToRiskBaseline — how the next cycle should *start*
 * risk-wise given what we just learned:
 *   - failed        → +2 bands (from low → high)
 *   - high_risk     → +1
 *   - delayed       → no change
 *   - successful    → -1 (capped at 'low')
 */
export function applyOutcomeToRiskBaseline(outcome = {}, base = 'low') {
  const klass = deriveOutcomeClass(outcome);
  if (klass === OUTCOME_CLASS.FAILED)     return bumpBand(base, +2);
  if (klass === OUTCOME_CLASS.HIGH_RISK)  return bumpBand(base, +1);
  if (klass === OUTCOME_CLASS.SUCCESSFUL) return bumpBand(base, -1);
  return base;
}

/**
 * getNextCycleAdjustments — bundles the per-outcome learning so the
 * crop-scoring engine can multiply it in and the Today engine can
 * read the baseline.
 */
export function getNextCycleAdjustments(outcome = {}) {
  const klass = deriveOutcomeClass(outcome);
  const cropKey = String(outcome.cropKey || outcome.crop || '').toLowerCase();
  const multiplier = cropKey
    ? applyOutcomeToConfidence(cropKey, [outcome])
    : 1;

  const hints = [];
  if (klass === OUTCOME_CLASS.SUCCESSFUL) hints.push('nextCycle.hint.repeatImproved');
  if (klass === OUTCOME_CLASS.DELAYED)    hints.push('nextCycle.hint.tryEarlier');
  if (klass === OUTCOME_CLASS.HIGH_RISK)  hints.push('nextCycle.hint.saferCrop');
  if (klass === OUTCOME_CLASS.FAILED)     hints.push('nextCycle.hint.switchCrop');

  return {
    confidenceMultiplier: multiplier,
    riskBaseline: applyOutcomeToRiskBaseline(outcome, 'low'),
    recommendationHints: hints,
    outcomeClass: klass,
  };
}

/**
 * getNextCycleRecommendations — up to three tap-to-act options.
 *
 * Strategy:
 *   1. If successful / delayed → offer "repeat with improved plan" as
 *      the first option using the same crop.
 *   2. Always compute scoreAllCrops for the current month and farmer
 *      context so we can suggest the best *alternative* crop.
 *   3. If the new planting-status for the current crop is 'wait' or
 *      'avoid', offer "delay planting" as an option instead.
 */
export function getNextCycleRecommendations({
  outcome,
  cycle,
  region,
  farmType,
  beginnerLevel,
  growingStyle,
  currentMonth,
  pastOutcomes,
} = {}) {
  const adjustments = getNextCycleAdjustments(outcome || {});
  const lastCrop = String(outcome?.cropKey || cycle?.cropType || '').toLowerCase() || null;

  // Run the scorer once so every option has the same confidence /
  // support-depth treatment as a fresh recommendation.
  let scored = null;
  try {
    scored = scoreAllCrops({
      country: region?.country || 'US',
      state: region?.state || region?.stateCode,
      farmType,
      beginnerLevel,
      growingStyle,
      currentMonth,
    }, {
      learningMultipliers: {
        ...(lastCrop ? { [lastCrop]: adjustments.confidenceMultiplier } : {}),
      },
    });
  } catch { /* scorer unavailable → skip switch suggestion */ }

  const options = [];
  const lastCropScored = (scored?.bestMatch || [])
    .concat(scored?.alsoConsider || [], scored?.notRecommendedNow || [])
    .find((c) => c.crop === lastCrop);

  // Option 1 — repeat with improved plan, unless the cycle was a
  // clean failure and we should nudge the farmer to a different crop.
  if (lastCrop && adjustments.outcomeClass !== OUTCOME_CLASS.FAILED) {
    // If the window is now closed, surface a delay option instead.
    if (lastCropScored && ['wait', 'avoid'].includes(lastCropScored.plantingStatus)) {
      options.push({
        type: 'delay_same_crop',
        cropKey: lastCrop,
        reasonKey: 'nextCycle.option.delay',
        plantingStatus: lastCropScored.plantingStatus,
        plantingWindowExplanation: lastCropScored.plantingWindowExplanation || null,
      });
    } else {
      options.push({
        type: 'repeat_improved',
        cropKey: lastCrop,
        reasonKey: 'nextCycle.option.repeatImproved',
        fitLevel: lastCropScored?.fitLevel || null,
        confidence: lastCropScored?.confidence || null,
        plantingStatus: lastCropScored?.plantingStatus || null,
      });
    }
  }

  // Option 2 — switch to the best-fit *different* crop.
  const best = (scored?.bestMatch || []).find((c) => c.crop !== lastCrop)
    || (scored?.alsoConsider || []).find((c) => c.crop !== lastCrop);
  if (best) {
    options.push({
      type: 'switch_crop',
      cropKey: best.crop,
      reasonKey: 'nextCycle.option.switchCrop',
      fitLevel: best.fitLevel,
      confidence: best.confidence,
      plantingStatus: best.plantingStatus,
      plantingWindowExplanation: best.plantingWindowExplanation || null,
    });
  }

  // Option 3 — let the app choose. Always available so the farmer
  // can hand off decisions when they're overwhelmed.
  options.push({
    type: 'auto_pick',
    cropKey: null,
    reasonKey: 'nextCycle.option.autoPick',
  });

  return {
    headlineKey: pickHeadlineKey(adjustments.outcomeClass),
    adjustments,
    options: options.slice(0, 3),
  };
}

function pickHeadlineKey(klass) {
  if (klass === OUTCOME_CLASS.FAILED)     return 'nextCycle.headline.failed';
  if (klass === OUTCOME_CLASS.HIGH_RISK)  return 'nextCycle.headline.highRisk';
  if (klass === OUTCOME_CLASS.DELAYED)    return 'nextCycle.headline.delayed';
  return 'nextCycle.headline.successful';
}

export const _internal = { bumpBand, pickHeadlineKey };
