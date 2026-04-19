/**
 * mapCountryToAgRegion — convert a raw country code into one of a
 * small set of internal agronomic regions. Centralised here so
 * recommendation, task, and risk engines all read the same table.
 *
 *   mapCountryToAgRegion('GH') → 'tropical_manual'
 *   mapCountryToAgRegion('US') → 'temperate_mechanized'
 *   mapCountryToAgRegion('??') → 'unknown'
 *
 * Keep this boring on purpose — one string per country. Region-
 * within-country refinement lives in the US_STATES / COUNTRY_REGIONS
 * tables; this helper is the coarse outer layer.
 */

const AG_REGION_BY_COUNTRY = Object.freeze({
  // Temperate mechanized
  US: 'temperate_mechanized',
  CA: 'temperate_mechanized',
  GB: 'temperate_mechanized',
  DE: 'temperate_mechanized',
  FR: 'temperate_mechanized',
  ES: 'temperate_mechanized',
  PT: 'temperate_mechanized',
  AU: 'temperate_mechanized',
  NZ: 'temperate_mechanized',

  // Tropical, primarily manual / smallholder
  GH: 'tropical_manual',
  SN: 'tropical_manual',
  CI: 'tropical_manual',
  TG: 'tropical_manual',
  BJ: 'tropical_manual',
  BF: 'tropical_manual',

  // Tropical mixed-scale (larger smallholder + some mech.)
  NG: 'tropical_mixed',
  KE: 'tropical_mixed',
  TZ: 'tropical_mixed',
  UG: 'tropical_mixed',
  ET: 'tropical_mixed',
  ZA: 'tropical_mixed',

  // Monsoon systems
  IN: 'monsoon_mixed',
  BD: 'monsoon_mixed',
  LK: 'monsoon_mixed',
  PH: 'monsoon_mixed',
  ID: 'monsoon_mixed',
  VN: 'monsoon_mixed',
  TH: 'monsoon_mixed',

  // Arid / irrigated
  EG: 'arid_irrigated',
  SA: 'arid_irrigated',
  AE: 'arid_irrigated',
  IL: 'arid_irrigated',

  // Latin America — broad bucket until we refine
  BR: 'tropical_mixed',
  MX: 'tropical_mixed',
  AR: 'temperate_mechanized',
});

export const AG_REGIONS = Object.freeze([
  'temperate_mechanized',
  'tropical_manual',
  'tropical_mixed',
  'monsoon_mixed',
  'arid_irrigated',
  'unknown',
]);

export function mapCountryToAgRegion(countryCode) {
  if (!countryCode) return 'unknown';
  const code = String(countryCode).trim().toUpperCase();
  return AG_REGION_BY_COUNTRY[code] || 'unknown';
}

/** Quick predicate used by the recommendation safety gate. */
export function hasAgRegionSupport(countryCode) {
  return mapCountryToAgRegion(countryCode) !== 'unknown';
}

export const _internal = { AG_REGION_BY_COUNTRY };
