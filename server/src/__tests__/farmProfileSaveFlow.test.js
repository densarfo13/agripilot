/**
 * Farm Profile Save Flow — source-code enforcement tests.
 *
 * Verifies:
 * 1. Country field is a <select> dropdown (not text input)
 * 2. Country dropdown uses i18n-iso-countries package
 * 3. Client-side validation with visible error messages
 * 4. Save button prevents double-click while saving
 * 5. Console logging for debugging
 * 6. Completion % only reflects required fields (no GPS)
 * 7. Farm Location stays optional
 * 8. Save redirects to /dashboard on success
 * 9. i18n keys for validation messages
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  COUNTRY DROPDOWN — i18n-iso-countries
// ═══════════════════════════════════════════════════════════

describe('Country field — searchable dropdown', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('imports i18n-iso-countries package', () => {
    expect(src).toContain("from 'i18n-iso-countries'");
  });

  it('imports English locale for country names', () => {
    expect(src).toContain("from 'i18n-iso-countries/langs/en.json'");
  });

  it('registers the English locale', () => {
    expect(src).toContain('countries.registerLocale(enLocale)');
  });

  it('builds sorted country options from getNames', () => {
    expect(src).toContain("countries.getNames('en'");
    expect(src).toContain('COUNTRY_OPTIONS');
  });

  it('renders country as <select> or pill with change button', () => {
    // Country is shown as a pill when set, or a <select> when empty
    expect(src).toContain('<select');
    expect(src).toContain("t('setup.selectCountry')");
  });

  it('has a placeholder "Select country" option', () => {
    expect(src).toContain("t('setup.selectCountry')");
  });

  it('maps COUNTRY_OPTIONS to <option> elements', () => {
    expect(src).toContain('COUNTRY_OPTIONS.map');
    expect(src).toContain('<option key={name}');
  });

  it('auto-switches size unit when country changes', () => {
    expect(src).toContain('defaultUnitForCountry(newCountry)');
  });
});

// ═══════════════════════════════════════════════════════════
//  CLIENT-SIDE VALIDATION — visible error messages
// ═══════════════════════════════════════════════════════════

describe('Save flow — client-side validation', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('has validateBeforeSubmit function', () => {
    expect(src).toContain('function validateBeforeSubmit()');
  });

  it('validates farmerName is required', () => {
    expect(src).toContain("t('setup.farmerNameRequired')");
  });

  it('validates farmName is required', () => {
    expect(src).toContain("t('setup.farmNameRequired')");
  });

  it('validates country is required', () => {
    expect(src).toContain("t('setup.countryRequired')");
  });

  it('validates location is required', () => {
    expect(src).toContain("t('setup.locationRequired')");
  });

  it('validates farm size is required', () => {
    expect(src).toContain("t('setup.sizeRequired')");
  });

  it('validates farm size must be > 0', () => {
    expect(src).toContain("t('setup.sizeInvalid')");
  });

  it('validates crop is required', () => {
    expect(src).toContain("t('setup.cropRequired')");
  });

  it('calls validateBeforeSubmit before saving', () => {
    // handleSave should call validateBeforeSubmit
    const handleSaveIdx = src.indexOf('async function handleSave()');
    const handleSaveSection = src.substring(handleSaveIdx, handleSaveIdx + 800);
    expect(handleSaveSection).toContain('validateBeforeSubmit()');
  });

  it('shows field errors from validation', () => {
    expect(src).toContain('setFieldErrors(validationErrors)');
  });

  it('returns early if validation fails (does not call saveProfile)', () => {
    const handleSaveIdx = src.indexOf('async function handleSave()');
    const earlyReturnIdx = src.indexOf("'Validation failed:'", handleSaveIdx);
    const saveCallIdx = src.indexOf('saveProfile(form)', handleSaveIdx);
    // The validation return should come before the save call
    expect(earlyReturnIdx).toBeLessThan(saveCallIdx);
  });
});

// ═══════════════════════════════════════════════════════════
//  SAVE BUTTON — double-click prevention + loading state
// ═══════════════════════════════════════════════════════════

describe('Save button — reliability', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('has submitGuardRef for double-click prevention', () => {
    expect(src).toContain('submitGuardRef.current');
  });

  it('disables button while submitting', () => {
    expect(src).toContain('disabled={submitting}');
  });

  it('shows loading text while saving', () => {
    expect(src).toContain("t('setup.saving')");
  });

  it('resets guard in finally block', () => {
    expect(src).toContain('submitGuardRef.current = false');
  });
});

// ═══════════════════════════════════════════════════════════
//  CONSOLE LOGGING — debugging
// ═══════════════════════════════════════════════════════════

describe('Save flow — console logging for debugging', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('logs when save is clicked', () => {
    expect(src).toContain("console.log('Save Farm Profile clicked')");
  });

  it('logs the form data being submitted', () => {
    expect(src).toContain("console.log('Submitting farm profile:'");
  });

  it('logs successful save result', () => {
    expect(src).toContain("console.log('Farm profile saved:'");
  });

  it('logs errors to console', () => {
    expect(src).toContain("console.error('Farm profile submission error:'");
  });

  it('logs validation failures', () => {
    expect(src).toContain("console.warn('Validation failed:'");
  });
});

// ═══════════════════════════════════════════════════════════
//  COMPLETION % — only required fields
// ═══════════════════════════════════════════════════════════

describe('Completion percentage — required fields only', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('fieldChecks (used by completion) does not include gpsLat', () => {
    // fieldChecks drives completion — extract the fieldChecks useMemo
    const checksBlock = src.slice(
      src.indexOf('const fieldChecks = useMemo'),
      src.indexOf('}, [form])') + 12
    );
    expect(checksBlock).not.toContain('gpsLat');
    expect(checksBlock).not.toContain('gpsLng');
  });

  it('fieldChecks does not include farmLocation or locationLabel', () => {
    const checksBlock = src.slice(
      src.indexOf('const fieldChecks = useMemo'),
      src.indexOf('}, [form])') + 12
    );
    expect(checksBlock).not.toContain('farmLocation');
    expect(checksBlock).not.toContain('locationLabel');
  });

  it('completion includes required fields', () => {
    // fieldChecks drives completion — check field names there
    const checksBlock = src.slice(
      src.indexOf('const fieldChecks = useMemo'),
      src.indexOf('}, [form])') + 12
    );
    expect(checksBlock).toContain('farmerName');
    expect(checksBlock).toContain('farmName');
    expect(checksBlock).toContain('country');
    expect(checksBlock).toContain('location');
    expect(checksBlock).toContain('size');
    expect(checksBlock).toContain('cropType');
  });
});

// ═══════════════════════════════════════════════════════════
//  REDIRECT & ERROR HANDLING
// ═══════════════════════════════════════════════════════════

describe('Save flow — redirect and error handling', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('redirects to /dashboard after successful save', () => {
    expect(src).toContain("navigate('/dashboard')");
  });

  it('shows save error message on failure', () => {
    expect(src).toContain('setSaveError(');
    expect(src).toContain("t('setup.saveFailed')");
  });

  it('handles timeout gracefully', () => {
    expect(src).toContain("t('setup.saveTimeout')");
  });

  it('displays save error in UI', () => {
    expect(src).toContain('{saveError &&');
  });
});

// ═══════════════════════════════════════════════════════════
//  i18n — validation keys
// ═══════════════════════════════════════════════════════════

describe('i18n — validation message keys', () => {
  const translations = read('src/i18n/translations.js');

  const validationKeys = [
    'setup.selectCountry',
    'setup.farmerNameRequired',
    'setup.farmNameRequired',
    'setup.countryRequired',
    'setup.locationRequired',
    'setup.sizeRequired',
    'setup.sizeInvalid',
    'setup.cropRequired',
  ];

  for (const key of validationKeys) {
    it(`has translation key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('validation keys have all 5 languages (en, fr, sw, ha, tw)', () => {
    for (const key of validationKeys) {
      const keyPattern = new RegExp(`'${key.replace(/\./g, '\\.')}':.*?\\{[^}]*en:.*?fr:.*?sw:.*?ha:.*?tw:`);
      expect(translations).toMatch(keyPattern);
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  FARM LOCATION — stays optional
// ═══════════════════════════════════════════════════════════

describe('Farm Location — optional', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('GPS section exists with location detection', () => {
    // GPS is now the primary action via "Use my location" button
    expect(src).toContain("t('location.getMyLocation')");
  });

  it('validation does NOT require GPS', () => {
    const validateFn = src.slice(
      src.indexOf('function validateBeforeSubmit()'),
      src.indexOf('return { errors, hasError }') + 30
    );
    expect(validateFn).not.toContain('gpsLat');
    expect(validateFn).not.toContain('gpsLng');
  });
});

// ═══════════════════════════════════════════════════════════
//  GPS AUTO-FILL — fills empty fields, never overwrites user data
// ═══════════════════════════════════════════════════════════

describe('GPS auto-fill — smart field population', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('handleGetGPS auto-fills location only when empty', () => {
    const gpsStart = src.indexOf('async function handleGetGPS()');
    const gpsEnd = src.indexOf('// ─── Size preset');
    const gpsFn = src.substring(gpsStart, gpsEnd);
    // Auto-fills location from GPS, but only when empty
    expect(gpsFn).toContain("!form.location.trim()");
    expect(gpsFn).toContain("updateField('location'");
    expect(gpsFn).toContain("updateField('locationLabel'");
  });

  it('handleGetGPS auto-fills country from GPS when default', () => {
    const gpsStart = src.indexOf('async function handleGetGPS()');
    const gpsEnd = src.indexOf('// ─── Size preset');
    const gpsFn = src.substring(gpsStart, gpsEnd);
    // Auto-fills country, guarded by "!form.country || form.country === 'Ghana'"
    expect(gpsFn).toContain("updateField('country'");
    expect(gpsFn).toContain("!form.country || form.country === 'Ghana'");
  });

  it('handleGetGPS stores GPS coordinates', () => {
    const gpsStart = src.indexOf('async function handleGetGPS()');
    const gpsEnd = src.indexOf('// ─── Size preset');
    const gpsFn = src.substring(gpsStart, gpsEnd);
    expect(gpsFn).toContain("updateField('gpsLat'");
    expect(gpsFn).toContain("updateField('gpsLng'");
  });

  it('handleGetGPS stores locationLabel from reverse geocoding', () => {
    const gpsStart = src.indexOf('async function handleGetGPS()');
    const gpsEnd = src.indexOf('// ─── Size preset');
    const gpsFn = src.substring(gpsStart, gpsEnd);
    expect(gpsFn).toContain("updateField('locationLabel'");
  });

  it('form state includes locationLabel field', () => {
    expect(src).toContain("locationLabel: ''");
    expect(src).toContain("locationLabel: profile?.locationLabel");
  });

  it('GPS success section displays locationLabel', () => {
    expect(src).toContain('form.locationLabel');
  });

  it('country can also change via dropdown', () => {
    expect(src).toContain('<select');
    expect(src).toContain("updateField('country'");
  });
});
