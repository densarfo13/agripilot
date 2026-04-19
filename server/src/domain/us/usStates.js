/**
 * usStates.js — every U.S. state + D.C. with display region,
 * internal climate subregion, and coarse agronomic bands.
 *
 * The display region is what we surface in the UI ("East Coast",
 * "Midwest"). The climate subregion is what the scoring engine
 * actually uses ("MID_ATLANTIC", "SOUTHEAST_COASTAL"). Keep these
 * split — UI groups are never precise enough for agronomy.
 *
 * frostRisk / rainfallBand / heatBand are coarse ("low" | "mid" |
 * "high") buckets used by the scoring engine. They encode broadly
 * known defaults — individual zones within a state vary, but for
 * beginner recommendations these give the right priors.
 *
 * All values are strings so the module can be JSON-serialized for
 * the wire without any conversion.
 */

/** Display regions the UI renders. */
export const DISPLAY_REGIONS = Object.freeze({
  EAST_COAST: 'East Coast',
  MIDWEST: 'Midwest',
  SOUTH: 'South',
  GREAT_PLAINS: 'Great Plains',
  SOUTHWEST: 'Southwest',
  WEST_COAST: 'West Coast',
  MOUNTAIN: 'Mountain',
});

/** Internal climate subregions used by the scoring engine. */
export const CLIMATE_SUBREGIONS = Object.freeze({
  NORTHEAST_COASTAL: 'NORTHEAST_COASTAL',
  MID_ATLANTIC: 'MID_ATLANTIC',
  SOUTHEAST_COASTAL: 'SOUTHEAST_COASTAL',
  FLORIDA_SUBTROPICAL: 'FLORIDA_SUBTROPICAL',
  MIDWEST_HUMID: 'MIDWEST_HUMID',
  GREAT_PLAINS_DRY: 'GREAT_PLAINS_DRY',
  SOUTH_CENTRAL_MIXED: 'SOUTH_CENTRAL_MIXED',
  SOUTHWEST_ARID: 'SOUTHWEST_ARID',
  WEST_COAST_MEDITERRANEAN: 'WEST_COAST_MEDITERRANEAN',
  PACIFIC_NORTHWEST_COOL: 'PACIFIC_NORTHWEST_COOL',
  MOUNTAIN_COOL_DRY: 'MOUNTAIN_COOL_DRY',
  DESERT_IRRIGATED: 'DESERT_IRRIGATED',
  LOWER_MISSISSIPPI_HUMID: 'LOWER_MISSISSIPPI_HUMID',
  SUBARCTIC_SHORT_SEASON: 'SUBARCTIC_SHORT_SEASON',
  TROPICAL_PACIFIC: 'TROPICAL_PACIFIC',
});

const D = DISPLAY_REGIONS;
const C = CLIMATE_SUBREGIONS;

/**
 * LOCATION PROFILE for each U.S. state + D.C.
 * Keyed by postal code. Canonical names are preserved on the entry.
 */
