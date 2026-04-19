/**
 * validateStateMapping.js — assertions that the US_STATES table
 * covers exactly 51 entries, each with one displayRegion and one
 * climateSubregion, no duplicates, no nulls.
 *
 * Run from a test suite or on app startup. Returns a structured
 * report the caller can pretty-print.
 */
import { US_STATES, DISPLAY_REGIONS, CLIMATE_SUBREGIONS } from './usStates.js';

const REQUIRED_CODES = Object.freeze([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]);

/**
 * Returns { ok: boolean, errors: string[] }.
 * `errors` is an ordered list of human-readable problems suitable
 * for logging on startup or asserting in a test.
 */
export function validateStateMapping() {
  const errors = [];
  const actualCodes = new Set(Object.keys(US_STATES));

  // 1. Completeness
  const missing = REQUIRED_CODES.filter((c) => !actualCodes.has(c));
  if (missing.length > 0) errors.push(`missing_states: ${missing.join(', ')}`);

  const unexpected = [...actualCodes].filter((c) => !REQUIRED_CODES.includes(c));
  if (unexpected.length > 0) errors.push(`unexpected_states: ${unexpected.join(', ')}`);

  if (actualCodes.size !== REQUIRED_CODES.length) {
    errors.push(`state_count_mismatch: expected ${REQUIRED_CODES.length}, got ${actualCodes.size}`);
  }

  // 2. Per-state shape
  const validDisplay = new Set(Object.values(DISPLAY_REGIONS));
  const validSubregion = new Set(Object.values(CLIMATE_SUBREGIONS));
  const seenPairs = new Map(); // code → { displayRegion, climateSubregion }

  for (const code of REQUIRED_CODES) {
    const entry = US_STATES[code];
    if (!entry) continue;
    if (!entry.name) errors.push(`${code}: missing name`);
    if (!entry.displayRegion) errors.push(`${code}: missing displayRegion`);
    else if (!validDisplay.has(entry.displayRegion)) {
      errors.push(`${code}: invalid displayRegion "${entry.displayRegion}"`);
    }
    if (!entry.climateSubregion) errors.push(`${code}: missing climateSubregion`);
    else if (!validSubregion.has(entry.climateSubregion)) {
      errors.push(`${code}: invalid climateSubregion "${entry.climateSubregion}"`);
    }
    if (!entry.frostRisk || !['low', 'medium', 'high'].includes(entry.frostRisk)) {
      errors.push(`${code}: invalid frostRisk "${entry.frostRisk}"`);
    }
    seenPairs.set(code, entry);
  }

  // 3. Detect if any state has been accidentally assigned two values
  // (JS objects can't have duplicates, but name collisions can).
  const seenNames = new Map();
  for (const [code, entry] of seenPairs) {
    const key = (entry.name || '').toLowerCase();
    if (seenNames.has(key)) {
      errors.push(`duplicate_name "${entry.name}" used by ${seenNames.get(key)} and ${code}`);
    } else {
      seenNames.set(key, code);
    }
  }

  return { ok: errors.length === 0, errors, count: actualCodes.size };
}
