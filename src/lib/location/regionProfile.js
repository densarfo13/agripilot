/**
 * regionProfile.js — deterministic location→profile resolver.
 *
 *   getRegionProfile({ countryCode, state, now }) → {
 *     countryCode,      // ISO-2 upper-cased
 *     region,           // state/region label when known, else '*'
 *     climate,          // 'tropical' | 'temperate' | 'arid'
 *     rainfallPattern,  // 'low' | 'moderate' | 'high'
 *     season,           // 'dry' | 'wet' | 'winter' | 'spring' | 'summer' | 'fall'
 *     source,           // 'rule_match' | 'country_default' | 'fallback'
 *   }
 *
 * Rules are hardcoded for the five spec countries (US, GH, NG, IN,
 * FR) plus a conservative fallback for everything else. No external
 * APIs, no network, no localStorage — the caller decides when to
 * persist (see storeRegionProfile in farrowayLocal.js).
 *
 * Pure + frozen output.
 */

const NORTH_HEMI_MONTH_TO_SEASON = Object.freeze({
  12: 'winter', 1: 'winter', 2: 'winter',
  3:  'spring', 4: 'spring', 5: 'spring',
  6:  'summer', 7: 'summer', 8: 'summer',
  9:  'fall',  10: 'fall',  11: 'fall',
});

// Tropical monsoon-style: wet season and dry season rather than 4
// temperate buckets. Same month buckets, different labels.
const TROPICAL_WET_MONTHS = new Set([4, 5, 6, 7, 8, 9, 10]);

function monthIndex(now) {
  const d = now instanceof Date ? now : (Number.isFinite(now) ? new Date(now) : new Date());
  return d.getMonth() + 1; // 1..12
}

function tropicalSeason(m) {
  return TROPICAL_WET_MONTHS.has(m) ? 'wet' : 'dry';
}

function temperateSeason(m) {
  return NORTH_HEMI_MONTH_TO_SEASON[m] || 'summer';
}

// ─── Country rules ───────────────────────────────────────────────
// Each rule: either a plain country default OR a map of state →
// climate/rainfall so we can capture "most of US is temperate, but
// FL/HI are tropical" without exploding the table.
const COUNTRY_RULES = Object.freeze({
  US: {
    default: { climate: 'temperate', rainfallPattern: 'moderate' },
    byState: {
      FL: { climate: 'tropical', rainfallPattern: 'high' },
      HI: { climate: 'tropical', rainfallPattern: 'high' },
      LA: { climate: 'tropical', rainfallPattern: 'high' },
      TX: { climate: 'arid',     rainfallPattern: 'low'  },
      AZ: { climate: 'arid',     rainfallPattern: 'low'  },
      NM: { climate: 'arid',     rainfallPattern: 'low'  },
      NV: { climate: 'arid',     rainfallPattern: 'low'  },
      UT: { climate: 'arid',     rainfallPattern: 'low'  },
      CA: { climate: 'temperate', rainfallPattern: 'moderate' },
    },
  },
  GH: {
    default: { climate: 'tropical', rainfallPattern: 'high' },
    byState: {
      // Northern + Upper East/West are hotter + drier.
      NP: { climate: 'tropical', rainfallPattern: 'moderate' },
      UE: { climate: 'tropical', rainfallPattern: 'moderate' },
      UW: { climate: 'tropical', rainfallPattern: 'moderate' },
    },
  },
  NG: {
    default: { climate: 'tropical', rainfallPattern: 'high' },
    byState: {
      // Sahel-edge states lean arid.
      SO: { climate: 'arid', rainfallPattern: 'low' },
      KE: { climate: 'arid', rainfallPattern: 'low' },
      BO: { climate: 'arid', rainfallPattern: 'low' },
      YO: { climate: 'arid', rainfallPattern: 'low' },
      ZA: { climate: 'arid', rainfallPattern: 'low' },
    },
  },
  IN: {
    default: { climate: 'tropical', rainfallPattern: 'high' },
    byState: {
      // North-western arid belt.
      RJ: { climate: 'arid', rainfallPattern: 'low' },
      GJ: { climate: 'arid', rainfallPattern: 'low' },
      PB: { climate: 'temperate', rainfallPattern: 'moderate' },
      HR: { climate: 'temperate', rainfallPattern: 'moderate' },
      HP: { climate: 'temperate', rainfallPattern: 'moderate' },
      JK: { climate: 'temperate', rainfallPattern: 'moderate' },
    },
  },
  FR: {
    default: { climate: 'temperate', rainfallPattern: 'moderate' },
    byState: {},
  },
});

const FALLBACK = Object.freeze({
  climate: 'temperate', rainfallPattern: 'moderate',
});

/**
 * Season derived from climate + month. Tropical regions split into
 * wet/dry; temperate + arid use the four northern-hemisphere buckets
 * (arid is not season-free — rainfall still varies enough that
 * "summer dry / winter wet" matters for planning).
 */
function seasonFor({ climate, month }) {
  if (climate === 'tropical') return tropicalSeason(month);
  // Arid climates are functionally dry year-round — the crop/risk
  // engines benefit more from a consistent "dry" signal than from a
  // misleading "wet" tag during a nominally-rainy month (July in AZ
  // is not a wet season). A tropical-Sahel country like NG in its
  // northern states can override this by setting the state profile
  // explicitly if a wet tag is desirable.
  if (climate === 'arid') return 'dry';
  return temperateSeason(month);
}

/**
 * getRegionProfile — deterministic. Pass { countryCode, state, now }
 * and get a frozen profile back. Missing country → fallback temperate
 * with a `source: 'fallback'` tag so callers can branch on it.
 */
export function getRegionProfile({ countryCode, state, now } = {}) {
  const country = countryCode ? String(countryCode).trim().toUpperCase() : '';
  const stateKey = state ? String(state).trim().toUpperCase() : '';
  const m = monthIndex(now);

  const rule = COUNTRY_RULES[country];
  if (!rule) {
    return Object.freeze({
      countryCode: country || null,
      region:      stateKey || '*',
      climate:     FALLBACK.climate,
      rainfallPattern: FALLBACK.rainfallPattern,
      season:      seasonFor({ climate: FALLBACK.climate, month: m }),
      source:      'fallback',
    });
  }

  const stateRule = rule.byState && rule.byState[stateKey];
  const base = stateRule || rule.default;

  return Object.freeze({
    countryCode: country,
    region:      stateKey || '*',
    climate:     base.climate,
    rainfallPattern: base.rainfallPattern,
    season:      seasonFor({ climate: base.climate, month: m }),
    source:      stateRule ? 'rule_match' : 'country_default',
  });
}

export const _internal = Object.freeze({
  COUNTRY_RULES, FALLBACK, seasonFor, monthIndex, tropicalSeason, temperateSeason,
  TROPICAL_WET_MONTHS, NORTH_HEMI_MONTH_TO_SEASON,
});
