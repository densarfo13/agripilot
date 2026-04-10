/**
 * Farmer Lifecycle State — server-side source of truth.
 *
 * Mirrors the frontend farmerLifecycle.js logic exactly.
 * Used by: farm profile routes, season guards, API responses.
 *
 * States:
 *   NEW               — approved user, no farm profile yet
 *   SETUP_INCOMPLETE  — farm profile exists but missing required fields
 *   ACTIVE            — farm profile complete, normal usage allowed
 */

export const FARMER_STATE = {
  NEW: 'NEW',
  SETUP_INCOMPLETE: 'SETUP_INCOMPLETE',
  ACTIVE: 'ACTIVE',
};

const REQUIRED_FIELDS = [
  { key: 'crop',             label: 'Crop type' },
  { key: 'landSizeValue',    label: 'Land size',         fallback: 'farmSizeAcres' },
  { key: 'landSizeUnit',     label: 'Land size unit' },
  { key: 'landSizeHectares', label: 'Normalized land size' },
];

const COUNTRY_REQUIRED = true;

/**
 * Check if a farm profile has all required fields.
 * @param {object|null} farmProfile
 * @param {object} opts - { countryCode }
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function isFarmProfileComplete(farmProfile, opts = {}) {
  if (!farmProfile) return { complete: false, missing: ['Farm profile'] };

  const missing = [];

  for (const field of REQUIRED_FIELDS) {
    const val = farmProfile[field.key] ?? (field.fallback ? farmProfile[field.fallback] : undefined);
    if (val == null || val === '') {
      missing.push(field.label);
    }
  }

  if (COUNTRY_REQUIRED) {
    const country = opts.countryCode || farmProfile.countryCode;
    if (!country || (typeof country === 'string' && country.trim().length < 2)) {
      missing.push('Country');
    }
  }

  return { complete: missing.length === 0, missing };
}

/**
 * Derive the farmer's lifecycle state.
 * @param {object} params
 * @param {object|null} params.farmProfile
 * @param {string|null} params.countryCode
 * @returns {{ state: string, complete: boolean, missing: string[] }}
 */
export function getFarmerLifecycleState({ farmProfile, countryCode }) {
  if (!farmProfile) {
    return { state: FARMER_STATE.NEW, complete: false, missing: ['Farm profile'] };
  }

  const { complete, missing } = isFarmProfileComplete(farmProfile, { countryCode });

  if (!complete) {
    return { state: FARMER_STATE.SETUP_INCOMPLETE, complete: false, missing };
  }

  return { state: FARMER_STATE.ACTIVE, complete: true, missing: [] };
}

export function canStartSeason(lifecycleState) {
  return lifecycleState.state === FARMER_STATE.ACTIVE;
}

export { REQUIRED_FIELDS, COUNTRY_REQUIRED };
