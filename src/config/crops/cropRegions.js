/**
 * cropRegions.js — regional relevance hooks for the crop registry.
 *
 * This is intentionally LIGHT in v1. Country-level overrides live in
 * cropYieldRanges + cropSeasonalGuidance; this module only provides
 * coarse region tags ('africa', 'asia', 'latam', 'europe', 'north-
 * america', 'global') so the crop picker can prioritise crops that
 * make sense for the user's country.
 *
 * Shape:
 *   CROP_REGIONS[canonicalKey] = ['africa', 'global']
 *   COUNTRY_REGIONS[countryCode] = 'africa'
 *
 * Helpers:
 *   getCropRegions(cropKey)            → string[] | []
 *   getRegionForCountry(countryCode)   → regionId | null
 *   getCropsForRegion(regionId, {limit?, pool?})  → canonical keys
 *   cropIsRelevantToRegion(cropKey, regionId)     → boolean
 *
 * Not in scope for v1
 *   • Detailed agro-ecological zones (highland vs lowland, humid vs arid)
 *   • Per-variety adaptation
 *   • Pest/disease pressure maps
 *   These belong in later data packs — don't over-model here.
 */

const f = Object.freeze;

export const REGION_IDS = f([
  'africa',
  'asia',
  'latam',
  'europe',
  'north-america',
  'oceania',
  'global',
]);

/**
 * Country → region id. ISO-3166 alpha-2 codes. Missing entries fall
 * back to 'global' so the picker still shows a sensible catalogue.
 * We only list the countries we actively have farmers in — adding a
 * new one is a single-row change.
 */
export const COUNTRY_REGIONS = f({
  // Africa
  GH: 'africa', NG: 'africa', KE: 'africa', TZ: 'africa', UG: 'africa',
  ET: 'africa', RW: 'africa', ZM: 'africa', ZW: 'africa', MW: 'africa',
  CI: 'africa', SN: 'africa', BF: 'africa', ML: 'africa', NE: 'africa',
  CM: 'africa', BJ: 'africa', TG: 'africa', SL: 'africa', LR: 'africa',
  GN: 'africa', MZ: 'africa', AO: 'africa', ZA: 'africa', SD: 'africa',
  SS: 'africa', EG: 'africa', MA: 'africa', DZ: 'africa', TN: 'africa',
  LY: 'africa', MG: 'africa',
  // Asia
  IN: 'asia', PK: 'asia', BD: 'asia', LK: 'asia', NP: 'asia', MM: 'asia',
  TH: 'asia', VN: 'asia', ID: 'asia', PH: 'asia', MY: 'asia', CN: 'asia',
  JP: 'asia', KR: 'asia',
  // Latin America + Caribbean
  BR: 'latam', AR: 'latam', MX: 'latam', CO: 'latam', PE: 'latam',
  EC: 'latam', BO: 'latam', GT: 'latam', HN: 'latam', NI: 'latam',
  CR: 'latam', PA: 'latam', CU: 'latam', DO: 'latam', HT: 'latam',
  // Europe
  GB: 'europe', FR: 'europe', DE: 'europe', IT: 'europe', ES: 'europe',
  PT: 'europe', NL: 'europe', BE: 'europe', PL: 'europe', UA: 'europe',
  RO: 'europe', GR: 'europe',
  // North America
  US: 'north-america', CA: 'north-america',
  // Oceania
  AU: 'oceania', NZ: 'oceania', PG: 'oceania',
});

/**
 * Canonical crop → relevance regions. A crop tagged 'global' shows up
 * everywhere; additional tags bump it up the picker for that region.
 *
 * Keep tags generous — the picker uses this to prioritise, never to
 * hide. A farmer who WANTS to plant coffee in Europe should still be
 * able to.
 */
