/**
 * crops.js — searchable catalog of common crops, shared by every
 * "pick a crop" input (NewFarmScreen, EditFarmScreen, CropFit).
 *
 *   COMMON_CROPS        → frozen list of { code, label }
 *   searchCrops(query)  → filtered list (starts-with wins over contains)
 *   normalizeCrop(val)  → lowercase code suitable for storage
 *   CROP_OTHER          → the sentinel 'other' option
 */

// Keep labels English + well-known so operators can audit data
// easily. UI can localise via existing crop-name overlays if needed;
// the stored value (code) stays stable.
export const COMMON_CROPS = Object.freeze([
  ['maize',      'Maize (corn)'],
  ['rice',       'Rice'],
  ['wheat',      'Wheat'],
  ['sorghum',    'Sorghum'],
  ['millet',     'Millet'],
  ['cassava',    'Cassava'],
  ['yam',        'Yam'],
  ['potato',     'Potato'],
  ['sweet_potato','Sweet potato'],
  ['beans',      'Beans'],
  ['soybean',    'Soybean'],
  ['groundnut',  'Groundnut / peanut'],
  ['cowpea',     'Cowpea'],
  ['chickpea',   'Chickpea'],
  ['lentil',     'Lentil'],
  ['tomato',     'Tomato'],
  ['onion',      'Onion'],
  ['pepper',     'Pepper / chili'],
  ['cabbage',    'Cabbage'],
  ['carrot',     'Carrot'],
  ['okra',       'Okra'],
  ['spinach',    'Spinach / leafy greens'],
  ['cucumber',   'Cucumber'],
  ['watermelon', 'Watermelon'],
  ['plantain',   'Plantain'],
  ['banana',     'Banana'],
  ['mango',      'Mango'],
  ['orange',     'Orange / citrus'],
  ['avocado',    'Avocado'],
  ['coffee',     'Coffee'],
  ['tea',        'Tea'],
  ['cocoa',      'Cocoa'],
  ['cotton',     'Cotton'],
  ['sugarcane',  'Sugarcane'],
  ['sunflower',  'Sunflower'],
  ['sesame',     'Sesame'],
  ['tobacco',    'Tobacco'],
  ['other',      'Other'],
].map(([code, label]) => Object.freeze({ code, label })));

export const CROP_OTHER = 'other';

const CODES = new Set(COMMON_CROPS.map((c) => c.code));

/**
 * normalizeCrop — produce a storage-safe lowercase code.
 *   • known labels or codes → the canonical code
 *   • anything else → the string lowercased/underscored
 *   • empty/invalid → ''
 */
export function normalizeCrop(value) {
  if (value == null) return '';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return '';
  if (CODES.has(raw)) return raw;
  // Accept common label-to-code collapses (spaces → underscores).
  const squashed = raw.replace(/\s+/g, '_');
  if (CODES.has(squashed)) return squashed;
  // Unknown crop — keep the user's value but in a safe shape.
  return squashed.replace(/[^\w]+/g, '_');
}

/**
 * searchCrops — filters the catalog for a searchable dropdown.
 *
 * Ranking:
 *   1. starts-with on label or code
 *   2. substring match
 *   3. "other" always sticks to the bottom for discoverability
 */
export function searchCrops(query, { limit = 20 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return COMMON_CROPS.slice(0, limit);
  const startsWith = [];
  const contains = [];
  let other = null;
  for (const c of COMMON_CROPS) {
    if (c.code === CROP_OTHER) { other = c; continue; }
    const hayLabel = c.label.toLowerCase();
    const hayCode  = c.code.toLowerCase();
    if (hayLabel.startsWith(q) || hayCode.startsWith(q)) startsWith.push(c);
    else if (hayLabel.includes(q) || hayCode.includes(q)) contains.push(c);
  }
  const out = [...startsWith, ...contains];
  if (other) out.push(other);
  return out.slice(0, limit);
}

export function getCropLabel(code) {
  if (!code) return '';
  const found = COMMON_CROPS.find((c) => c.code === String(code).toLowerCase());
  return found ? found.label : String(code);
}

export const _internal = Object.freeze({ CODES });
