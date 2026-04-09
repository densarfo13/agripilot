/**
 * Land size unit conversion utilities (client-side).
 *
 * Mirrors server/src/utils/landSize.js — keep in sync.
 */

export const VALID_UNITS = ['ACRE', 'HECTARE', 'SQUARE_METER'];

const TO_HECTARES = {
  ACRE: 0.404686,
  HECTARE: 1,
  SQUARE_METER: 0.0001,
};

export const UNIT_LABELS = {
  ACRE: 'acres',
  HECTARE: 'hectares',
  SQUARE_METER: 'm²',
};

export const UNIT_OPTIONS = [
  { value: 'ACRE', label: 'Acres' },
  { value: 'HECTARE', label: 'Hectares' },
  { value: 'SQUARE_METER', label: 'Square Meters' },
];

/**
 * Convert a value to hectares.
 */
export function toHectares(value, unit) {
  if (value == null || isNaN(value)) return null;
  const factor = TO_HECTARES[(unit || 'ACRE').toUpperCase()];
  if (!factor) return null;
  return Math.round(value * factor * 1e6) / 1e6;
}

/**
 * Format a land size for display: "5 acres", "2.5 hectares", "500 m²"
 */
export function formatLandSize(value, unit) {
  if (value == null) return '—';
  const u = (unit || 'ACRE').toUpperCase();
  const label = UNIT_LABELS[u] || 'acres';
  // Show up to 2 decimal places, strip trailing zeros
  const formatted = parseFloat(Number(value).toFixed(2));
  return `${formatted} ${label}`;
}

/**
 * Compute landSizeHectares from value + unit (for pre-submit).
 */
export function computeLandSizeFields(value, unit) {
  if (value == null || value === '' || isNaN(Number(value))) {
    return { landSizeValue: null, landSizeUnit: null, landSizeHectares: null };
  }
  const numVal = parseFloat(value);
  const u = (unit || 'ACRE').toUpperCase();
  return {
    landSizeValue: numVal,
    landSizeUnit: u,
    landSizeHectares: toHectares(numVal, u),
  };
}
