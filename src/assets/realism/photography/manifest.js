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
  HERO_SUNSET_FIELD:      'hero-sunset-field',
  HERO_NIGHT_FIELD:       'hero-night-field',
  HERO_CLOUDY_FIELD:      'hero-cloudy-field',
  HERO_PARTLY_CLOUDY:     'hero-partly-cloudy',
  HERO_STORM_FIELD:       'hero-storm-field',
  HERO_FOG_FIELD:         'hero-fog-field',

  // ─── Region-aware farm scenes (climate-cluster level) ───────
  // Real photo shoot drops the production webp at:
  //   /assets/realism/photography/<slot>.webp
  // and the resolver picks them up automatically.
  HERO_TROPICAL_DAYLIGHT: 'hero-tropical-daylight',
  HERO_TROPICAL_RAIN:     'hero-tropical-rain',
  HERO_MONSOON_RAIN:      'hero-monsoon-rain',
  HERO_MONSOON_DAYLIGHT:  'hero-monsoon-daylight',
  HERO_TEMPERATE_DAYLIGHT:'hero-temperate-daylight',
  HERO_TEMPERATE_SUNRISE: 'hero-temperate-sunrise',
  HERO_ARID_DAYLIGHT:     'hero-arid-daylight',
  HERO_ARID_SUNSET:       'hero-arid-sunset',
  HERO_HIGHLAND_DAYLIGHT: 'hero-highland-daylight',

  // ─── Garden-mode scenes (small-scale + container) ───────────
  HERO_GARDEN_DAYLIGHT:   'hero-garden-daylight',
  HERO_GARDEN_RAINY:      'hero-garden-rainy',
  HERO_GARDEN_SUNRISE:    'hero-garden-sunrise',
  HERO_GARDEN_DUSK:       'hero-garden-dusk',
  HERO_GARDEN_NIGHT:      'hero-garden-night',
  HERO_GARDEN_BALCONY:    'hero-garden-balcony',
  HERO_GARDEN_BACKYARD:   'hero-garden-backyard',
  HERO_GARDEN_INDOOR:     'hero-garden-indoor',

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
