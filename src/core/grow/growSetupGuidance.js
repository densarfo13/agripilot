/**
 * growSetupGuidance.js — simple sunlight + setting guidance per
 * crop / plant (spec §9).
 *
 *   import { getGrowSetupGuidance, SUNLIGHT, SETTING }
 *     from 'src/core/grow/growSetupGuidance.js';
 *
 *   const g = getGrowSetupGuidance('tomato');
 *   // g.sunlight  → 'full_sun' | 'part_sun' | 'shade'
 *   // g.settings  → ['field', 'raised_bed', 'outdoor']
 *   // g.note      → { key, fallback, params }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small frozen registry of typical sunlight + setting
 *   preferences per crop. It does NOT pretend to measure light;
 *   there are no sensors involved. The output is honest broad
 *   guidance ("Tomatoes usually need strong sunlight. Choose a
 *   bright outdoor spot.") — exactly the spec's §9 example.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Frozen data. SSR-safe.
 */

export const SUNLIGHT = Object.freeze({
  FULL_SUN:  'full_sun',
  PART_SUN:  'part_sun',
  SHADE:     'shade',
});

export const SETTING = Object.freeze({
  FIELD:      'field',
  OUTDOOR:    'outdoor',
  RAISED_BED: 'raised_bed',
  CONTAINER:  'container',
  POT:        'pot',
  BALCONY:    'balcony',
  INDOOR:     'indoor',
  GREENHOUSE: 'greenhouse',
});

// Crop → preferred sunlight + plausible settings. Settings are
// listed in order of typical preference; the surface picks one
// matching the user's available setup.
const REGISTRY = Object.freeze({
  tomato:    { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'container', 'outdoor', 'greenhouse'] },
  pepper:    { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'container', 'outdoor', 'greenhouse'] },
  maize:     { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
  rice:      { sunlight: 'full_sun', settings: ['field'] },
  beans:     { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'outdoor'] },
  cassava:   { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
  yam:       { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
  basil:     { sunlight: 'full_sun', settings: ['container', 'pot', 'balcony', 'raised_bed', 'indoor'] },
  herbs:     { sunlight: 'full_sun', settings: ['container', 'pot', 'balcony', 'raised_bed', 'indoor'] },
  lettuce:   { sunlight: 'part_sun', settings: ['raised_bed', 'container', 'pot', 'outdoor'] },
  spinach:   { sunlight: 'part_sun', settings: ['raised_bed', 'container', 'pot', 'outdoor'] },
  cabbage:   { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'outdoor'] },
  okra:      { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'outdoor'] },
  onion:     { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'outdoor'] },
  cucumber:  { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'container', 'outdoor', 'greenhouse'] },
  carrot:    { sunlight: 'full_sun', settings: ['raised_bed', 'container', 'field', 'outdoor'] },
  potato:    { sunlight: 'full_sun', settings: ['field', 'raised_bed', 'outdoor'] },
  banana:    { sunlight: 'full_sun', settings: ['outdoor'] },
  mango:     { sunlight: 'full_sun', settings: ['outdoor'] },
  avocado:   { sunlight: 'full_sun', settings: ['outdoor'] },
  citrus:    { sunlight: 'full_sun', settings: ['outdoor', 'greenhouse'] },
  groundnut: { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
  sorghum:   { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
  millet:    { sunlight: 'full_sun', settings: ['field', 'outdoor'] },
});

const SUNLIGHT_NOTE = Object.freeze({
  full_sun: { key: 'grow.sun.full', fallback: '{crop} usually needs strong sunlight. Choose a bright outdoor spot.' },
  part_sun: { key: 'grow.sun.part', fallback: '{crop} grows best in partial sun — bright but not all-day direct sun.' },
  shade:    { key: 'grow.sun.shade', fallback: '{crop} prefers a shaded spot — avoid harsh direct sun.' },
});

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

function _norm(crop) {
  const s = String(crop || '').toLowerCase().trim();
  if (REGISTRY[s]) return s;
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
  if (s.includes('plantain') || s.includes('banana')) return 'banana';
  if (s.includes('mango')) return 'mango';
  if (s.includes('avocado')) return 'avocado';
  if (s.includes('orange') || s.includes('lemon') || s.includes('lime') || s.includes('citrus')) return 'citrus';
  if (s.includes('mint') || s.includes('thyme') || s.includes('parsley') || s.includes('cilantro')) return 'herbs';
  if (s.includes('basil')) return 'basil';
  return '';
}

/**
 * Get grow-setup guidance for a crop / plant.
 *
 * @param {string} crop
 * @returns {{ cropKey, sunlight, settings, note, isEstimate, disclaimer } | null}
 */
export function getGrowSetupGuidance(crop) {
  try {
    const key = _norm(crop);
    if (!key) return null;
    const entry = REGISTRY[key];
    if (!entry) return null;
    return {
      cropKey:    key,
      sunlight:   entry.sunlight,
      settings:   entry.settings.slice(),
      note:       _msg(SUNLIGHT_NOTE[entry.sunlight], { crop: crop || key }),
      isEstimate: true,
      disclaimer: 'General guidance — local microclimate may shift this. We do not measure light.',
    };
  } catch {
    return null;
  }
}

/** Known crops the guidance covers. */
export const KNOWN_GROW_CROPS = Object.freeze(Object.keys(REGISTRY));

const _module = {
  SUNLIGHT, SETTING, KNOWN_GROW_CROPS,
  getGrowSetupGuidance,
};
export default _module;
