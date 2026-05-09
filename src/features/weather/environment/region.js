/**
 * region.js — RegionEnvironmentMapper.
 *
 * Maps an ISO country code (and optional region/admin-1 hint)
 * to a CLIMATE CLUSTER the scene resolver uses to pick which
 * regional photo variant to render.
 *
 *   tropical   — Ghana, Nigeria, Kenya, Côte d'Ivoire, Brazil, Indonesia
 *                (year-round warm + wet)
 *   monsoon    — India, Bangladesh, Vietnam, Thailand, Cambodia
 *                (alternating wet/dry seasons; rice + paddy framing)
 *   temperate  — USA Midwest, Canada, UK, France, Germany, Japan
 *                (4-season; wheat + corn + open fields)
 *   arid       — Egypt, Morocco, Saudi Arabia, Australia, Mexico
 *                (warm + dry; drip irrigation framing)
 *   highland   — Ethiopia, Rwanda, Bolivia, Nepal
 *                (cool altitude, terraced fields)
 *
 * Strict-rule audit
 *   • Pure function. Never throws on bad input.
 *   • Unknown country → 'temperate' (the most neutral fallback).
 *   • All inputs upper-cased before lookup so callers don't have
 *     to canonicalise themselves.
 */

const CLIMATE = Object.freeze({
  // Tropical (West/East Africa, equatorial Americas, SE Asia)
  GH: 'tropical', NG: 'tropical', CI: 'tropical', SN: 'tropical',
  CM: 'tropical', UG: 'tropical', KE: 'tropical', TZ: 'tropical',
  ZM: 'tropical', RW: 'tropical', MZ: 'tropical', AO: 'tropical',
  BR: 'tropical', CO: 'tropical', PE: 'tropical', EC: 'tropical',
  ID: 'tropical', PH: 'tropical', MY: 'tropical', SG: 'tropical',

  // Monsoon (S Asia + SE Asia)
  IN: 'monsoon',  BD: 'monsoon',  PK: 'monsoon',  LK: 'monsoon',
  NP: 'monsoon',  MM: 'monsoon',  TH: 'monsoon',  VN: 'monsoon',
  KH: 'monsoon',  LA: 'monsoon',

  // Temperate (4-season N. America, most of Europe, NE Asia)
  US: 'temperate', CA: 'temperate', GB: 'temperate', IE: 'temperate',
  FR: 'temperate', DE: 'temperate', NL: 'temperate', BE: 'temperate',
  IT: 'temperate', ES: 'temperate', PT: 'temperate', PL: 'temperate',
  CZ: 'temperate', AT: 'temperate', CH: 'temperate', RO: 'temperate',
  HU: 'temperate', GR: 'temperate', JP: 'temperate', KR: 'temperate',
  CN: 'temperate', NZ: 'temperate', AR: 'temperate', CL: 'temperate',
  UY: 'temperate', SE: 'temperate', NO: 'temperate', FI: 'temperate',
  DK: 'temperate',

  // Arid (N. Africa + Middle East + Australia + Mexico)
  EG: 'arid', MA: 'arid', DZ: 'arid', TN: 'arid', LY: 'arid',
  SA: 'arid', AE: 'arid', QA: 'arid', KW: 'arid', OM: 'arid',
  IR: 'arid', IQ: 'arid', JO: 'arid', IL: 'arid', SY: 'arid',
  YE: 'arid', AU: 'arid', MX: 'arid', NA: 'arid', BW: 'arid',
  ZA: 'arid', // partly temperate but coastal/wine regions still arid-leaning

  // Highland (mountainous + altitude-driven climates)
  ET: 'highland', BO: 'highland',
});

const VALID_CLUSTERS = Object.freeze([
  'tropical', 'monsoon', 'temperate', 'arid', 'highland',
]);

/**
 * climateClusterFor(country) → cluster string.
 * Bad input → 'temperate'.
 */
export function climateClusterFor(country) {
  if (!country || typeof country !== 'string') return 'temperate';
  const code = country.trim().toUpperCase().slice(0, 2);
  return CLIMATE[code] || 'temperate';
}

/**
 * regionEnvironment({ country, region }) → { cluster, hemisphere }
 *
 * Hemisphere is derived from a tiny southern-hemisphere allowlist
 * (BR, AR, AU, NZ, ZA, CL, UY, BO, PY, NA, ZM, AO, MZ, MG …).
 * It's used by the seasonal selector — temperate winter in Sydney
 * is July not January.
 */
const SOUTHERN = new Set([
  'AR','AU','NZ','BR','BO','CL','UY','PY','PE','EC',
  'ZA','NA','BW','ZM','ZW','MZ','AO','MG','LS','SZ',
]);

export function regionEnvironment({ country, region } = {}) {
  const cluster = climateClusterFor(country);
  const code = (typeof country === 'string')
    ? country.trim().toUpperCase().slice(0, 2)
    : '';
  const hemisphere = SOUTHERN.has(code) ? 'south' : 'north';
  return Object.freeze({
    cluster,
    hemisphere,
    region: (typeof region === 'string' && region.trim()) ? region.trim() : '',
  });
}

export const CLIMATE_CLUSTERS = VALID_CLUSTERS;
