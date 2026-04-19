/**
 * cropFit.js — client-side mirror of the server crop-fit warning.
 *
 * The server attaches `warning: { reasonKey, reasons[] }` on every
 * recommendation, but the farmer Today page often shows a chosen
 * crop outside the recommendation flow. This helper runs the same
 * rules locally so a "low-fit warning" can appear wherever a crop
 * is surfaced.
 */

/** Crops whose range is narrow enough to always warn outside the tropics. */
const TROPICAL_ONLY = new Set([
  'cassava', 'sugarcane', 'citrus', 'taro', 'banana', 'papaya', 'pineapple',
]);

const TROPICAL_SUBREGIONS = new Set(['HAWAII_TROPICAL', 'FLORIDA_SUBTROPICAL']);

/**
 * Coarse state → climate band map — keep in lockstep with the
 * server's usStates.js for the states most farmers will use.
 */
const STATE_CLIMATE = Object.freeze({
  AL: 'LOWER_MISSISSIPPI_HUMID', AK: 'ALASKA_SHORT_SEASON', AZ: 'SOUTHWEST_ARID',
  AR: 'LOWER_MISSISSIPPI_HUMID', CA: 'WEST_COAST_MEDITERRANEAN',
  CO: 'MOUNTAIN_COOL_DRY', CT: 'NORTHEAST_COASTAL', DE: 'MID_ATLANTIC',
  DC: 'MID_ATLANTIC', FL: 'FLORIDA_SUBTROPICAL', GA: 'SOUTHEAST_COASTAL',
  HI: 'HAWAII_TROPICAL', ID: 'MOUNTAIN_COOL_DRY', IL: 'MIDWEST_HUMID',
  IN: 'MIDWEST_HUMID', IA: 'MIDWEST_HUMID', KS: 'GREAT_PLAINS_DRY',
  KY: 'SOUTH_CENTRAL_MIXED', LA: 'LOWER_MISSISSIPPI_HUMID',
  ME: 'NORTHEAST_COASTAL', MD: 'MID_ATLANTIC', MA: 'NORTHEAST_COASTAL',
  MI: 'MIDWEST_HUMID', MN: 'MIDWEST_HUMID', MS: 'LOWER_MISSISSIPPI_HUMID',
  MO: 'MIDWEST_HUMID', MT: 'MOUNTAIN_COOL_DRY', NE: 'GREAT_PLAINS_DRY',
  NV: 'DESERT_IRRIGATED', NH: 'NORTHEAST_COASTAL', NJ: 'MID_ATLANTIC',
  NM: 'SOUTHWEST_ARID', NY: 'MID_ATLANTIC', NC: 'SOUTHEAST_COASTAL',
  ND: 'GREAT_PLAINS_DRY', OH: 'MIDWEST_HUMID', OK: 'GREAT_PLAINS_DRY',
  OR: 'PACIFIC_NORTHWEST_COOL', PA: 'MID_ATLANTIC', RI: 'NORTHEAST_COASTAL',
  SC: 'SOUTHEAST_COASTAL', SD: 'GREAT_PLAINS_DRY',
  TN: 'SOUTH_CENTRAL_MIXED', TX: 'SOUTH_CENTRAL_MIXED',
  UT: 'MOUNTAIN_COOL_DRY', VT: 'NORTHEAST_COASTAL', VA: 'MID_ATLANTIC',
  WA: 'PACIFIC_NORTHWEST_COOL', WV: 'MID_ATLANTIC',
  WI: 'MIDWEST_HUMID', WY: 'MOUNTAIN_COOL_DRY',
});

/**
 * @param {Object} args
 * @param {string} args.crop         canonical crop key (e.g. 'cassava', 'tomato')
 * @param {string} [args.stateCode]  US state postal code
 * @param {string} [args.country]    ISO country code; defaults 'US'
 * @returns {{ show: boolean, reasonKey?: string, reasons?: string[] }}
 */
export function evaluateCropFit({ crop, stateCode, country = 'US' } = {}) {
  const key = String(crop || '').toLowerCase();
  if (!key) return { show: false };

  const reasons = [];

  // Tropical-only crops outside a tropical subregion are always a
  // low fit. Cassava in Maryland is the canonical example.
  if (TROPICAL_ONLY.has(key) && String(country).toUpperCase() === 'US') {
    const subregion = STATE_CLIMATE[String(stateCode || '').toUpperCase()];
    if (!subregion || !TROPICAL_SUBREGIONS.has(subregion)) {
      reasons.push('climate_mismatch');
    }
  }

  if (reasons.length === 0) return { show: false };
  return { show: true, reasonKey: 'cropFit.warning.reason', reasons };
}

export const _internal = { TROPICAL_ONLY, TROPICAL_SUBREGIONS, STATE_CLIMATE };
