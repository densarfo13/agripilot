/**
 * yieldForecastEngine.js — HONEST, wide-range yield estimate.
 *
 *   import { estimateYield } from 'src/core/intelligence/yieldForecastEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure helper that turns a few honest signals (planted area /
 *   typical per-plant yield range / health adjustments from
 *   scan + watering consistency) into a WIDE RANGE estimate with
 *   a strong disclaimer. Confidence is capped at 'low' by
 *   default — we have NO trained yield model, so this is a
 *   ballpark, NOT a prediction.
 *
 *   Spec rule (and our standing rule): "Never guarantee exact
 *   yield." Outputs always carry `isEstimate: true` and a
 *   "ballpark only" disclaimer. When inputs are too thin the
 *   module returns `{ ok: false, reason: 'not_enough_data' }`
 *   instead of guessing — that's the honest answer.
 *
 *   It does NOT:
 *     • predict yield from satellite data (none here)
 *     • train on past harvests (no learning pipeline)
 *     • adjust by region beyond what cropDurationRegistry exposes
 *
 *   Range bounds are deliberately WIDE so a farmer never plans
 *   their finances against this number.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Honest hedged wording.
 */

// Typical per-plant yield ranges (in kg or kg-equivalent units).
// Numbers are deliberately conservative low bounds and generous
// high bounds — real outcomes routinely sit in the middle. If a
// crop isn't here we return not_enough_data rather than guess.
const PER_PLANT_KG = Object.freeze({
  tomato:    { min: 2,   max: 6 },
  pepper:    { min: 1,   max: 3 },
  cucumber:  { min: 2,   max: 5 },
  okra:      { min: 0.5, max: 1.5 },
  beans:     { min: 0.2, max: 0.6 },
  cabbage:   { min: 1,   max: 2.5 },
  lettuce:   { min: 0.3, max: 0.8 },
  carrot:    { min: 0.1, max: 0.25 },
  onion:     { min: 0.2, max: 0.4 },
  potato:    { min: 0.8, max: 2 },
});

const HEALTH_FACTOR = Object.freeze({
  good:    1.00,
  average: 0.85,
  poor:    0.65,
});

function _num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function _str(v) { return String(v == null ? '' : v).toLowerCase(); }

function _normalizeCrop(c) {
  const s = _str(c);
  if (PER_PLANT_KG[s]) return s;
  if (s.includes('tomato')) return 'tomato';
  if (s.includes('pepper') || s.includes('chili')) return 'pepper';
  if (s.includes('cucumber')) return 'cucumber';
  if (s.includes('okra')) return 'okra';
  if (s.includes('bean')) return 'beans';
  if (s.includes('cabbage')) return 'cabbage';
  if (s.includes('lettuce')) return 'lettuce';
  if (s.includes('carrot')) return 'carrot';
  if (s.includes('onion')) return 'onion';
  if (s.includes('potato') && !s.includes('sweet')) return 'potato';
  return '';
}

function _scoreHealth(args) {
  // Health from: scanHistory (worst recent issue), watering
  // consistency (taskCompletionRate), and a crude weather signal.
  const list = Array.isArray(args.scanHistory) ? args.scanHistory : [];
  const lastCat = _str(list.length ? (list[list.length - 1].issueCategory
    || list[list.length - 1].category) : '');
  const taskRate = _num(args.taskCompletionRate);

  let label = 'average';
  if (lastCat === 'fungal_risk' || lastCat === 'fruit_rot' || lastCat === 'pest_damage') label = 'poor';
  else if (lastCat === 'healthy' && taskRate != null && taskRate >= 0.75) label = 'good';
  else if (taskRate != null && taskRate >= 0.6 && (lastCat === '' || lastCat === 'healthy')) label = 'average';
  return label;
}

/**
 * Honest, hedged yield estimate.
 *
 * @param {object} args
 * @param {string} args.crop
 * @param {number} [args.plantCount]            number of plants
 * @param {Array}  [args.scanHistory]
 * @param {number} [args.taskCompletionRate]    0..1
 * @returns {object}
 */
export function estimateYield(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const cropKey = _normalizeCrop(a.crop);
    const plants = _num(a.plantCount);
    if (!cropKey || plants == null || plants <= 0) {
      return Object.freeze({
        ok: false, reason: 'not_enough_data',
        isEstimate: true,
        disclaimer: 'A yield range needs at least a known crop AND your plant count. We do not predict from a single scan.',
      });
    }

    const base = PER_PLANT_KG[cropKey];
    const healthLabel = _scoreHealth(a);
    const factor = HEALTH_FACTOR[healthLabel] || HEALTH_FACTOR.average;

    // Apply the health factor to the upper bound only — a poor
    // health signal lowers what's reasonable to expect; it should
    // not raise the lower bound (you can always lose more).
    const minKg = Math.round(base.min * plants * 100) / 100;
    const maxKg = Math.round(base.max * plants * factor * 100) / 100;

    return Object.freeze({
      ok:                true,
      cropKey,
      plantCount:        plants,
      estimatedRangeKg:  { min: minKg, max: maxKg },
      healthLabel,
      // Confidence is CAPPED at low — we have no yield model.
      confidenceLabel:   'low',
      isEstimate:        true,
      disclaimer:        'Ballpark estimate only — local weather, variety, and care will shift this. Do not plan finances against it.',
    });
  } catch {
    return Object.freeze({
      ok: false, reason: 'exception',
      isEstimate: true,
      disclaimer: 'We could not produce a yield estimate right now.',
    });
  }
}

const _module = { estimateYield };
export default _module;
