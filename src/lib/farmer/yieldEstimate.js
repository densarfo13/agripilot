/**
 * yieldEstimate.js — lightweight per-farm yield projection.
 *
 *   estimateYield({
 *     crop:        'maize'|'cassava'|...,
 *     areaHectares: 0.8,
 *     score:        72,                  // optional — adjusts factor
 *     storedEstimate: null|number,       // optional — overrides math
 *   }) → {
 *     tons:       number,
 *     confidence: 'low'|'medium'|'high',
 *     basis:      'stored'|'estimate'|'fallback',
 *     reason:     string,
 *   }
 *
 * Why a separate file (not stuffed into yield engines)
 *   • `src/lib/yieldEngine` exists for the rich per-farm forecasting.
 *     This module is the dashboard-quick estimate — fast, deterministic,
 *     no external data, no I/O. Used by SummaryCards / InsightCards /
 *     YieldBadge to avoid pulling in the full forecast engine on every
 *     row. Same contract: pure, never throws, always returns a number.
 *
 * Constraints
 *   • Pure. Never reads localStorage or calls fetch.
 *   • Returns sensible defaults when inputs are missing — never NaN.
 *   • Numbers rounded to 1 decimal for display; callers can re-round.
 *
 * Score → multiplier (0.7 .. 1.2)
 *   <40   High Risk  → 0.7
 *   <60   Medium     → 0.85
 *   <80   Good       → 1.0
 *   ≥80   Excellent  → 1.2
 *
 * Confidence
 *   • 'high'   when storedEstimate is provided OR score ≥ 60 with
 *              a known crop and a positive area
 *   • 'medium' when score is unknown / out-of-band but crop + area
 *              are present
 *   • 'low'    when crop unknown, or area missing, or only fallback
 *              base yield was used
 */

import { normalizeCrop } from '../../config/crops.js';

// Conservative tonnes-per-hectare medians for the common Farroway
// crops. NOT a yield database — these are dashboard sanity numbers.
// When the catalogued crop isn't here, we use FALLBACK_BASE_T_PER_HA
// and downgrade confidence to 'low'.
const BASE_YIELD_T_PER_HA = Object.freeze({
  maize:        3.0,
  rice:         3.5,
  wheat:        3.0,
  sorghum:      1.5,
  millet:       1.2,
  cassava:      8.0,
  yam:          10.0,
  potato:       12.0,
  sweet_potato: 8.0,
  beans:        1.2,
  soybean:      1.8,
  groundnut:    1.4,
  cowpea:       1.0,
  chickpea:     1.2,
  lentil:       1.0,
  tomato:       20.0,
  onion:        15.0,
  pepper:       8.0,
  cabbage:      18.0,
  carrot:       15.0,
  okra:         6.0,
  spinach:      8.0,
  cucumber:     12.0,
  watermelon:   15.0,
  plantain:     10.0,
  banana:       12.0,
  mango:        7.0,
  orange:       10.0,
  avocado:      8.0,
  coffee:       0.7,
  tea:          1.5,
  cocoa:        0.5,
  cotton:       1.5,
  sugarcane:    50.0,
  sunflower:    1.2,
  sesame:       0.6,
  tobacco:      1.5,
  eggplant:     15.0,
  ginger:       6.0,
  garlic:       6.0,
  lettuce:      10.0,
  oil_palm:     3.0,
});
const FALLBACK_BASE_T_PER_HA = 2.0;

function scoreFactor(score) {
  const n = Number(score);
  if (!Number.isFinite(n))                 return null;   // unknown → 1.0 with medium confidence
  if (n >= 80) return 1.2;
  if (n >= 60) return 1.0;
  if (n >= 40) return 0.85;
  return 0.7;
}

function clampToOneDecimal(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Pure compute. See header for contract.
 */
export function estimateYield({
  crop          = null,
  areaHectares  = null,
  score         = null,
  storedEstimate = null,
} = {}) {
  // Stored override wins. Treat any positive finite number as truth.
  if (storedEstimate != null) {
    const n = Number(storedEstimate);
    if (Number.isFinite(n) && n >= 0) {
      return Object.freeze({
        tons: clampToOneDecimal(n),
        confidence: 'high',
        basis: 'stored',
        reason: 'Using farmer-supplied harvest estimate.',
      });
    }
  }

  const area = Number(areaHectares);
  const haveArea = Number.isFinite(area) && area > 0;
  const cropKey = crop ? normalizeCrop(crop) : null;
  const baseFromMap = cropKey ? BASE_YIELD_T_PER_HA[cropKey] : null;
  const haveCrop = !!baseFromMap;

  const base = haveCrop ? baseFromMap : FALLBACK_BASE_T_PER_HA;
  const factor = scoreFactor(score);
  const usedFactor = factor == null ? 1.0 : factor;

  const tons = haveArea ? base * area * usedFactor : 0;

  let confidence = 'medium';
  let reason = '';
  if (!haveArea) {
    confidence = 'low';
    reason = 'Area unknown — yield not estimated.';
  } else if (!haveCrop) {
    confidence = 'low';
    reason = `Crop "${crop || 'unknown'}" not catalogued — using fallback base yield.`;
  } else if (factor == null) {
    confidence = 'medium';
    reason = 'Farmer score unknown — using neutral factor.';
  } else if (factor >= 1.0) {
    confidence = 'high';
    reason = 'Score is solid — yield estimate uses standard multiplier.';
  } else {
    confidence = 'medium';
    reason = 'Below-average score — yield estimate de-rated.';
  }

  return Object.freeze({
    tons: clampToOneDecimal(tons),
    confidence,
    basis: haveCrop && haveArea ? 'estimate' : 'fallback',
    reason,
  });
}

/**
 * sumYield — total tons across an array of farms. Convenience for
 * dashboard "Estimated Output (30 days)" cards.
 */
export function sumYield(farms) {
  if (!Array.isArray(farms)) return 0;
  let total = 0;
  for (const f of farms) {
    if (!f) continue;
    const r = estimateYield({
      crop: f.crop || f.cropType,
      areaHectares: f.landSizeHectares
        ?? (f.normalizedAreaSqm != null ? f.normalizedAreaSqm / 10000 : null)
        ?? f.areaHectares
        ?? null,
      score: f.score ?? f.farmerScore ?? null,
      storedEstimate: f.estimatedYield ?? f.estimatedYieldTons ?? null,
    });
    total += r.tons || 0;
  }
  return clampToOneDecimal(total);
}

export const _internal = Object.freeze({ BASE_YIELD_T_PER_HA, FALLBACK_BASE_T_PER_HA, scoreFactor });
