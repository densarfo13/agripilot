/**
 * cropDurationRegistry.js — honest days-to-harvest ranges + a
 * harvest-window estimator.
 *
 *   import { getDurationDays, estimateHarvestWindow, KNOWN_CROPS }
 *     from 'src/core/lifecycle/cropDurationRegistry.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small frozen lookup of typical days-to-harvest RANGES per
 *   crop, with light per-setting / per-climate adjustments, plus a
 *   helper that turns a planting date into an honest harvest WINDOW
 *   (earliest → latest). The output ALWAYS carries `isEstimate:true`
 *   and a `disclaimer` — Farroway never guarantees a date.
 *
 *   It does NOT replace `cropStageEstimator` (which decides the
 *   current STAGE from days-since-planting) — `cropLifecycleEngine`
 *   composes both.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Frozen data.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// Crop → { min, max } days-to-harvest ranges, with optional
// adjustments. Ranges are conservative — favour wider windows over
// false precision.
const REGISTRY = Object.freeze({
  tomato:    Object.freeze({ min: 60, max: 90 }),
  pepper:    Object.freeze({ min: 65, max: 95 }),
  maize:     Object.freeze({ min: 90, max: 120 }),
  rice:      Object.freeze({ min: 105, max: 150 }),
  beans:     Object.freeze({ min: 50, max: 75 }),
  cassava:   Object.freeze({ min: 240, max: 365 }),
  yam:       Object.freeze({ min: 240, max: 330 }),
  basil:     Object.freeze({ min: 40, max: 65 }),
  lettuce:   Object.freeze({ min: 30, max: 60 }),
  spinach:   Object.freeze({ min: 30, max: 50 }),
  cabbage:   Object.freeze({ min: 70, max: 110 }),
  okra:      Object.freeze({ min: 50, max: 70 }),
  onion:     Object.freeze({ min: 90, max: 120 }),
  groundnut: Object.freeze({ min: 100, max: 150 }),
  sorghum:   Object.freeze({ min: 95, max: 125 }),
  millet:    Object.freeze({ min: 70, max: 110 }),
});

export const KNOWN_CROPS = Object.freeze(Object.keys(REGISTRY));

/** Climate adjustment factor — gentle, never extreme. */
const CLIMATE_FACTOR = Object.freeze({
  hot_dry:    Object.freeze({ minFactor: 1.00, maxFactor: 1.05 }),
  hot_wet:    Object.freeze({ minFactor: 0.95, maxFactor: 1.00 }),
  cool_wet:   Object.freeze({ minFactor: 1.05, maxFactor: 1.15 }),
  temperate:  Object.freeze({ minFactor: 1.00, maxFactor: 1.00 }),
  cold:       Object.freeze({ minFactor: 1.10, maxFactor: 1.25 }),
});

/** Setting adjustment — pots/containers grow a bit slower; fields fastest. */
const SETTING_FACTOR = Object.freeze({
  field:     Object.freeze({ minFactor: 1.00, maxFactor: 1.00 }),
  container: Object.freeze({ minFactor: 1.05, maxFactor: 1.10 }),
  pot:       Object.freeze({ minFactor: 1.05, maxFactor: 1.10 }),
  raised_bed:Object.freeze({ minFactor: 1.00, maxFactor: 1.05 }),
  indoor:    Object.freeze({ minFactor: 1.10, maxFactor: 1.20 }),
  outdoor:   Object.freeze({ minFactor: 1.00, maxFactor: 1.00 }),
});

function _normalizeCrop(cropOrId) {
  if (cropOrId == null) return '';
  const s = String(cropOrId).toLowerCase().trim();
  if (REGISTRY[s]) return s;
  // Common aliases — extend if more localised aliases appear.
  if (s.includes('maize') || s.includes('corn')) return 'maize';
  if (s.includes('tomato')) return 'tomato';
  if (s.includes('pepper') || s.includes('chili')) return 'pepper';
  if (s.includes('cassava')) return 'cassava';
  if (s.includes('yam')) return 'yam';
  if (s.includes('rice')) return 'rice';
  if (s.includes('bean')) return 'beans';
  return '';
}

function _factor(map, key) {
  const k = String(key || '').toLowerCase();
  return map[k] || null;
}

/**
 * Conservative days-to-harvest range for a crop, with optional
 * climate + setting adjustments. Unknown crops return `null`.
 *
 * @param {string} cropOrId
 * @param {object} [opts] { climate, setting }
 * @returns {{ min:number, max:number, cropKey:string } | null}
 */
export function getDurationDays(cropOrId, opts) {
  try {
    const key = _normalizeCrop(cropOrId);
    const base = REGISTRY[key];
    if (!base) return null;
    const o = (opts && typeof opts === 'object') ? opts : {};
    const climate = _factor(CLIMATE_FACTOR, o.climate);
    const setting = _factor(SETTING_FACTOR, o.setting);
    let min = base.min, max = base.max;
    if (climate) { min *= climate.minFactor; max *= climate.maxFactor; }
    if (setting) { min *= setting.minFactor; max *= setting.maxFactor; }
    return {
      min:     Math.round(min),
      max:     Math.round(max),
      cropKey: key,
    };
  } catch {
    return null;
  }
}

/**
 * Turn a planting date into an honest harvest window.
 *
 * Always returns `{ isEstimate: true, disclaimer }` — never a
 * single hard date. Unknown crops or invalid dates return
 * `{ ok: false, reason }` so the caller renders a calm
 * "we'll need a bit more info" line instead of a fake date.
 *
 * @param {string} cropOrId
 * @param {string|number|Date} plantingDate
 * @param {object} [opts] { climate, setting, nowMs }
 * @returns {object}
 */
export function estimateHarvestWindow(cropOrId, plantingDate, opts) {
  try {
    const duration = getDurationDays(cropOrId, opts);
    if (!duration) return { ok: false, reason: 'unknown_crop' };

    const plantedMs = (plantingDate instanceof Date)
      ? plantingDate.getTime()
      : (typeof plantingDate === 'number' && Number.isFinite(plantingDate))
        ? plantingDate
        : Date.parse(String(plantingDate || ''));
    if (!Number.isFinite(plantedMs)) {
      return { ok: false, reason: 'invalid_planting_date' };
    }

    const o = (opts && typeof opts === 'object') ? opts : {};
    const now = Number.isFinite(o.nowMs) ? o.nowMs : Date.now();
    const earliestMs = plantedMs + duration.min * DAY_MS;
    const latestMs   = plantedMs + duration.max * DAY_MS;
    const isoOf = (ms) => { try { return new Date(ms).toISOString().slice(0, 10); } catch { return null; } };
    const daysUntilEarliest = Math.round((earliestMs - now) / DAY_MS);
    const daysUntilLatest   = Math.round((latestMs - now) / DAY_MS);

    return {
      ok:          true,
      cropKey:     duration.cropKey,
      earliest:    isoOf(earliestMs),
      latest:      isoOf(latestMs),
      daysUntilEarliest,
      daysUntilLatest,
      durationDays: { min: duration.min, max: duration.max },
      isEstimate:  true,
      disclaimer:  'Estimated harvest window — not a guaranteed date. Local conditions vary.',
    };
  } catch {
    return { ok: false, reason: 'exception' };
  }
}

const _module = {
  KNOWN_CROPS,
  getDurationDays,
  estimateHarvestWindow,
};
export default _module;