export const CROP_REGIONS = f({
  // Staples + grains
  maize:          f(['africa', 'latam', 'asia', 'north-america', 'europe', 'global']),
  rice:           f(['asia', 'africa', 'latam', 'global']),
  wheat:          f(['asia', 'europe', 'north-america', 'africa', 'global']),
  sorghum:        f(['africa', 'asia', 'latam']),
  millet:         f(['africa', 'asia']),

  // Roots + tubers
  cassava:        f(['africa', 'latam', 'asia']),
  yam:            f(['africa', 'latam']),
  potato:         f(['europe', 'asia', 'north-america', 'africa', 'latam', 'global']),
  'sweet-potato': f(['africa', 'asia', 'latam', 'global']),

  // Legumes
  beans:          f(['africa', 'latam', 'asia', 'global']),
  soybean:        f(['latam', 'north-america', 'asia', 'africa', 'global']),
  groundnut:      f(['africa', 'asia', 'latam']),
  cowpea:         f(['africa', 'asia']),
  chickpea:       f(['asia', 'africa', 'europe']),
  lentil:         f(['asia', 'europe', 'africa']),

  // Vegetables
  tomato:         f(['global', 'africa', 'asia', 'latam', 'europe', 'north-america']),
  onion:          f(['global', 'africa', 'asia']),
  pepper:         f(['global', 'africa', 'asia', 'latam']),
  cabbage:        f(['global', 'asia', 'europe', 'africa']),
  carrot:         f(['global', 'europe', 'north-america', 'africa', 'asia']),
  okra:           f(['africa', 'asia']),
  cucumber:       f(['global', 'asia', 'europe']),
  eggplant:       f(['africa', 'asia', 'global']),
  watermelon:     f(['africa', 'asia', 'latam', 'global']),
  spinach:        f(['global', 'asia', 'europe']),
  lettuce:        f(['global', 'europe', 'north-america']),
  garlic:         f(['global', 'asia', 'europe']),
  ginger:         f(['asia', 'africa', 'global']),

  // Fruit / tree
  banana:         f(['africa', 'asia', 'latam', 'global']),
  plantain:       f(['africa', 'latam']),
  mango:          f(['africa', 'asia', 'latam']),
  orange:         f(['africa', 'asia', 'latam', 'europe', 'north-america', 'global']),
  avocado:        f(['latam', 'africa', 'north-america']),

  // Cash / tree crops
  cocoa:          f(['africa', 'latam']),
  coffee:         f(['africa', 'latam', 'asia']),
  cotton:         f(['asia', 'africa', 'north-america']),
  sugarcane:      f(['latam', 'asia', 'africa']),
  'oil-palm':     f(['africa', 'asia']),
  sunflower:      f(['europe', 'north-america', 'asia', 'africa']),
  sesame:         f(['africa', 'asia']),
  tea:            f(['asia', 'africa']),
});

/**
 * getCropRegions(cropKey) — returns the frozen tag list (may be []).
 */
export function getCropRegions(cropKey) {
  if (!cropKey) return Object.freeze([]);
  return CROP_REGIONS[cropKey] || Object.freeze([]);
}

/**
 * getRegionForCountry(countryCode) — regionId or null.
 */
export function getRegionForCountry(countryCode) {
  if (!countryCode) return null;
  return COUNTRY_REGIONS[String(countryCode).toUpperCase()] || null;
}

/**
 * cropIsRelevantToRegion(cropKey, regionId) — treats 'global'-tagged
 * crops as relevant everywhere. Used by the picker to decide
 * visibility, not to hide.
 */
export function cropIsRelevantToRegion(cropKey, regionId) {
  if (!regionId) return true;                    // null region → show everything
  const tags = getCropRegions(cropKey);
  if (!tags || tags.length === 0) return true;   // no data → show (don't hide)
  return tags.includes(regionId) || tags.includes('global');
}

/**
 * getCropsForRegion(regionId, { pool, limit })
 *   Returns canonical crop keys relevant to the region, in the same
 *   order as the supplied `pool` (or the full CROP_REGIONS table
 *   when pool is omitted). Purely a filter — no ranking magic.
 */
export function getCropsForRegion(regionId, { pool = null, limit = null } = {}) {
  const source = pool || Object.keys(CROP_REGIONS);
  const out = [];
  for (const key of source) {
    if (cropIsRelevantToRegion(key, regionId)) {
      out.push(key);
      if (limit && out.length >= limit) break;
    }
  }
  return Object.freeze(out);
}

export const _internal = Object.freeze({ CROP_REGIONS, COUNTRY_REGIONS });
