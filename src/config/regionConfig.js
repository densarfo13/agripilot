/**
 * regionConfig.js — single source of truth for country-level
 * Farroway behaviour. Every UI surface that needs to adapt
 * reads through here so we never sprinkle `if country ===`
 * checks across components.
 *
 * Data shapes (JSDoc — codebase is JS, spec uses TS):
 *
 *   @typedef {'farm' | 'backyard' | 'mixed'} RegionExperience
 *
 *   @typedef {Object} RegionConfig
 *   @property {string}        country
 *   @property {1|2|3|4}       launchWave
 *   @property {'active'|'beta'|'planned'} status
 *   @property {string}        defaultLanguage
 *   @property {string[]}      languages
 *   @property {string[]}      defaultCrops
 *   @property {string[]}      farmTypes
 *   @property {RegionExperience} experience
 *   @property {string[]}      weatherFocus
 *   @property {string[]}      marketFocus
 *   @property {string}        currency
 *   @property {'metric'|'imperial'|'mixed'} measurementSystem
 *   @property {boolean}       enableSellFlow
 *   @property {boolean}       enableBackyardMode
 *   @property {boolean}       enableNgoReporting
 *
 * Strict-rule audit
 *   • Pure data + read-only helpers. No I/O, no React.
 *   • DEFAULT_REGION_CONFIG covers every unknown country so
 *     Farroway never crashes on a new market.
 *   • Status flags (`active` / `beta` / `planned`) are the
 *     ONLY way a region becomes user-facing — UI surfaces
 *     check `isRegionActive()` before flipping behaviour.
 */

export const DEFAULT_REGION_CONFIG = Object.freeze({
  country: 'Default',
  launchWave: 1,
  status: 'active',
  defaultLanguage: 'en',
  languages: ['en'],
  defaultCrops: ['maize', 'tomato', 'pepper', 'onion', 'okra'],
  farmTypes: ['small_farm'],
  experience: 'farm',
  weatherFocus: ['rainfall', 'temperature'],
  marketFocus: ['local_market'],
  currency: 'USD',
  measurementSystem: 'metric',
  enableSellFlow: true,
  enableBackyardMode: false,
  enableNgoReporting: false,
});

