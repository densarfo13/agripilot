/**
 * cropImages.js — centralised catalog mapping canonical crop keys
 * to optimised WebP image paths under /public/crops.
 *
 *   getCropImagePath('maize')   → '/crops/maize.webp'
 *   getCropImagePath('MAIZE')   → '/crops/maize.webp'   // case-insensitive
 *   getCropImagePath('unknown') → null                  // caller shows placeholder
 *
 *   hasCropImage(key) → boolean
 *
 * Principles
 *   • lowercase canonical keys so the same mapping works for the
 *     modern uppercase storage shape (`MAIZE`) and legacy lowercase
 *     (`maize`) — we only ever normalise, never rename.
 *   • The mapping is a frozen object literal so it's fast to look up
 *     and can't be mutated by callers.
 *   • Missing entries return `null` — the CropImage component turns
 *     that into the generic `/crops/_placeholder.svg` fallback. No
 *     crashes, no broken `<img>` tags.
 *
 * Adding a new crop image
 *   1. Drop `<key>.webp` into /public/crops (keep it square, ≤80kb).
 *   2. Add a row to CROP_IMAGE_PATHS below:
 *        newcrop: '/crops/newcrop.webp',
 *   3. That's it — every CropImage consumer picks it up on next
 *      render. No other code touches image paths directly.
 */

import { normalizeCrop } from './crops.js';

export const CROP_IMAGE_PLACEHOLDER = '/crops/_placeholder.svg';

/**
 * Canonical lowercase crop key → image path. Keys match the codes in
 * src/config/crops.js (normalised to lowercase) so the mapping is
 * consistent across yield ranges, prices, and this image catalog.
 *
 * The full list intentionally mirrors the crops we already price +
 * range. Adding a new row here without an actual file will just
 * render the placeholder (tested in cropImage.test.js), so entries
 * can land slightly ahead of the asset drop.
 */
export const CROP_IMAGE_PATHS = Object.freeze({
  // Staples + grains
  maize:        '/crops/maize.webp',
  corn:         '/crops/maize.webp',      // synonym
  rice:         '/crops/rice.webp',
  wheat:        '/crops/wheat.webp',
  sorghum:      '/crops/sorghum.webp',
  millet:       '/crops/millet.webp',
  barley:       '/crops/barley.webp',
  // Roots + tubers
  cassava:      '/crops/cassava.webp',
  yam:          '/crops/yam.webp',
  potato:       '/crops/potato.webp',
  sweet_potato: '/crops/sweet_potato.webp',
  // Legumes
  beans:        '/crops/beans.webp',
  bean:         '/crops/beans.webp',
  soybean:      '/crops/soybean.webp',
  groundnut:    '/crops/groundnut.webp',
  peanut:       '/crops/groundnut.webp',
  cowpea:       '/crops/cowpea.webp',
  chickpea:     '/crops/chickpea.webp',
  lentil:       '/crops/lentil.webp',
  // Vegetables
  tomato:       '/crops/tomato.webp',
  onion:        '/crops/onion.webp',
  pepper:       '/crops/pepper.webp',
  chili:        '/crops/pepper.webp',
  cabbage:      '/crops/cabbage.webp',
  carrot:       '/crops/carrot.webp',
  okra:         '/crops/okra.webp',
  cucumber:     '/crops/cucumber.webp',
  watermelon:   '/crops/watermelon.webp',
  // Tree + permanent
  banana:       '/crops/banana.webp',
  plantain:     '/crops/plantain.webp',
  mango:        '/crops/mango.webp',
  avocado:      '/crops/avocado.webp',
  coffee:       '/crops/coffee.webp',
  tea:          '/crops/tea.webp',
  cocoa:        '/crops/cocoa.webp',
  cacao:        '/crops/cocoa.webp',      // synonym
  cotton:       '/crops/cotton.webp',
  sugarcane:    '/crops/sugarcane.webp',
  sunflower:    '/crops/sunflower.webp',
  sesame:       '/crops/sesame.webp',
});

/**
 * Tracks which images actually exist in /public/crops at build time.
 * The CropImage component still uses a runtime `onError` fallback,
 * but this set lets us cheaply answer "is the asset expected to
 * resolve?" without a network round-trip — useful for tests.
 *
 * Update this set when you drop a new webp into /public/crops.
 * (The `_placeholder.svg` is always available.)
 */
export const AVAILABLE_CROP_IMAGES = Object.freeze(new Set([
  // Seed with the placeholder only; real images land as they're
  // optimised + committed. An entry listed in CROP_IMAGE_PATHS but
  // missing from this set still renders — the browser falls back via
  // the component's onError handler.
]));

/**
 * getCropImagePath — resolve a crop key to an image URL, or null
 * when the catalog has no mapping. Accepts:
 *   - canonical lowercase ('maize', 'sweet_potato')
 *   - storage uppercase   ('MAIZE', 'SWEET_POTATO')
 *   - display string      ('Maize', 'Sweet Potato')
 *   - structured "other"  ('OTHER:Teff') → null (use placeholder)
 *
 * Returns null when no mapping exists OR when the input is empty.
 * The caller's CropImage component turns `null` into the generic
 * placeholder so the UI never shows a broken image.
 */
export function getCropImagePath(cropKey) {
  const normalised = normalizeCrop(cropKey);   // lowercase canonical
  if (!normalised) return null;
  return CROP_IMAGE_PATHS[normalised] || null;
}

/**
 * hasCropImage — quick lookup, useful for tests + analytics. True
 * when a mapping exists in CROP_IMAGE_PATHS (not whether the asset
 * is physically on disk — that's AVAILABLE_CROP_IMAGES).
 */
export function hasCropImage(cropKey) {
  return getCropImagePath(cropKey) !== null;
}

export const _internal = Object.freeze({ CROP_IMAGE_PATHS, AVAILABLE_CROP_IMAGES });
