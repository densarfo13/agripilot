/**
 * usStates.js — canonical mapping of every U.S. state + D.C. to a
 * UI-facing display region and an internal climate subregion, plus
 * agronomic bands used by the scoring engine.
 *
 * Conventions (locked to spec):
 *   • displayRegion values are ENUM codes (EAST_COAST, MIDWEST, ...).
 *     The UI resolves them to human-readable labels via
 *     `DISPLAY_REGION_LABELS` so we never couple agronomic grouping
 *     to wording.
 *   • climateSubregion values are the authoritative keys the scoring
 *     engine looks up rules by.
 *   • frostRisk uses `low | medium | high` (spec).
 *
 * This module is pure data — safe to import from both the server
 * (rules engine) and the client (selector + crop-card renderer).
 */

/** UI display regions. */
export const DISPLAY_REGIONS = Object.freeze({
  EAST_COAST: 'EAST_COAST',
  MIDWEST: 'MIDWEST',
  SOUTH: 'SOUTH',
  GREAT_PLAINS: 'GREAT_PLAINS',
  SOUTHWEST: 'SOUTHWEST',
  WEST_COAST: 'WEST_COAST',
  MOUNTAIN: 'MOUNTAIN',
});

/** Friendly labels the UI can render without a lookup table. */
export const DISPLAY_REGION_LABELS = Object.freeze({
  EAST_COAST: 'East Coast',
  MIDWEST: 'Midwest',
  SOUTH: 'South',
  GREAT_PLAINS: 'Great Plains',
  SOUTHWEST: 'Southwest',
  WEST_COAST: 'West Coast',
  MOUNTAIN: 'Mountain',
});

/** Internal climate subregions — scoring engine keys. */
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
  ALASKA_SHORT_SEASON: 'ALASKA_SHORT_SEASON',
  HAWAII_TROPICAL: 'HAWAII_TROPICAL',
});

const D = DISPLAY_REGIONS;
const C = CLIMATE_SUBREGIONS;

/**
 * US_STATES — keyed by postal code. Each entry carries name, display
 * region, internal climate subregion, and coarse agronomic bands
 * (frost / rainfall / heat). Bands are `low | medium | high`.
 *
 * The mapping below is the authoritative seed from the spec. If a
 * state's subregion needs to change, update it here and the entire
 * engine + UI re-aligns automatically.
 */
