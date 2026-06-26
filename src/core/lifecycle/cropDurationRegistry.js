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
  cucumber:  Object.freeze({ min: 50, max: 75 }),
  carrot:    Object.freeze({ min: 70, max: 100 }),
  potato:    Object.freeze({ min: 80, max: 130 }),
  banana:    Object.freeze({ min: 270, max: 365 }),
  mango:     Object.freeze({ min: 1095, max: 1825 }),  // 3–5 years to first fruit
  avocado:   Object.freeze({ min: 1095, max: 2555 }),  // 3–7 years
  citrus:    Object.freeze({ min: 1095, max: 1825 }),  // 3–5 years
  herbs:     Object.freeze({ min: 30, max: 80 }),
  // Coverage expansion — common smallholder staples with standard,
  // conservative days-to-maturity ranges. Wider windows over false precision.
  cowpea:       Object.freeze({ min: 60, max: 90 }),
  soybean:      Object.freeze({ min: 90, max: 120 }),
  sweet_potato: Object.freeze({ min: 90, max: 120 }),
  plantain:     Object.freeze({ min: 300, max: 400 }),
  cocoa:        Object.freeze({ min: 1095, max: 1825 }),  // 3–5 years to first pod
  cocoyam:      Object.freeze({ min: 180, max: 270 }),
  pumpkin:      Object.freeze({ min: 90, max: 120 }),
  eggplant:     Object.freeze({ min: 70, max: 100 }),
  watermelon:   Object.freeze({ min: 80, max: 100 }),
  pineapple:    Object.freeze({ min: 450, max: 540 }),
  sugarcane:    Object.freeze({ min: 300, max: 365 }),
  wheat:        Object.freeze({ min: 100, max: 130 }),
  sesame:       Object.freeze({ min: 90, max: 120 }),
  sunflower:    Object.freeze({ min: 90, max: 120 }),
  ginger:       Object.freeze({ min: 240, max: 300 }),
  garlic:       Object.freeze({ min: 120, max: 150 }),
  kale:         Object.freeze({ min: 50, max: 70 }),
  amaranth:     Object.freeze({ min: 40, max: 60 }),
  moringa:      Object.freeze({ min: 60, max: 90 }),   // leaf harvest
  chickpea:     Object.freeze({ min: 90, max: 120 }),
  pea:          Object.freeze({ min: 60, max: 90 }),
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
  if (s.includes('cucumber')) return 'cucumber';
  if (s.includes('carrot')) return 'carrot';
  if (s.includes('sweet') && s.includes('potato')) return 'sweet_potato';
  if (s.includes('potato')) return 'potato';
  if (s.includes('plantain')) return 'plantain';
  if (s.includes('banana')) return 'banana';
  // Coverage expansion aliases. Order matters — specific before generic so e.g.
  // "cowpea"/"peanut" never fall through to the generic "pea" match.
  if (s.includes('cowpea') || s.includes('black-eyed') || s.includes('black eyed')) return 'cowpea';
  if (s.includes('groundnut') || s.includes('peanut')) return 'groundnut';
  if (s.includes('soy')) return 'soybean';
  if (s.includes('cocoa') || s.includes('cacao')) return 'cocoa';
  if (s.includes('cocoyam') || s.includes('taro') || s.includes('dasheen')) return 'cocoyam';
  if (s.includes('pumpkin') || s.includes('squash') || s.includes('gourd')) return 'pumpkin';
  if (s.includes('eggplant') || s.includes('aubergine') || s.includes('garden egg')) return 'eggplant';
  if (s.includes('watermelon')) return 'watermelon';
  if (s.includes('pineapple')) return 'pineapple';
  if (s.includes('sugarcane') || s.includes('sugar cane')) return 'sugarcane';
  if (s.includes('wheat')) return 'wheat';
  if (s.includes('sesame') || s.includes('benniseed') || s.includes('beniseed')) return 'sesame';
  if (s.includes('sunflower')) return 'sunflower';
  if (s.includes('ginger')) return 'ginger';
  if (s.includes('garlic')) return 'garlic';
  if (s.includes('kale')) return 'kale';
  if (s.includes('amaranth')) return 'amaranth';
  if (s.includes('moringa')) return 'moringa';
  if (s.includes('chickpea') || s.includes('chick pea') || s.includes('gram')) return 'chickpea';
  if (s === 'pea' || s === 'peas' || s.includes('garden pea') || s.includes('green pea') || s.includes('field pea')) return 'pea';
  if (s.includes('mango')) return 'mango';
  if (s.includes('avocado') || s.includes('pear')) return 'avocado';
  if (s.includes('orange') || s.includes('lemon') || s.includes('lime') || s.includes('citrus')) return 'citrus';
  if (s.includes('basil') || s.includes('mint') || s.includes('parsley') || s.includes('cilantro') || s.includes('coriander') || s.includes('thyme')) return 'herbs';
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
