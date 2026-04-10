/**
 * Farmer Lifecycle State — single source of truth.
 *
 * Determines what state a farmer is in and what they should see/do.
 * Used by: FarmerDashboardPage, score card, season CTA, action guards.
 *
 * States:
 *   NEW               — approved user, no farm profile yet
 *   SETUP_INCOMPLETE  — farm profile exists but missing required fields
 *   ACTIVE            — farm profile complete, normal usage allowed
 */

// ─── Required fields for a complete farm profile ─────────
// These are the minimum fields needed before score/season/actions unlock.
// GPS, photo, farm name, and other metadata are NOT required.
const REQUIRED_FIELDS = [
  { key: 'crop',             label: 'Crop type' },
  { key: 'landSizeValue',    label: 'Land size',         fallback: 'farmSizeAcres' },
  { key: 'landSizeUnit',     label: 'Land size unit' },
  { key: 'landSizeHectares', label: 'Normalized land size' },
];

// Country is on the farmer record, not the farm profile, so checked separately.
const COUNTRY_REQUIRED = true;

// ─── State enum ──────────────────────────────────────────

export const FARMER_STATE = {
  NEW: 'NEW',
  SETUP_INCOMPLETE: 'SETUP_INCOMPLETE',
  ACTIVE: 'ACTIVE',
};

// ─── Core completion check ───────────────────────────────

/**
 * Check if a farm profile has all required fields.
 * @param {object|null} farmProfile - The farm profile record
 * @param {object|null} opts - { countryCode } from farmer record
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

  // Country comes from farmer record or profile
  if (COUNTRY_REQUIRED) {
    const country = opts.countryCode || farmProfile.countryCode;
    if (!country || (typeof country === 'string' && country.trim().length < 2)) {
      missing.push('Country');
    }
  }

  return { complete: missing.length === 0, missing };
}

// ─── Lifecycle state derivation ──────────────────────────

/**
 * Derive the farmer's lifecycle state from their data.
 * @param {object} params
 * @param {object|null} params.farmProfile - Current farm profile (null = no profile)
 * @param {string|null} params.countryCode - From farmer record
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

// ─── Action guards ───────────────────────────────────────

/**
 * Whether the farmer can start a season.
 */
export function canStartSeason(lifecycleState) {
  return lifecycleState.state === FARMER_STATE.ACTIVE;
}

/**
 * Whether the farm score should be displayed.
 */
export function canShowScore(lifecycleState) {
  return lifecycleState.state === FARMER_STATE.ACTIVE;
}

/**
 * Whether the farmer can submit progress updates.
 */
export function canAddUpdate(lifecycleState) {
  return lifecycleState.state === FARMER_STATE.ACTIVE;
}

// ─── Exports for shared use ──────────────────────────────

export { REQUIRED_FIELDS, COUNTRY_REQUIRED };
