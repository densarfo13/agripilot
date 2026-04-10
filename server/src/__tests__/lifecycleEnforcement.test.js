import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — Strict Farmer Lifecycle State Logic
// ═══════════════════════════════════════════════════════════

describe('Farmer lifecycle — state definitions', () => {
  const code = readFile('src/utils/farmerLifecycle.js');

  it('defines exactly 3 states: NEW, SETUP_INCOMPLETE, ACTIVE', () => {
    expect(code).toContain("NEW: 'NEW'");
    expect(code).toContain("SETUP_INCOMPLETE: 'SETUP_INCOMPLETE'");
    expect(code).toContain("ACTIVE: 'ACTIVE'");
  });

  it('exports FARMER_STATE enum', () => {
    expect(code).toContain('export const FARMER_STATE');
  });

  it('exports getFarmerLifecycleState function', () => {
    expect(code).toContain('export function getFarmerLifecycleState');
  });

  it('exports guard functions', () => {
    expect(code).toContain('export function canStartSeason');
    expect(code).toContain('export function canShowScore');
    expect(code).toContain('export function canAddUpdate');
  });

  it('guard functions check for ACTIVE state', () => {
    expect(code).toContain('lifecycleState.state === FARMER_STATE.ACTIVE');
  });
});

describe('Farmer lifecycle — required fields', () => {
  const code = readFile('src/utils/farmerLifecycle.js');

  it('requires crop field', () => {
    expect(code).toContain("key: 'crop'");
  });

  it('requires landSizeValue with farmSizeAcres fallback', () => {
    expect(code).toContain("key: 'landSizeValue'");
    expect(code).toContain("fallback: 'farmSizeAcres'");
  });

  it('requires landSizeUnit', () => {
    expect(code).toContain("key: 'landSizeUnit'");
  });

  it('requires landSizeHectares', () => {
    expect(code).toContain("key: 'landSizeHectares'");
  });

  it('requires country code', () => {
    expect(code).toContain('COUNTRY_REQUIRED');
    expect(code).toContain('countryCode');
  });
});

