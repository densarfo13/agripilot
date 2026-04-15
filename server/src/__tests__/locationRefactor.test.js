/**
 * Location Input Refactor — tests.
 *
 * Verifies:
 * 1. "Village / Region" replaced with "Enter your location"
 * 2. Free text location input with global placeholder
 * 3. GPS is optional (not required by validation)
 * 4. location_text still required
 * 5. GPS still stored when provided
 * 6. No country-specific labeling in location field
 * 7. i18n keys updated
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  PROFILE SETUP — location input UI
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup — location input refactored', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('uses setup.location label (not setup.village)', () => {
    expect(src).toContain("t('setup.location')");
    expect(src).not.toContain("t('setup.village')");
  });

  it('uses setup.locationPlaceholder for placeholder', () => {
    expect(src).toContain("t('setup.locationPlaceholder')");
  });

  it('still has location field in form state', () => {
    expect(src).toContain("location: ''");
    expect(src).toContain("updateField('location'");
  });

  it('GPS section is labeled as optional', () => {
    expect(src).toContain("t('setup.gpsOptional')");
  });

  it('GPS section no longer shows farmLocation heading', () => {
    expect(src).not.toContain("t('location.farmLocation')");
  });

  it('completion check does not include GPS fields', () => {
    // Completion should only check: farmerName, farmName, country, location, size, cropType
    // Should NOT contain gpsLat or gpsLng in completion checks
    const completionBlock = src.slice(
      src.indexOf('const completion = useMemo'),
      src.indexOf('], [form])') + 12
    );
    expect(completionBlock).not.toContain('gpsLat');
    expect(completionBlock).not.toContain('gpsLng');
  });

  it('still keeps GPS detection button', () => {
    expect(src).toContain('handleGetGPS');
    expect(src).toContain("t('location.getMyLocation')");
  });

  it('still stores GPS coordinates in form', () => {
    expect(src).toContain("updateField('gpsLat'");
    expect(src).toContain("updateField('gpsLng'");
  });
});

// ═══════════════════════════════════════════════════════════
//  VALIDATION — GPS optional, location required
// ═══════════════════════════════════════════════════════════

describe('Validation — GPS optional', () => {
  it('accepts profile without GPS coordinates', async () => {
    const { validateFarmProfilePayload } = await import('../../lib/validation.js');
    const result = validateFarmProfilePayload({
      farmerName: 'Test', farmName: 'Farm', country: 'Ghana', location: 'Accra',
      cropType: 'MAIZE', size: 5, sizeUnit: 'ACRE',
      // NO gpsLat, NO gpsLng
    });
    expect(result.isValid).toBe(true);
    expect(result.data.gpsLat).toBeNull();
    expect(result.data.gpsLng).toBeNull();
  });

  it('still requires location text', async () => {
    const { validateFarmProfilePayload } = await import('../../lib/validation.js');
    const result = validateFarmProfilePayload({
      farmerName: 'Test', farmName: 'Farm', country: 'Ghana', location: '',
      cropType: 'MAIZE', size: 5, sizeUnit: 'ACRE',
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.location).toBeTruthy();
  });

  it('accepts valid GPS when provided', async () => {
    const { validateFarmProfilePayload } = await import('../../lib/validation.js');
    const result = validateFarmProfilePayload({
      farmerName: 'Test', farmName: 'Farm', country: 'Kenya', location: 'Nairobi',
      cropType: 'MAIZE', size: 5, sizeUnit: 'ACRE',
      gpsLat: -1.28, gpsLng: 36.82,
    });
    expect(result.isValid).toBe(true);
    expect(result.data.gpsLat).toBe(-1.28);
    expect(result.data.gpsLng).toBe(36.82);
  });

  it('rejects invalid GPS even though optional', async () => {
    const { validateFarmProfilePayload } = await import('../../lib/validation.js');
    const result = validateFarmProfilePayload({
      farmerName: 'Test', farmName: 'Farm', country: 'Ghana', location: 'Accra',
      cropType: 'MAIZE', size: 5, sizeUnit: 'ACRE',
      gpsLat: 999, gpsLng: 36.82,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.gpsLat).toBeTruthy();
  });

  it('validation source no longer requires GPS', () => {
    const src = read('server/lib/validation.js');
    expect(src).not.toContain("errors.gpsLat = 'Latitude is required'");
    expect(src).not.toContain("errors.gpsLng = 'Longitude is required'");
  });
});

// ═══════════════════════════════════════════════════════════
//  DATA STORAGE — unchanged schema
// ═══════════════════════════════════════════════════════════

describe('Data storage — location fields unchanged', () => {
  const schema = read('server/prisma/schema.prisma');

  it('FarmProfile still has locationName field', () => {
    expect(schema).toContain('locationName');
  });

  it('FarmProfile still has latitude field (optional)', () => {
    expect(schema).toMatch(/latitude\s+Float\?/);
  });

  it('FarmProfile still has longitude field (optional)', () => {
    expect(schema).toMatch(/longitude\s+Float\?/);
  });

  it('FarmProfile still has country field (optional)', () => {
    expect(schema).toMatch(/country\s+String\?/);
  });
});

describe('API — location mapping unchanged', () => {
  const route = read('server/routes/farmProfile.js');

  it('mapProfile returns location from locationName', () => {
    expect(route).toContain('location: profile.locationName');
  });

  it('profileData maps location to locationName', () => {
    expect(route).toContain('locationName: validation.data.location');
  });

  it('profileData maps GPS to latitude/longitude', () => {
    expect(route).toContain('latitude: validation.data.gpsLat');
    expect(route).toContain('longitude: validation.data.gpsLng');
  });
});

// ═══════════════════════════════════════════════════════════
//  I18N — translation keys
// ═══════════════════════════════════════════════════════════

describe('i18n — location translation keys', () => {
  const translations = read('src/i18n/translations.js');

  it('has setup.location key', () => {
    expect(translations).toContain("'setup.location'");
  });

  it('has setup.locationPlaceholder key', () => {
    expect(translations).toContain("'setup.locationPlaceholder'");
  });

  it('has setup.gpsOptional key', () => {
    expect(translations).toContain("'setup.gpsOptional'");
  });

  it('setup.location says "Enter your location" (not Village/Region)', () => {
    const match = translations.match(/'setup\.location':\s*\{[^}]*en:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toBe('Enter your location');
  });

  it('placeholder includes example cities', () => {
    const match = translations.match(/'setup\.locationPlaceholder':\s*\{[^}]*en:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('Accra');
    expect(match[1]).toContain('Kumasi');
  });

  it('gpsOptional label mentions optional', () => {
    const match = translations.match(/'setup\.gpsOptional':\s*\{[^}]*en:\s*'([^']*)'/);
    expect(match).toBeTruthy();
    expect(match[1]).toContain('optional');
  });

  it('all new keys have 5 languages (en, fr, sw, ha, tw)', () => {
    for (const key of ['setup.location', 'setup.locationPlaceholder', 'setup.gpsOptional']) {
      const keyPattern = new RegExp(`'${key.replace(/\./g, '\\.')}':.*?\\{[^}]*en:.*?fr:.*?sw:.*?ha:.*?tw:`);
      expect(translations).toMatch(keyPattern);
    }
  });

  it('old setup.village key still exists for backward compat', () => {
    expect(translations).toContain("'setup.village'");
  });
});

// ═══════════════════════════════════════════════════════════
//  NO COUNTRY-SPECIFIC LABELING
// ═══════════════════════════════════════════════════════════

describe('Location — no country-specific structure', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('location input has no region/district/province labels', () => {
    expect(src).not.toContain('Region');
    expect(src).not.toContain('District');
    expect(src).not.toContain('Province');
  });

  it('location field is plain text input (no dropdown)', () => {
    // Should be <input> not <select>
    const locationSection = src.slice(
      src.indexOf("t('setup.location')"),
      src.indexOf("t('setup.farmSize')")
    );
    expect(locationSection).toContain('<input');
    expect(locationSection).not.toContain('<select');
  });
});
