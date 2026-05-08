/**
 * regionProfiles.js — country/region profile registry.
 *
 * Each profile carries the climate, language preferences, common
 * crops, season pattern, and guidance modifier hints the
 * intelligence layer (regionIntelligence.js) consumes.
 *
 * Strict-rule audit
 *   • Pure data module — no I/O, no React.
 *   • Frozen objects — callers cannot corrupt the registry.
 *   • Approximations only — confidence-safe ("rainy season is
 *     roughly Mar-Oct"), never overclaiming exact local agronomy.
 *   • UNKNOWN profile = canonical fallback.
 *
 * Lookup contract:
 *   getProfile('GH')   → GHANA profile
 *   getProfile('xx')   → UNKNOWN profile (never null/throws)
 *   Codes: ISO-3166-1 alpha-2 (case-insensitive).
 */

// ─── Climate / season vocabulary ─────────────────────────────────
//
// Months are 1-12 (matches `new Date().getMonth() + 1`).
// rainyMonths / dryMonths are inclusive arrays — overlap is legal
// (a transitional month can belong to both with `confidence: 'low'`).

const NORTHERN_HEMISPHERE_FROST = Object.freeze([11, 12, 1, 2, 3]);
const NORTHERN_HEMISPHERE_HEAT  = Object.freeze([6, 7, 8]);

// ─── Country profiles (spec §2) ──────────────────────────────────

