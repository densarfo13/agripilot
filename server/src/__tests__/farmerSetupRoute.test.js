import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — LIVE ROUTE WIRING
// ═══════════════════════════════════════════════════════════

describe('Live route wiring — farmer setup uses correct components', () => {
  const app = readFile('src/App.jsx');
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('App routes farmer role to FarmerDashboardPage', () => {
    expect(app).toContain('FarmerDashboardPage');
    expect(app).toContain("role === 'farmer'");
  });

  it('FarmerDashboardPage imports OnboardingWizard', () => {
    expect(dashboard).toContain("import OnboardingWizard");
    expect(dashboard).toContain("from '../components/OnboardingWizard.jsx'");
  });

  it('shows onboarding when no farm profiles exist', () => {
    expect(dashboard).toContain('profiles.length === 0');
    expect(dashboard).toContain('setShowOnboarding(true)');
  });

  it('only shows wizard when user is approved', () => {
    expect(dashboard).toContain('showOnboarding && isApproved');
  });

  it('passes userName and countryCode as props', () => {
    expect(dashboard).toContain("userName={user?.fullName");
    expect(dashboard).toContain("countryCode={profile?.countryCode}");
  });

  it('wizard component uses CropSelect (not hardcoded 4-crop grid)', () => {
    const wizard = readFile('src/components/OnboardingWizard.jsx');
    expect(wizard).toContain("import CropSelect");
    expect(wizard).toContain('<CropSelect');
    expect(wizard).toContain('Search all 60+ crops');
  });

  it('wizard component uses CountrySelect for country', () => {
    const wizard = readFile('src/components/OnboardingWizard.jsx');
    expect(wizard).toContain("import CountrySelect");
    expect(wizard).toContain('<CountrySelect');
  });

  it('wizard component uses TapSelector for units', () => {
    const wizard = readFile('src/components/OnboardingWizard.jsx');
    expect(wizard).toContain("import TapSelector");
    expect(wizard).toContain('land-unit-selector');
    expect(wizard).toContain('UNIT_OPTIONS');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — ROOT CAUSE: farmerName FIELD MAPPING
// ═══════════════════════════════════════════════════════════

describe('Root cause fix — farmerName payload mapping', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('backend requires farmerName for farm profile creation', () => {
    expect(service).toContain("if (!data.farmerName)");
    expect(service).toContain("'farmerName is required'");
  });

  it('handleOnboardingComplete injects farmerName from user record', () => {
    expect(dashboard).toContain("profileData.farmerName = user?.fullName");
  });

  it('farmerName has fallback chain: fullName → farmName → "Farmer"', () => {
    expect(dashboard).toContain("user?.fullName || profileData.farmName || 'Farmer'");
  });

  it('frontend throws on createProfile failure (not silent return)', () => {
    expect(dashboard).toContain('throw new Error(msg)');
    // Should have at least 2 throws: one in catch, one in null-check
    const throws = (dashboard.match(/throw new Error\(msg\)/g) || []).length;
    expect(throws).toBeGreaterThanOrEqual(2);
  });

  it('backend normalizes crop codes', () => {
    expect(service).toContain('normalizeCrop');
    expect(service).toContain('KNOWN_CROP_CODES');
    expect(service).toContain('LEGACY_ALIASES');
  });

  it('backend accepts OTHER:CustomName crops', () => {
    expect(service).toContain("upper.startsWith('OTHER:')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — LAND SIZE FIELD MAPPING (frontend → backend)
// ═══════════════════════════════════════════════════════════

describe('Land size field mapping — frontend to backend', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('frontend sends landSizeValue and landSizeUnit', () => {
    expect(wizard).toContain('landSizeValue: ls.landSizeValue');
    expect(wizard).toContain('landSizeUnit: ls.landSizeUnit');
    expect(wizard).toContain('landSizeHectares: ls.landSizeHectares');
  });

  it('backend reads landSizeValue (or farmSizeAcres fallback)', () => {
    expect(service).toContain('data.landSizeValue ?? data.farmSizeAcres');
  });

  it('backend reads landSizeUnit (defaults to ACRE)', () => {
    expect(service).toContain("data.landSizeUnit || 'ACRE'");
  });

  it('backend stores all three land size fields', () => {
    expect(service).toContain('landSizeValue: landSize.landSizeValue');
    expect(service).toContain('landSizeUnit: landSize.landSizeUnit');
    expect(service).toContain('landSizeHectares: landSize.landSizeHectares');
  });

  it('backend computes farmSizeAcres for backward compat', () => {
    expect(service).toContain('fromHectares');
    expect(service).toContain('farmSizeAcres: computedAcres');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 4 — GENDER / COUNTRY PERSISTENCE
// ═══════════════════════════════════════════════════════════

describe('Gender and country persistence via PATCH /farmers/me', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');
  const routes = readFile('server/src/modules/farmers/routes.js');

  it('handleOnboardingComplete sends PATCH for gender/countryCode', () => {
    expect(dashboard).toContain("api.patch('/farmers/me'");
    expect(dashboard).toContain('gender');
    expect(dashboard).toContain('countryCode');
  });

  it('PATCH is non-blocking (does not delay farm creation)', () => {
    const patchIdx = dashboard.indexOf("api.patch('/farmers/me'");
    const chunk = dashboard.slice(patchIdx, patchIdx + 300);
    expect(chunk).toContain('.catch(() => {})');
  });

  it('backend has PATCH /farmers/me endpoint', () => {
    expect(routes).toContain("router.patch('/me'");
  });

  it('PATCH /me only allows whitelisted fields', () => {
    expect(routes).toContain('ALLOWED_FIELDS');
    expect(routes).toContain("'gender'");
    expect(routes).toContain("'countryCode'");
  });

  it('PATCH /me rejects non-farmer roles', () => {
    expect(routes).toContain("req.user.role !== 'farmer'");
  });

  it('PATCH /me requires at least one valid field', () => {
    expect(routes).toContain("'No valid fields to update'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — ONBOARDING COMPLETION FLAG
// ═══════════════════════════════════════════════════════════

describe('Onboarding completion flag — no re-entry loop', () => {
  const routes = readFile('server/src/modules/farmProfiles/routes.js');

  it('sets onboardingCompletedAt on farm profile creation', () => {
    expect(routes).toContain('onboardingCompletedAt');
    expect(routes).toContain("onboardingCompletedAt: null");
    expect(routes).toContain("onboardingCompletedAt: new Date()");
  });

  it('update is awaited (not fire-and-forget)', () => {
    const idx = routes.indexOf('onboardingCompletedAt: new Date()');
    const chunk = routes.slice(Math.max(0, idx - 200), idx);
    expect(chunk).toContain('await prisma.farmer.updateMany');
  });

  it('uses updateMany with onboardingCompletedAt: null guard (idempotent)', () => {
    expect(routes).toContain('where: { id: farmerId, onboardingCompletedAt: null }');
  });

  it('uses already-imported prisma (no dynamic import)', () => {
    // Should NOT have dynamic import for this simple DB call
    const createBlock = routes.indexOf('POST /api/v1/farms');
    const endBlock = routes.indexOf('res.status(201).json(profile)');
    const block = routes.slice(createBlock, endBlock);
    expect(block).not.toContain("await import('../../config/database.js')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — DUPLICATE / RETRY SAFETY
// ═══════════════════════════════════════════════════════════

describe('Duplicate and retry safety', () => {
  const store = readFile('src/store/farmStore.js');
  const routes = readFile('server/src/modules/farmProfiles/routes.js');
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('farmStore has _createInFlight guard', () => {
    expect(store).toContain('_createInFlight');
    expect(store).toContain('if (get()._createInFlight) return null');
  });

  it('_createInFlight resets on error', () => {
    const catchIdx = store.indexOf('Failed to create farm profile');
    const chunk = store.slice(catchIdx - 200, catchIdx);
    expect(chunk).toContain('_createInFlight: false');
  });

  it('backend route uses idempotencyCheck middleware', () => {
    expect(routes).toContain("'/', idempotencyCheck");
  });

  it('wizard submitGuardRef prevents double-submit', () => {
    expect(wizard).toContain('submitGuardRef');
    expect(wizard).toContain('if (submitGuardRef.current) return');
  });

  it('submitGuardRef resets on error and retry', () => {
    expect(wizard).toContain('submitGuardRef.current = false; handleSubmit()');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 7 — DRAFT PERSISTENCE / RESUME
// ═══════════════════════════════════════════════════════════

describe('Draft persistence and resume', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('uses useDraft hook for form state persistence', () => {
    expect(wizard).toContain("useDraft(");
    expect(wizard).toContain("'onboarding-wizard'");
  });

  it('syncs step and form to draft on every change', () => {
    expect(wizard).toContain('setDraft(prev => ({ ...prev, step: nextStep })');
    expect(wizard).toContain('setDraft(d => ({ ...d, form: next })');
  });

  it('restores from draft on mount', () => {
    expect(wizard).toContain('draftRestored');
    expect(wizard).toContain("saveStatus === 'restored'");
  });

  it('clears draft on successful completion', () => {
    expect(wizard).toContain('clearDraft()');
  });

  it('does NOT clear draft on error (data preserved for retry)', () => {
    // clearDraft should only appear in the success path, not in the catch
    const catchIdx = wizard.indexOf('} catch (err) {', wizard.indexOf('await onComplete'));
    const catchBlock = wizard.slice(catchIdx, catchIdx + 500);
    expect(catchBlock).not.toContain('clearDraft');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 8 — POST-SUCCESS ROUTING
// ═══════════════════════════════════════════════════════════

describe('Post-success routing', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('success screen shows "Farm created!" and continue button', () => {
    expect(wizard).toContain('Farm created!');
    expect(wizard).toContain('Continue to Dashboard');
  });

  it('continue button reloads page to show dashboard', () => {
    expect(wizard).toContain('window.location.reload()');
  });

  it('handleOnboardingComplete sets showOnboarding false on success', () => {
    expect(dashboard).toContain('setShowOnboarding(false)');
  });

  it('after reload, fetchProfiles returns the new profile → no re-enter onboarding', () => {
    // profiles.length will be > 0, so showOnboarding stays false
    expect(dashboard).toContain('profiles.length === 0');
    expect(dashboard).toContain('setShowOnboarding(true)');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 9 — FULL PAYLOAD AUDIT
// ═══════════════════════════════════════════════════════════

describe('Full payload audit — no field mismatches', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('frontend sends crop (backend requires crop)', () => {
    expect(wizard).toContain('crop: form.crop');
    expect(service).toContain('validateCrop(data.crop)');
  });

  it('frontend sends stage (backend accepts stage)', () => {
    expect(wizard).toContain('stage: form.stage');
    expect(service).toContain("data.stage || 'planting'");
  });

  it('frontend sends farmName (backend stores farmName)', () => {
    expect(wizard).toContain('farmName: form.farmName.trim()');
    expect(service).toContain('farmName: data.farmName || null');
  });

  it('frontend sends locationName (backend stores locationName)', () => {
    expect(wizard).toContain('locationName: form.locationName.trim() || null');
    expect(service).toContain('locationName: data.locationName || null');
  });

  it('frontend sends lat/lon (backend validates and stores)', () => {
    expect(wizard).toContain('latitude: form.latitude || null');
    expect(wizard).toContain('longitude: form.longitude || null');
    expect(service).toContain('latitude: data.latitude');
    expect(service).toContain('longitude: data.longitude');
  });

  it('parent injects farmerName (backend requires farmerName)', () => {
    expect(dashboard).toContain('profileData.farmerName');
    expect(service).toContain('farmerName: data.farmerName');
  });

  it('gender/countryCode go to Farmer model (not FarmProfile)', () => {
    // These should NOT be in the farm profile create call
    const createBlock = service.indexOf('prisma.farmProfile.create');
    const createEnd = service.indexOf('});', createBlock + 30);
    const createChunk = service.slice(createBlock, createEnd);
    expect(createChunk).not.toContain('countryCode');
    expect(createChunk).not.toContain('gender');

    // They go via PATCH /farmers/me instead
    expect(dashboard).toContain("api.patch('/farmers/me'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 10 — GAP FIXES: ageGroup, validation, dashboard, idempotency
// ═══════════════════════════════════════════════════════════

describe('Gap fix — ageGroup persistence', () => {
  const schema = readFile('server/prisma/schema.prisma');
  const routes = readFile('server/src/modules/farmers/routes.js');
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('Prisma Farmer model has ageGroup field', () => {
    expect(schema).toContain('ageGroup');
    expect(schema).toContain("@map(\"age_group\")");
  });

  it('PATCH /farmers/me whitelist includes ageGroup', () => {
    expect(routes).toContain("'ageGroup'");
  });

  it('PATCH /farmers/me response includes ageGroup', () => {
    expect(routes).toContain('ageGroup: true');
  });

  it('wizard collects ageGroup from form', () => {
    expect(wizard).toContain('ageGroup: form.ageGroup');
  });

  it('dashboard sends ageGroup in PATCH call', () => {
    expect(dashboard).toContain('ageGroup');
  });
});

describe('Gap fix — farmerName length validation', () => {
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('validates farmerName minimum length', () => {
    expect(service).toContain('farmerName must be between 2 and 100 characters');
  });

  it('trims farmerName before length check', () => {
    expect(service).toContain('data.farmerName.trim().length < 2');
  });
});

describe('Gap fix — dashboard summary returns land size fields', () => {
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('summary includes landSizeValue', () => {
    expect(service).toContain('landSizeValue: profile.landSizeValue');
  });

  it('summary includes landSizeUnit', () => {
    expect(service).toContain('landSizeUnit: profile.landSizeUnit');
  });

  it('summary includes landSizeHectares', () => {
    expect(service).toContain('landSizeHectares: profile.landSizeHectares');
  });
});

describe('Gap fix — onboardingCompletedAt error logging', () => {
  const routes = readFile('server/src/modules/farmProfiles/routes.js');

  it('imports opsEvent for operational logging', () => {
    expect(routes).toContain("import { opsEvent }");
  });

  it('logs onboarding flag failure instead of swallowing', () => {
    expect(routes).toContain('onboarding_flag_failed');
  });

  it('does not silently swallow the error', () => {
    const flagIdx = routes.indexOf('onboardingCompletedAt: new Date()');
    const chunk = routes.slice(flagIdx, flagIdx + 300);
    expect(chunk).not.toContain('.catch(() => {})');
  });
});

describe('Gap fix — offline queue idempotency', () => {
  const store = readFile('src/store/farmStore.js');
  const offlineQueue = readFile('src/utils/offlineQueue.js');

  it('createProfile generates an idempotency key', () => {
    expect(store).toContain('X-Idempotency-Key');
    expect(store).toContain('generateIdempotencyKey');
  });

  it('idempotency key is passed to API call', () => {
    expect(store).toContain("headers: { 'X-Idempotency-Key': idempotencyKey }");
  });

  it('idempotency key is included in offline queue', () => {
    expect(store).toContain("queueIfOffline('POST', '/v1/farms', data, { 'X-Idempotency-Key': idempotencyKey })");
  });

  it('queueIfOffline accepts headers parameter', () => {
    expect(store).toContain('function queueIfOffline(method, url, data, headers');
  });

  it('sync engine replays with stored headers', () => {
    expect(offlineQueue).toContain('const config = m.headers ? { headers: m.headers } : undefined');
  });

  it('PATCH /me response includes preferredLanguage', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain('preferredLanguage: true');
  });
});
