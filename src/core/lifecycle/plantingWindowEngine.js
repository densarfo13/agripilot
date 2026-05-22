/**
 * plantingWindowEngine.js — region-aware "when should I plant?" view.
 *
 *   import { getPlantingWindow, PLANTING_REGIONS }
 *     from 'src/core/lifecycle/plantingWindowEngine.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small frozen registry of typical month-range planting
 *   windows by (country, crop), with optional frost / heat /
 *   rainfall caution. Output is a calm envelope the Home /
 *   MyFarm card can render — never a hard "plant on Tuesday"
 *   promise.
 *
 *   It does NOT replace any weather engine. It does NOT predict
 *   weather. It composes with `weatherOperationalInterpreter` and
 *   `cropLifecycleEngine` — the lifecycle engine uses this to
 *   decide whether the user is currently inside, before, or
 *   past the recommended planting window.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Frozen data. Honest defaults
 *     — unknown (country, crop) returns { ok:false, reason:
 *     'no_data' } so the UI shows "we don't have a local source
 *     yet" instead of guessing.
 */

// Local crop / country normalisers — kept inside this module so
// it stays standalone (cropDurationRegistry keeps its own private
// alias map for the duration tables).
function _norm(s) {
  if (s == null) return '';
  return String(s).toLowerCase().trim().replace(/[^a-z]+/g, '_');
}

export const PLANTING_REGIONS = Object.freeze(['usa', 'ghana', 'kenya', 'india']);

// Month numbers are 1–12 (human-readable). Windows wrap the
// year when `endMonth < startMonth` (e.g. nov→feb in Ghana
// for tomato).
//
// HONEST DEFAULT: only the (country, crop) pairs listed here have
// data. Anything else returns { ok:false, reason:'no_data' }.
const REGISTRY = Object.freeze({
  usa: Object.freeze({
    tomato:   Object.freeze({ start: 4, end: 6,  note: 'after_last_frost' }),
    pepper:   Object.freeze({ start: 4, end: 6,  note: 'after_last_frost' }),
    maize:    Object.freeze({ start: 4, end: 6,  note: 'cool_soil_caution' }),
    cucumber: Object.freeze({ start: 5, end: 7,  note: 'warm_soil_only' }),
    lettuce:  Object.freeze({ start: 3, end: 5,  note: 'bolts_in_heat' }),
    carrot:   Object.freeze({ start: 3, end: 6,  note: 'cool_season' }),
    potato:   Object.freeze({ start: 3, end: 5,  note: 'cool_season' }),
    herbs:    Object.freeze({ start: 4, end: 6,  note: 'sensitive_to_frost' }),
  }),
  ghana: Object.freeze({
    tomato:   Object.freeze({ start: 9, end: 2,  note: 'cooler_dry_window' }),  // wraps
    pepper:   Object.freeze({ start: 3, end: 5,  note: 'major_season_start' }),
    maize:    Object.freeze({ start: 3, end: 5,  note: 'major_season_start' }),
    cassava:  Object.freeze({ start: 3, end: 6,  note: 'rainy_season' }),
    okra:     Object.freeze({ start: 3, end: 6,  note: 'rainy_season' }),
    onion:    Object.freeze({ start: 10, end: 2, note: 'cooler_dry_window' }), // wraps
    rice:     Object.freeze({ start: 5, end: 7,  note: 'main_rains' }),
    yam:      Object.freeze({ start: 2, end: 4,  note: 'early_rains' }),
  }),
  kenya: Object.freeze({
    tomato:   Object.freeze({ start: 3, end: 5,  note: 'long_rains_start' }),
    maize:    Object.freeze({ start: 3, end: 5,  note: 'long_rains' }),
    beans:    Object.freeze({ start: 3, end: 5,  note: 'long_rains' }),
    pepper:   Object.freeze({ start: 3, end: 5,  note: 'long_rains_start' }),
    cabbage:  Object.freeze({ start: 3, end: 6,  note: 'long_rains' }),
    onion:    Object.freeze({ start: 6, end: 9,  note: 'short_dry' }),
  }),
  india: Object.freeze({
    tomato:   Object.freeze({ start: 6, end: 8,  note: 'kharif_season' }),
    pepper:   Object.freeze({ start: 6, end: 8,  note: 'kharif_season' }),
    rice:     Object.freeze({ start: 6, end: 7,  note: 'kharif_paddy' }),
    maize:    Object.freeze({ start: 6, end: 7,  note: 'kharif_season' }),
    okra:     Object.freeze({ start: 6, end: 7,  note: 'kharif_season' }),
    potato:   Object.freeze({ start: 10, end: 11,note: 'rabi_season' }),
    cabbage:  Object.freeze({ start: 9, end: 11, note: 'rabi_season' }),
    onion:    Object.freeze({ start: 10, end: 12,note: 'rabi_season' }),
  }),
});

