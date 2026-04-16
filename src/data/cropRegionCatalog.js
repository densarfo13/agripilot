/**
 * Crop Region Catalog — single source of truth for which crops grow where.
 *
 * Used by:
 *   - OnboardingWizard (top crop buttons grouped by country)
 *   - CropSelect (recommendation section)
 *   - NewFarmerRecommendation (country-aware suggestions)
 *   - cropRecommendations.js (getCountryRecommendedCodes)
 *
 * Each entry maps a crop code to:
 *   - countries: ISO 2-letter codes where this crop is commonly grown
 *   - regions: broader regional groupings
 *   - beginner: true if suitable for first-time farmers
 *   - goals: which farming goals this crop fits
 *   - priority: 1 = staple/very common, 2 = common, 3 = niche but valid
 */

// ─── Region definitions ─────────────────────────────────────
export const REGIONS = {
  east_africa: { countries: ['KE', 'TZ', 'UG', 'ET', 'RW', 'BI', 'SO'], labelKey: 'region.eastAfrica' },
  west_africa: { countries: ['NG', 'GH', 'SN', 'ML', 'CI', 'BF', 'NE', 'TG', 'BJ', 'GM', 'SL', 'LR', 'GN'], labelKey: 'region.westAfrica' },
  southern_africa: { countries: ['ZA', 'ZM', 'ZW', 'MW', 'MZ', 'BW', 'NA', 'LS', 'SZ'], labelKey: 'region.southernAfrica' },
  central_africa: { countries: ['CD', 'CM', 'CG', 'CF', 'GA', 'TD', 'GQ'], labelKey: 'region.centralAfrica' },
};

