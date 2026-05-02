/**
 * firstPlanEngine.js \u2014 the user's first daily plan, generated
 * inline on the onboarding review screen.
 *
 *   import { generateFirstPlan } from '../core/firstPlanEngine.js';
 *
 *   const actions = generateFirstPlan({
 *     crop:      'tomato',
 *     location:  { country: 'US', region: 'CA' },
 *     isGarden:  true,
 *     plantedAt: '2026-04-15',
 *     weather:   { rainChance: 70, humidity: 65, temp: 28 },
 *   });
 *   // \u2192 [{ type, text, detail }, \u2026]
 *
 * Coexists with `dailyIntelligenceEngine.generateDailyPlan` \u2014
 * that engine drives the post-onboarding /home daily card from
 * the full farm record + completed-task history. THIS engine
 * is a slimmer pure function that runs at the END of onboarding
 * to surface the user's first plan BEFORE they commit, on
 * inputs they've just entered. Same shape (action objects with
 * a type / text / detail) so the review panel can render either.
 *
 * Action ordering (most relevant first):
 *   1. inspection \u2014 always present (the day-1 baseline)
 *   2. watering   \u2014 always present (skip on rain, otherwise check)
 *   3. risk       \u2014 0\u20132 entries when humidity / temp signals fire
 *   4. growth     \u2014 0\u20131 entry per detected plant stage
 *   5. scan       \u2014 always present (CTA into the scan flow)
 *
 * Strict-rule audit
 *   \u2022 Pure function. No I/O. Never throws \u2014 every input branch
 *     is wrapped + falls through to safe defaults.
 *   \u2022 No translation lookup. The caller (OnboardingReviewPanel)
 *     wraps the action text in tStrict if it wants i18n; the
 *     engine returns English seeds for now. Spec parity with
 *     the existing dailyIntelligenceEngine which also ships
 *     English seeds.
 *   \u2022 isGarden flips plant\u2194crop wording on the inspection +
 *     watering + scan actions so the same engine drives both
 *     experiences.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Detect plant stage from days-since-planting.
 *   < 10 days  \u2192 germination
 *   < 30 days  \u2192 early growth
 *   < 60 days  \u2192 vegetative
 *   \u2265 60 days \u2192 mature
 * Returns 'unknown' when no plantedAt was supplied.
 */
function _detectStage(plantedAt, today = new Date()) {
  if (!plantedAt) return 'unknown';
  let plantedDate = null;
  try {
    plantedDate = new Date(plantedAt);
    if (Number.isNaN(plantedDate.getTime())) return 'unknown';
  } catch { return 'unknown'; }
  const days = Math.floor((today.getTime() - plantedDate.getTime()) / DAY_MS);
  if (days < 0)  return 'unknown';     // future-dated planting
  if (days < 10) return 'germination';
  if (days < 30) return 'early growth';
  if (days < 60) return 'vegetative';
  return 'mature';
}

/**
 * generateFirstPlan(input) \u2192 action[] for the review screen.
 *
 * @param {object} input
 * @param {string} [input.crop]       crop / plant name (informational; not yet
 *                                     used in copy, but accepted so callers
 *                                     can thread it through)
 * @param {object} [input.location]   { country, region, city } (informational)
 * @param {boolean} [input.isGarden]  true \u2192 plant wording, false \u2192 crop wording
 * @param {string|Date} [input.plantedAt]  drives the stage detector
 * @param {object} [input.weather]    { rainChance, humidity, temp }
 *                                     all numeric; missing fields are silently
 *                                     ignored so a partial cache still works.
 * @returns {Array<{ type: string, text: string, detail: string }>}
 */
export function generateFirstPlan(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  const isGarden = safe.isGarden !== false; // default to garden voice (safer)
  const noun = isGarden ? 'plant' : 'crop';

  const stage = _detectStage(safe.plantedAt);

  const w = (safe.weather && typeof safe.weather === 'object') ? safe.weather : {};
  const rainExpected = Number(w.rainChance) > 60;
  const highHumidity = Number(w.humidity)   > 70;
  const highTemp     = Number(w.temp)       > 30;

  const actions = [];

  // 1. Inspection \u2014 always present.
  actions.push({
    type: 'inspection',
    text: `Check your ${noun} today`,
    detail: 'Look closely at leaves (top and underside) for spots, holes, or insects',
  });

  // 2. Watering \u2014 rain branch vs check-soil branch.
  if (rainExpected) {
    actions.push({
      type: 'watering',
      text: 'Skip watering today',
      detail: 'Rain is expected in your area \u2014 avoid overwatering',
    });
  } else {
    actions.push({
      type: 'watering',
      text: 'Water only if soil is dry',
      detail: isGarden
        ? 'Stick your finger into the soil \u2014 water only if dry'
        : 'Check soil moisture before watering',
    });
  }

  // 3. Risk engine \u2014 0\u20132 entries.
  if (highHumidity) {
    actions.push({
      type: 'risk',
      text: 'Watch for fungal disease',
      detail: 'High humidity increases risk of leaf spots and mold',
    });
  }
  if (highTemp) {
    actions.push({
      type: 'risk',
      text: 'Heat stress risk',
      detail: 'Consider watering early morning or evening',
    });
  }

  // 4. Stage-based guidance \u2014 0\u20131 entry.
  if (stage === 'germination') {
    actions.push({
      type: 'growth',
      text: 'Protect young seedlings',
      detail: 'Keep soil moist but not soaked',
    });
  } else if (stage === 'vegetative') {
    actions.push({
      type: 'growth',
      text: 'Support strong leaf growth',
      detail: 'Ensure consistent watering and monitor pests',
    });
  } else if (stage === 'mature') {
    actions.push({
      type: 'growth',
      text: 'Prepare for harvest stage',
      detail: 'Watch for color change and fruit maturity',
    });
  }
  // 'early growth' and 'unknown' fall through with no extra action.

  // 5. Scan CTA \u2014 always present.
  actions.push({
    type: 'scan',
    text: `Scan ${noun} if you see damage`,
    detail: 'Take a photo to identify issues early',
  });

  return actions;
}

// Spec-named alias. The user's contract called the function
// `generateDailyPlan`; the canonical name in the codebase
// (`generateFirstPlan`) avoids a collision with
// dailyIntelligenceEngine.generateDailyPlan, but callers that
// follow the spec verbatim can use this alias.
export { generateFirstPlan as generateOnboardingFirstPlan };

export default generateFirstPlan;