const NOTE_COPY = Object.freeze({
  after_last_frost:    { key: 'lifecycle.window.after_frost',     fallback: 'Wait until after your last frost — young {crop} dies in cold.' },
  cool_soil_caution:   { key: 'lifecycle.window.cool_soil',       fallback: 'Soil should be warm — early planting in cold soil rots seed.' },
  warm_soil_only:      { key: 'lifecycle.window.warm_soil',       fallback: 'Soil must be warm — wait for steady warm days.' },
  bolts_in_heat:       { key: 'lifecycle.window.bolts',           fallback: '{crop} bolts in heat — plant before days get hot.' },
  cool_season:         { key: 'lifecycle.window.cool_season',     fallback: '{crop} prefers cool weather — plant on the cool side of the window.' },
  sensitive_to_frost:  { key: 'lifecycle.window.frost_sensitive', fallback: 'Tender herbs do not survive frost — be patient.' },
  cooler_dry_window:   { key: 'lifecycle.window.cool_dry',        fallback: 'Plant in the cooler dry months for the best results.' },
  major_season_start:  { key: 'lifecycle.window.major_season',    fallback: 'Plant at the start of the main rains so seedlings catch the moisture.' },
  rainy_season:        { key: 'lifecycle.window.rainy_season',    fallback: 'Plant with the rains — soil should be moist, not flooded.' },
  main_rains:          { key: 'lifecycle.window.main_rains',      fallback: 'Plant at the start of the main rains.' },
  early_rains:         { key: 'lifecycle.window.early_rains',     fallback: 'Plant early in the rains so tubers form before the dry season.' },
  long_rains_start:    { key: 'lifecycle.window.long_rains_start',fallback: 'Plant at the start of the long rains.' },
  long_rains:          { key: 'lifecycle.window.long_rains',      fallback: 'Plant during the long rains.' },
  short_dry:           { key: 'lifecycle.window.short_dry',       fallback: 'Plant in the short dry window between rains.' },
  kharif_season:       { key: 'lifecycle.window.kharif',          fallback: 'Kharif (monsoon) season — plant at the start of the rains.' },
  kharif_paddy:        { key: 'lifecycle.window.kharif_paddy',    fallback: 'Plant paddy with the kharif rains in flooded fields.' },
  rabi_season:         { key: 'lifecycle.window.rabi',            fallback: 'Rabi (cool, dry) season — plant after the monsoon ends.' },
});

const MONTH_NAMES = Object.freeze([
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

function _windowText(start, end, crop) {
  const a = MONTH_NAMES[start] || '';
  const b = MONTH_NAMES[end] || '';
  if (!a || !b) return '';
  const cropLabel = crop || 'this crop';
  if (start === end) return `Plant ${cropLabel} in ${a}.`;
  if (start < end)   return `Plant ${cropLabel} between ${a} and ${b}.`;
  return `Plant ${cropLabel} between ${a} and ${b} (window wraps the new year).`;
}

function _isInWindow(month, start, end) {
  // 1–12 inclusive; wrapping windows treat e.g. Nov–Feb as
  // [11,12,1,2].
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function _normalizeCountry(country) {
  const c = _norm(country);
  if (!c) return '';
  if (PLANTING_REGIONS.includes(c)) return c;
  // Light aliases — extend as more localised names appear.
  if (c.includes('united_states') || c === 'us' || c.includes('america')) return 'usa';
  return '';
}

// Lightweight crop normaliser — duplicates the duration registry's
// alias set for the most common cases. Kept local so this module
// stays standalone.
function _normalizeCrop(crop) {
  const s = _norm(crop);
  if (!s) return '';
  if (s.includes('maize') || s.includes('corn')) return 'maize';
  if (s.includes('tomato')) return 'tomato';
  if (s.includes('pepper') || s.includes('chili')) return 'pepper';
  if (s.includes('cassava')) return 'cassava';
  if (s.includes('yam')) return 'yam';
  if (s.includes('rice')) return 'rice';
  if (s.includes('bean')) return 'beans';
  if (s.includes('cucumber')) return 'cucumber';
  if (s.includes('carrot')) return 'carrot';
  if (s.includes('lettuce')) return 'lettuce';
  if (s.includes('cabbage')) return 'cabbage';
  if (s.includes('okra')) return 'okra';
  if (s.includes('onion')) return 'onion';
  if (s.includes('potato') && !s.includes('sweet')) return 'potato';
  if (s.includes('herb') || s.includes('basil') || s.includes('mint')) return 'herbs';
  return s;
}

/**
 * Get the planting-window envelope for a (country, crop, nowMs).
 *
 * @param {object} args
 * @param {string} args.country
 * @param {string} args.crop
 * @param {number} [args.nowMs]
 * @returns {object}
 */
export function getPlantingWindow(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const country = _normalizeCountry(a.country);
    const crop = _normalizeCrop(a.crop);
    if (!country || !crop) return { ok: false, reason: 'no_data' };

    const countryMap = REGISTRY[country];
    if (!countryMap) return { ok: false, reason: 'no_data' };

    const entry = countryMap[crop];
    if (!entry) return { ok: false, reason: 'no_data' };

    const nowMs = Number.isFinite(a.nowMs) ? a.nowMs : Date.now();
    const month = new Date(nowMs).getMonth() + 1;
    const inWindow = _isInWindow(month, entry.start, entry.end);

    // "Caution" = one month before window start.
    const cautionMonth = entry.start === 1 ? 12 : entry.start - 1;
    const inCaution = month === cautionMonth;

    const reasonCopy = NOTE_COPY[entry.note] || null;
    const why = reasonCopy
      ? { key: reasonCopy.key, fallback: reasonCopy.fallback.replace('{crop}', crop), params: { crop } }
      : null;

    return {
      ok:           true,
      country, cropKey: crop,
      startMonth:   entry.start,
      endMonth:     entry.end,
      currentMonth: month,
      inWindow,
      inCaution,
      isEstimate:   true,
      windowText:   { key: 'lifecycle.window.text', fallback: _windowText(entry.start, entry.end, crop), params: { crop } },
      why,
      disclaimer:   'Estimated planting window — local weather and your variety may shift it by a few weeks.',
    };
  } catch {
    return { ok: false, reason: 'exception' };
  }
}

const _module = {
  PLANTING_REGIONS,
  getPlantingWindow,
};
export default _module;
