/**
 * validateLocation(loc) → { isValid, errors }
 *
 *   country   required
 *   state     required when the country has a known region list
 *   city      always optional
 *
 * Error codes are stable strings the UI maps to i18n keys so every
 * surface renders the same message in the farmer's language.
 */

import { findCountry, requiresState } from './locationData.js';

export function validateLocation(loc = {}) {
  const errors = {};
  if (!loc || typeof loc !== 'object') {
    return { isValid: false, errors: { country: 'required' } };
  }
  const country = findCountry(loc.country);
  if (!country) {
    errors.country = 'required';
  } else if (requiresState(country.code)) {
    const stateKey = loc.state || loc.stateCode;
    if (!stateKey) errors.state = 'required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export const VALIDATION_I18N_KEYS = Object.freeze({
  'country.required': 'validation.countryRequired',
  'state.required':   'validation.stateRequired',
});