// ─── Catalog entries ─────────────────────────────────────────
export const CROP_REGION_CATALOG = [
  // ── Cereals & Grains ──
  { code: 'MAIZE',    countries: ['KE','TZ','UG','NG','GH','ET','ZA','ZM','MW','MZ','CM','ZW'], regions: ['east_africa','west_africa','southern_africa','central_africa'], beginner: true,  goals: ['home_food','local_sales','profit'], priority: 1 },
  { code: 'RICE',     countries: ['NG','TZ','GH','KE','UG','SN','ML','MZ','CM','ZA','ET'],       regions: ['west_africa','east_africa','southern_africa'],                   beginner: false, goals: ['home_food','profit'],               priority: 1 },
  { code: 'SORGHUM',  countries: ['NG','ET','TZ','KE','UG','GH','BF','NE','ZA','MW','ZM'],       regions: ['west_africa','east_africa','southern_africa'],                   beginner: true,  goals: ['home_food','local_sales'],           priority: 2 },
  { code: 'MILLET',   countries: ['NG','NE','ML','BF','ET','TZ','UG','KE','GH'],                  regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['home_food','local_sales'],           priority: 2 },
  { code: 'WHEAT',    countries: ['ET','KE','ZA','TZ','ZM','ZW','NG'],                            regions: ['east_africa','southern_africa'],                                 beginner: false, goals: ['profit','local_sales'],              priority: 2 },

  // ── Legumes & Pulses ──
  { code: 'BEAN',     countries: ['KE','TZ','UG','ET','RW','NG','GH','ZM','MW','CM'],             regions: ['east_africa','west_africa','southern_africa','central_africa'], beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'GROUNDNUT',countries: ['NG','GH','TZ','MW','ZM','UG','SN','ML','ZA','ET'],             regions: ['west_africa','east_africa','southern_africa'],                   beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'COWPEA',   countries: ['NG','NE','BF','GH','SN','ML','KE','TZ'],                       regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['home_food','local_sales'],           priority: 2 },
  { code: 'SOYBEAN',  countries: ['NG','ZA','ZM','MW','GH','TZ','UG'],                            regions: ['west_africa','southern_africa','east_africa'],                   beginner: false, goals: ['profit','local_sales'],              priority: 2 },
  { code: 'PEA',      countries: ['KE','ET','TZ','UG','ZA'],                                      regions: ['east_africa','southern_africa'],                                 beginner: true,  goals: ['home_food','local_sales'],           priority: 3 },

  // ── Root & Tuber Crops ──
  { code: 'CASSAVA',  countries: ['NG','GH','TZ','UG','CM','CD','MZ','MW','KE','CI'],             regions: ['west_africa','east_africa','central_africa','southern_africa'], beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'YAM',      countries: ['NG','GH','CI','BJ','TG','CM','ET'],                            regions: ['west_africa','central_africa'],                                  beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'SWEET_POTATO', countries: ['UG','TZ','KE','NG','GH','ET','MW','MZ','RW','ZA'],         regions: ['east_africa','west_africa','southern_africa'],                   beginner: true,  goals: ['home_food'],                         priority: 1 },
  { code: 'POTATO',   countries: ['KE','ET','ZA','TZ','UG','RW','NG','GH','CM'],                  regions: ['east_africa','southern_africa','west_africa'],                   beginner: false, goals: ['local_sales','profit'],              priority: 2 },

  // ── Vegetables ──
  { code: 'TOMATO',   countries: ['NG','KE','TZ','GH','ET','UG','ZA','CM','SN'],                  regions: ['west_africa','east_africa','southern_africa'],                   beginner: false, goals: ['local_sales','profit'],              priority: 1 },
  { code: 'ONION',    countries: ['NG','ET','TZ','KE','GH','NE','SN','ZA'],                       regions: ['west_africa','east_africa','southern_africa'],                   beginner: false, goals: ['local_sales','profit'],              priority: 2 },
  { code: 'PEPPER',   countries: ['NG','GH','ET','KE','TZ','UG','CM'],                            regions: ['west_africa','east_africa','central_africa'],                    beginner: true,  goals: ['local_sales','profit'],              priority: 2 },
  { code: 'OKRA',     countries: ['NG','GH','ML','SN','BF','CI','CM','TZ','ET'],                  regions: ['west_africa','east_africa','central_africa'],                    beginner: true,  goals: ['home_food','local_sales'],           priority: 2 },
  { code: 'CABBAGE',  countries: ['KE','TZ','ET','UG','ZA','GH','NG'],                            regions: ['east_africa','southern_africa','west_africa'],                   beginner: true,  goals: ['local_sales'],                       priority: 2 },
  { code: 'KALE',     countries: ['KE','TZ','UG','ET'],                                           regions: ['east_africa'],                                                  beginner: true,  goals: ['home_food','local_sales'],           priority: 2 },
  { code: 'EGGPLANT', countries: ['NG','GH','TZ','KE','UG','CM'],                                 regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['local_sales'],                       priority: 3 },
  { code: 'SPINACH',  countries: ['KE','TZ','UG','ZA','NG','GH','ET'],                            regions: ['east_africa','southern_africa','west_africa'],                   beginner: true,  goals: ['home_food','local_sales'],           priority: 3 },
  { code: 'CUCUMBER', countries: ['NG','KE','GH','TZ','UG'],                                      regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['local_sales'],                       priority: 3 },
  { code: 'CARROT',   countries: ['KE','ET','ZA','TZ','UG','GH','NG'],                            regions: ['east_africa','southern_africa','west_africa'],                   beginner: true,  goals: ['local_sales'],                       priority: 3 },
  { code: 'WATERMELON', countries: ['NG','GH','KE','TZ','SN','ZA'],                               regions: ['west_africa','east_africa','southern_africa'],                   beginner: true,  goals: ['local_sales','profit'],              priority: 3 },

  // ── Spices ──
  { code: 'GINGER',   countries: ['NG','ET','KE','TZ','GH','UG','CM'],                            regions: ['west_africa','east_africa','central_africa'],                    beginner: false, goals: ['local_sales','profit'],              priority: 2 },
  { code: 'CHILI',    countries: ['NG','GH','ET','KE','TZ','UG'],                                 regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['local_sales','profit'],              priority: 3 },
  { code: 'GARLIC',   countries: ['ET','KE','NG','GH','TZ','ZA'],                                 regions: ['east_africa','west_africa','southern_africa'],                   beginner: false, goals: ['local_sales','profit'],              priority: 3 },

  // ── Fruits ──
  { code: 'BANANA',   countries: ['UG','TZ','KE','ET','RW','CM','NG','GH','CI'],                  regions: ['east_africa','west_africa','central_africa'],                    beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'PLANTAIN', countries: ['NG','GH','CM','CI','UG','TZ','CD','RW'],                       regions: ['west_africa','central_africa','east_africa'],                    beginner: true,  goals: ['home_food','local_sales'],           priority: 1 },
  { code: 'MANGO',    countries: ['NG','KE','TZ','GH','ET','UG','ML','SN','ZA'],                  regions: ['west_africa','east_africa','southern_africa'],                   beginner: true,  goals: ['home_food','local_sales','profit'],  priority: 2 },
  { code: 'PAPAYA',   countries: ['NG','KE','TZ','GH','UG','ET'],                                 regions: ['west_africa','east_africa'],                                    beginner: true,  goals: ['home_food','local_sales'],           priority: 3 },
  { code: 'AVOCADO',  countries: ['KE','TZ','ET','UG','ZA','GH','NG'],                            regions: ['east_africa','southern_africa','west_africa'],                   beginner: false, goals: ['profit','local_sales'],              priority: 2 },
  { code: 'PINEAPPLE',countries: ['GH','NG','KE','TZ','UG','CI','CM'],                            regions: ['west_africa','east_africa','central_africa'],                    beginner: false, goals: ['profit','local_sales'],              priority: 3 },
  { code: 'ORANGE',   countries: ['NG','ZA','GH','KE','TZ','ET'],                                 regions: ['west_africa','east_africa','southern_africa'],                   beginner: false, goals: ['profit','local_sales'],              priority: 3 },

  // ── Cash Crops ──
  { code: 'COFFEE',   countries: ['ET','KE','TZ','UG','RW','CM','CI'],                            regions: ['east_africa','central_africa','west_africa'],                    beginner: false, goals: ['profit'],                            priority: 1 },
  { code: 'TEA',      countries: ['KE','TZ','UG','ET','RW','MW','ZA'],                            regions: ['east_africa','southern_africa'],                                 beginner: false, goals: ['profit'],                            priority: 2 },
  { code: 'COTTON',   countries: ['NG','TZ','BF','ML','ZM','ZW','ET','CM','MZ'],                  regions: ['west_africa','east_africa','southern_africa'],                   beginner: false, goals: ['profit'],                            priority: 2 },
  { code: 'SUGARCANE',countries: ['KE','TZ','ZA','UG','ET','NG','MZ','ZM','ZW'],                  regions: ['east_africa','southern_africa','west_africa'],                   beginner: false, goals: ['profit'],                            priority: 2 },
  { code: 'COCOA',    countries: ['GH','CI','NG','CM'],                                           regions: ['west_africa','central_africa'],                                  beginner: false, goals: ['profit'],                            priority: 1 },
  { code: 'PALM_OIL', countries: ['NG','GH','CI','CM','CD'],                                      regions: ['west_africa','central_africa'],                                  beginner: false, goals: ['profit'],                            priority: 2 },
  { code: 'SESAME',   countries: ['ET','NG','TZ','BF','ML','UG'],                                 regions: ['east_africa','west_africa'],                                    beginner: true,  goals: ['profit','local_sales'],              priority: 3 },
  { code: 'SUNFLOWER',countries: ['TZ','KE','ZA','UG','ZM','ET'],                                 regions: ['east_africa','southern_africa'],                                 beginner: false, goals: ['profit','local_sales'],              priority: 3 },
];

