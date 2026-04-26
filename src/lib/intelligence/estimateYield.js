/**
 * estimateYield.js — simple, defensible yield estimator for the
 * NGO decision layer.
 *
 * Formula (per spec)
 * ──────────────────
 *   estimate = baseYield(crop) × landSize × scoreFactor(score)
 *
 * Where:
 *   • baseYield(crop) — kg/ha lookup from `cropBaseYields.js`
 *   • landSize         — hectares; non-finite or ≤ 0 falls back to 1 ha
 *   • scoreFactor(s)   — linear ramp on a 0–100 score:
 *        score ≤ 0    → 0.5  (still produces *something* so
 *                              dashboards don't render literal zero
 *                              for a brand-new farm with no signal)
 *        score 0–100  → 0.5 + (score / 100) × 0.7    range 0.5 → 1.2
 *        score ≥ 100  → 1.2  (cap — a farmer can't out-perform a
 *                              perfect-form farm by an unbounded ratio)
 *     The 0.5 floor keeps the estimate non-zero for new farms;
 *     the 1.2 ceiling keeps top-quartile farms within a sane
 *     +20% lift over the table value.
 *
 * Returns kilograms (number, rounded to nearest 1 kg). Never throws;
 * pathological inputs degrade to the default base × 1 ha × 0.5
 * floor, never NaN.
 *
 * Coexistence note
 * ────────────────
 * Some surfaces (AdminDashboard `/api/admin/performance`) already
 * carry a server-computed `yield` per farm. Prefer that authoritative
 * number when it's present and finite. This estimator is the
 * fallback for surfaces that only have crop + land + score — for
 * example the NGO summary card "estimated total yield" tile.
 */

import { getBaseYieldKgPerHa } from './cropBaseYields.js';

const SCORE_FLOOR  = 0.5;
const SCORE_CEILING = 1.2;
const SCORE_RANGE  = SCORE_CEILING - SCORE_FLOOR; // 0.7

function _toFiniteNumber(v, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {number|string} score 0–100
 * @returns {number} multiplicative factor in [0.5, 1.2]
 */
export function scoreFactor(score) {
  const n = _toFiniteNumber(score, 0);
  if (n <= 0)   return SCORE_FLOOR;
  if (n >= 100) return SCORE_CEILING;
  return SCORE_FLOOR + (n / 100) * SCORE_RANGE;
}

/**
 * @typedef {object} EstimateInput
 * @property {string}        crop         e.g. 'maize' (lowercased internally)
 * @property {number|string} landHa       hectares
 * @property {number|string} score        0–100
 *
 * @param {EstimateInput} args
 * @returns {{ kg: number, base: number, factor: number, landHa: number }}
 */
export function estimateYield({ crop, landHa, score } = {}) {
  const base = getBaseYieldKgPerHa(crop);
  let land = _toFiniteNumber(landHa, 0);
  if (!(land > 0)) land = 1;          // fall back to 1 ha when missing
  const factor = scoreFactor(score);
  const kg = Math.round(base * land * factor);
  return { kg, base, factor, landHa: land };
}

/**
 * Best-effort extraction of land size + score from a farm-shaped
 * row, for the common case where the caller has a list of mixed
 * payload shapes (admin scoring vs admin performance vs raw farms).
 *
 * Looks at: row.landHa | row.landSize | row.farm?.landHa, and
 * row.score | row.farmerScore | row.progressScore.
 *
 * Returns the same shape as `estimateYield` so call sites can be
 * uniform: `const { kg } = estimateForRow(row);`
 */
export function estimateForRow(row) {
  if (!row || typeof row !== 'object') return estimateYield({});
  const crop = row.crop || row.cropType || row?.farm?.crop || '';
  const landHa =
    row.landHa
    ?? row.landSize
    ?? row.land_ha
    ?? row?.farm?.landHa
    ?? row?.farm?.landSize
    ?? null;
  const score =
    row.score
    ?? row.farmerScore
    ?? row.progressScore
    ?? row?.scoring?.score
    ?? null;
  return estimateYield({ crop, landHa, score });
}

/**
 * Sum estimated yield across an array of mixed-shape rows.
 * Skips rows with insufficient data (no crop AND no land).
 *
 * @param {object[]} rows
 * @returns {{ totalKg: number, counted: number, skipped: number }}
 */
export function estimateTotalYield(rows) {
  let totalKg = 0;
  let counted = 0;
  let skipped = 0;
  if (!Array.isArray(rows)) return { totalKg, counted, skipped };
  for (const row of rows) {
    if (!row) { skipped += 1; continue; }
    // Prefer a server-computed yield when present and finite.
    const serverYield = _toFiniteNumber(row.yield, NaN);
    if (Number.isFinite(serverYield) && serverYield > 0) {
      totalKg += serverYield;
      counted += 1;
      continue;
    }
    const crop = row.crop || row.cropType || row?.farm?.crop || '';
    if (!crop) { skipped += 1; continue; }
    const { kg } = estimateForRow(row);
    if (kg > 0) {
      totalKg += kg;
      counted += 1;
    } else {
      skipped += 1;
    }
  }
  return { totalKg: Math.round(totalKg), counted, skipped };
}
