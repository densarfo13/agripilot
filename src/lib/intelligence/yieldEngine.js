/**
 * yieldEngine.js — rule-based crop-yield estimator.
 *
 * Maps a farm's (crop × area × country × farmType × cropStage) to a
 * conservative low/high/typical yield range expressed in kg AND tons.
 * Pure, deterministic, explainable — every multiplier applied is
 * appended to `assumptions[]` so the UI can show why the number moved.
 *
 *   estimateYield({
 *     crop,                 // canonical code, e.g. 'maize'
 *     normalizedAreaSqm,    // m²; engine also accepts legacy size+unit
 *     size, sizeUnit,       //   (optional — used when sqm not given)
 *     farmType,             // 'backyard' | 'small_farm' | 'commercial'
 *     cropStage,            // 'planning' | 'planted' | 'growing' | 'harvest' | 'post_harvest'
 *     countryCode,          // ISO-2
 *   }) → {
 *     lowEstimateKg, highEstimateKg, typicalEstimateKg,
 *     lowEstimateTons, highEstimateTons, typicalEstimateTons,
 *     unit: 'kg',
 *     confidenceLevel: 'low' | 'medium' | 'high',
 *     assumptions: Array<{ tag, detail }>,
 *     crop, normalizedAreaSqm, source,
 *   } | null
 *
 * Returns null only when the inputs are too sparse to compute
 * anything (no crop OR no area at all). Otherwise always produces a
 * range, falling back to the generic row with confidence='low'.
 */

import { getYieldRange } from '../../config/cropYieldRanges.js';
import { toSquareMeters } from '../units/areaConversion.js';
import { normalizeCrop } from '../../config/crops.js';

// Farm-type yield multipliers. Backyard plots are more intensive per
// m² (hand-watered, small surface) but also more variable; commercial
// ops run closer to the high end of the band thanks to inputs +
// mechanisation. Narrow so the UI still feels honest.
const FARM_TYPE_MULT = Object.freeze({
  backyard:   { low: 0.80, high: 1.10 },
  small_farm: { low: 1.00, high: 1.00 },
  commercial: { low: 1.05, high: 1.20 },
});

// Crop-stage confidence + "still-to-harvest" haircut. Planning stage
// is aspirational; growing stage is near-deterministic; post-harvest
// is locked in.
const STAGE_ADJ = Object.freeze({
  planning:     { lowMult: 0.70, highMult: 1.00, conf: 'low',    tag: 'planning_buffer' },
  planted:      { lowMult: 0.80, highMult: 1.00, conf: 'low',    tag: 'planted_buffer' },
  growing:      { lowMult: 0.90, highMult: 1.05, conf: 'medium', tag: 'growing_buffer' },
  harvest:      { lowMult: 1.00, highMult: 1.00, conf: 'high',   tag: 'harvest_ready' },
  post_harvest: { lowMult: 1.00, highMult: 1.00, conf: 'high',   tag: 'post_harvest' },
});
const DEFAULT_STAGE = { lowMult: 0.85, highMult: 1.00, conf: 'medium', tag: 'stage_unknown' };

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

function canonicalStage(s) {
  const k = String(s || '').toLowerCase().trim();
  return STAGE_ADJ[k] ? k : null;
}

function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f; }

/**
 * resolveAreaSqm — accept modern `normalizedAreaSqm` first, fall
 * back to legacy `size + sizeUnit`. Back-compat shim for farms
 * stored before the canonical area migration.
 */
function resolveAreaSqm({ normalizedAreaSqm, size, sizeUnit }) {
  const n = Number(normalizedAreaSqm);
  if (Number.isFinite(n) && n > 0) return { sqm: n, source: 'normalizedAreaSqm' };
  const s = Number(size);
  if (Number.isFinite(s) && s > 0 && sizeUnit) {
    const converted = toSquareMeters(s, String(sizeUnit).toLowerCase());
    if (Number.isFinite(converted) && converted > 0) {
      return { sqm: converted, source: `size+${sizeUnit}` };
    }
  }
  return { sqm: 0, source: null };
}

