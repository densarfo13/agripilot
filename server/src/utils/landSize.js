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
  if (value == null || isNaN(value)) return null;
  const u = (unit || 'ACRE').toUpperCase();
  const factor = TO_HECTARES[u];
  if (!factor) return null;
  return Math.round(value * factor * 1e6) / 1e6;
}

/**
 * Convert hectares to a target unit.
 * @param {number} hectares
 * @param {string} unit - target unit
 * @returns {number}
 */
export function fromHectares(hectares, unit) {
  if (hectares == null || isNaN(hectares)) return null;
  const u = (unit || 'ACRE').toUpperCase();
  const factor = FROM_HECTARES[u];
  if (!factor) return null;
  return Math.round(hectares * factor * 1e6) / 1e6;
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
 * Returns an object with landSizeValue, landSizeUnit, landSizeHectares,
 * and farmSizeAcres (backward compat).
 */
export function computeLandSizeFields(value, unit) {
  if (value == null || value === '' || isNaN(Number(value))) {
    return { landSizeValue: null, landSizeUnit: null, landSizeHectares: null };
  }
  const numVal = parseFloat(value);
  const u = (unit || 'ACRE').toUpperCase();
  if (!VALID_UNITS.includes(u)) {
    return { landSizeValue: numVal, landSizeUnit: 'ACRE', landSizeHectares: toHectares(numVal, 'ACRE') };
  }
  return {
    landSizeValue: numVal,
    landSizeUnit: u,
    landSizeHectares: toHectares(numVal, u),
  };
}

export { VALID_UNITS, UNIT_LABELS };
