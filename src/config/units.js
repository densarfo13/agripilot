/**
 * units.js — single source of truth for the country → land-area
 * unit default (Final Farm Size + Review Normalization §1).
 *
 *   import { getUnit, DEFAULT_UNIT_BY_COUNTRY } from '../config/units.js';
 *
 *   getUnit('US')       // → 'acres'
 *   getUnit('GH')       // → 'hectares'
 *   getUnit('NG')       // → 'hectares'
 *   getUnit('IN')       // → 'hectares'
 *   getUnit('UNKNOWN')  // → 'hectares'  (DEFAULT)
 *   getUnit(null)       // → 'hectares'
 *
 * Why this module exists
 * ──────────────────────
 * The codebase already has `lib/units/areaConversion.js`
 * (getDefaultUnit, getAllowedUnits) which handles the wider
 * matrix of farmType × country (sqft for US backyard, sqm for
 * non-US backyard, etc.). That module stays the canonical
 * picker for the multi-step setup forms.
 *
 * THIS module is the slim spec-shaped helper the spec mandates:
 * a flat country → unit map + a `getUnit(countryCode)` reader.
 * It's purely about the FARM tier (small_farm / commercial),
 * because that's the surface where the unit-inconsistency bug
 * surfaced (acres vs hectares mixed in the review screen).
 *
 * Both helpers stay in sync because getUnit() delegates to
 * the existing getDefaultUnit() with farmType: 'small_farm' —
 * so a future country addition only has to land in ONE place
 * (areaConversion.js).
 *
 * Strict-rule audit
 *   • Pure function. No I/O.
 *   • Never throws. Bad input falls through to the DEFAULT.
 *   • Idempotent. Two calls with the same code return the
 *     same string.
 *   • Coexists with areaConversion.getDefaultUnit — does not
 *     replace it.
 */

import { getDefaultUnit } from '../lib/units/areaConversion.js';

/**
 * Spec §1 — flat country → unit map. Public so callers that
 * want to render "X uses {unit}" copy can read the per-country
 * default without paying the function-call cost.
 *
 * The map mirrors the launch-set countries:
 *   • US — acres (US tradition; matches USDA reporting).
 *   • GH / NG / IN — hectares (metric-tier markets).
 *   • DEFAULT — hectares (safer fallback for any new market;
 *               metric covers more of the global pilot set).
 */
export const DEFAULT_UNIT_BY_COUNTRY = Object.freeze({
  US:      'acres',
  GH:      'hectares',
  NG:      'hectares',
  IN:      'hectares',
  DEFAULT: 'hectares',
});

/**
 * getUnit(countryCode) → 'acres' | 'hectares'.
 *
 * Looks up the per-country default and falls through to
 * DEFAULT for any unknown / missing code. The lookup is
 * case-insensitive and trims whitespace so a value passed
 * straight from a form input still resolves correctly.
 *
 * @param {string|null|undefined} countryCode — ISO 2-letter code.
 * @returns {string} — 'acres' or 'hectares'.
 */
export function getUnit(countryCode) {
  const iso = String(countryCode || '').trim().toUpperCase();
  if (!iso) return DEFAULT_UNIT_BY_COUNTRY.DEFAULT;
  // Prefer the spec map first so a country listed there always
  // wins over whatever the wider areaConversion engine would
  // pick. For codes not on the spec map, delegate to the
  // existing areaConversion.getDefaultUnit so a new country
  // added there flows through automatically.
  if (Object.prototype.hasOwnProperty.call(DEFAULT_UNIT_BY_COUNTRY, iso)) {
    return DEFAULT_UNIT_BY_COUNTRY[iso];
  }
  try {
    const wider = getDefaultUnit({ farmType: 'small_farm', countryCode: iso });
    // areaConversion may return 'sqft' / 'sqm' for some matrices
    // (US-only edge cases that the spec doesn't cover). Force
    // the answer into the spec's two-value vocabulary so
    // callers reading the spec contract never see surprise
    // values like 'sqft'.
    if (wider === 'acres' || wider === 'hectares') return wider;
  } catch { /* swallow — fall through to DEFAULT */ }
  return DEFAULT_UNIT_BY_COUNTRY.DEFAULT;
}

export default { DEFAULT_UNIT_BY_COUNTRY, getUnit };