// ─── Build indexes for fast lookup ──────────────────────────

/** @type {Map<string, Object>} code → catalog entry */
const _byCode = new Map(CROP_REGION_CATALOG.map(c => [c.code, c]));

/** @type {Map<string, string[]>} countryCode → [cropCodes] sorted by priority */
const _byCountry = new Map();

for (const entry of CROP_REGION_CATALOG) {
  for (const cc of entry.countries) {
    if (!_byCountry.has(cc)) _byCountry.set(cc, []);
    _byCountry.get(cc).push(entry);
  }
}
// Sort each country's crops by priority (1 first) then alphabetically
for (const [cc, entries] of _byCountry) {
  entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
  _byCountry.set(cc, entries);
}

/** @type {Map<string, Object[]>} regionKey → catalog entries sorted by priority */
const _byRegion = new Map();
for (const entry of CROP_REGION_CATALOG) {
  for (const r of entry.regions) {
    if (!_byRegion.has(r)) _byRegion.set(r, []);
    _byRegion.get(r).push(entry);
  }
}
for (const [r, entries] of _byRegion) {
  entries.sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code));
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Get catalog entry for a crop code.
 * @param {string} code
 * @returns {Object|null}
 */
export function getCatalogEntry(code) {
  return _byCode.get(code) || null;
}

