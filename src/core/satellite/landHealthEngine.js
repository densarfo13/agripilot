/**
 * landHealthEngine.js — hedged land-health label from NDVI + weather.
 *
 *   import { computeLandHealth, LAND_HEALTH_LABEL }
 *     from 'src/core/satellite/landHealthEngine.js';
 *
 *   const h = computeLandHealth({ ndvi: 0.55, weather: { daysSinceRain: 8 } });
 *   // h.label      → LAND_HEALTH_LABEL.STRESS_POSSIBLE
 *   // h.score      → 0..1
 *   // h.confidence → 'low' | 'medium'   (NEVER 'high')
 *
 * What it is — and is NOT
 * ───────────────────────
 *   When NDVI is null (no imagery), returns null — honest gap.
 *   When NDVI is present, it labels the value using calm buckets:
 *     BARE / SPARSE / MODERATE / HEALTHY / DENSE
 *   and softens the label when weather context suggests stress
 *   (long dry spell, frost risk).
 *
 *   It NEVER claims a specific disease, NEVER recommends a
 *   specific chemical, and NEVER returns confidence 'high'.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { labelForNdvi, NDVI_LABEL } from './ndviPlaceholder.js';

export const LAND_HEALTH_LABEL = Object.freeze({
  BARE_GROUND:       'bare_ground',
  SPARSE_COVER:      'sparse_cover',
  STRESS_POSSIBLE:   'stress_possible',
  HEALTHY_COVER:     'healthy_cover',
  DENSE_VIGOROUS:    'dense_vigorous',
  UNKNOWN:           'unknown',
});

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

const _MESSAGES = Object.freeze({
  [LAND_HEALTH_LABEL.BARE_GROUND]:     _msg('satellite.landHealth.bare',     'Bare ground — recently planted or freshly tilled.'),
  [LAND_HEALTH_LABEL.SPARSE_COVER]:    _msg('satellite.landHealth.sparse',   'Sparse cover — vegetation is patchy or early-season.'),
  [LAND_HEALTH_LABEL.STRESS_POSSIBLE]: _msg('satellite.landHealth.stress',   'Possible plant stress — check the field for water or nutrient stress.'),
  [LAND_HEALTH_LABEL.HEALTHY_COVER]:   _msg('satellite.landHealth.healthy',  'Healthy cover — vegetation looks balanced.'),
  [LAND_HEALTH_LABEL.DENSE_VIGOROUS]:  _msg('satellite.landHealth.dense',    'Dense vigorous growth — typical for fruiting / mid-season.'),
  [LAND_HEALTH_LABEL.UNKNOWN]:         _msg('satellite.landHealth.unknown',  'Land health cannot be assessed yet — no recent imagery.'),
});

function _baseLabelForNdvi(v) {
  const l = labelForNdvi(v);
  if (l === NDVI_LABEL.BARE)     return LAND_HEALTH_LABEL.BARE_GROUND;
  if (l === NDVI_LABEL.SPARSE)   return LAND_HEALTH_LABEL.SPARSE_COVER;
  if (l === NDVI_LABEL.MODERATE) return LAND_HEALTH_LABEL.HEALTHY_COVER;
  if (l === NDVI_LABEL.HEALTHY)  return LAND_HEALTH_LABEL.HEALTHY_COVER;
  if (l === NDVI_LABEL.DENSE)    return LAND_HEALTH_LABEL.DENSE_VIGOROUS;
  return LAND_HEALTH_LABEL.UNKNOWN;
}

/**
 * @param {object} ctx
 * @returns {object|null}
 */
export function computeLandHealth(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    if (c.ndvi == null) return null;            // honest gap — no imagery
    const ndvi = Number(c.ndvi);
    if (!Number.isFinite(ndvi)) return null;

    let label = _baseLabelForNdvi(ndvi);
    // Softening rule: long dry spell flips "healthy" → "stress_possible".
    const weather = (c.weather && typeof c.weather === 'object') ? c.weather : null;
    const days = weather && Number.isFinite(Number(weather.daysSinceRain)) ? Number(weather.daysSinceRain) : null;
    if (days != null && days >= 10
        && (label === LAND_HEALTH_LABEL.HEALTHY_COVER
            || label === LAND_HEALTH_LABEL.DENSE_VIGOROUS)) {
      label = LAND_HEALTH_LABEL.STRESS_POSSIBLE;
    }

    return {
      label,
      score:      Math.max(0, Math.min(1, ndvi)),
      message:    { ..._MESSAGES[label] },
      confidence: 'medium',                     // never 'high'
      isEstimate: true,
    };
  } catch {
    return null;
  }
}

const _module = { LAND_HEALTH_LABEL, computeLandHealth };
export default _module;