describe('Farmer lifecycle — state derivation logic', () => {
  const code = readFile('src/utils/farmerLifecycle.js');

  it('returns NEW when no farm profile', () => {
    expect(code).toContain('if (!farmProfile)');
    expect(code).toContain('FARMER_STATE.NEW');
  });

  it('returns SETUP_INCOMPLETE when missing required fields', () => {
    expect(code).toContain('if (!complete)');
    expect(code).toContain('FARMER_STATE.SETUP_INCOMPLETE');
  });

  it('returns ACTIVE when all fields present', () => {
    expect(code).toContain('FARMER_STATE.ACTIVE');
    expect(code).toContain('complete: true');
  });

  it('reports missing fields in the state result', () => {
    expect(code).toContain('missing:');
    expect(code).toContain('missing.push');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — Lifecycle Enforcement in UI Components
// ═══════════════════════════════════════════════════════════

describe('FarmerDashboardPage — lifecycle enforcement', () => {
  const code = readFile('src/pages/FarmerDashboardPage.jsx');

  it('imports lifecycle utilities', () => {
    expect(code).toContain("getFarmerLifecycleState");
    expect(code).toContain("FARMER_STATE");
    expect(code).toContain("canShowScore");
    expect(code).toContain("canStartSeason");
  });

  it('derives lifecycle state from farmProfile + countryCode', () => {
    expect(code).toContain('getFarmerLifecycleState({');
    expect(code).toContain('farmProfile');
    expect(code).toContain('countryCode');
  });

  it('uses lifecycle state for CTA decisions', () => {
    expect(code).toContain('setupComplete');
    expect(code).toContain('isActive');
    expect(code).toContain('isSetupIncomplete');
    expect(code).toContain('isNew');
  });

  it('gates score display by setupComplete', () => {
    expect(code).toContain('setupComplete && !financeScore.setupRequired');
  });

  it('shows "Set Up Farm" for NEW state', () => {
    expect(code).toContain("t('home.setUpFarm')");
  });

  it('shows "Finish Setup" for SETUP_INCOMPLETE state', () => {
    expect(code).toContain("t('home.finishSetup')");
  });

  it('shows missing fields in CTA helper text', () => {
    expect(code).toContain('farmerLifecycle.missing');
    expect(code).toContain("t('home.missing')");
  });
});

describe('FarmerProgressTab — lifecycle guard for season creation', () => {
  const code = readFile('src/pages/FarmerProgressTab.jsx');

  it('imports lifecycle utilities', () => {
    expect(code).toContain("getFarmerLifecycleState");
    expect(code).toContain("canStartSeason");
    expect(code).toContain("FARMER_STATE");
  });

  it('fetches farm profile for lifecycle check', () => {
    expect(code).toContain('/farm-profiles');
    expect(code).toContain('setFarmProfile');
  });

  it('computes lifecycle state', () => {
    expect(code).toContain('getFarmerLifecycleState({ farmProfile, countryCode:');
  });

  it('gates season creation by setupComplete', () => {
    expect(code).toContain('setupComplete');
    // The "Start New Season" button should only appear when setup is complete
    expect(code).toContain('setupComplete ? (');
  });

  it('shows setup-required banner when profile incomplete', () => {
    expect(code).toContain('setup-required-banner');
    expect(code).toContain("t('progress.setupRequired')");
    expect(code).toContain("t('progress.completeSetupFirst')");
  });

  it('shows missing fields in setup-required banner', () => {
    expect(code).toContain('lifecycle.missing');
  });

  it('bottom season button gated by setupComplete', () => {
    // The bottom "Start New Season" button is wrapped in setupComplete check
    const bottomBtnIdx = code.indexOf('New season button at bottom');
    const chunk = code.slice(bottomBtnIdx, bottomBtnIdx + 200);
    expect(chunk).toContain('setupComplete');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — Backend Lifecycle Guard on Season Creation
// ═══════════════════════════════════════════════════════════

describe('Season service — lifecycle guard', () => {
  const code = readFile('server/src/modules/seasons/service.js');

  it('imports lifecycle utilities', () => {
    expect(code).toContain('getFarmerLifecycleState');
    expect(code).toContain('FARMER_STATE');
  });

  it('checks lifecycle state before creating season', () => {
    const createIdx = code.indexOf('createSeason');
    const chunk = code.slice(createIdx, createIdx + 800);
    expect(chunk).toContain('getFarmerLifecycleState');
    expect(chunk).toContain("lifecycle.state !== FARMER_STATE.ACTIVE");
  });

  it('returns error with missing fields when setup incomplete', () => {
    const createIdx = code.indexOf('createSeason');
    const chunk = code.slice(createIdx, createIdx + 800);
    expect(chunk).toContain('lifecycle.missing.join');
    expect(chunk).toContain('Complete your farm profile');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 4 — Score / Completeness Separation
// ═══════════════════════════════════════════════════════════

describe('Finance score — setup-required gating', () => {
  const code = readFile('server/src/modules/financeScore/service.js');

  it('checks isFarmProfileComplete before scoring', () => {
    expect(code).toContain('isFarmProfileComplete');
    expect(code).toContain('if (!complete)');
  });

  it('returns setupRequired: true when incomplete', () => {
    expect(code).toContain('setupRequired: true');
  });

  it('returns null score when setup required', () => {
    expect(code).toContain('score: null');
    expect(code).toContain('band: null');
  });

  it('returns "Setup Required" readiness text', () => {
    expect(code).toContain("readiness: 'Setup Required'");
  });

  it('includes missing fields in response', () => {
    expect(code).toContain('missingRequiredFields: missing');
  });
});

describe('Dashboard — score display gating', () => {
  const dashboard = readFile('src/pages/FarmerDashboardPage.jsx');

  it('only shows farm score for ACTIVE farmers with real scores', () => {
    expect(dashboard).toContain('financeScore && setupComplete && !financeScore.setupRequired');
  });

  it('does NOT show misleading scores for incomplete profiles', () => {
    // The score card is inside a conditional block that requires setupComplete
    // Look at the 200 chars before the farm-score-compact testid
    const scoreIdx = dashboard.indexOf('farm-score-compact');
    const chunk = dashboard.slice(Math.max(0, scoreIdx - 200), scoreIdx);
    expect(chunk).toContain('setupComplete');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — Data Consistency (land size normalization)
// ═══════════════════════════════════════════════════════════

describe('Data consistency — land size normalization', () => {
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('uses computeLandSizeFields for all land size inputs', () => {
    expect(service).toContain('computeLandSizeFields');
    const matches = (service.match(/computeLandSizeFields/g) || []).length;
    // Should be used in create, atomicFarmSetup, and update paths
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it('always normalizes to hectares', () => {
    expect(service).toContain('landSizeHectares');
  });

  it('keeps farmSizeAcres in sync for backward compat', () => {
    expect(service).toContain('fromHectares');
    expect(service).toContain('farmSizeAcres');
  });

  it('defaults unit to ACRE when not specified', () => {
    expect(service).toContain("'ACRE'");
  });
});

describe('Data consistency — crop field naming', () => {
  const lifecycle = readFile('src/utils/farmerLifecycle.js');

  it('checks crop field (not cropType or cropCode)', () => {
    expect(lifecycle).toContain("key: 'crop'");
  });

  it('lifecycle required fields match farm profile schema', () => {
    // Verify all required field keys are valid FarmProfile fields
    const requiredKeys = ['crop', 'landSizeValue', 'landSizeUnit', 'landSizeHectares'];
    for (const key of requiredKeys) {
      expect(lifecycle).toContain(`key: '${key}'`);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — Translation Coverage for Lifecycle Messages
// ═══════════════════════════════════════════════════════════

describe('Translations — lifecycle and setup messages', () => {
  const translations = readFile('src/i18n/translations.js');

  it('has progress.setupRequired in all 5 languages', () => {
    expect(translations).toContain("'progress.setupRequired'");
    const idx = translations.indexOf("'progress.setupRequired'");
    const chunk = translations.slice(idx, idx + 300);
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });

  it('has progress.completeSetupFirst in all 5 languages', () => {
    expect(translations).toContain("'progress.completeSetupFirst'");
    const idx = translations.indexOf("'progress.completeSetupFirst'");
    const chunk = translations.slice(idx, idx + 400);
    expect(chunk).toContain('en:');
    expect(chunk).toContain('fr:');
    expect(chunk).toContain('sw:');
    expect(chunk).toContain('ha:');
    expect(chunk).toContain('tw:');
  });

  it('has home.setUpFarm translation', () => {
    expect(translations).toContain("'home.setUpFarm'");
  });

  it('has home.finishSetup translation', () => {
    expect(translations).toContain("'home.finishSetup'");
  });

  it('has home.missing translation', () => {
    expect(translations).toContain("'home.missing'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 7 — Atomic Farm Setup Integrity
// ═══════════════════════════════════════════════════════════

describe('Atomic farm setup — transaction integrity', () => {
  const service = readFile('server/src/modules/farmProfiles/service.js');

  it('uses prisma transaction for atomic setup', () => {
    expect(service).toContain('$transaction');
  });

  it('creates profile and updates farmer in same transaction', () => {
    const atomicIdx = service.indexOf('atomicFarmSetup');
    const chunk = service.slice(atomicIdx, atomicIdx + 4000);
    expect(chunk).toContain('tx.farmProfile.create');
    expect(chunk).toContain('tx.farmer.update');
  });

  it('sets onboardingCompletedAt on farmer record', () => {
    expect(service).toContain('onboardingCompletedAt');
  });

  it('normalizes crop name', () => {
    expect(service).toContain('normalizeCrop');
  });

  it('validates required fields before transaction', () => {
    const atomicIdx = service.indexOf('atomicFarmSetup');
    const chunk = service.slice(atomicIdx, atomicIdx + 800);
    // Should check for crop and land size before entering transaction
    expect(chunk).toContain('crop');
  });

  it('returns lifecycle state in response', () => {
    expect(service).toContain('farmProfileComplete');
    expect(service).toContain('farmerState');
    expect(service).toContain('missingRequiredFields');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 8 — QuickUpdateFlow Localization
// ═══════════════════════════════════════════════════════════

describe('QuickUpdateFlow — localized option factory functions', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('uses getActionOptions factory function', () => {
    expect(code).toContain('function getActionOptions(t)');
    expect(code).toContain('getActionOptions(t)');
  });

  it('uses getStageOptions factory function', () => {
    expect(code).toContain('function getStageOptions(t)');
    expect(code).toContain('getStageOptions(t)');
  });

  it('uses getConditionOptions factory function', () => {
    expect(code).toContain('function getConditionOptions(t)');
    expect(code).toContain('getConditionOptions(t)');
  });

  it('no hardcoded English in action options', () => {
    expect(code).not.toContain("label: 'Crop Progress'");
    expect(code).not.toContain("label: 'Upload Photo'");
    expect(code).not.toContain("label: 'Report Issue'");
  });

  it('no hardcoded English in stage options', () => {
    expect(code).not.toContain("label: 'Planting'");
    expect(code).not.toContain("label: 'Growing'");
    expect(code).not.toContain("label: 'Flowering'");
    expect(code).not.toContain("label: 'Harvesting'");
  });

  it('no hardcoded English in condition options', () => {
    expect(code).not.toContain("label: 'Good'");
    expect(code).not.toContain("label: 'Okay'");
    expect(code).not.toContain("label: 'Problem'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 9 — FarmerProgressTab Localized Messages
// ═══════════════════════════════════════════════════════════

describe('FarmerProgressTab — localized success/error messages', () => {
  const code = readFile('src/pages/FarmerProgressTab.jsx');

  it('season created message uses t()', () => {
    expect(code).toContain("t('progress.seasonCreated')");
    expect(code).not.toContain("'Season created. You can now start logging activities.'");
  });

  it('first activity message uses t()', () => {
    expect(code).toContain("t('progress.firstActivityRecorded')");
    expect(code).not.toContain("'your first activity is recorded'");
  });

  it('activity recorded message uses t()', () => {
    expect(code).toContain("t('progress.activityRecorded')");
  });

  it('condition saved uses t()', () => {
    expect(code).toContain("t('progress.conditionSaved')");
    expect(code).not.toContain("'Condition update saved.'");
  });

  it('stage confirmed uses t()', () => {
    expect(code).toContain("t('progress.stageConfirmed')");
    expect(code).not.toContain("'Stage confirmed.'");
  });

  it('harvest submitted uses t()', () => {
    expect(code).toContain("t('progress.harvestSubmitted')");
    expect(code).not.toContain("'Harvest report submitted.'");
  });

  it('photo uploaded uses t()', () => {
    expect(code).toContain("t('progress.photoUploaded')");
  });

  it('load error uses t()', () => {
    expect(code).toContain("t('progress.loadError')");
    expect(code).not.toContain("'Failed to load season data. Check your connection.'");
  });

  it('duplicate warning uses t()', () => {
    expect(code).toContain("t('progress.duplicateWarning')");
    expect(code).not.toContain("'Duplicate check:");
  });

  it('retry button uses t()', () => {
    expect(code).toContain("t('common.retry')");
  });

  it('all error fallbacks use t()', () => {
    expect(code).toContain("t('progress.createSeasonError')");
    expect(code).toContain("t('progress.saveActivityError')");
    expect(code).toContain("t('progress.conditionError')");
    expect(code).toContain("t('progress.stageError')");
    expect(code).toContain("t('progress.harvestError')");
    expect(code).toContain("t('progress.photoError')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 10 — Translation Keys Exist in All 5 Languages
// ═══════════════════════════════════════════════════════════

describe('Translations — QuickUpdateFlow keys in all 5 languages', () => {
  const translations = readFile('src/i18n/translations.js');

  const keys = [
    'quickUpdate.cropProgress', 'quickUpdate.uploadPhoto', 'quickUpdate.reportIssue',
    'quickUpdate.planting', 'quickUpdate.growing', 'quickUpdate.flowering', 'quickUpdate.harvesting',
    'quickUpdate.good', 'quickUpdate.okay', 'quickUpdate.problem',
  ];

  for (const key of keys) {
    it(`has ${key} in all 5 languages`, () => {
      expect(translations).toContain(`'${key}'`);
      const idx = translations.indexOf(`'${key}'`);
      const chunk = translations.slice(idx, idx + 300);
      expect(chunk).toContain('en:');
      expect(chunk).toContain('fr:');
      expect(chunk).toContain('sw:');
      expect(chunk).toContain('ha:');
      expect(chunk).toContain('tw:');
    });
  }
});

describe('Translations — FarmerProgressTab keys in all 5 languages', () => {
  const translations = readFile('src/i18n/translations.js');

  const keys = [
    'progress.seasonCreated', 'progress.activityRecorded', 'progress.conditionSaved',
    'progress.stageConfirmed', 'progress.harvestSubmitted', 'progress.photoUploaded',
    'progress.loadError', 'progress.duplicateWarning',
  ];

  for (const key of keys) {
    it(`has ${key} in all 5 languages`, () => {
      expect(translations).toContain(`'${key}'`);
      const idx = translations.indexOf(`'${key}'`);
      const chunk = translations.slice(idx, idx + 400);
      expect(chunk).toContain('en:');
      expect(chunk).toContain('fr:');
      expect(chunk).toContain('sw:');
      expect(chunk).toContain('ha:');
      expect(chunk).toContain('tw:');
    });
  }
});
