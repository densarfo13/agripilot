/**
 * Region Definitions — maps countries to agricultural regions.
 *
 * Each region groups countries with similar climate patterns, growing
 * seasons, and crop suitability. Used by cropRegionRules, seasonalRules,
 * and the recommendation engine.
 *
 * Extensible: add new regions by appending to REGIONS.
 * The getRegionForCountry() lookup auto-indexes on first call.
 */

export const REGIONS = {
  east_africa: {
    key: 'east_africa',
    label: 'East Africa',
    labelKey: 'region.eastAfrica',
    countries: ['KE', 'TZ', 'UG', 'ET', 'RW', 'BI', 'SO'],
    climate: 'tropical_highland_bimodal',
    notes: 'Bimodal rainfall: long rains Mar-May, short rains Oct-Dec',
  },
  west_africa: {
    key: 'west_africa',
    label: 'West Africa',
    labelKey: 'region.westAfrica',
    countries: ['NG', 'GH', 'SN', 'ML', 'CI', 'BF', 'NE', 'TG', 'BJ', 'GM', 'SL', 'LR', 'GN'],
    climate: 'tropical_monsoon',
    notes: 'Main rains Apr-Sep (south) / Jun-Sep (north), dry Oct-Mar',
  },
  southern_africa: {
    key: 'southern_africa',
    label: 'Southern Africa',
    labelKey: 'region.southernAfrica',
    countries: ['ZA', 'ZM', 'ZW', 'MW', 'MZ', 'BW', 'NA', 'LS', 'SZ'],
    climate: 'subtropical',
    notes: 'Main rains Nov-Mar, dry Apr-Oct',
  },
  central_africa: {
    key: 'central_africa',
    label: 'Central Africa',
    labelKey: 'region.centralAfrica',
    countries: ['CD', 'CM', 'CG', 'CF', 'GA', 'TD', 'GQ'],
    climate: 'tropical_equatorial',
    notes: 'Bimodal near equator: Mar-Jun, Sep-Nov; dry Dec-Feb, Jul-Aug',
  },
  mid_atlantic_us: {
    key: 'mid_atlantic_us',
    label: 'Mid-Atlantic US',
    labelKey: 'region.midAtlanticUS',
    countries: ['US'],
    states: ['MD', 'VA', 'PA', 'DE', 'NJ', 'DC'],
    climate: 'temperate_humid',
    notes: 'Last frost mid-Apr, first frost mid-Oct. Growing season ~180 days',
  },
};

// ─── Country → Region index (built lazily) ──────────────────

let _countryRegionMap = null;

function buildCountryRegionMap() {
  if (_countryRegionMap) return _countryRegionMap;
  _countryRegionMap = new Map();
  for (const [key, region] of Object.entries(REGIONS)) {
    for (const cc of region.countries) {
      // First region wins — a country can only belong to one primary region
      if (!_countryRegionMap.has(cc)) {
        _countryRegionMap.set(cc, key);
      }
    }
  }
  return _countryRegionMap;
}

/**
 * Get the region key for a country code.
 * @param {string} countryCode — ISO 2-letter
 * @returns {string|null}
 */
export function getRegionForCountry(countryCode) {
  if (!countryCode) return null;
  return buildCountryRegionMap().get(countryCode.toUpperCase()) || null;
}

/**
 * Get full region object by key.
 * @param {string} regionKey
 * @returns {Object|null}
 */
export function getRegion(regionKey) {
  return REGIONS[regionKey] || null;
}

/**
 * Get all region keys.
 * @returns {string[]}
 */
export function getAllRegionKeys() {
  return Object.keys(REGIONS);
}

/**
 * Get all country codes that belong to any known region.
 * @returns {string[]}
 */
export function getAllMappedCountries() {
  return [...buildCountryRegionMap().keys()];
}
