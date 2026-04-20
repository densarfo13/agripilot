/**
 * yieldEngine.js — deterministic, explainable yield estimator.
 *
 * estimateYield({ crop, rainfall, completionRate, baselineOverride? })
 *   → {
 *       estimated: number   // rounded final estimate
 *       baseline:  number   // pre-adjustment baseline
 *       deltas:    { key, delta }[]   // per-adjustment contribution
 *       units:     'rel'    // relative units — not kg; plug real calibration later
 *     }
 *
 * Pure. Rule set matches the spec:
 *   baseline 100, cassava 120, maize 90
 *   rainfall > 20 → +10;  rainfall < 10 → -20
 *   multiplied by completionRate
 *
 * Extras on top of spec:
 *   • returns a breakdown so tests + UI can explain WHY
 *   • accepts `baselineOverride` for callers that maintain their
 *     own crop table
 *   • clamps completionRate to [0, 1] so we can't produce
 *     negative or inflated estimates
 */

const DEFAULT_BASELINE   = 100;
const RAIN_HIGH_THRESHOLD = 20;
const RAIN_LOW_THRESHOLD  = 10;
const RAIN_BOOST = 10;
const RAIN_PENALTY = 20;

const CROP_BASELINES = Object.freeze({
  cassava: 120,
  maize:   90,
  rice:    95,
  sorghum: 85,
  beans:   80,
});

function clamp01(n) {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function baselineFor(crop, override) {
  if (Number.isFinite(override)) return override;
  if (!crop) return DEFAULT_BASELINE;
  const key = String(crop).toLowerCase();
  return CROP_BASELINES[key] || DEFAULT_BASELINE;
}

/** estimateYield — returns full breakdown. */
function estimateYield({
  crop = null, rainfall = null, completionRate = 1,
  baselineOverride = undefined,
} = {}) {
  const baseline = baselineFor(crop, baselineOverride);
  const deltas = [];
  let adjusted = baseline;

  if (Number.isFinite(rainfall)) {
    if (rainfall > RAIN_HIGH_THRESHOLD) {
      adjusted += RAIN_BOOST;
      deltas.push({ key: 'yield.delta.rain_good', delta: RAIN_BOOST });
    } else if (rainfall < RAIN_LOW_THRESHOLD) {
      adjusted -= RAIN_PENALTY;
      deltas.push({ key: 'yield.delta.rain_low',  delta: -RAIN_PENALTY });
    }
  }

  const cr = clamp01(completionRate);
  if (cr !== 1) {
    deltas.push({ key: 'yield.delta.completion_rate', delta: Math.round((cr - 1) * adjusted) });
  }
  adjusted *= cr;

  const estimated = Math.max(0, Math.round(adjusted));

  return Object.freeze({
    estimated, baseline,
    deltas: Object.freeze(deltas),
    units: 'rel',
  });
}

/** Spec-compatible shorthand — returns just the rounded number. */
function estimateYieldNumber(input) {
  return estimateYield(input).estimated;
}

/** Detect a "yield drop" vs a reference baseline — used by the
 * farmer banner (§5 says show a message if yield drops). */
function yieldHasDropped(estimate, referenceBaseline) {
  if (!estimate || typeof estimate !== 'object') return false;
  const ref = Number.isFinite(referenceBaseline)
    ? referenceBaseline : estimate.baseline;
  if (!Number.isFinite(ref) || ref <= 0) return false;
  return estimate.estimated < ref * 0.8; // drop threshold = 20%
}

module.exports = {
  estimateYield,
  estimateYieldNumber,
  yieldHasDropped,
  _internal: {
    DEFAULT_BASELINE, CROP_BASELINES,
    RAIN_HIGH_THRESHOLD, RAIN_LOW_THRESHOLD,
    RAIN_BOOST, RAIN_PENALTY,
  },
};
