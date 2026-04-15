/**
 * Onboarding Flow — source-code enforcement tests.
 *
 * Verifies:
 * 1. FarmerType page exists and works correctly
 * 2. StarterGuide page exists with guided steps
 * 3. ProfileSetup routes to farmer-type when experienceLevel not set
 * 4. Dashboard personalizes by farmer type
 * 5. Routes are registered in App.jsx
 * 6. Zod validation schema exists
 * 7. Dashboard mode helper works
 * 8. i18n keys for new pages
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  FARMER TYPE PAGE
// ═══════════════════════════════════════════════════════════

describe('FarmerType page', () => {
  const src = read('src/pages/FarmerType.jsx');

  it('exists and exports default', () => {
    expect(src).toContain('export default function FarmerType');
  });

  it('saves via dedicated farmer-type API endpoint', () => {
    expect(src).toContain('apiFarmerType(farmerType)');
  });

  it('refreshes profile after save', () => {
    expect(src).toContain('refreshProfile()');
  });

  it('handles "new" → routes to /onboarding/starter-guide', () => {
    expect(src).toContain("'/onboarding/starter-guide'");
  });

  it('handles "experienced" → routes to /dashboard', () => {
    expect(src).toContain("'/dashboard'");
  });

  it('has loading state prevention', () => {
    expect(src).toContain('if (saving) return');
  });

  it('has error handling with console.error', () => {
    expect(src).toContain("console.error('Farmer type save error:'");
  });

  it('has console.log for save events', () => {
    expect(src).toContain("console.log('Saving farmer type:'");
    expect(src).toContain("console.log('Farmer type saved:'");
  });

  it('tracks analytics event', () => {
    expect(src).toContain("safeTrackEvent('onboarding.farmer_type_selected'");
  });

  it('uses i18n for all visible text', () => {
    expect(src).toContain("t('farmerType.question')");
    expect(src).toContain("t('farmerType.new')");
    expect(src).toContain("t('farmerType.experienced')");
    expect(src).toContain("t('farmerType.newDesc')");
    expect(src).toContain("t('farmerType.experiencedDesc')");
  });

  it('shows error message on failure', () => {
    expect(src).toContain('{error &&');
  });

  it('shows saving indicator', () => {
    expect(src).toContain("t('farmerType.saving')");
  });

  it('disables buttons while saving', () => {
    expect(src).toContain('disabled={saving}');
  });
});

// ═══════════════════════════════════════════════════════════
//  STARTER GUIDE PAGE
// ═══════════════════════════════════════════════════════════

describe('StarterGuide page', () => {
  const src = read('src/pages/StarterGuide.jsx');

  it('exists and exports default', () => {
    expect(src).toContain('export default function StarterGuide');
  });

  it('imports GUIDED_STEPS', () => {
    expect(src).toContain('GUIDED_STEPS');
  });

  it('renders all 5 guided steps', () => {
    expect(src).toContain('GUIDED_STEPS.map');
    expect(src).toContain("t(`guided.step.${step.id}`)");
  });

  it('has continue button to dashboard', () => {
    expect(src).toContain("navigate('/dashboard')");
    expect(src).toContain("t('starterGuide.continue')");
  });

  it('tracks completion event', () => {
    expect(src).toContain("safeTrackEvent('onboarding.starter_guide_completed'");
  });

  it('uses i18n for title and subtitle', () => {
    expect(src).toContain("t('starterGuide.title')");
    expect(src).toContain("t('starterGuide.subtitle')");
  });
});

// ═══════════════════════════════════════════════════════════
//  PROFILE SETUP — conditional routing
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup — post-save routing', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('routes to farmer-type when experienceLevel not set', () => {
    expect(src).toContain("navigate('/onboarding/farmer-type')");
  });

  it('routes to dashboard when experienceLevel already set', () => {
    expect(src).toContain("navigate('/dashboard')");
  });

  it('checks experienceLevel before routing', () => {
    expect(src).toContain("if (!form.experienceLevel)");
  });
});

// ═══════════════════════════════════════════════════════════
//  APP ROUTES
// ═══════════════════════════════════════════════════════════

describe('App.jsx — onboarding routes', () => {
  const src = read('src/App.jsx');

  it('has /onboarding/farmer-type route', () => {
    expect(src).toContain('"/onboarding/farmer-type"');
  });

  it('has /onboarding/starter-guide route', () => {
    expect(src).toContain('"/onboarding/starter-guide"');
  });

  it('lazy-loads FarmerType page', () => {
    expect(src).toContain("import('./pages/FarmerType.jsx')");
  });

  it('lazy-loads StarterGuide page', () => {
    expect(src).toContain("import('./pages/StarterGuide.jsx')");
  });
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD — personalization by farmer type
// ═══════════════════════════════════════════════════════════

describe('Dashboard — farmer type personalization', () => {
  it('dashboardMode utility file exists', () => {
    expect(existsSync(join(root, 'src/utils/dashboardMode.js'))).toBe(true);
  });

  it('dashboardMode utility exports isOperationsMode', () => {
    const src = read('src/utils/dashboardMode.js');
    expect(src).toContain('isOperationsMode');
  });
});

// ═══════════════════════════════════════════════════════════
//  DASHBOARD MODE HELPER
// ═══════════════════════════════════════════════════════════

describe('dashboardMode utility', () => {
  it('exports getDashboardMode, isBeginnerMode, isOperationsMode', async () => {
    const mod = await import('../../../src/utils/dashboardMode.js');
    expect(typeof mod.getDashboardMode).toBe('function');
    expect(typeof mod.isBeginnerMode).toBe('function');
    expect(typeof mod.isOperationsMode).toBe('function');
  });

  it('returns beginner for null profile', async () => {
    const { getDashboardMode } = await import('../../../src/utils/dashboardMode.js');
    expect(getDashboardMode(null)).toBe('beginner');
  });

  it('returns beginner for new farmer', async () => {
    const { getDashboardMode } = await import('../../../src/utils/dashboardMode.js');
    expect(getDashboardMode({ experienceLevel: 'new' })).toBe('beginner');
  });

  it('returns operations for experienced farmer', async () => {
    const { getDashboardMode } = await import('../../../src/utils/dashboardMode.js');
    expect(getDashboardMode({ experienceLevel: 'experienced' })).toBe('operations');
  });

  it('returns beginner for unknown experienceLevel', async () => {
    const { getDashboardMode } = await import('../../../src/utils/dashboardMode.js');
    expect(getDashboardMode({ experienceLevel: null })).toBe('beginner');
    expect(getDashboardMode({})).toBe('beginner');
  });

  it('isOperationsMode matches getDashboardMode', async () => {
    const { isOperationsMode, isBeginnerMode } = await import('../../../src/utils/dashboardMode.js');
    expect(isOperationsMode({ experienceLevel: 'experienced' })).toBe(true);
    expect(isOperationsMode({ experienceLevel: 'new' })).toBe(false);
    expect(isBeginnerMode({ experienceLevel: 'new' })).toBe(true);
    expect(isBeginnerMode({ experienceLevel: 'experienced' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
//  ZOD VALIDATION SCHEMA
// ═══════════════════════════════════════════════════════════

describe('Zod validation schema', () => {
  const src = read('server/lib/farmProfileSchema.js');

  it('exports farmProfileSchema', () => {
    expect(src).toContain('export const farmProfileSchema');
  });

  it('exports farmerTypeSchema', () => {
    expect(src).toContain('export const farmerTypeSchema');
  });

  it('exports validateWithZod helper', () => {
    expect(src).toContain('export function validateWithZod');
  });

  it('farmProfileSchema validates required fields', () => {
    expect(src).toContain("'Farmer name is required'");
    expect(src).toContain("'Farm name is required'");
    expect(src).toContain("'Country is required'");
    expect(src).toContain("'Enter your location'");
    expect(src).toContain("'Crop type is required'");
  });

  it('farmerTypeSchema only allows new/experienced', () => {
    expect(src).toContain("z.enum(['new', 'experienced']");
  });

  it('uses zod library', () => {
    expect(src).toContain("from 'zod'");
  });
});

// ═══════════════════════════════════════════════════════════
//  i18n — new page keys
// ═══════════════════════════════════════════════════════════

describe('i18n — farmer type and starter guide keys', () => {
  const translations = read('src/i18n/translations.js');

  const requiredKeys = [
    'farmerType.question',
    'farmerType.subtitle',
    'farmerType.new',
    'farmerType.newDesc',
    'farmerType.experienced',
    'farmerType.experiencedDesc',
    'farmerType.saving',
    'farmerType.saveFailed',
    'starterGuide.title',
    'starterGuide.subtitle',
    'starterGuide.continue',
  ];

  for (const key of requiredKeys) {
    it(`has key: ${key}`, () => {
      expect(translations).toContain(`'${key}'`);
    });
  }

  it('all new keys have 5 languages', () => {
    for (const key of requiredKeys) {
      const start = translations.indexOf(`'${key}'`);
      const block = translations.substring(start, start + 600);
      expect(block).toContain('en:');
      expect(block).toContain('fr:');
      expect(block).toContain('sw:');
      expect(block).toContain('ha:');
      expect(block).toContain('tw:');
    }
  });
});

// ═══════════════════════════════════════════════════════════
//  EXISTING INFRASTRUCTURE — still works
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  BACKEND — farmer-type endpoint + onboarding tracking
// ═══════════════════════════════════════════════════════════

describe('Backend — farmer-type endpoint', () => {
  const route = read('server/routes/farmProfile.js');

  it('has POST /farmer-type route', () => {
    expect(route).toContain("router.post('/farmer-type'");
  });

  it('uses Zod validation via validateWithZod', () => {
    expect(route).toContain('validateWithZod(farmerTypeSchema');
  });

  it('updates experienceLevel on farm profile', () => {
    expect(route).toContain('experienceLevel: farmerType');
  });

  it('updates onboarding status on user record', () => {
    expect(route).toContain("onboardingLastStep: 'farmer_type'");
    expect(route).toContain("onboardingStatus: 'completed'");
    expect(route).toContain('onboardedAt:');
  });

  it('uses atomic transaction for profile + user update', () => {
    expect(route).toContain('prisma.$transaction');
  });

  it('returns 404 if no farm profile found', () => {
    expect(route).toContain('No farm profile found');
  });

  it('logs farmer type to console', () => {
    expect(route).toContain('console.log(`Farmer type set:');
  });

  it('writes audit log', () => {
    expect(route).toContain("'farm_profile.farmer_type_set'");
  });
});

describe('Backend — farm profile save tracks onboarding', () => {
  const route = read('server/routes/farmProfile.js');

  it('updates onboardingLastStep to farm_profile', () => {
    expect(route).toContain("onboardingLastStep: 'farm_profile'");
  });

  it('sets onboardingStatus to in_progress', () => {
    expect(route).toContain("onboardingStatus: 'in_progress'");
  });

  it('imports Zod schemas', () => {
    expect(route).toContain("import { farmProfileSchema, farmerTypeSchema, validateWithZod }");
  });
});

describe('API client — saveFarmerType', () => {
  const src = read('src/lib/api.js');

  it('exports saveFarmerType function', () => {
    expect(src).toContain('export function saveFarmerType');
  });

  it('calls /api/v2/farm-profile/farmer-type', () => {
    expect(src).toContain('/api/v2/farm-profile/farmer-type');
  });
});

// ═══════════════════════════════════════════════════════════
//  ROUTES — auth protection
// ═══════════════════════════════════════════════════════════

describe('Routes — onboarding pages protected by auth', () => {
  const src = read('src/App.jsx');

  it('farmer-type route is inside V2ProtectedLayout', () => {
    const protectedStart = src.indexOf('<Route element={<V2ProtectedLayout />}>');
    const farmerTypeRoute = src.indexOf('"/onboarding/farmer-type"');
    const protectedEnd = src.indexOf('</Route>', protectedStart);
    expect(farmerTypeRoute).toBeGreaterThan(protectedStart);
    expect(farmerTypeRoute).toBeLessThan(protectedEnd);
  });

  it('starter-guide route is inside V2ProtectedLayout', () => {
    const protectedStart = src.indexOf('<Route element={<V2ProtectedLayout />}>');
    const starterRoute = src.indexOf('"/onboarding/starter-guide"');
    const protectedEnd = src.indexOf('</Route>', protectedStart);
    expect(starterRoute).toBeGreaterThan(protectedStart);
    expect(starterRoute).toBeLessThan(protectedEnd);
  });
});

describe('Existing infrastructure preserved', () => {
  it('ProfileSetup still has experienceLevel in form', () => {
    const src = read('src/pages/ProfileSetup.jsx');
    expect(src).toContain("experienceLevel: ''");
    expect(src).toContain("updateField('experienceLevel'");
  });

  it('GuidedFarmingCard still uses isGuidedMode', () => {
    const src = read('src/components/GuidedFarmingCard.jsx');
    expect(src).toContain('isGuidedMode(profile)');
  });

  it('guidedFarmingSteps still exports isGuidedMode', () => {
    const src = read('src/utils/guidedFarmingSteps.js');
    expect(src).toContain('export function isGuidedMode');
  });

  it('validation.js still validates experienceLevel', () => {
    const src = read('server/lib/validation.js');
    expect(src).toContain('experienceLevel');
    expect(src).toContain("VALID_EXPERIENCE_LEVELS");
  });

  it('schema still has experienceLevel field', () => {
    const schema = read('server/prisma/schema.prisma');
    expect(schema).toContain('experienceLevel');
    expect(schema).toContain('experience_level');
  });
});