export const US_STATES = Object.freeze({
  // ─── East Coast (Northeast coastal → Southeast coastal) ────
  ME: { name: 'Maine',            displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'high', rainfallBand: 'mid',  heatBand: 'low'  },
  NH: { name: 'New Hampshire',    displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'high', rainfallBand: 'mid',  heatBand: 'low'  },
  VT: { name: 'Vermont',          displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'high', rainfallBand: 'mid',  heatBand: 'low'  },
  MA: { name: 'Massachusetts',    displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'high', rainfallBand: 'mid',  heatBand: 'mid'  },
  RI: { name: 'Rhode Island',     displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  CT: { name: 'Connecticut',      displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  NY: { name: 'New York',         displayRegion: D.EAST_COAST, climateSubregion: C.NORTHEAST_COASTAL, frostRisk: 'high', rainfallBand: 'mid',  heatBand: 'mid'  },
  NJ: { name: 'New Jersey',       displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,      frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  PA: { name: 'Pennsylvania',     displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,      frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  DE: { name: 'Delaware',         displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,      frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  MD: { name: 'Maryland',         displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,      frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  DC: { name: 'District of Columbia', displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,  frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  VA: { name: 'Virginia',         displayRegion: D.EAST_COAST, climateSubregion: C.MID_ATLANTIC,      frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'mid'  },
  NC: { name: 'North Carolina',   displayRegion: D.EAST_COAST, climateSubregion: C.SOUTHEAST_COASTAL, frostRisk: 'mid',  rainfallBand: 'mid',  heatBand: 'high' },
  SC: { name: 'South Carolina',   displayRegion: D.EAST_COAST, climateSubregion: C.SOUTHEAST_COASTAL, frostRisk: 'low',  rainfallBand: 'mid',  heatBand: 'high' },
  GA: { name: 'Georgia',          displayRegion: D.EAST_COAST, climateSubregion: C.SOUTHEAST_COASTAL, frostRisk: 'low',  rainfallBand: 'mid',  heatBand: 'high' },
  FL: { name: 'Florida',          displayRegion: D.EAST_COAST, climateSubregion: C.FLORIDA_SUBTROPICAL, frostRisk: 'low', rainfallBand: 'high', heatBand: 'high' },

  // ─── Midwest ───────────────────────────────────────────────
  OH: { name: 'Ohio',          displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'mid',  rainfallBand: 'mid', heatBand: 'mid' },
  MI: { name: 'Michigan',      displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'high', rainfallBand: 'mid', heatBand: 'mid' },
  IN: { name: 'Indiana',       displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'mid',  rainfallBand: 'mid', heatBand: 'mid' },
  IL: { name: 'Illinois',      displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'mid',  rainfallBand: 'mid', heatBand: 'mid' },
  WI: { name: 'Wisconsin',     displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'high', rainfallBand: 'mid', heatBand: 'low' },
  MN: { name: 'Minnesota',     displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'high', rainfallBand: 'mid', heatBand: 'low' },
  IA: { name: 'Iowa',          displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'mid',  rainfallBand: 'mid', heatBand: 'mid' },
  MO: { name: 'Missouri',      displayRegion: D.MIDWEST, climateSubregion: C.MIDWEST_HUMID, frostRisk: 'mid',  rainfallBand: 'mid', heatBand: 'mid' },

  // ─── Great Plains ──────────────────────────────────────────
  ND: { name: 'North Dakota',  displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'low' },
  SD: { name: 'South Dakota',  displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'mid' },
  NE: { name: 'Nebraska',      displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY, frostRisk: 'mid',  rainfallBand: 'low', heatBand: 'mid' },
  KS: { name: 'Kansas',        displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY, frostRisk: 'mid',  rainfallBand: 'low', heatBand: 'high' },
  OK: { name: 'Oklahoma',      displayRegion: D.GREAT_PLAINS, climateSubregion: C.SOUTH_CENTRAL_MIXED, frostRisk: 'low', rainfallBand: 'mid', heatBand: 'high' },

  // ─── South ─────────────────────────────────────────────────
  KY: { name: 'Kentucky',      displayRegion: D.SOUTH, climateSubregion: C.MIDWEST_HUMID,           frostRisk: 'mid', rainfallBand: 'mid', heatBand: 'mid'  },
  TN: { name: 'Tennessee',     displayRegion: D.SOUTH, climateSubregion: C.LOWER_MISSISSIPPI_HUMID, frostRisk: 'mid', rainfallBand: 'mid', heatBand: 'high' },
  AR: { name: 'Arkansas',      displayRegion: D.SOUTH, climateSubregion: C.LOWER_MISSISSIPPI_HUMID, frostRisk: 'low', rainfallBand: 'mid', heatBand: 'high' },
  LA: { name: 'Louisiana',     displayRegion: D.SOUTH, climateSubregion: C.LOWER_MISSISSIPPI_HUMID, frostRisk: 'low', rainfallBand: 'high', heatBand: 'high' },
  MS: { name: 'Mississippi',   displayRegion: D.SOUTH, climateSubregion: C.LOWER_MISSISSIPPI_HUMID, frostRisk: 'low', rainfallBand: 'mid',  heatBand: 'high' },
  AL: { name: 'Alabama',       displayRegion: D.SOUTH, climateSubregion: C.SOUTHEAST_COASTAL,       frostRisk: 'low', rainfallBand: 'mid',  heatBand: 'high' },
  WV: { name: 'West Virginia', displayRegion: D.SOUTH, climateSubregion: C.MID_ATLANTIC,            frostRisk: 'mid', rainfallBand: 'mid', heatBand: 'mid'  },

  // ─── Southwest ─────────────────────────────────────────────
  TX: { name: 'Texas',         displayRegion: D.SOUTHWEST, climateSubregion: C.SOUTH_CENTRAL_MIXED, frostRisk: 'low', rainfallBand: 'mid', heatBand: 'high' },
  NM: { name: 'New Mexico',    displayRegion: D.SOUTHWEST, climateSubregion: C.SOUTHWEST_ARID,      frostRisk: 'mid', rainfallBand: 'low', heatBand: 'high' },
  AZ: { name: 'Arizona',       displayRegion: D.SOUTHWEST, climateSubregion: C.SOUTHWEST_ARID,      frostRisk: 'low', rainfallBand: 'low', heatBand: 'high' },
  NV: { name: 'Nevada',        displayRegion: D.SOUTHWEST, climateSubregion: C.DESERT_IRRIGATED,    frostRisk: 'mid', rainfallBand: 'low', heatBand: 'high' },

  // ─── West Coast ────────────────────────────────────────────
  CA: { name: 'California',    displayRegion: D.WEST_COAST, climateSubregion: C.WEST_COAST_MEDITERRANEAN, frostRisk: 'low',  rainfallBand: 'mid', heatBand: 'high' },
  OR: { name: 'Oregon',        displayRegion: D.WEST_COAST, climateSubregion: C.PACIFIC_NORTHWEST_COOL,   frostRisk: 'mid',  rainfallBand: 'high', heatBand: 'low'  },
  WA: { name: 'Washington',    displayRegion: D.WEST_COAST, climateSubregion: C.PACIFIC_NORTHWEST_COOL,   frostRisk: 'mid',  rainfallBand: 'high', heatBand: 'low'  },
  AK: { name: 'Alaska',        displayRegion: D.WEST_COAST, climateSubregion: C.SUBARCTIC_SHORT_SEASON,   frostRisk: 'high', rainfallBand: 'mid', heatBand: 'low'  },
  HI: { name: 'Hawaii',        displayRegion: D.WEST_COAST, climateSubregion: C.TROPICAL_PACIFIC,         frostRisk: 'low',  rainfallBand: 'high', heatBand: 'high' },

  // ─── Mountain ──────────────────────────────────────────────
  MT: { name: 'Montana',       displayRegion: D.MOUNTAIN, climateSubregion: C.MOUNTAIN_COOL_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'low'  },
  ID: { name: 'Idaho',         displayRegion: D.MOUNTAIN, climateSubregion: C.MOUNTAIN_COOL_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'mid'  },
  WY: { name: 'Wyoming',       displayRegion: D.MOUNTAIN, climateSubregion: C.MOUNTAIN_COOL_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'low'  },
  CO: { name: 'Colorado',      displayRegion: D.MOUNTAIN, climateSubregion: C.MOUNTAIN_COOL_DRY, frostRisk: 'high', rainfallBand: 'low', heatBand: 'mid'  },
  UT: { name: 'Utah',          displayRegion: D.MOUNTAIN, climateSubregion: C.MOUNTAIN_COOL_DRY, frostRisk: 'mid',  rainfallBand: 'low', heatBand: 'mid'  },
});

/** Sanity: 50 states + DC expected. */
export const US_STATE_COUNT = Object.keys(US_STATES).length;

/**
 * Accept case-insensitive postal codes ("tx"), canonical codes ("TX"),
 * or full names ("Texas") and return the postal code, or null if
 * unresolvable.
 */
export function resolveStateCode(input) {
  if (!input) return null;
  const raw = String(input).trim();
  const up = raw.toUpperCase();
  if (US_STATES[up]) return up;
  for (const [code, entry] of Object.entries(US_STATES)) {
    if (entry.name.toLowerCase() === raw.toLowerCase()) return code;
  }
  return null;
}

/** Return the full location profile for a state or null. */
export function resolveLocationProfile(input) {
  const code = resolveStateCode(input);
  if (!code) return null;
  return { code, ...US_STATES[code] };
}

/** Display region (for UI copy). */
export function resolveDisplayRegion(input) {
  const p = resolveLocationProfile(input);
  return p ? p.displayRegion : null;
}

/** Internal climate subregion (for scoring). */
export function resolveClimateSubregion(input) {
  const p = resolveLocationProfile(input);
  return p ? p.climateSubregion : null;
}

/** All states grouped by display region — convenient for selectors. */
export function statesByDisplayRegion() {
  const out = {};
  for (const [code, e] of Object.entries(US_STATES)) {
    (out[e.displayRegion] ||= []).push({ code, name: e.name });
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}
