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
// Canonical crop → image path. 14 crops ship real illustration SVGs
// under /public/crops today (consistent style: dark radial gradient
// + crop-specific silhouette). Rows still pointing at .webp will
// gracefully fall back to _placeholder.svg until the real photo
// lands — swap the extension to .webp once the asset is dropped in.
export const CROP_IMAGE_PATHS = Object.freeze({
  // Staples + grains
  maize:          '/crops/maize.svg',
  corn:           '/crops/maize.svg',        // synonym
  rice:           '/crops/rice.svg',
  wheat:          '/crops/wheat.webp',
  sorghum:        '/crops/sorghum.webp',
  millet:         '/crops/millet.webp',
  barley:         '/crops/barley.webp',
  // Roots + tubers
  cassava:        '/crops/cassava.svg',
  yam:            '/crops/yam.webp',
  potato:         '/crops/potato.svg',
  'sweet-potato': '/crops/sweet-potato.svg',
  sweet_potato:   '/crops/sweet-potato.svg',  // underscore variant
  sweetpotato:    '/crops/sweet-potato.svg',  // no-separator variant
  // Legumes
  beans:          '/crops/beans.webp',
  bean:           '/crops/beans.webp',
  soybean:        '/crops/soybean.webp',
  groundnut:      '/crops/groundnut.svg',
  peanut:         '/crops/groundnut.svg',
  cowpea:         '/crops/cowpea.webp',
  chickpea:       '/crops/chickpea.webp',
  lentil:         '/crops/lentil.webp',
  // Vegetables
  tomato:         '/crops/tomato.svg',
  onion:          '/crops/onion.svg',
  pepper:         '/crops/pepper.svg',
  chili:          '/crops/pepper.svg',
  cabbage:        '/crops/cabbage.webp',
  carrot:         '/crops/carrot.webp',
  okra:           '/crops/okra.svg',
  cucumber:       '/crops/cucumber.webp',
  watermelon:     '/crops/watermelon.webp',
  eggplant:       '/crops/eggplant.webp',
  aubergine:      '/crops/eggplant.webp',   // UK synonym
  garlic:         '/crops/garlic.webp',
  ginger:         '/crops/ginger.webp',
  lettuce:        '/crops/lettuce.webp',
  spinach:        '/crops/spinach.webp',
  // Tree + permanent
  banana:         '/crops/banana.svg',
  plantain:       '/crops/plantain.svg',
  mango:          '/crops/mango.svg',
  avocado:        '/crops/avocado.webp',
  orange:         '/crops/orange.webp',
  coffee:         '/crops/coffee.webp',
  tea:            '/crops/tea.webp',
  cocoa:          '/crops/cocoa.svg',
  cacao:          '/crops/cocoa.svg',        // synonym
  'oil-palm':     '/crops/oil-palm.webp',
  oil_palm:       '/crops/oil-palm.webp',    // underscore variant
  oilpalm:        '/crops/oil-palm.webp',    // no-separator variant
  palm:           '/crops/oil-palm.webp',    // shorthand
  cotton:         '/crops/cotton.webp',
  sugarcane:      '/crops/sugarcane.webp',
  sunflower:      '/crops/sunflower.webp',
  sesame:         '/crops/sesame.webp',
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
 *   - canonical lowercase  ('maize', 'sweet-potato', 'sweet_potato')
 *   - storage uppercase    ('MAIZE', 'SWEET-POTATO')
 *   - display string       ('Maize', 'Sweet Potato', 'Oil Palm')
 *   - structured "other"   ('OTHER:Teff') → null (use placeholder)
 *
 * Hyphen + underscore + space forms all collapse to the same row:
 *   'sweet-potato' === 'sweet_potato' === 'Sweet Potato' === 'SWEETPOTATO'
 *
 * Returns null when no mapping exists OR when the input is empty.
 * The caller's CropImage component turns `null` into the generic
 * placeholder so the UI never shows a broken image.
 */
export function getCropImagePath(cropKey) {
  const raw = String(cropKey || '').trim().toLowerCase();
  if (!raw) return null;

  // Try the exact lowercase form first (handles 'sweet-potato' /
  // 'oil-palm' / 'sweet_potato' verbatim).
  if (CROP_IMAGE_PATHS[raw]) return CROP_IMAGE_PATHS[raw];

  // Collapse any separator (space / hyphen / underscore) to try both
  // canonical shapes without listing every permutation in the table.
  const hyphenated  = raw.replace(/[\s_]+/g, '-');
  if (CROP_IMAGE_PATHS[hyphenated]) return CROP_IMAGE_PATHS[hyphenated];
  const underscored = raw.replace(/[\s-]+/g, '_');
  if (CROP_IMAGE_PATHS[underscored]) return CROP_IMAGE_PATHS[underscored];

  // Fall back to the legacy normalizeCrop path (handles uppercase
  // storage codes + OTHER:… structured values).
  const normalised = normalizeCrop(cropKey);
  if (normalised && CROP_IMAGE_PATHS[normalised]) return CROP_IMAGE_PATHS[normalised];

  return null;
}

/**
 * getCropImage — alias for getCropImagePath that always returns a
 * usable URL. Missing mappings resolve to the placeholder so callers
 * who don't want to branch on null can drop the result straight into
 * an <img src>.
 *
 *   getCropImage('maize')        → '/crops/maize.webp'
 *   getCropImage('dragonfruit')  → '/crops/_placeholder.svg'
 */
export function getCropImage(cropKey) {
  return getCropImagePath(cropKey) || CROP_IMAGE_PLACEHOLDER;
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
