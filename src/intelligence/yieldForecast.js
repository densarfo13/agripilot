/**
 * yieldForecast.js — expected yield band for a farm.
 *
 * Combines four signals already in scope:
 *
 *   • base yield (kg/ha) for the crop  ← src/lib/intelligence/cropBaseYields.js
 *   • land size (ha)                    ← farm.landHa | farm.landSize | 1
 *   • score factor                      ← from estimateYield.scoreFactor
 *   • satellite NDVI bonus              ← gentle linear lift / drag
 *
 * Why two yield modules
 * ─────────────────────
 * `src/lib/intelligence/estimateYield.js` already does the simple
 * `base × land × scoreFactor` math used by the NGO Farmer Intelligence
 * Summary. THIS module wraps that helper and layers an NDVI-derived
 * adjustment so the recommendation ranker can prioritise tasks for
 * a farm with weak vegetation signal even before the score updates.
 *
 * The result is a BAND (low / medium / high relative to the farm's
 * own profile baseline), not a hard kg number for UI. Callers that
 * want kg can read `kg` directly; callers that want a chip use
 * `band`. Confidence is propagated upstream by `confidenceScoring`.
 */

import {
  estimateYield, scoreFactor,
} from '../lib/intelligence/estimateYield.js';

// NDVI bands (typical smallholder range):
//   < 0.35   → very weak vegetation (sparse / stressed)
//   0.35-0.5 → weak / establishing
//   0.5-0.65 → healthy
//   > 0.65   → vigorous
const NDVI_LIFT = Object.freeze([
  // [maxNdvi, multiplier]
  [0.35, 0.85],
  [0.50, 0.95],
  [0.65, 1.05],
  [1.00, 1.12],
]);

function _ndviMultiplier(ndvi) {
  if (!Number.isFinite(ndvi)) return 1.0;
  for (const [bound, mult] of NDVI_LIFT) {
    if (ndvi <= bound) return mult;
  }
  return 1.0;
}

/**
 * Forecast yield for a farm.
 *
 * @param {object} input
 * @param {object} input.farm                   farm shape (crop, landHa, score)
 * @param {object} [input.signals]              satellite signal (optional)
 * @returns {{
 *   kg:        number,             // best-effort point estimate
 *   base:      number,             // kg/ha lookup
 *   landHa:    number,             // resolved hectares
 *   factor:    number,             // score factor [0.5, 1.2]
 *   ndviLift:  number,             // NDVI multiplier in [0.85, 1.12]
 *   band:      'low'|'medium'|'high'
 * }}
 */
export function forecastYield({ farm, signals } = {}) {
  const safeFarm = farm && typeof farm === 'object' ? farm : {};
  const score = _toNumber(
    safeFarm.score ?? safeFarm.farmerScore ?? safeFarm.progressScore,
    0,
  );
  // estimateYield already handles defaults for crop/land/score and
  // returns kg/base/factor/landHa. `crop` is canonical
  // (canonicalizeFarmPayload in lib/api.js).
  const base = estimateYield({
    crop:   safeFarm.crop || '',
    landHa: safeFarm.landHa ?? safeFarm.landSize ?? safeFarm.land_ha,
    score,
  });

  const ndvi = _toNumber(signals?.ndvi, NaN);
  const ndviLift = _ndviMultiplier(ndvi);

  const kg = Math.round(base.kg * ndviLift);

  // Band derivation — relative to the farm's own potential ceiling
  // (base × land × max factor 1.2 × max NDVI lift 1.12). The cap
  // mirrors the upper bounds in scoreFactor + NDVI_LIFT so a band
  // never claims "high" beyond the model's actual reach.
  const ceiling = base.base * base.landHa * 1.2 * 1.12;
  const ratio = ceiling > 0 ? kg / ceiling : 0;
  const band = ratio >= 0.85 ? 'high'
             : ratio >= 0.55 ? 'medium'
             :                 'low';

  return Object.freeze({
    kg,
    base:     base.base,
    landHa:   base.landHa,
    factor:   base.factor,
    ndviLift,
    band,
  });
}

/**
 * Convenience: return ONLY the band. For surfaces that just want a
 * Low / Medium / High pill without exposing kg numbers.
 */
export function forecastYieldBand(input) {
  return forecastYield(input).band;
}

function _toNumber(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export { scoreFactor };