export const REGION_CONFIG = Object.freeze({
  Ghana: Object.freeze({
    country: 'Ghana',
    launchWave: 1,
    status: 'active',
    defaultLanguage: 'en',
    languages: ['en', 'tw', 'ha'],
    defaultCrops: ['maize', 'okra', 'pepper', 'cassava', 'yam', 'tomato', 'onion', 'ginger'],
    farmTypes: ['small_farm', 'community_farm', 'ngo_program'],
    experience: 'farm',
    weatherFocus: ['rainfall', 'humidity', 'heat'],
    marketFocus: ['local_market', 'buyer_matching'],
    currency: 'GHS',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
  'United States': Object.freeze({
    country: 'United States',
    launchWave: 1,
    status: 'active',
    defaultLanguage: 'en',
    languages: ['en', 'es'],
    defaultCrops: ['tomato', 'lettuce', 'pepper', 'herbs', 'corn', 'cucumber'],
    farmTypes: ['backyard', 'home_garden', 'small_farm', 'large_farm'],
    experience: 'backyard',
    weatherFocus: ['temperature', 'frost', 'heat', 'rainfall'],
    marketFocus: ['home_garden', 'local_sale'],
    currency: 'USD',
    measurementSystem: 'imperial',
    enableSellFlow: false,
    enableBackyardMode: true,
    enableNgoReporting: false,
  }),
  Nigeria: Object.freeze({
    country: 'Nigeria',
    launchWave: 2,
    status: 'beta',
    defaultLanguage: 'en',
    languages: ['en', 'ha'],
    defaultCrops: ['maize', 'cassava', 'yam', 'tomato', 'pepper', 'okra', 'onion'],
    farmTypes: ['small_farm', 'community_farm', 'ngo_program'],
    experience: 'farm',
    weatherFocus: ['rainfall', 'humidity', 'heat'],
    marketFocus: ['local_market', 'buyer_matching'],
    currency: 'NGN',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
  Kenya: Object.freeze({
    country: 'Kenya',
    launchWave: 2,
    status: 'planned',
    defaultLanguage: 'en',
    languages: ['en', 'sw'],
    defaultCrops: ['maize', 'tomato', 'beans', 'potato', 'kale', 'onion'],
    farmTypes: ['small_farm', 'community_farm', 'ngo_program'],
    experience: 'farm',
    weatherFocus: ['rainfall', 'drought', 'humidity'],
    marketFocus: ['local_market', 'buyer_matching'],
    currency: 'KES',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
  India: Object.freeze({
    country: 'India',
    launchWave: 3,
    status: 'planned',
    defaultLanguage: 'hi',
    languages: ['hi', 'en'],
    defaultCrops: ['rice', 'wheat', 'maize', 'tomato', 'onion', 'pepper'],
    farmTypes: ['small_farm', 'community_farm'],
    experience: 'farm',
    weatherFocus: ['monsoon', 'heat', 'rainfall'],
    marketFocus: ['local_market', 'government_market'],
    currency: 'INR',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
  Philippines: Object.freeze({
    country: 'Philippines',
    launchWave: 3,
    status: 'planned',
    defaultLanguage: 'en',
    languages: ['en', 'tl'],
    defaultCrops: ['rice', 'corn', 'coconut', 'banana', 'tomato', 'pepper'],
    farmTypes: ['small_farm', 'community_farm'],
    experience: 'farm',
    weatherFocus: ['rainfall', 'typhoon', 'humidity'],
    marketFocus: ['local_market'],
    currency: 'PHP',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
  Brazil: Object.freeze({
    country: 'Brazil',
    launchWave: 4,
    status: 'planned',
    defaultLanguage: 'pt',
    languages: ['pt', 'en'],
    defaultCrops: ['soybean', 'maize', 'coffee', 'cassava', 'tomato'],
    farmTypes: ['small_farm', 'large_farm'],
    experience: 'mixed',
    weatherFocus: ['rainfall', 'heat', 'humidity'],
    marketFocus: ['local_market', 'export_market'],
    currency: 'BRL',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: false,
  }),
  Mexico: Object.freeze({
    country: 'Mexico',
    launchWave: 4,
    status: 'planned',
    defaultLanguage: 'es',
    languages: ['es', 'en'],
    defaultCrops: ['maize', 'tomato', 'pepper', 'beans', 'avocado'],
    farmTypes: ['small_farm', 'home_garden', 'large_farm'],
    experience: 'mixed',
    weatherFocus: ['rainfall', 'heat', 'drought'],
    marketFocus: ['local_market', 'export_market'],
    currency: 'MXN',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: true,
    enableNgoReporting: false,
  }),
  Indonesia: Object.freeze({
    country: 'Indonesia',
    launchWave: 4,
    status: 'planned',
    defaultLanguage: 'id',
    languages: ['id', 'en'],
    defaultCrops: ['rice', 'corn', 'chili', 'cassava', 'banana'],
    farmTypes: ['small_farm', 'community_farm'],
    experience: 'farm',
    weatherFocus: ['rainfall', 'humidity', 'flood'],
    marketFocus: ['local_market'],
    currency: 'IDR',
    measurementSystem: 'metric',
    enableSellFlow: true,
    enableBackyardMode: false,
    enableNgoReporting: true,
  }),
});

// ── Public read API ──────────────────────────────────────────

/**
 * getRegionConfig — never returns null. Unknown country →
 * DEFAULT_REGION_CONFIG so callers always get a usable shape.
 */
export function getRegionConfig(country) {
  if (!country) return DEFAULT_REGION_CONFIG;
  return REGION_CONFIG[country] || DEFAULT_REGION_CONFIG;
}

/**
 * isRegionActive — true for `active` and `beta`, false for
 * `planned`. UI flips that change behaviour by country MUST
 * gate on this so planned markets stay safe-default.
 */
export function isRegionActive(country) {
  const config = getRegionConfig(country);
  return config.status === 'active' || config.status === 'beta';
}

export function getRegionLanguages(country) {
  return getRegionConfig(country).languages;
}

export function getRegionCrops(country) {
  return getRegionConfig(country).defaultCrops;
}

export function getRegionExperience(country) {
  return getRegionConfig(country).experience;
}

export function getRegionWeatherFocus(country) {
  return getRegionConfig(country).weatherFocus;
}

export function getRegionMeasurementSystem(country) {
  return getRegionConfig(country).measurementSystem;
}

/**
 * shouldUseBackyardExperience — gates the U.S. garden flow.
 * Both the region must allow backyard mode AND the farmer's
 * declared farm type must be a backyard / home garden one.
 *
 * For Mexico (mixed experience with enableBackyardMode:true)
 * this also returns true when the farmer chose home_garden.
 */
export function shouldUseBackyardExperience(country, farmType) {
  const config = getRegionConfig(country);
  if (!config.enableBackyardMode) return false;
  return ['backyard', 'home_garden'].includes(String(farmType || ''));
}

/**
 * Optional helper for surfaces that show country-aware copy
 * ("My Farm" vs "My Garden").
 */
export function effectiveExperience(country, farmType) {
  if (shouldUseBackyardExperience(country, farmType)) return 'backyard';
  return getRegionExperience(country);
}

// ── Listing helpers (admin) ──────────────────────────────────

export function listActiveRegions() {
  return Object.values(REGION_CONFIG).filter((c) => c.status === 'active');
}
export function listBetaRegions() {
  return Object.values(REGION_CONFIG).filter((c) => c.status === 'beta');
}
export function listPlannedRegions() {
  return Object.values(REGION_CONFIG).filter((c) => c.status === 'planned');
}
export function listAllRegions() {
  return Object.values(REGION_CONFIG);
}
