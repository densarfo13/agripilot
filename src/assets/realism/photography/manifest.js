/**
 * realism/photography/manifest — typed slot catalogue.
 *
 * MAY 2026 REALISM MIGRATION — HONEST DISCLOSURE
 *
 * The Farroway code agent that staged this directory CANNOT
 * create or fetch documentary-grade agricultural photography.
 * Real photos require a production photo shoot (real crops,
 * real farms, real soil, real produce) under a content-team
 * brief with budget + licensing.
 *
 * What this manifest ships:
 *   • A frozen catalogue of every photo slot the UI is ready
 *     to render once production assets arrive.
 *   • A `slotPath()` helper that returns the canonical
 *     `src/assets/realism/photography/<slot>.webp` path.
 *   • A `<RealisticPhoto>` consumer (see ./RealisticPhoto.jsx)
 *     that renders a calm ochre-tinted placeholder when the
 *     slot is empty — never a broken image, never a 404.
 *
 * When real photos are commissioned, drop them at the path
 * below and the UI picks them up automatically. No code
 * changes needed.
 */

export const PHOTO_SLOTS = Object.freeze({
  // ─── Hero / atmospheric ─────────────────────────────────────
  HERO_DAYLIGHT_FIELD:    'hero-daylight-field',
  HERO_RAINY_FIELD:       'hero-rainy-field',
  HERO_SUNRISE_FIELD:     'hero-sunrise-field',
  HERO_DUSK_FIELD:        'hero-dusk-field',

  // ─── Crop close-ups (used by My Farm + Progress) ────────────
  CROP_MAIZE:             'crop-maize',
  CROP_RICE:              'crop-rice',
  CROP_CASSAVA:           'crop-cassava',
  CROP_TOMATO:            'crop-tomato',
  CROP_PEPPER:            'crop-pepper',
  CROP_COCOA:             'crop-cocoa',
  CROP_YAM:               'crop-yam',
  CROP_PLANTAIN:          'crop-plantain',

  // ─── Soil close-ups (used by Soil Scan) ─────────────────────
  SOIL_DRY_LOAM:          'soil-dry-loam',
  SOIL_MOIST_LOAM:        'soil-moist-loam',
  SOIL_CLAY_DARK:         'soil-clay-dark',

  // ─── Marketplace / produce thumbnails (used by Sell) ────────
  PRODUCE_BASKET_TOMATO:  'produce-basket-tomato',
  PRODUCE_BASKET_MAIZE:   'produce-basket-maize',
  PRODUCE_BASKET_PEPPER:  'produce-basket-pepper',

  // ─── Funding institutional context (calm desk / paper) ──────
  FUNDING_DESK_PAPERWORK: 'funding-desk-paperwork',
  FUNDING_DOC_STAMP:      'funding-doc-stamp',
});

export const PHOTO_SLOT_LIST = Object.freeze(Object.values(PHOTO_SLOTS));

/**
 * Canonical file path for a slot. Caller appends `.webp` (the
 * preferred format — modern browsers + ~30% smaller than JPEG).
 *
 * @param {string} slot
 * @returns {string}
 */
export function slotPath(slot) {
  if (!slot || typeof slot !== 'string') return '';
  // Slot names are kebab-case; reject anything else so a typo
  // can't escape the filesystem boundary.
  const safe = slot.match(/^[a-z0-9-]+$/) ? slot : '';
  return safe ? `/assets/realism/photography/${safe}.webp` : '';
}

const _module = { PHOTO_SLOTS, PHOTO_SLOT_LIST, slotPath };
export default _module;
