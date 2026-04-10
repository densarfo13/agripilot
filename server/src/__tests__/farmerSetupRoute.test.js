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
    expect(dashboard).toContain("allFields.farmerName = user?.fullName");
  });

  it('farmerName has fallback chain: fullName → farmName → "Farmer"', () => {
    expect(dashboard).toContain("user?.fullName || allFields.farmName || 'Farmer'");
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

describe('Gender and country persistence — atomic setup', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('handleOnboardingComplete sends all fields in one atomic request (no separate PATCH)', () => {
    // Gender/countryCode are now included in the atomic createProfile call
    expect(dashboard).toContain("const { photoFile, ...allFields } = data");
    expect(dashboard).toContain("createProfile(allFields)");
    // Should NOT have a separate PATCH /farmers/me
    expect(dashboard).not.toContain("api.patch('/farmers/me'");
  });

  it('atomicFarmSetup updates farmer record with gender/country inside transaction', () => {
    expect(service).toContain("if (data.gender) farmerUpdate.gender = data.gender");
    expect(service).toContain("if (data.ageGroup) farmerUpdate.ageGroup = data.ageGroup");
    expect(service).toContain("farmerUpdate.countryCode = countryCode.trim().toUpperCase()");
  });

  it('backend PATCH /farmers/me endpoint still exists for standalone updates', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain("router.patch('/me'");
  });

  it('PATCH /me only allows whitelisted fields', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain('ALLOWED_FIELDS');
    expect(routes).toContain("'gender'");
    expect(routes).toContain("'countryCode'");
  });

  it('PATCH /me rejects non-farmer roles', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain("req.user.role !== 'farmer'");
  });

  it('PATCH /me requires at least one valid field', () => {
    const routes = readFile('server/src/modules/farmers/routes.js');
    expect(routes).toContain("'No valid fields to update'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — ONBOARDING COMPLETION FLAG
// ═══════════════════════════════════════════════════════════

describe('Onboarding completion flag — atomic transaction', () => {
  const service = readFile('server/src/modules/farmProfiles/service.js');
  const routes = readFile('server/src/modules/farmProfiles/routes.js');

  it('sets onboardingCompletedAt inside the atomic transaction', () => {
    expect(service).toContain('onboardingCompletedAt');
    expect(service).toContain('farmerUpdate.onboardingCompletedAt = new Date()');
  });

  it('farmer update is inside $transaction (not fire-and-forget)', () => {
    // tx.farmer.update is called inside the $transaction callback
    expect(service).toContain('tx.farmer.update');
    expect(service).toContain('prisma.$transaction');
  });

  it('uses farmer.update inside transaction (atomic with farm profile)', () => {
    // Both tx.farmProfile.create and tx.farmer.update in same transaction
    expect(service).toContain('tx.farmProfile.create');
    expect(service).toContain('tx.farmer.update');
  });

  it('route handler uses atomicFarmSetup for farmer role', () => {
    expect(routes).toContain('service.atomicFarmSetup');
    expect(routes).toContain("req.user.role === 'farmer'");
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
    expect(dashboard).toContain('allFields.farmerName');
    expect(service).toContain('farmerName: data.farmerName');
  });

  it('gender/countryCode go to Farmer model via atomic transaction (not FarmProfile)', () => {
    // In atomicFarmSetup, gender/countryCode go to farmer.update, not farmProfile.create
    const atomicBlock = service.split('atomicFarmSetup')[1] || '';
    expect(atomicBlock).toContain('farmerUpdate.gender = data.gender');
    expect(atomicBlock).toContain('farmerUpdate.countryCode');
    // They are sent via atomic createProfile call (not separate PATCH)
    expect(dashboard).toContain("createProfile(allFields)");
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

describe('Gap fix — onboarding completion logging', () => {
  const routes = readFile('server/src/modules/farmProfiles/routes.js');
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('imports opsEvent for operational logging', () => {
    expect(routes).toContain("import { opsEvent }");
  });

  it('logs atomic setup completion', () => {
    expect(routes).toContain('atomic_farm_setup_completed');
  });

  it('onboarding flag is set inside $transaction (cannot fail independently)', () => {
    // The farmer.update with onboardingCompletedAt is inside the $transaction
    // so if it fails the entire operation rolls back — no partial state
    expect(service).toContain('tx.farmer.update');
    expect(service).toContain('farmerUpdate.onboardingCompletedAt = new Date()');
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

// ═══════════════════════════════════════════════════════════
// PART 11 — VOICE-GUIDED ONBOARDING
// ═══════════════════════════════════════════════════════════

describe('Voice-guided onboarding for low-literacy farmers', () => {
  const voiceGuide = readFile('src/utils/voiceGuide.js');
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  // ── voiceGuide.js structure ──

  it('exports speak function', () => {
    expect(voiceGuide).toContain('export function speak(');
  });

  it('exports stopSpeech function', () => {
    expect(voiceGuide).toContain('export function stopSpeech()');
  });

  it('exports isVoiceAvailable function', () => {
    expect(voiceGuide).toContain('export function isVoiceAvailable()');
  });

  it('exports VOICE_LANGUAGES array', () => {
    expect(voiceGuide).toContain('export const VOICE_LANGUAGES');
  });

  it('uses speechSynthesis API', () => {
    expect(voiceGuide).toContain('window.speechSynthesis');
    expect(voiceGuide).toContain('SpeechSynthesisUtterance');
  });

  // ── Onboarding step keys have voice map entries (dot-notation) ──

  const EXPECTED_STEPS = [
    'onboarding.welcome', 'onboarding.farmName', 'onboarding.country', 'onboarding.crop',
    'onboarding.landSize', 'onboarding.gender', 'onboarding.ageGroup',
    'onboarding.region', 'onboarding.photoOptional', 'onboarding.processing',
  ];
  for (const step of EXPECTED_STEPS) {
    it(`voiceMap includes "${step}" step`, () => {
      expect(voiceGuide).toContain(`'${step}':`);
    });
  }

  // ── All 5 languages present ──

  const EXPECTED_LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];
  for (const lang of EXPECTED_LANGS) {
    it(`voiceMap includes "${lang}" language`, () => {
      expect(voiceGuide).toContain(`${lang}:`);
    });
  }

  it('falls back to English when translation missing', () => {
    // The speak function should use stepTexts[lang] || stepTexts.en
    expect(voiceGuide).toMatch(/stepTexts\[lang\]\s*\|\|\s*stepTexts\.en/);
  });

  it('uses slower speech rate for comprehension', () => {
    expect(voiceGuide).toContain('utterance.rate = VOICE_RATE');
  });

  it('cancels ongoing speech before starting new', () => {
    expect(voiceGuide).toContain('speechSynthesis.cancel()');
  });

  // ── OnboardingWizard integration ──

  it('wizard imports voiceGuide utilities', () => {
    expect(wizard).toContain("from '../utils/voiceGuide.js'");
    expect(wizard).toContain('speak');
    expect(wizard).toContain('stopSpeech');
    expect(wizard).toContain('isVoiceAvailable');
    expect(wizard).toContain('VOICE_LANGUAGES');
  });

  it('wizard has voiceLang state', () => {
    expect(wizard).toContain("voiceLang, setVoiceLang");
  });

  it('wizard has voiceEnabled state', () => {
    expect(wizard).toContain("voiceEnabled, setVoiceEnabled");
  });

  it('wizard auto-plays voice on step change', () => {
    // Should call speak(currentVoiceKey, voiceLang) in a useEffect
    expect(wizard).toContain('speak(currentVoiceKey, voiceLang)');
  });

  it('wizard stops speech on unmount', () => {
    expect(wizard).toContain('stopSpeech()');
  });

  it('wizard has replay/listen button', () => {
    expect(wizard).toContain('handleReplay');
    expect(wizard).toContain('Listen');
  });

  it('wizard has voice language selector', () => {
    expect(wizard).toContain('voiceLangSelect');
    expect(wizard).toContain('VOICE_LANGUAGES.map');
  });

  it('wizard has mute button to disable voice', () => {
    expect(wizard).toContain('setVoiceEnabled(false)');
  });

  it('wizard tracks auto-played steps to avoid repeat', () => {
    expect(wizard).toContain('voicePlayedRef');
  });

  it('wizard only shows voice controls when speechSynthesis available', () => {
    // Voice bar is conditional on voiceEnabled or isVoiceAvailable()
    expect(wizard).toContain('voiceEnabled');
    expect(wizard).toContain('isVoiceAvailable()');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 12 — VOICE GUIDE: FARMER HOME + ADD UPDATE FLOW
// ═══════════════════════════════════════════════════════════

describe('Voice guide — Farmer Home voice keys (dot-notation)', () => {
  const voiceGuide = readFile('src/utils/voiceGuide.js');

  const HOME_KEYS = ['home.welcome', 'home.status.onTrack', 'home.status.needsUpdate', 'home.primaryAction.addUpdate', 'home.help'];
  for (const key of HOME_KEYS) {
    it(`voiceMap includes "${key}" key`, () => {
      expect(voiceGuide).toContain(`'${key}':`);
    });
  }

  const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];
  for (const lang of LANGS) {
    it(`home.welcome has "${lang}" translation`, () => {
      const homeBlock = voiceGuide.split("'home.welcome':")[1]?.split('},')[0];
      expect(homeBlock).toContain(`${lang}:`);
    });
  }
});

describe('Voice guide — Add Update flow voice keys (dot-notation)', () => {
  const voiceGuide = readFile('src/utils/voiceGuide.js');

  const UPDATE_KEYS = [
    'update.start', 'update.chooseType', 'update.chooseStage',
    'update.condition', 'update.takePhoto', 'update.problemNote',
    'update.submit', 'update.success', 'update.savedOffline', 'update.failed',
  ];
  for (const key of UPDATE_KEYS) {
    it(`voiceMap includes "${key}" key`, () => {
      expect(voiceGuide).toContain(`'${key}':`);
    });
  }

  const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];
  for (const lang of LANGS) {
    it(`update.start has "${lang}" translation`, () => {
      const block = voiceGuide.split("'update.start':")[1]?.split('},')[0];
      expect(block).toContain(`${lang}:`);
    });
  }

  it('update.success has all 5 language translations', () => {
    const block = voiceGuide.split("'update.success':")[1]?.split('},')[0];
    for (const lang of LANGS) {
      expect(block).toContain(`${lang}:`);
    }
  });
});

describe('VoiceBar shared component', () => {
  const voiceBar = readFile('src/components/VoiceBar.jsx');

  it('imports speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES', () => {
    expect(voiceBar).toContain("from '../utils/voiceGuide.js'");
    expect(voiceBar).toContain('speak');
    expect(voiceBar).toContain('stopSpeech');
    expect(voiceBar).toContain('isVoiceAvailable');
    expect(voiceBar).toContain('VOICE_LANGUAGES');
  });

  it('accepts voiceKey and compact props', () => {
    expect(voiceBar).toContain('voiceKey');
    expect(voiceBar).toContain('compact');
  });

  it('auto-plays once per voiceKey', () => {
    expect(voiceBar).toContain('playedRef');
    expect(voiceBar).toContain('speak(voiceKey, voiceLang)');
  });

  it('stops speech on unmount', () => {
    expect(voiceBar).toContain('stopSpeech()');
  });

  it('persists language preference in localStorage', () => {
    expect(voiceBar).toContain('farroway:voiceLang');
    expect(voiceBar).toContain('localStorage');
  });

  it('renders listen button with test id', () => {
    expect(voiceBar).toContain('voice-listen-btn');
  });

  it('renders language select with test id', () => {
    expect(voiceBar).toContain('voice-lang-select');
  });

  it('renders mute button with test id', () => {
    expect(voiceBar).toContain('voice-mute-btn');
  });

  it('returns null when speechSynthesis unavailable', () => {
    expect(voiceBar).toContain('if (!isVoiceAvailable()) return null');
  });
});

describe('Farmer Home integrates VoiceBar', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('imports VoiceBar component', () => {
    expect(dashboard).toContain("import VoiceBar from '../components/VoiceBar.jsx'");
  });

  it('renders VoiceBar with home.welcome key', () => {
    expect(dashboard).toContain('voiceKey="home.welcome"');
  });
});

describe('QuickUpdateFlow integrates VoiceBar', () => {
  const quickUpdate = readFile('src/components/QuickUpdateFlow.jsx');

  it('imports VoiceBar component', () => {
    expect(quickUpdate).toContain("import VoiceBar from './VoiceBar.jsx'");
  });

  it('maps steps to voice keys via STEP_VOICE_KEY (dot-notation)', () => {
    expect(quickUpdate).toContain('STEP_VOICE_KEY');
    expect(quickUpdate).toContain("action: 'update.start'");
    expect(quickUpdate).toContain("stage: 'update.chooseStage'");
    expect(quickUpdate).toContain("condition: 'update.condition'");
    expect(quickUpdate).toContain("photo: 'update.takePhoto'");
    expect(quickUpdate).toContain("done: 'update.success'");
    expect(quickUpdate).toContain("offline: 'update.savedOffline'");
    expect(quickUpdate).toContain("error: 'update.failed'");
  });

  it('renders VoiceBar in action step', () => {
    // VoiceBar with voiceKey and compact should appear in the component
    expect(quickUpdate).toContain('<VoiceBar voiceKey={voiceKey} compact');
  });

  it('computes voiceKey from current step', () => {
    expect(quickUpdate).toContain('const voiceKey = STEP_VOICE_KEY[step]');
  });

  it('renders VoiceBar in feedback steps (done, offline, error)', () => {
    // Count VoiceBar renders — should have multiple (action, stage, condition, photo, done, offline, error)
    const voiceBarCount = (quickUpdate.match(/<VoiceBar/g) || []).length;
    expect(voiceBarCount).toBeGreaterThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════════
// PART 13 — VOICE GUIDE: OFFICER VALIDATION + ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════

describe('Voice guide — Officer Validation voice keys (dot-notation)', () => {
  const voiceGuide = readFile('src/utils/voiceGuide.js');

  const OFFICER_KEYS = ['officer.queue', 'officer.openItem', 'officer.imageFocus', 'officer.approve', 'officer.reject', 'officer.flag', 'officer.next', 'officer.empty'];
  for (const key of OFFICER_KEYS) {
    it(`voiceMap includes "${key}" key`, () => {
      expect(voiceGuide).toContain(`'${key}':`);
    });
  }

  const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];
  for (const lang of LANGS) {
    it(`officer.queue has "${lang}" translation`, () => {
      const block = voiceGuide.split("'officer.queue':")[1]?.split('},')[0];
      expect(block).toContain(`${lang}:`);
    });
  }

  it('officer.empty has all 5 language translations', () => {
    const block = voiceGuide.split("'officer.empty':")[1]?.split('},')[0];
    for (const lang of LANGS) {
      expect(block).toContain(`${lang}:`);
    }
  });
});

describe('Voice guide — Admin Dashboard voice keys (dot-notation)', () => {
  const voiceGuide = readFile('src/utils/voiceGuide.js');

  const ADMIN_KEYS = ['admin.overview', 'admin.needsAttention', 'admin.openIssues', 'admin.invite', 'admin.assign', 'admin.report'];
  for (const key of ADMIN_KEYS) {
    it(`voiceMap includes "${key}" key`, () => {
      expect(voiceGuide).toContain(`'${key}':`);
    });
  }

  const LANGS = ['en', 'fr', 'sw', 'ha', 'tw'];
  for (const lang of LANGS) {
    it(`admin.overview has "${lang}" translation`, () => {
      const block = voiceGuide.split("'admin.overview':")[1]?.split('},')[0];
      expect(block).toContain(`${lang}:`);
    });
  }

  it('admin.report has all 5 language translations', () => {
    const block = voiceGuide.split("'admin.report':")[1]?.split('},')[0];
    for (const lang of LANGS) {
      expect(block).toContain(`${lang}:`);
    }
  });
});

describe('OfficerValidationPage integrates VoiceBar', () => {
  const officer = readFile('src/pages/OfficerValidationPage.jsx');

  it('imports VoiceBar component', () => {
    expect(officer).toContain("import VoiceBar from '../components/VoiceBar.jsx'");
  });

  it('renders VoiceBar with officer.openItem key for active queue', () => {
    expect(officer).toContain('voiceKey="officer.openItem"');
  });

  it('renders VoiceBar with officer.empty key for empty state', () => {
    expect(officer).toContain('voiceKey="officer.empty"');
  });

  it('uses compact mode for VoiceBar', () => {
    expect(officer).toContain('compact');
  });

  it('renders VoiceBar in multiple states (active queue + empty + all done)', () => {
    const count = (officer.match(/<VoiceBar/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

describe('Admin DashboardPage integrates VoiceBar', () => {
  const dashboard = readFile('src/pages/DashboardPage.jsx');

  it('imports VoiceBar component', () => {
    expect(dashboard).toContain("import VoiceBar from '../components/VoiceBar.jsx'");
  });

  it('renders VoiceBar with admin.overview key', () => {
    expect(dashboard).toContain('voiceKey="admin.overview"');
  });

  it('uses compact mode', () => {
    expect(dashboard).toContain('compact');
  });
});

describe('VoiceBar shared behavior for officer/admin use', () => {
  const voiceBar = readFile('src/components/VoiceBar.jsx');

  it('persists language in localStorage across pages', () => {
    expect(voiceBar).toContain("localStorage.getItem('farroway:voiceLang')");
    expect(voiceBar).toContain("localStorage.setItem('farroway:voiceLang'");
  });

  it('supports compact prop for smaller controls', () => {
    expect(voiceBar).toContain('compact');
    // Compact mode shows shorter labels
    expect(voiceBar).toContain("compact ? 'Voice' : 'Enable Voice Guide'");
  });

  it('does not auto-play same key twice', () => {
    expect(voiceBar).toContain('playedRef.current[voiceKey]');
  });

  it('stops speech before playing new key', () => {
    // In the auto-play useEffect, stopSpeech is called before speak
    expect(voiceBar).toContain('stopSpeech()');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 14 — VOICE ANALYTICS
// ═══════════════════════════════════════════════════════════

describe('Voice analytics utility — voiceAnalytics.js', () => {
  const va = readFile('src/utils/voiceAnalytics.js');

  it('exports trackVoiceEvent function', () => {
    expect(va).toContain('export function trackVoiceEvent(');
  });

  it('exports trackVoiceStepCompleted function', () => {
    expect(va).toContain('export function trackVoiceStepCompleted(');
  });

  it('exports trackVoiceStepAbandoned function', () => {
    expect(va).toContain('export function trackVoiceStepAbandoned(');
  });

  it('exports getVoiceAnalyticsSummary function', () => {
    expect(va).toContain('export function getVoiceAnalyticsSummary(');
  });

  it('uses trackPilotEvent for local tracking', () => {
    expect(va).toContain("import { trackPilotEvent } from './pilotTracker.js'");
    expect(va).toContain('trackPilotEvent(eventType, meta)');
  });

  it('posts to server analytics endpoint', () => {
    expect(va).toContain("api.post('/v1/analytics/track'");
  });

  it('fires server call as fire-and-forget', () => {
    expect(va).toContain(".catch(() => {})");
  });

  it('maps all voice prompt keys to screen names via SCREEN_MAP (dot-notation)', () => {
    expect(va).toContain('SCREEN_MAP');
    // Spot check dot-notation key mappings
    expect(va).toContain("'onboarding.welcome': 'onboarding'");
    expect(va).toContain("'home.welcome': 'farmer_home'");
    expect(va).toContain("'update.start': 'update_flow'");
    expect(va).toContain("'officer.queue': 'officer_validation'");
    expect(va).toContain("'admin.overview': 'admin_dashboard'");
  });

  it('debounces SHOWN events within 2s window', () => {
    expect(va).toContain('SHOWN_DEBOUNCE_MS');
    expect(va).toContain('VOICE_PROMPT_SHOWN');
  });

  const EXPECTED_EVENTS = [
    'VOICE_PROMPT_SHOWN', 'VOICE_PROMPT_PLAYED', 'VOICE_PROMPT_REPLAYED',
    'VOICE_PROMPT_MUTED', 'VOICE_STEP_COMPLETED', 'VOICE_STEP_ABANDONED',
  ];
  for (const evt of EXPECTED_EVENTS) {
    it(`references event type "${evt}"`, () => {
      expect(va).toContain(evt);
    });
  }

  it('local summary aggregates by event, prompt, language, screen', () => {
    expect(va).toContain('byEvent');
    expect(va).toContain('byPrompt');
    expect(va).toContain('byLanguage');
    expect(va).toContain('byScreen');
  });
});

describe('VoiceBar fires analytics events', () => {
  const voiceBar = readFile('src/components/VoiceBar.jsx');

  it('imports trackVoiceEvent', () => {
    expect(voiceBar).toContain("import { trackVoiceEvent } from '../utils/voiceAnalytics.js'");
  });

  it('tracks VOICE_PROMPT_SHOWN on voiceKey change', () => {
    expect(voiceBar).toContain("trackVoiceEvent('VOICE_PROMPT_SHOWN'");
  });

  it('tracks VOICE_PROMPT_PLAYED on auto-play', () => {
    expect(voiceBar).toContain("trackVoiceEvent('VOICE_PROMPT_PLAYED'");
  });

  it('tracks VOICE_PROMPT_REPLAYED on replay tap', () => {
    expect(voiceBar).toContain("trackVoiceEvent('VOICE_PROMPT_REPLAYED'");
  });

  it('tracks VOICE_PROMPT_MUTED on mute tap', () => {
    expect(voiceBar).toContain("trackVoiceEvent('VOICE_PROMPT_MUTED'");
  });
});

describe('OnboardingWizard tracks voice step completion', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('imports trackVoiceStepCompleted', () => {
    expect(wizard).toContain("import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js'");
  });

  it('calls trackVoiceStepCompleted on goNext', () => {
    expect(wizard).toContain('trackVoiceStepCompleted(currentVoiceKey, voiceLang)');
  });
});

describe('QuickUpdateFlow tracks voice step completion', () => {
  const quickUpdate = readFile('src/components/QuickUpdateFlow.jsx');

  it('imports trackVoiceStepCompleted', () => {
    expect(quickUpdate).toContain("import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js'");
  });

  it('calls trackVoiceStepCompleted in goToStep', () => {
    expect(quickUpdate).toContain('trackVoiceStepCompleted(voiceKey, lang)');
  });
});

describe('Server-side voice analytics endpoint', () => {
  const routes = readFile('server/src/modules/analytics/routes.js');
  const service = readFile('server/src/modules/analytics/service.js');

  it('has GET /voice-summary route', () => {
    expect(routes).toContain("'/voice-summary'");
    expect(routes).toContain('getVoiceAnalyticsSummary');
  });

  it('route requires admin or field_officer role', () => {
    expect(routes).toContain("'super_admin'");
    expect(routes).toContain("'institutional_admin'");
    expect(routes).toContain("'field_officer'");
  });

  it('service exports getVoiceAnalyticsSummary', () => {
    expect(service).toContain('export async function getVoiceAnalyticsSummary');
  });

  it('filters for VOICE_ event types', () => {
    expect(service).toContain('VOICE_EVENTS');
    expect(service).toContain('VOICE_PROMPT_SHOWN');
    expect(service).toContain('VOICE_PROMPT_REPLAYED');
    expect(service).toContain('VOICE_STEP_COMPLETED');
    expect(service).toContain('VOICE_STEP_ABANDONED');
  });

  it('returns topReplayed, topAbandoned, byLanguage, byScreen', () => {
    expect(service).toContain('topReplayed');
    expect(service).toContain('topAbandoned');
    expect(service).toContain('langCounts');
    expect(service).toContain('screenCounts');
    expect(service).toContain('screenCompletion');
  });

  it('caps query at 5000 records for performance', () => {
    expect(service).toContain('take: 5000');
  });
});

describe('PilotMetricsPage shows voice analytics', () => {
  const page = readFile('src/pages/PilotMetricsPage.jsx');

  it('fetches voice-summary from API', () => {
    expect(page).toContain("'/v1/analytics/voice-summary'");
  });

  it('has voiceData state', () => {
    expect(page).toContain('voiceData');
    expect(page).toContain('setVoiceData');
  });

  it('renders VoiceAnalyticsCard component', () => {
    expect(page).toContain('VoiceAnalyticsCard');
    expect(page).toContain('voiceData={voiceData}');
  });

  it('VoiceAnalyticsCard shows overview stats', () => {
    expect(page).toContain('Played');
    expect(page).toContain('Replayed');
    expect(page).toContain('Muted');
    expect(page).toContain('Completed');
    expect(page).toContain('Abandoned');
  });

  it('VoiceAnalyticsCard shows top replayed prompts', () => {
    expect(page).toContain('Top Replayed Prompts');
  });

  it('VoiceAnalyticsCard shows top abandoned steps', () => {
    expect(page).toContain('Top Abandoned Steps');
  });

  it('VoiceAnalyticsCard shows usage by language', () => {
    expect(page).toContain('Usage by Language');
  });

  it('VoiceAnalyticsCard shows usage by screen', () => {
    expect(page).toContain('Usage by Screen');
  });

  it('only renders for admin users', () => {
    expect(page).toContain('isAdmin && <VoiceAnalyticsCard');
  });

  it('voice fetch is supplemental — does not block main load', () => {
    // Voice fetch is outside the main Promise.all
    expect(page).toContain("api.get('/v1/analytics/voice-summary').then");
    expect(page).toContain(".catch(() => {})");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 15 — ATOMIC FARMER SETUP FLOW
// ═══════════════════════════════════════════════════════════

describe('Atomic farm setup — backend service validation', () => {
  const svc = readFile('server/src/modules/farmProfiles/service.js');

  it('1. atomicFarmSetup validates all required fields before saving', () => {
    // Must validate crop, land size, land unit, country, farmerName before DB touch
    expect(svc).toContain('export async function atomicFarmSetup');
    expect(svc).toContain('validateCrop(data.crop)');
    expect(svc).toContain("throw validationError('Land size is required')");
    expect(svc).toContain("throw validationError('Country is required')");
    expect(svc).toContain("throw validationError('farmerName is required");
    expect(svc).toContain("throw validationError('landSizeUnit must be one of");
  });

  it('2. atomicFarmSetup wraps profile creation + farmer update in a single transaction', () => {
    expect(svc).toContain('prisma.$transaction(async (tx)');
    expect(svc).toContain('tx.farmProfile.create');
    expect(svc).toContain('tx.farmer.update');
    // Both inside the same $transaction callback — no partial saves
  });

  it('3. atomicFarmSetup sets onboardingCompletedAt inside the transaction', () => {
    // The farmer.update inside the tx sets the onboarding flag atomically
    expect(svc).toContain('farmerUpdate.onboardingCompletedAt = new Date()');
  });

  it('4. farmProfileComplete requires crop + land size + country (GPS not required)', () => {
    expect(svc).toContain('result.crop');
    expect(svc).toContain('result.landSizeValue != null || result.farmSizeAcres != null');
    expect(svc).toContain('countryCode');
    // The farmProfileComplete check does NOT include latitude/longitude
    const completeCheck = svc.split('farmProfileComplete = !!')[1]?.split(';')[0] || '';
    expect(completeCheck).not.toContain('latitude');
    expect(completeCheck).not.toContain('longitude');
    expect(svc).toContain('farmProfileComplete');
  });

  it('5. land size validation rejects zero and negative values', () => {
    expect(svc).toContain('numericSize <= 0');
    expect(svc).toContain("'Land size must be a positive number'");
  });

  it('6. createFarmProfile also validates land size (backward compat)', () => {
    // The regular createFarmProfile also got land size validation
    const createBlock = svc.split('export async function createFarmProfile')[1].split('export async function')[0];
    expect(createBlock).toContain("'Land size is required");
    expect(createBlock).toContain("'Land size must be a positive number'");
    expect(createBlock).toContain("isValidUnit(unit)");
  });
});

describe('Atomic farm setup — route handler + response format', () => {
  const routes = readFile('server/src/modules/farmProfiles/routes.js');

  it('7. POST /farms uses atomicFarmSetup for farmer role', () => {
    expect(routes).toContain("req.user.role === 'farmer'");
    expect(routes).toContain('service.atomicFarmSetup');
  });

  it('8. response format includes success + farmProfileComplete + nextRoute + profile', () => {
    expect(routes).toContain('success: true');
    expect(routes).toContain('farmProfileComplete');
    expect(routes).toContain("nextRoute: '/home'");
    expect(routes).toContain('profile');
  });

  it('9. non-farmer role still uses standard createFarmProfile', () => {
    expect(routes).toContain('service.createFarmProfile(req.body, farmerId)');
  });

  it('10. idempotency middleware is still applied', () => {
    expect(routes).toContain("router.post('/', idempotencyCheck");
  });
});

describe('Atomic farm setup — frontend OnboardingWizard', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('11. processing timeout is 8 seconds', () => {
    expect(wizard).toContain('PROCESSING_TIMEOUT_MS = 8000');
  });

  it('12. pre-submit validates crop, land size, and country before network call', () => {
    expect(wizard).toContain("if (!form.crop) missing.push('crop')");
    expect(wizard).toContain("if (!form.farmSizeAcres && !form.farmSizeCategory) missing.push('land size')");
    expect(wizard).toContain("if (!form.countryCode) missing.push('country')");
    expect(wizard).toContain("missing.length > 0");
  });

  it('13. shows server validation errors clearly', () => {
    expect(wizard).toContain('isValidation && serverError');
    expect(wizard).toContain('Validation error:');
  });

  it('14. ProcessingStep shows error UI with retry and back buttons', () => {
    expect(wizard).toContain('onRetry');
    expect(wizard).toContain('onBack');
    expect(wizard).toContain('submitGuardRef.current = false');
  });

  it('15. submit guard prevents duplicate submissions', () => {
    expect(wizard).toContain('if (submitGuardRef.current) return');
    expect(wizard).toContain('submitGuardRef.current = true');
  });
});

describe('Atomic farm setup — FarmerDashboardPage handler', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('16. sends all fields (including gender/countryCode/ageGroup) in a single request', () => {
    // No longer destructures and sends separately
    expect(dashboard).toContain("const { photoFile, ...allFields } = data");
    expect(dashboard).toContain("createProfile(allFields)");
    // Should NOT have a separate PATCH /farmers/me for gender/country
    expect(dashboard).not.toContain("api.patch('/farmers/me'");
  });

  it('17. handles atomic response format (success + farmProfileComplete + profile)', () => {
    expect(dashboard).toContain('result.profile || result');
    expect(dashboard).toContain('result.farmProfileComplete');
    expect(dashboard).toContain("result.farmProfileComplete ?? true");
  });

  it('18. handles offline queued result gracefully', () => {
    expect(dashboard).toContain('result._offline');
    expect(dashboard).toContain('onboarding_queued_offline');
  });

  it('19. tracks farmProfileComplete status in analytics', () => {
    expect(dashboard).toContain("crop: data.crop, farmProfileComplete");
  });
});

describe('Atomic farm setup — farmStore createProfile', () => {
  const store = readFile('src/store/farmStore.js');

  it('20. handles new response format (body.profile || body)', () => {
    expect(store).toContain('body.profile || body');
  });

  it('21. returns full response for atomic setup (success, farmProfileComplete, nextRoute)', () => {
    expect(store).toContain('body.success ? body : profile');
  });

  it('22. idempotency key is generated and sent with request', () => {
    expect(store).toContain('generateIdempotencyKey()');
    expect(store).toContain("'X-Idempotency-Key': idempotencyKey");
  });

  it('23. duplicate submission guard prevents rapid taps', () => {
    expect(store).toContain('_createInFlight');
    expect(store).toContain('if (get()._createInFlight) return null');
  });

  it('24. offline queue includes idempotency key for dedup on replay', () => {
    expect(store).toContain("queueIfOffline('POST', '/v1/farms', data, { 'X-Idempotency-Key': idempotencyKey })");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 16 — VOICE QUALITY IMPROVEMENTS
// ═══════════════════════════════════════════════════════════

describe('Voice quality — natural speech settings', () => {
  const guide = readFile('src/utils/voiceGuide.js');

  it('1. speech rate is 0.85 (slower for clarity)', () => {
    expect(guide).toContain('VOICE_RATE = 0.85');
    expect(guide).toContain('utterance.rate = VOICE_RATE');
  });

  it('2. pitch is 0.9 (slightly lower for warmth)', () => {
    expect(guide).toContain('VOICE_PITCH = 0.9');
    expect(guide).toContain('utterance.pitch = VOICE_PITCH');
  });

  it('3. prompts use human-friendly script pack wording', () => {
    // Welcome prompt is clear and simple
    expect(guide).toContain("Welcome. Let's set up your farm.");
    // Officer prompt is concise
    expect(guide).toContain("Tap approve to confirm.");
    // Update prompt is direct
    expect(guide).toContain("Your update was sent.");
  });

  it('4. wording is simple and direct (no jargon)', () => {
    // Country prompt is simple
    expect(guide).toContain('Choose your country.');
    // Crop prompt is direct
    expect(guide).toContain('Tap the crop you are growing.');
  });
});

describe('Voice quality — smart voice selection', () => {
  const guide = readFile('src/utils/voiceGuide.js');

  it('5. prefers natural / neural / enhanced voices', () => {
    expect(guide).toContain('PREFERRED_VOICE_PATTERNS');
    expect(guide).toContain('/natural/i');
    expect(guide).toContain('/neural/i');
    expect(guide).toContain('/enhanced/i');
  });

  it('6. penalises low-quality voices (compact, espeak)', () => {
    expect(guide).toContain('/compact/i');
    expect(guide).toContain('/espeak/i');
    expect(guide).toContain('score -= ');
  });

  it('7. uses selectBestVoice with scoring', () => {
    expect(guide).toContain('function selectBestVoice');
    expect(guide).toContain('function scoreVoice');
    expect(guide).toContain('const bestVoice = selectBestVoice(langTag)');
  });

  it('8. caches selected voices for performance', () => {
    expect(guide).toContain('_voiceCache');
    expect(guide).toContain('_voiceCache.has(langTag)');
    expect(guide).toContain('_voiceCache.set(langTag, best)');
  });

  it('9. pre-warms voice list on module load (Chrome fix)', () => {
    expect(guide).toContain("window.speechSynthesis.getVoices()");
    expect(guide).toContain('voiceschanged');
  });
});

describe('Voice quality — pre-recorded audio support', () => {
  const guide = readFile('src/utils/voiceGuide.js');

  it('10. has AUDIO_MAP for pre-recorded files', () => {
    expect(guide).toContain('const AUDIO_MAP');
    expect(guide).toContain('export { VOICE_MAP, AUDIO_MAP');
  });

  it('11. tryPlayAudio falls back gracefully', () => {
    expect(guide).toContain('async function tryPlayAudio');
    expect(guide).toContain('resolve(false)'); // returns false on failure
  });

  it('12. speak() tries audio first, then TTS', () => {
    expect(guide).toContain('tryPlayAudio(stepKey, lang).then');
    expect(guide).toContain('if (played) return'); // skip TTS if audio worked
  });

  it('13. stopSpeech stops both audio and TTS', () => {
    expect(guide).toContain('stopAudio()');
    expect(guide).toContain('speechSynthesis.cancel()');
  });

  it('14. audio element is reusable (not recreated each call)', () => {
    expect(guide).toContain('let _audioEl = null');
    expect(guide).toContain('function getAudioElement');
  });

  it('15. audio has 3s load timeout to avoid blocking', () => {
    expect(guide).toContain('setTimeout(() => resolve(false), 3000)');
  });
});