export function estimateYield({
  crop,
  normalizedAreaSqm,
  size, sizeUnit,
  farmType,
  cropStage,
  countryCode,
} = {}) {
  const code = normalizeCrop(crop);
  if (!code) return null;

  const { sqm, source: areaSource } = resolveAreaSqm({ normalizedAreaSqm, size, sizeUnit });
  if (sqm <= 0) return null;

  const assumptions = [];
  const range = getYieldRange(code, countryCode);     // { low, high, typical, source }
  assumptions.push({ tag: `yield_range:${range.source}`, detail:
    `Using ${range.source === 'global' ? 'global baseline' :
             range.source === 'fallback' ? 'generic fallback' :
             `${range.source} country override`} range ` +
    `${range.low}–${range.high} kg/m² for ${code}.` });

  const tier = canonicalFarmType(farmType);
  const ftMult = FARM_TYPE_MULT[tier];
  if (tier !== 'small_farm') {
    assumptions.push({ tag: `farm_type:${tier}`, detail:
      `${tier === 'backyard' ? 'Backyard' : 'Commercial'} multiplier ` +
      `${ftMult.low}×–${ftMult.high}× applied to the baseline band.` });
  }

  const stageKey = canonicalStage(cropStage);
  const stage = stageKey ? STAGE_ADJ[stageKey] : DEFAULT_STAGE;
  assumptions.push({ tag: stage.tag, detail:
    stageKey
      ? `Stage "${stageKey}" uses ${Math.round(stage.lowMult * 100)}%–${Math.round(stage.highMult * 100)}% of the band.`
      : 'Crop stage unknown — using a conservative mid-band buffer.' });

  // Compose bounds.
  const lowBase     = range.low     * ftMult.low  * stage.lowMult;
  const highBase    = range.high    * ftMult.high * stage.highMult;
  const typicalBase = range.typical * ((ftMult.low + ftMult.high) / 2);

  const lowKg     = lowBase     * sqm;
  const highKg    = highBase    * sqm;
  const typicalKg = typicalBase * sqm;

  // Guard against pathological multipliers producing low>high.
  const lo = Math.min(lowKg, highKg);
  const hi = Math.max(lowKg, highKg);

  // Confidence: stage sets ceiling; drop one band if we hit the
  // generic fallback (unpriced/uncatalogued crop).
  let confidenceLevel = stage.conf;
  if (range.source === 'fallback') {
    confidenceLevel = 'low';
    assumptions.push({ tag: 'fallback_yield', detail:
      'No catalogued yield for this crop — using a conservative generic band; confidence reduced.' });
  }

  // Area-source note (back-compat transparency)
  if (areaSource && areaSource !== 'normalizedAreaSqm') {
    assumptions.push({ tag: 'area_back_compat', detail:
      `Area computed from legacy ${areaSource}; for best accuracy re-save the farm size.` });
  }

  const kgDigits = lo < 10 ? 2 : lo < 100 ? 1 : 0;
  return Object.freeze({
    crop: code,
    normalizedAreaSqm: round(sqm, 2),
    lowEstimateKg:      round(lo, kgDigits),
    highEstimateKg:     round(hi, kgDigits),
    typicalEstimateKg:  round(typicalKg, kgDigits),
    lowEstimateTons:    round(lo / 1000, 3),
    highEstimateTons:   round(hi / 1000, 3),
    typicalEstimateTons:round(typicalKg / 1000, 3),
    unit: 'kg',
    confidenceLevel,
    assumptions: Object.freeze(assumptions),
    source: range.source,
    farmType: tier,
    cropStage: stageKey || null,
  });
}

export const _internal = Object.freeze({
  FARM_TYPE_MULT, STAGE_ADJ, DEFAULT_STAGE,
  canonicalFarmType, canonicalStage, resolveAreaSqm,
});
