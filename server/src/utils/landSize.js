/**
 * Land size unit conversion utilities.
 *
 * Supported units: ACRE, HECTARE, SQUARE_METER
 * Internal normalization: everything stored as hectares in landSizeHectares.
 */

const VALID_UNITS = ['ACRE', 'HECTARE', 'SQUARE_METER'];

const TO_HECTARES = {
  ACRE: 0.404686,
  HECTARE: 1,
  SQUARE_METER: 0.0001,
};

const FROM_HECTARES = {
  ACRE: 1 / 0.404686,     // ~2.47105
  HECTARE: 1,
  SQUARE_METER: 10000,
};

const UNIT_LABELS = {
  ACRE: 'acres',
  HECTARE: 'hectares',
  SQUARE_METER: 'm²',
};

/**
 * Convert a land size value to hectares.
 * @param {number} value - The numeric value
 * @param {string} unit - One of ACRE, HECTARE, SQUARE_METER
 * @returns {number} value in hectares, rounded to 6 decimal places
 */
export function toHectares(value, unit) {
  // B7 — `isNaN("abc")` returns true via JS coercion which works by
  // accident. Use Number.isNaN(Number(x)) so the check is explicit
  // about coercing once and rejecting non-numeric input.
  const n = Number(value);
  if (value == null || Number.isNaN(n)) return null;
  const u = (unit || 'ACRE').toUpperCase();
  const factor = TO_HECTARES[u];
  if (!factor) return null;
  return Math.round(n * factor * 1e6) / 1e6;
}

/**
 * Convert hectares to a target unit.
 * @param {number} hectares
 * @param {string} unit - target unit
 * @returns {number}
 */
export function fromHectares(hectares, unit) {
  // B7 — same explicit coercion as toHectares.
  const n = Number(hectares);
  if (hectares == null || Number.isNaN(n)) return null;
  const u = (unit || 'ACRE').toUpperCase();
  const factor = FROM_HECTARES[u];
  if (!factor) return null;
  return Math.round(n * factor * 1e6) / 1e6;
}

/**
 * Check if a unit string is valid.
 * @param {string} unit
 * @returns {boolean}
 */
export function isValidUnit(unit) {
  return VALID_UNITS.includes((unit || '').toUpperCase());
}

/**
 * Get the display label for a unit.
 * @param {string} unit
 * @returns {string}
 */
export function unitLabel(unit) {
  return UNIT_LABELS[(unit || 'ACRE').toUpperCase()] || 'acres';
}

/**
 * Compute all land size fields from a value + unit pair.
 * Returns landSizeValue, landSizeUnit, landSizeHectares, AND
 * normalizedAreaSqm (m², persisted server-side per Fix P1.4 so the
 * intelligence engines never have to recompute area on read).
 */
export function computeLandSizeFields(value, unit) {
  if (value == null || value === '' || isNaN(Number(value))) {
    return {
      landSizeValue: null, landSizeUnit: null,
      landSizeHectares: null, normalizedAreaSqm: null,
    };
  }
  const numVal = parseFloat(value);
  const u = (unit || 'ACRE').toUpperCase();
  const safeUnit = VALID_UNITS.includes(u) ? u : 'ACRE';
  const hectares = toHectares(numVal, safeUnit);
  const sqm = hectares == null ? null : Math.round(hectares * 10000 * 100) / 100;
  return {
    landSizeValue: numVal,
    landSizeUnit: safeUnit,
    landSizeHectares: hectares,
    normalizedAreaSqm: sqm,
  };
}

export { VALID_UNITS, UNIT_LABELS };
