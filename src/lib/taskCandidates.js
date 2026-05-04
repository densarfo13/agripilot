/**
 * taskCandidates.js — generate a small candidate list of safe
 * crop-care tasks. Always returns 4 envelopes covering the
 * categories the ML scorer ranks (watering, pest-check, weeding,
 * crop-stage). The smartTaskEngine then sorts by score and
 * promotes the top one to "Today's Task."
 *
 *   import { generateTaskCandidates } from './lib/taskCandidates.js';
 *
 *   const list = generateTaskCandidates({
 *     userType:  'backyard',
 *     crop:      'tomato',
 *     cropStage: 'flowering',
 *     region:    'Ashanti',
 *     weather:   { temp: 27, rainChance: 70 },
 *   });
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Same input always returns
 *     the same shape.
 *   • Bad input collapses to crop='crop' so the renderer never
 *     prints "[object Object]" or "undefined" in a title.
 *   • NEVER produces legacy profitability wording — every
 *     candidate is a crop-care action.
 *   • Backyard users see "plant" wording in reasons; farmer
 *     users see "crop" / "field" wording.
 */

function _normCrop(crop) {
  if (typeof crop === 'string' && crop.length > 0) return crop;
  if (crop && typeof crop === 'object' && typeof crop.name === 'string' && crop.name) {
    return crop.name;
  }
  return 'crop';
}

function _swapForBackyard(text) {
  return String(text || '')
    .replace(/crop/g, 'plant')
    .replace(/field/g, 'garden');
}

export function generateTaskCandidates(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const userType = o.userType === 'farmer' ? 'farmer' : 'backyard';
  const cropName = _normCrop(o.crop);

  const candidates = [
    {
      title:    `Check soil moisture around your ${cropName}`,
      reason:   'Dry weather can stress plants. Water only if the soil feels dry.',
      urgency:  'medium',
      time:     '5 mins',
      cta:      'Mark as done',
      category: 'watering',
    },
    {
      title:    `Inspect ${cropName} leaves for yellow spots or pests`,
      reason:   'Early checks help prevent crop damage.',
      urgency:  'medium',
      time:     '6 mins',
      cta:      'Mark as done',
      category: 'pest-check',
    },
    {
      title:    `Remove weeds around your ${cropName}`,
      reason:   'Weeds compete with your crop for water and nutrients.',
      urgency:  'medium',
      time:     '10 mins',
      cta:      'Mark as done',
      category: 'weeding',
    },
    {
      title:    `Check crop stage for your ${cropName}`,
      // Rephrased so the backyard-rewrite pass cleanly swaps
      // "crop" → "plant" without a sentence-initial "Crop"
      // surviving the regex.
      reason:   'Knowing the crop stage helps Farroway guide your next task.',
      urgency:  'low',
      time:     '3 mins',
      cta:      'Update crop stage',
      category: 'crop-stage',
    },
  ];

  // Apply backyard wording rewrite so reasons read naturally
  // for home-garden users. The rules engine (taskIntelligence)
  // already does this for its single-task output; the candidate
  // list applies the same rule for consistency.
  if (userType === 'backyard') {
    return candidates.map((c) => ({
      ...c,
      reason: _swapForBackyard(c.reason),
    }));
  }

  return candidates;
}

export const _internal = Object.freeze({
  _normCrop,
  _swapForBackyard,
});

export default generateTaskCandidates;
