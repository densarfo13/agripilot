/**
 * validateFarmProfile(profile) → { isValid, errors }
 *
 * Hardens the Save Farm Profile flow so it never fails silently.
 * Returns a per-field error map the UI can render inline rather
 * than a single generic message.
 *
 * Fields validated:
 *   farmerName        required, 2+ chars
 *   farmName          required, 2+ chars
 *   country           required
 *   state             required when country == US
 *   size              required, positive, finite, ≤ 100_000
 *   sizeUnit          required, 'acre' | 'hectare' | 'square_meter'
 *   cropType          required
 *   farmType          required, enum
 *   experienceLevel   optional, enum
 *   growingStyle      required when farmType == backyard
 *
 * Returns:
 *   { isValid: boolean, errors: { [field]: 'error_code' } }
 *
 * Error codes are short stable identifiers the UI maps to
 * translation keys; callers never see raw English.
 */

const FARM_TYPES = new Set(['backyard', 'small_farm', 'commercial']);
const EXPERIENCE = new Set(['new', 'experienced', 'beginner', 'intermediate', 'advanced']);
const GROWING_STYLES = new Set(['container', 'raised_bed', 'in_ground', 'mixed']);
const UNITS = new Set(['acre', 'acres', 'hectare', 'hectares', 'square_meter', 'square_meters']);

export function validateFarmProfile(profile = {}) {
  const errors = {};
  const p = profile || {};

  if (!isNonEmptyString(p.farmerName) || p.farmerName.trim().length < 2) errors.farmerName = 'required';
  if (!isNonEmptyString(p.farmName)   || p.farmName.trim().length < 2)   errors.farmName = 'required';

  const country = String(p.country || '').toUpperCase();
  if (!country) errors.country = 'required';

  if (country === 'US' || country === 'USA') {
    if (!isNonEmptyString(p.stateCode || p.state)) errors.state = 'required_for_us';
  }

  const size = Number(p.size);
  if (!(size > 0) || !Number.isFinite(size)) errors.size = 'invalid_value';
  else if (size > 100_000) errors.size = 'too_large';

  const unit = String(p.sizeUnit || '').toLowerCase();
  if (!unit || !UNITS.has(unit)) errors.sizeUnit = 'invalid_unit';

  if (!isNonEmptyString(p.cropType)) errors.cropType = 'required';

  // farmType is required by the onboarding flow — without it the
  // recommendation + task engines can't pick the right track.
  if (!p.farmType) {
    errors.farmType = 'required';
  } else if (!FARM_TYPES.has(String(p.farmType).toLowerCase())) {
    errors.farmType = 'invalid_enum';
  }
  if (p.experienceLevel && !EXPERIENCE.has(String(p.experienceLevel).toLowerCase())) {
    errors.experienceLevel = 'invalid_enum';
  }

  const farmType = String(p.farmType || '').toLowerCase();
  if (farmType === 'backyard') {
    if (!p.growingStyle || !GROWING_STYLES.has(String(p.growingStyle).toLowerCase())) {
      errors.growingStyle = 'required_for_backyard';
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Map error codes → i18n keys the UI can resolve with t(). */
export const VALIDATION_I18N_KEYS = Object.freeze({
  required: 'validation.required',
  required_for_us: 'validation.stateRequiredForUs',
  required_for_backyard: 'validation.growingStyleRequired',
  invalid_value: 'validation.invalidNumber',
  invalid_unit: 'validation.invalidUnit',
  invalid_enum: 'validation.invalidChoice',
  too_large: 'validation.sizeTooLarge',
});

export const _internal = { FARM_TYPES, EXPERIENCE, GROWING_STYLES, UNITS };
