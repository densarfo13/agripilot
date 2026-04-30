/**
 * cropStageEstimator.js — pure function: planting date + crop
 * id → estimated lifecycle stage.
 *
 * Pure / no I/O. Used by dailyIntelligenceEngine to pick the
 * right crop-stage tasks when the farmer hasn't manually
 * overridden the stage on their farm profile.
 *
 * Strict-rule audit
 *   • No coupling to the existing taskEngine — this is a
 *     SUGGESTED stage; the daily engine treats the manual
 *     override on the farm profile as authoritative when set.
 *   • If the planting date is missing the function returns
 *     `{ stage: null, daysSincePlanting: null, needsPlantingDate: true }`
 *     so the daily card can ask the farmer to add the date.
 */

// Lifecycle tables. Days inclusive at the lower bound,
// exclusive at the upper bound, except for the last range
// which extends to Infinity (the farmer is in harvest cycle
// until they reset the planting date).
const TABLES = Object.freeze({
  maize: [
    { from: 0,   to: 11,  stage: 'germination' },
    { from: 11,  to: 36,  stage: 'vegetative' },
    { from: 36,  to: 66,  stage: 'flowering' },
    { from: 66,  to: 101, stage: 'grain_filling' },
    { from: 101, to: Infinity, stage: 'harvest' },
  ],
  okra: [
    { from: 0,  to: 11,  stage: 'germination' },
    { from: 11, to: 36,  stage: 'vegetative' },
    { from: 36, to: 61,  stage: 'flowering' },
    { from: 61, to: Infinity, stage: 'harvest' },
  ],
  tomato: [
    { from: 0,  to: 15,  stage: 'establishment' },
    { from: 15, to: 46,  stage: 'vegetative' },
    { from: 46, to: 76,  stage: 'flowering' },
    { from: 76, to: Infinity, stage: 'harvest' },
  ],
  // Generic fallback for any crop we don't have a specific
  // table for. Mirrors the loose "early → mid → late" schedule
  // most short-cycle field crops follow.
  __default: [
    { from: 0,   to: 14,  stage: 'germination' },
    { from: 14,  to: 45,  stage: 'vegetative' },
    { from: 45,  to: 80,  stage: 'flowering' },
    { from: 80,  to: 110, stage: 'grain_filling' },
    { from: 110, to: Infinity, stage: 'harvest' },
  ],
});

// Crop aliases — keep the surface narrow; full normalisation
// happens in src/utils/crops.js. We just lowercase + try a
// few well-known aliases here so the engine accepts whatever
// shape the farm profile carries.
const ALIASES = Object.freeze({
  corn: 'maize', maize: 'maize', mais: 'maize',
  okro: 'okra',  okra: 'okra',
  tomatoes: 'tomato', tomato: 'tomato',
});

function normaliseCropId(input) {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  return ALIASES[s] || s;
}

function tableFor(cropId) {
  const id = normaliseCropId(cropId);
  if (id && TABLES[id]) return { table: TABLES[id], cropKey: id };
  return { table: TABLES.__default, cropKey: id || null };
}

/**
 * daysBetween — whole days between two ISO dates / Date
 * objects. Returns null when the input can't be parsed.
 */
function daysBetween(fromInput, toInput = Date.now()) {
  if (!fromInput) return null;
  const from = (fromInput instanceof Date) ? fromInput : new Date(fromInput);
  if (!Number.isFinite(from.getTime())) return null;
  const to = (toInput instanceof Date) ? toInput : new Date(toInput);
  if (!Number.isFinite(to.getTime())) return null;
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / 86400000);
}

/**
 * estimateCropStage — main entry.
 *
 *   estimateCropStage({ cropId: 'maize', plantingDate: '2026-04-01' })
 *   → { stage: 'vegetative', daysSincePlanting: 29, cropKey: 'maize',
 *       needsPlantingDate: false }
 *
 *   estimateCropStage({ cropId: 'maize' })
 *   → { stage: null, daysSincePlanting: null, cropKey: 'maize',
 *       needsPlantingDate: true }
 *
 * Optional `now` override is accepted for deterministic tests.
 */
export function estimateCropStage({ cropId, plantingDate, now } = {}) {
  const { table, cropKey } = tableFor(cropId);

  if (!plantingDate) {
    return {
      stage: null,
      daysSincePlanting: null,
      cropKey,
      needsPlantingDate: true,
    };
  }
  const days = daysBetween(plantingDate, now != null ? now : Date.now());
  if (days == null) {
    return {
      stage: null,
      daysSincePlanting: null,
      cropKey,
      needsPlantingDate: true,
    };
  }
  // Negative days (planting date in the future) → still treat
  // as pre-germination; that's a data-entry mistake that the
  // daily card will surface.
  const safeDays = Math.max(0, days);

  for (const row of table) {
    if (safeDays >= row.from && safeDays < row.to) {
      return {
        stage: row.stage,
        daysSincePlanting: safeDays,
        cropKey,
        needsPlantingDate: false,
      };
    }
  }
  // Should never hit; defensive last-resort.
  return {
    stage: 'harvest',
    daysSincePlanting: safeDays,
    cropKey,
    needsPlantingDate: false,
  };
}

/**
 * isHarvestStage — convenience for callers that branch on
 * "should we surface 'Prepare to sell' today?" without
 * caring about the exact stage label.
 */
export function isHarvestStage(stage) {
  if (!stage) return false;
  const s = String(stage).toLowerCase();
  return s === 'harvest' || s === 'post_harvest' || s === 'harvesting';
}

export const _internal = Object.freeze({ TABLES, ALIASES });