/** Ghana — tropical, rainy/dry/Harmattan pattern. */
const GHANA = Object.freeze({
  countryCode:        'GH',
  countryName:        'Ghana',
  climateZone:        'tropical',
  preferredLanguages: Object.freeze(['en', 'tw', 'ha']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops: Object.freeze([
    'maize', 'cassava', 'tomato', 'pepper', 'okra', 'plantain', 'yam',
    'cocoa', 'rice', 'onion',
  ]),
  // Approximate seasonal calendar — confidence-safe.
  rainyMonths:    Object.freeze([3, 4, 5, 6, 7, 9, 10]),
  dryMonths:      Object.freeze([11, 12, 1, 2]),
  harmattanMonths: Object.freeze([12, 1, 2]),  // dry, dusty trade winds
  frostMonths:    Object.freeze([]),            // no frost
  heatMonths:     Object.freeze([2, 3, 4]),
  // Guidance modifier tags — referenced by regionIntelligence
  // when constructing the insight. Each tag maps to a translation
  // key in regionTranslations.js.
  guidanceTags:   Object.freeze([
    'rainySeason', 'drySeason', 'harmattan', 'heat',
  ]),
});

/** Nigeria — tropical, similar to Ghana but pushed slightly north. */
const NIGERIA = Object.freeze({
  countryCode:        'NG',
  countryName:        'Nigeria',
  climateZone:        'tropical',
  preferredLanguages: Object.freeze(['en', 'ha']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops: Object.freeze([
    'maize', 'cassava', 'rice', 'yam', 'tomato', 'pepper', 'okra',
    'sorghum', 'millet', 'onion', 'cocoa',
  ]),
  rainyMonths:    Object.freeze([4, 5, 6, 7, 8, 9, 10]),
  dryMonths:      Object.freeze([11, 12, 1, 2, 3]),
  harmattanMonths: Object.freeze([12, 1, 2]),
  frostMonths:    Object.freeze([]),
  heatMonths:     Object.freeze([2, 3, 4]),
  guidanceTags:   Object.freeze([
    'rainySeason', 'drySeason', 'harmattan', 'heat', 'flooding',
  ]),
});

/** India — tropical / subtropical, monsoon-driven. */
const INDIA = Object.freeze({
  countryCode:        'IN',
  countryName:        'India',
  climateZone:        'tropical-subtropical',
  preferredLanguages: Object.freeze(['hi', 'en']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops: Object.freeze([
    'rice', 'wheat', 'tomato', 'onion', 'pepper', 'okra',
    'mustard', 'lentil', 'cabbage', 'spinach',
  ]),
  rainyMonths:    Object.freeze([6, 7, 8, 9]),  // SW monsoon (most of country)
  dryMonths:      Object.freeze([2, 3, 4, 5]),
  harmattanMonths: Object.freeze([]),
  frostMonths:    Object.freeze([12, 1]),       // northern India only — confidence: 'low'
  heatMonths:     Object.freeze([4, 5, 6]),
  guidanceTags:   Object.freeze([
    'monsoon', 'heat', 'drySeason', 'containerCare',
  ]),
});

/** United States — temperate, frost-bearing, garden-mode bias. */
const UNITED_STATES = Object.freeze({
  countryCode:        'US',
  countryName:        'United States',
  climateZone:        'temperate',
  preferredLanguages: Object.freeze(['en']),
  defaultUnits:       Object.freeze({
    temperature: 'F',           // °F default
    area:        'acre',        // farm
    weight:      'kg',          // produce listings still use kg for consistency
    gardenArea:  'sqft',        // garden mode
  }),
  commonCrops: Object.freeze([
    'tomato', 'pepper', 'corn', 'lettuce', 'spinach',
    'beans', 'onion', 'cabbage', 'cucumber', 'basil',
  ]),
  rainyMonths:    Object.freeze([4, 5, 6]),
  dryMonths:      Object.freeze([7, 8]),
  harmattanMonths: Object.freeze([]),
  frostMonths:    NORTHERN_HEMISPHERE_FROST,
  heatMonths:     NORTHERN_HEMISPHERE_HEAT,
  guidanceTags:   Object.freeze([
    'frost', 'heat', 'gardenContainer',
  ]),
});

/** Kenya / East Africa — tropical, bimodal rains, altitude variation. */
const KENYA = Object.freeze({
  countryCode:        'KE',
  countryName:        'Kenya',
  climateZone:        'tropical-highland',
  preferredLanguages: Object.freeze(['en', 'sw']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops: Object.freeze([
    'maize', 'beans', 'tomato', 'spinach', 'potato',
    'cabbage', 'onion', 'kale', 'lettuce',
  ]),
  // Bimodal: long rains Mar-May; short rains Oct-Dec.
  rainyMonths:    Object.freeze([3, 4, 5, 10, 11, 12]),
  dryMonths:      Object.freeze([1, 2, 6, 7, 8, 9]),
  harmattanMonths: Object.freeze([]),
  frostMonths:    Object.freeze([6, 7]),        // highland only — confidence: 'low'
  heatMonths:     Object.freeze([1, 2]),
  guidanceTags:   Object.freeze([
    'rainySeason', 'drySeason', 'altitudeFrost',
  ]),
});

/** France — temperate, four-season, frost-bearing. */
const FRANCE = Object.freeze({
  countryCode:        'FR',
  countryName:        'France',
  climateZone:        'temperate',
  preferredLanguages: Object.freeze(['fr']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops: Object.freeze([
    'tomato', 'onion', 'potato', 'lettuce', 'spinach',
    'beans', 'cucumber', 'cabbage', 'basil',
  ]),
  rainyMonths:    Object.freeze([10, 11, 12, 1]),
  dryMonths:      Object.freeze([7, 8]),
  harmattanMonths: Object.freeze([]),
  frostMonths:    NORTHERN_HEMISPHERE_FROST,
  heatMonths:     NORTHERN_HEMISPHERE_HEAT,
  guidanceTags:   Object.freeze([
    'frost', 'heat', 'temperateSeasons',
  ]),
});

/** UNKNOWN — canonical fallback profile. Never throws. */
const UNKNOWN = Object.freeze({
  countryCode:        'XX',
  countryName:        'Your area',
  climateZone:        'unknown',
  preferredLanguages: Object.freeze(['en']),
  defaultUnits:       Object.freeze({
    temperature: 'C',
    area:        'hectare',
    weight:      'kg',
  }),
  commonCrops:    Object.freeze([]),
  rainyMonths:    Object.freeze([]),
  dryMonths:      Object.freeze([]),
  harmattanMonths: Object.freeze([]),
  frostMonths:    Object.freeze([]),
  heatMonths:     Object.freeze([]),
  guidanceTags:   Object.freeze([]),
});

// ─── Registry ─────────────────────────────────────────────────────

const REGISTRY = Object.freeze({
  GH: GHANA,
  NG: NIGERIA,
  IN: INDIA,
  US: UNITED_STATES,
  KE: KENYA,
  FR: FRANCE,
});

// ─── Public API ──────────────────────────────────────────────────

/**
 * getProfile(countryCode) → CountryProfile
 *
 * Returns the matching profile or UNKNOWN. Never throws.
 *
 * @param {string|null|undefined} countryCode  ISO-3166-1 alpha-2
 */
export function getProfile(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return UNKNOWN;
  const code = countryCode.trim().toUpperCase();
  return REGISTRY[code] || UNKNOWN;
}

/**
 * isKnownCountry(countryCode) — boolean test.
 */
export function isKnownCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(REGISTRY, countryCode.trim().toUpperCase());
}

/**
 * getAllProfiles() — array of all six known profiles + UNKNOWN.
 * Useful for dev / settings surfaces that show available regions.
 */
export function getAllProfiles() {
  return Object.freeze([...Object.values(REGISTRY), UNKNOWN]);
}

// ─── Test surface ─────────────────────────────────────────────────
export const PROFILES = REGISTRY;
export { GHANA, NIGERIA, INDIA, UNITED_STATES, KENYA, FRANCE, UNKNOWN };
export default getProfile;