/**
 * Get crops common in a specific country, sorted by priority.
 * @param {string} countryCode - ISO 2-letter code
 * @returns {Object[]} catalog entries
 */
export function getCropsForCountry(countryCode) {
  if (!countryCode) return [];
  return _byCountry.get(countryCode.toUpperCase()) || [];
}

/**
 * Get crop codes common in a specific country.
 * @param {string} countryCode
 * @returns {string[]} crop codes sorted by priority
 */
export function getCountryCropCodes(countryCode) {
  return getCropsForCountry(countryCode).map(e => e.code);
}

/**
 * Get crops for a region key.
 * @param {string} regionKey - 'east_africa', 'west_africa', etc.
 * @returns {Object[]}
 */
export function getCropsForRegion(regionKey) {
  return _byRegion.get(regionKey) || [];
}

/**
 * Detect region from country code.
 * @param {string} countryCode
 * @returns {string|null} region key
 */
export function getRegionForCountry(countryCode) {
  if (!countryCode) return null;
  const cc = countryCode.toUpperCase();
  for (const [key, region] of Object.entries(REGIONS)) {
    if (region.countries.includes(cc)) return key;
  }
  return null;
}

/**
 * Get a prioritized crop list: country-specific first, then regional, then global fallback.
 * Deduplicates by code. Returns catalog entries.
 *
 * @param {string} countryCode
 * @returns {{ local: Object[], regional: Object[], global: Object[] }}
 */
export function getLocalizedCropList(countryCode) {
  const seen = new Set();
  const local = [];
  const regional = [];
  const global = [];

  // 1. Country-specific crops
  for (const entry of getCropsForCountry(countryCode)) {
    if (!seen.has(entry.code)) {
      seen.add(entry.code);
      local.push(entry);
    }
  }

  // 2. Regional crops not already in country list
  const region = getRegionForCountry(countryCode);
  if (region) {
    for (const entry of getCropsForRegion(region)) {
      if (!seen.has(entry.code)) {
        seen.add(entry.code);
        regional.push(entry);
      }
    }
  }

  // 3. Global — everything else in the catalog
  for (const entry of CROP_REGION_CATALOG) {
    if (!seen.has(entry.code)) {
      seen.add(entry.code);
      global.push(entry);
    }
  }

  return { local, regional, global };
}

/**
 * Check if a crop is common in a country.
 * @param {string} cropCode
 * @param {string} countryCode
 * @returns {boolean}
 */
export function isCropLocalToCountry(cropCode, countryCode) {
  const entry = _byCode.get(cropCode);
  if (!entry || !countryCode) return false;
  return entry.countries.includes(countryCode.toUpperCase());
}

/**
 * Get beginner-friendly crops for a country, optionally filtered by goal.
 * @param {string} countryCode
 * @param {string|null} goal - 'home_food', 'local_sales', 'profit'
 * @returns {Object[]}
 */
export function getBeginnerCropsForCountry(countryCode, goal) {
  let crops = getCropsForCountry(countryCode).filter(c => c.beginner);
  if (goal) {
    crops = crops.filter(c => c.goals.includes(goal));
  }
  return crops;
}
