/**
 * cropStageModel.js — derives a likely current crop stage from
 * planting date + crop, with conservative fallbacks for unknown
 * crops.
 *
 * Why this exists alongside the existing cropStages.js
 * ────────────────────────────────────────────────────
 * `src/utils/cropStages.js` exposes the canonical STAGE_KEYS / order
 * + i18n keys. This module is its NUMERIC counterpart — it estimates
 * which stage a farm is *likely* in given days-since-planting, so
 * downstream tasks (weatherRiskModel × pestDiseaseRisk × yield
 * forecast) can reason about timing without asking the farmer to
 * tap a stage chip.
 *
 * The farmer-facing stage chip remains authoritative — when the
 * farmer has explicitly set `cropStage` on the farm, that value
 * wins. The model is only consulted when stage is missing OR when
 * the caller wants a confidence-weighted blend.
 *
 * Stage durations (days) — conservative midpoints
 * ───────────────────────────────────────────────
 * The table is intentionally short and per-crop. Unknown crops
 * fall back to a generic 4-month profile so the model never blanks.
 */

const STAGE_ORDER = Object.freeze([
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
]);

// Per-crop days-from-planting cumulative thresholds. Each tuple is
// [stage, days]: at days <= n the stage is `stage`. Last entry is
// the harvest threshold; beyond it is `post_harvest`.
const PROFILES = Object.freeze({
  // Cereal staples — ~4 months
  maize:    Object.freeze([['germination', 7], ['vegetative', 35], ['flowering', 60], ['fruiting', 95], ['harvest', 120]]),
  corn:     Object.freeze([['germination', 7], ['vegetative', 35], ['flowering', 60], ['fruiting', 95], ['harvest', 120]]),
  rice:     Object.freeze([['germination', 10], ['vegetative', 40], ['flowering', 80], ['fruiting', 110], ['harvest', 140]]),
  wheat:    Object.freeze([['germination', 10], ['vegetative', 50], ['flowering', 90], ['fruiting', 120], ['harvest', 150]]),
  sorghum:  Object.freeze([['germination', 10], ['vegetative', 45], ['flowering', 75], ['fruiting', 105], ['harvest', 130]]),
  millet:   Object.freeze([['germination', 7],  ['vegetative', 35], ['flowering', 60], ['fruiting', 85],  ['harvest', 110]]),
  // Roots & tubers — longer cycle
  cassava:  Object.freeze([['germination', 14], ['vegetative', 60], ['flowering', 180], ['fruiting', 270], ['harvest', 360]]),
  yam:      Object.freeze([['germination', 21], ['vegetative', 90], ['flowering', 180], ['fruiting', 240], ['harvest', 300]]),
  potato:   Object.freeze([['germination', 14], ['vegetative', 45], ['flowering', 70],  ['fruiting', 90],  ['harvest', 110]]),
  // Legumes
  bean:     Object.freeze([['germination', 7],  ['vegetative', 30], ['flowering', 50], ['fruiting', 70],  ['harvest', 90]]),
  beans:    Object.freeze([['germination', 7],  ['vegetative', 30], ['flowering', 50], ['fruiting', 70],  ['harvest', 90]]),
  groundnut: Object.freeze([['germination', 10], ['vegetative', 35], ['flowering', 65], ['fruiting', 95], ['harvest', 120]]),
  soybean:  Object.freeze([['germination', 7],  ['vegetative', 35], ['flowering', 60], ['fruiting', 90],  ['harvest', 110]]),
  // Vegetables — ~3 months
  tomato:   Object.freeze([['germination', 7],  ['vegetative', 30], ['flowering', 50], ['fruiting', 75],  ['harvest', 95]]),
  onion:    Object.freeze([['germination', 14], ['vegetative', 60], ['flowering', 90], ['fruiting', 110], ['harvest', 130]]),
  pepper:   Object.freeze([['germination', 10], ['vegetative', 40], ['flowering', 65], ['fruiting', 90],  ['harvest', 110]]),
  cabbage:  Object.freeze([['germination', 7],  ['vegetative', 35], ['flowering', 65], ['fruiting', 80],  ['harvest', 95]]),
});

const GENERIC_PROFILE = Object.freeze(
  [['germination', 10], ['vegetative', 40], ['flowering', 70], ['fruiting', 100], ['harvest', 130]],
);

function _norm(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/\s+/g, '_');
}

function _profileFor(crop) {
  return PROFILES[_norm(crop)] || GENERIC_PROFILE;
}

/**
 * Estimate the current stage from a planting date.
 *
 * @param {object} input
 * @param {string} [input.crop]
 * @param {Date|number|string} [input.plantingDate]
 * @param {number} [input.nowMs]   defaults to Date.now()
 * @returns {{ stage: string, daysSincePlanting: number, source: 'estimate' }}
 */
export function estimateStageFromPlanting({ crop, plantingDate, nowMs } = {}) {
  const profile = _profileFor(crop);
  const plantedAt = _toMs(plantingDate);
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (!Number.isFinite(plantedAt)) {
    return Object.freeze({ stage: 'planning', daysSincePlanting: 0, source: 'estimate' });
  }
  const days = Math.max(0, Math.floor((now - plantedAt) / 86400000));
  let stage = 'post_harvest';
  for (const [name, threshold] of profile) {
    if (days <= threshold) { stage = name; break; }
  }
  return Object.freeze({ stage, daysSincePlanting: days, source: 'estimate' });
}

/**
 * Resolve the stage to use for a farm. Farmer-set value wins; falls
 * back to the planting-date estimate; ultimately to 'planning' so
 * downstream callers always get a string.
 *
 * @param {object} farm
 * @returns {{ stage: string, daysSincePlanting: number, source: 'declared'|'estimate'|'unknown' }}
 */
export function resolveStage(farm) {
  if (!farm || typeof farm !== 'object') {
    return Object.freeze({ stage: 'planning', daysSincePlanting: 0, source: 'unknown' });
  }
  const declared = farm.cropStage || farm.stage;
  if (declared && STAGE_ORDER.includes(_norm(declared))) {
    // We don't know exact days when the farmer declared the stage,
    // but consumers that need it can fall back to plantingDate.
    const planted = _toMs(farm.plantingDate || farm.plantedAt);
    const days = Number.isFinite(planted)
      ? Math.max(0, Math.floor((Date.now() - planted) / 86400000))
      : 0;
    return Object.freeze({ stage: _norm(declared), daysSincePlanting: days, source: 'declared' });
  }
  // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
  const est = estimateStageFromPlanting({
    crop:         farm.crop,
    plantingDate: farm.plantingDate || farm.plantedAt,
  });
  return Object.freeze({ ...est, source: 'estimate' });
}

function _toMs(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (v instanceof Date) return v.getTime();
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : NaN;
}

export { STAGE_ORDER };
