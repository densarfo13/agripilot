/**
 * Location Display — source-code enforcement tests.
 *
 * Verifies that raw lat/long coordinates are hidden from farmer-facing UI,
 * replaced with human-readable location labels, and that admin views
 * retain coordinate access.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  SCHEMA — locationLabel field exists
// ═══════════════════════════════════════════════════════════

describe('Schema — locationLabel field', () => {
  const schema = read('server/prisma/schema.prisma');

  it('FarmProfile has locationLabel field', () => {
    expect(schema).toContain('locationLabel');
    expect(schema).toContain('location_label');
  });

  it('locationLabel is optional String', () => {
    expect(schema).toContain('locationLabel   String?');
  });
});

// ═══════════════════════════════════════════════════════════
//  MIGRATION — location_label column
// ═══════════════════════════════════════════════════════════

describe('Migration — add location_label', () => {
  const sql = read('server/prisma/migrations/20260413_add_location_label/migration.sql');

  it('adds location_label column', () => {
    expect(sql).toContain('ADD COLUMN "location_label"');
  });

  it('backfills from location_name where available', () => {
    expect(sql).toContain('SET "location_label" = "location_name"');
    expect(sql).toContain('WHERE "location_name" IS NOT NULL');
  });
});

// ═══════════════════════════════════════════════════════════
//  BACKEND — mapProfile returns locationLabel
// ═══════════════════════════════════════════════════════════

describe('Backend farmProfile route — locationLabel', () => {
  const src = read('server/routes/farmProfile.js');

  it('mapProfile includes locationLabel in response', () => {
    expect(src).toContain('locationLabel: profile.locationLabel');
  });

  it('POST / accepts locationLabel from frontend', () => {
    expect(src).toContain('req.body?.locationLabel');
    expect(src).toContain('profileData.locationLabel');
  });

  it('POST /new also accepts locationLabel', () => {
    // Both the main POST and /new route should handle locationLabel
    const newSection = src.split("'/new'")[1] || '';
    expect(newSection).toContain('locationLabel');
  });
});

// ═══════════════════════════════════════════════════════════
//  FARMER UI — no raw coordinates displayed
// ═══════════════════════════════════════════════════════════

describe('ProfileSetupPage — no raw lat/long display', () => {
  const src = read('src/pages/ProfileSetupPage.jsx');

  it('does NOT display .toFixed coordinate format', () => {
    // Should not contain patterns like latitude.toFixed(5) in display
    expect(src).not.toMatch(/latitude\.toFixed\(\d\)/);
    expect(src).not.toMatch(/longitude\.toFixed\(\d\)/);
  });

  it('uses detectAndResolveLocation for GPS capture', () => {
    expect(src).toContain('detectAndResolveLocation');
  });

  it('stores locationLabel from reverse geocoding result', () => {
    expect(src).toContain('locationLabel: label');
  });

  it('shows locationLabel or fallback instead of coordinates', () => {
    expect(src).toContain("form.locationLabel || t('location.captured')");
  });

  it('sends locationLabel in save payload', () => {
    expect(src).toContain('locationLabel: form.locationLabel');
  });

  it('uses i18n key for Farm Location label', () => {
    expect(src).toContain("t('location.farmLocation')");
  });

  it('shows location saved confirmation', () => {
    expect(src).toContain("t('location.capturedCheck')");
  });
});

// ═══════════════════════════════════════════════════════════
//  FARMER UI — V2 ProfileSetup (no lat/lng inputs)
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup (V2) — no lat/lng inputs, farmer-friendly GPS', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('does NOT have latitude text input field', () => {
    expect(src).not.toContain("placeholder=\"Latitude\"");
  });

  it('does NOT have longitude text input field', () => {
    expect(src).not.toContain("placeholder=\"Longitude\"");
  });

  it('does NOT use setup.latitude i18n key', () => {
    expect(src).not.toContain("t('setup.latitude')");
  });

  it('does NOT use setup.longitude i18n key', () => {
    expect(src).not.toContain("t('setup.longitude')");
  });

  it('shows Farm Location heading', () => {
    expect(src).toContain("t('location.farmLocation')");
  });

  it('shows optional description', () => {
    expect(src).toContain("t('location.gpsOptionalDesc')");
  });

  it('shows Get My Location button', () => {
    expect(src).toContain("t('location.getMyLocation')");
  });

  it('shows readable location after GPS capture', () => {
    expect(src).toContain("form.location || t('location.captured')");
  });

  it('shows location saved confirmation', () => {
    expect(src).toContain("t('location.capturedCheck')");
  });

  it('uses farmer-friendly fallback error (not technical)', () => {
    expect(src).toContain("t('location.gpsFallback')");
    expect(src).not.toContain("t('setup.gpsPermissionDenied')");
    expect(src).not.toContain("t('setup.gpsSignalWeak')");
    expect(src).not.toContain("t('setup.gpsTimeout')");
  });

  it('uses reverse geocoding via detectAndResolveLocation', () => {
    expect(src).toContain('detectAndResolveLocation');
  });

  it('still stores gpsLat/gpsLng in form state', () => {
    expect(src).toContain("updateField('gpsLat'");
    expect(src).toContain("updateField('gpsLng'");
  });
});

// ═══════════════════════════════════════════════════════════
//  FARMER UI — LocationDetect component (friendly errors)
// ═══════════════════════════════════════════════════════════

describe('LocationDetect component — farmer-friendly', () => {
  const src = read('src/components/LocationDetect.jsx');

  it('does NOT show technical error messages', () => {
    expect(src).not.toContain('Permission denied');
    expect(src).not.toContain('POSITION_UNAVAILABLE');
    expect(src).not.toContain('TIMEOUT');
    expect(src).not.toContain('err.message');
  });

  it('shows calm fallback message on GPS failure', () => {
    expect(src).toContain("couldn't get your exact location");
    expect(src).toContain('continue with your village or region');
  });

  it('uses non-technical button text', () => {
    expect(src).toContain('Finding your location...');
    expect(src).toContain('Location found');
    expect(src).toContain('Get My Location');
  });

  it('uses soft message styling (not red error)', () => {
    expect(src).toContain('softMsgStyle');
    expect(src).not.toContain('errorStyle');
  });
});

// ═══════════════════════════════════════════════════════════
//  GEOLOCATION UTILS — friendly error messages
// ═══════════════════════════════════════════════════════════

describe('Geolocation utility — friendly errors', () => {
  const src = read('src/utils/geolocation.js');

  it('does NOT expose technical error codes to users', () => {
    expect(src).not.toContain('PERMISSION_DENIED');
    expect(src).not.toContain('POSITION_UNAVAILABLE');
  });

  it('uses a single calm error message for all GPS failures', () => {
    expect(src).toContain("couldn't get your exact location");
  });
});

describe('OnboardingWizard — no raw coordinate fallback', () => {
  const src = read('src/components/OnboardingWizard.jsx');

  it('does NOT show raw lat/long as fallback text', () => {
    // Should not contain .toFixed coordinate display patterns
    expect(src).not.toMatch(/latitude\.toFixed\(\d\)/);
    expect(src).not.toMatch(/longitude\.toFixed\(\d\)/);
  });

  it('falls back to location.captured i18n key', () => {
    expect(src).toContain("t('location.captured')");
  });

  it('still stores latitude/longitude in form state', () => {
    expect(src).toContain('latitude: loc.latitude');
    expect(src).toContain('longitude: loc.longitude');
  });
});

describe('FarmerProgressTab — no raw coordinate display', () => {
  const src = read('src/pages/FarmerProgressTab.jsx');

  it('does NOT show GPS: lat, lng format', () => {
    expect(src).not.toContain('GPS:');
    expect(src).not.toMatch(/latitude\.toFixed\(\d\)/);
    expect(src).not.toMatch(/longitude\.toFixed\(\d\)/);
  });

  it('shows location saved confirmation instead', () => {
    expect(src).toContain("t('location.capturedCheck')");
  });

  it('still stores lat/long in imageForm state', () => {
    expect(src).toContain('latitude: loc.latitude');
    expect(src).toContain('longitude: loc.longitude');
  });
});

describe('FarmSnapshotCard — shows readable location', () => {
  const src = read('src/components/FarmSnapshotCard.jsx');

  it('does NOT show separate GPS Added/Not Added row', () => {
    // The old GPS row with gpsAdded/gpsNotAdded text should be gone
    expect(src).not.toContain("t('farm.gpsNotAdded')");
  });

  it('uses locationLabel for display', () => {
    expect(src).toContain('profile?.locationLabel');
  });

  it('shows green checkmark when GPS is present', () => {
    expect(src).toContain('hasGps');
    expect(src).toContain('✅');
  });

  it('falls back through locationLabel > location > country', () => {
    expect(src).toContain('profile?.locationLabel');
    expect(src).toContain('profile?.location');
    expect(src).toContain('profile?.country');
  });
});

// ═══════════════════════════════════════════════════════════
//  ADMIN UI — coordinates still visible
// ═══════════════════════════════════════════════════════════

describe('Admin views — retain coordinate access', () => {
  it('FarmerDetailPage still shows coordinates for admin', () => {
    const src = read('src/pages/FarmerDetailPage.jsx');
    expect(src).toContain('latitude.toFixed');
    expect(src).toContain('longitude.toFixed');
  });

  it('ApplicationDetailPage still shows lat/long labels', () => {
    const src = read('src/pages/ApplicationDetailPage.jsx');
    expect(src).toContain('Latitude');
    expect(src).toContain('Longitude');
  });
});

// ═══════════════════════════════════════════════════════════
//  GEOLOCATION UTILS — reverseGeocode exists
// ═══════════════════════════════════════════════════════════

describe('Geolocation utilities', () => {
  const src = read('src/utils/geolocation.js');

  it('exports reverseGeocode function', () => {
    expect(src).toContain('export async function reverseGeocode');
  });

  it('exports detectAndResolveLocation function', () => {
    expect(src).toContain('export async function detectAndResolveLocation');
  });

  it('reverseGeocode returns structured address fields', () => {
    expect(src).toContain('country:');
    expect(src).toContain('region:');
    expect(src).toContain('locality:');
    expect(src).toContain('displayName:');
  });

  it('reverseGeocode has fallback on failure', () => {
    expect(src).toContain('return fallback');
  });

  it('uses Nominatim (no API key required)', () => {
    expect(src).toContain('nominatim.openstreetmap.org');
  });
});

// ═══════════════════════════════════════════════════════════
//  DATA INTEGRITY — lat/long still stored
// ═══════════════════════════════════════════════════════════

describe('Data integrity — coordinates preserved', () => {
  const schema = read('server/prisma/schema.prisma');

  it('latitude field still exists in FarmProfile', () => {
    expect(schema).toContain('latitude        Float?');
  });

  it('longitude field still exists in FarmProfile', () => {
    expect(schema).toContain('longitude       Float?');
  });

  it('ProfileSetupPage still sends latitude in save payload', () => {
    const src = read('src/pages/ProfileSetupPage.jsx');
    expect(src).toContain('latitude: form.latitude');
    expect(src).toContain('longitude: form.longitude');
  });

  it('backend still stores latitude/longitude in database', () => {
    const src = read('server/routes/farmProfile.js');
    expect(src).toContain('latitude: validation.data.gpsLat');
    expect(src).toContain('longitude: validation.data.gpsLng');
  });
});

// ═══════════════════════════════════════════════════════════
//  i18n — location keys
// ═══════════════════════════════════════════════════════════

describe('i18n — location display keys', () => {
  const src = read('src/i18n/translations.js');

  const requiredKeys = [
    'location.farmLocation',
    'location.captured',
    'location.capturedCheck',
    'location.detecting',
    'location.captureGPS',
    'location.update',
    'location.updating',
    'location.getMyLocation',
    'location.gpsOptionalDesc',
    'location.gpsFallback',
    'location.gpsSlow',
  ];

  for (const key of requiredKeys) {
    it(`has translation key: ${key}`, () => {
      expect(src).toContain(`'${key}'`);
    });
  }

  it('location keys have English translations', () => {
    for (const key of requiredKeys) {
      const keyPattern = new RegExp(`'${key.replace('.', '\\.')}':\\s*\\{[^}]*en:`);
      expect(src).toMatch(keyPattern);
    }
  });
});