export const US_STATES = Object.freeze({
  AL: { name: 'Alabama',               displayRegion: D.SOUTH,        climateSubregion: C.LOWER_MISSISSIPPI_HUMID,  frostRisk: 'medium', rainfallBand: 'high',   heatBand: 'high'   },
  AK: { name: 'Alaska',                displayRegion: D.WEST_COAST,   climateSubregion: C.ALASKA_SHORT_SEASON,      frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  AZ: { name: 'Arizona',               displayRegion: D.SOUTHWEST,    climateSubregion: C.SOUTHWEST_ARID,           frostRisk: 'low',    rainfallBand: 'low',    heatBand: 'high'   },
  AR: { name: 'Arkansas',              displayRegion: D.SOUTH,        climateSubregion: C.LOWER_MISSISSIPPI_HUMID,  frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  CA: { name: 'California',            displayRegion: D.WEST_COAST,   climateSubregion: C.WEST_COAST_MEDITERRANEAN, frostRisk: 'low',    rainfallBand: 'medium', heatBand: 'high'   },
  CO: { name: 'Colorado',              displayRegion: D.MOUNTAIN,     climateSubregion: C.MOUNTAIN_COOL_DRY,        frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'medium' },
  CT: { name: 'Connecticut',           displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  DE: { name: 'Delaware',              displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  DC: { name: 'District of Columbia',  displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  FL: { name: 'Florida',               displayRegion: D.EAST_COAST,   climateSubregion: C.FLORIDA_SUBTROPICAL,      frostRisk: 'low',    rainfallBand: 'high',   heatBand: 'high'   },
  GA: { name: 'Georgia',               displayRegion: D.EAST_COAST,   climateSubregion: C.SOUTHEAST_COASTAL,        frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  HI: { name: 'Hawaii',                displayRegion: D.WEST_COAST,   climateSubregion: C.HAWAII_TROPICAL,          frostRisk: 'low',    rainfallBand: 'high',   heatBand: 'high'   },
  ID: { name: 'Idaho',                 displayRegion: D.MOUNTAIN,     climateSubregion: C.MOUNTAIN_COOL_DRY,        frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'medium' },
  IL: { name: 'Illinois',              displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  IN: { name: 'Indiana',               displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  IA: { name: 'Iowa',                  displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  KS: { name: 'Kansas',                displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY,         frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'high'   },
  KY: { name: 'Kentucky',              displayRegion: D.SOUTH,        climateSubregion: C.SOUTH_CENTRAL_MIXED,      frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  LA: { name: 'Louisiana',             displayRegion: D.SOUTH,        climateSubregion: C.LOWER_MISSISSIPPI_HUMID,  frostRisk: 'low',    rainfallBand: 'high',   heatBand: 'high'   },
  ME: { name: 'Maine',                 displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  MD: { name: 'Maryland',              displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  MA: { name: 'Massachusetts',         displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  MI: { name: 'Michigan',              displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  MN: { name: 'Minnesota',             displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  MS: { name: 'Mississippi',           displayRegion: D.SOUTH,        climateSubregion: C.LOWER_MISSISSIPPI_HUMID,  frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  MO: { name: 'Missouri',              displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  MT: { name: 'Montana',               displayRegion: D.MOUNTAIN,     climateSubregion: C.MOUNTAIN_COOL_DRY,        frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'low'    },
  NE: { name: 'Nebraska',              displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY,         frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'medium' },
  NV: { name: 'Nevada',                displayRegion: D.SOUTHWEST,    climateSubregion: C.DESERT_IRRIGATED,         frostRisk: 'medium', rainfallBand: 'low',    heatBand: 'high'   },
  NH: { name: 'New Hampshire',         displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  NJ: { name: 'New Jersey',            displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  NM: { name: 'New Mexico',            displayRegion: D.SOUTHWEST,    climateSubregion: C.SOUTHWEST_ARID,           frostRisk: 'medium', rainfallBand: 'low',    heatBand: 'high'   },
  NY: { name: 'New York',              displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  NC: { name: 'North Carolina',        displayRegion: D.EAST_COAST,   climateSubregion: C.SOUTHEAST_COASTAL,        frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  ND: { name: 'North Dakota',          displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY,         frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'low'    },
  OH: { name: 'Ohio',                  displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  OK: { name: 'Oklahoma',              displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY,         frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  OR: { name: 'Oregon',                displayRegion: D.WEST_COAST,   climateSubregion: C.PACIFIC_NORTHWEST_COOL,   frostRisk: 'medium', rainfallBand: 'high',   heatBand: 'low'    },
  PA: { name: 'Pennsylvania',          displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  RI: { name: 'Rhode Island',          displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  SC: { name: 'South Carolina',        displayRegion: D.EAST_COAST,   climateSubregion: C.SOUTHEAST_COASTAL,        frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  SD: { name: 'South Dakota',          displayRegion: D.GREAT_PLAINS, climateSubregion: C.GREAT_PLAINS_DRY,         frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'medium' },
  TN: { name: 'Tennessee',             displayRegion: D.SOUTH,        climateSubregion: C.SOUTH_CENTRAL_MIXED,      frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  TX: { name: 'Texas',                 displayRegion: D.SOUTHWEST,    climateSubregion: C.SOUTH_CENTRAL_MIXED,      frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'high'   },
  UT: { name: 'Utah',                  displayRegion: D.MOUNTAIN,     climateSubregion: C.MOUNTAIN_COOL_DRY,        frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'medium' },
  VT: { name: 'Vermont',               displayRegion: D.EAST_COAST,   climateSubregion: C.NORTHEAST_COASTAL,        frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  VA: { name: 'Virginia',              displayRegion: D.EAST_COAST,   climateSubregion: C.MID_ATLANTIC,             frostRisk: 'medium', rainfallBand: 'medium', heatBand: 'medium' },
  WA: { name: 'Washington',            displayRegion: D.WEST_COAST,   climateSubregion: C.PACIFIC_NORTHWEST_COOL,   frostRisk: 'medium', rainfallBand: 'high',   heatBand: 'low'    },
  WV: { name: 'West Virginia',         displayRegion: D.SOUTH,        climateSubregion: C.MID_ATLANTIC,             frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'medium' },
  WI: { name: 'Wisconsin',             displayRegion: D.MIDWEST,      climateSubregion: C.MIDWEST_HUMID,            frostRisk: 'high',   rainfallBand: 'medium', heatBand: 'low'    },
  WY: { name: 'Wyoming',               displayRegion: D.MOUNTAIN,     climateSubregion: C.MOUNTAIN_COOL_DRY,        frostRisk: 'high',   rainfallBand: 'low',    heatBand: 'low'    },
});

export const US_STATE_COUNT = Object.keys(US_STATES).length;

/** Accept "tx" / "TX" / "Texas" — return the postal code or null. */
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

/** Full location profile with a UI-ready `displayRegionLabel`. */
export function resolveLocationProfile(input) {
  const code = resolveStateCode(input);
  if (!code) return null;
  const entry = US_STATES[code];
  return {
    code,
    ...entry,
    displayRegionLabel: DISPLAY_REGION_LABELS[entry.displayRegion] || entry.displayRegion,
  };
}

export function resolveDisplayRegion(input) {
  const p = resolveLocationProfile(input);
  return p ? p.displayRegion : null;
}

export function resolveClimateSubregion(input) {
  const p = resolveLocationProfile(input);
  return p ? p.climateSubregion : null;
}

/** States grouped by display region — keyed by the display region label. */
export function statesByDisplayRegion() {
  const out = {};
  for (const [code, e] of Object.entries(US_STATES)) {
    const label = DISPLAY_REGION_LABELS[e.displayRegion];
    (out[label] ||= []).push({ code, name: e.name });
  }
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}
