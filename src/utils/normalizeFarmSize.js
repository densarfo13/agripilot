/**
 * normalizeFarmSize(value, unit) — convert user-entered size to a
 * canonical internal unit (acres) plus both display values so the
 * UI can render whichever the farmer prefers.
 *
 * Returns:
 *   {
 *     acres, hectares,
 *     sizeBand: 'small' | 'medium' | 'large',
 *     originalValue, originalUnit,
 *     isValid, error
 *   }
 *
 * Unit aliases supported:
 *   'acre' | 'acres' | 'ac' → acres
 *   'hectare' | 'hectares' | 'ha' → hectares
 *   'sqm' | 'square_meter' | 'square_meters' | 'm2' → square meters
 */

const ACRES_PER_HECTARE = 2.47105;
const SQM_PER_ACRE = 4046.86;

const SIZE_BANDS = Object.freeze([
  { max: 1,   band: 'small' },
  { max: 5,   band: 'medium' },
  { max: Infinity, band: 'large' },
]);

export function normalizeFarmSize(value, unit) {
  const raw = Number(value);
  const u = String(unit || '').trim().toLowerCase();

  if (!Number.isFinite(raw) || raw < 0) {
    return { isValid: false, error: 'invalid_value', originalValue: value, originalUnit: unit };
  }
  if (raw === 0) {
    return { isValid: false, error: 'zero_value', originalValue: value, originalUnit: unit };
  }

  let acres;
  if (u === 'acre' || u === 'acres' || u === 'ac') acres = raw;
  else if (u === 'hectare' || u === 'hectares' || u === 'ha') acres = raw * ACRES_PER_HECTARE;
  else if (u === 'sqm' || u === 'square_meter' || u === 'square_meters' || u === 'm2' || u === 'sq m') {
    acres = raw / SQM_PER_ACRE;
  } else {
    return { isValid: false, error: 'invalid_unit', originalValue: value, originalUnit: unit };
  }

  const sizeBand = (SIZE_BANDS.find((b) => acres <= b.max) || SIZE_BANDS[SIZE_BANDS.length - 1]).band;

  return {
    isValid: true,
    acres: Math.round(acres * 100) / 100,
    hectares: Math.round((acres / ACRES_PER_HECTARE) * 100) / 100,
    sizeBand,
    originalValue: raw,
    originalUnit: u,
    error: null,
  };
}

/** Render helper — returns "2.5 acres" or "1.0 ha" based on preferred unit. */
export function formatFarmSize(normalized, preferredUnit = 'acres') {
  if (!normalized?.isValid) return '—';
  const u = String(preferredUnit).toLowerCase();
  if (u === 'hectare' || u === 'hectares' || u === 'ha') {
    return `${normalized.hectares.toFixed(1)} ha`;
  }
  return `${normalized.acres.toFixed(1)} acres`;
}

export const _internal = { ACRES_PER_HECTARE, SQM_PER_ACRE, SIZE_BANDS };
