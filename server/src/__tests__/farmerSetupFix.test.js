import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PART 1 — Stuck Setup Flow Fix
// ═══════════════════════════════════════════════════════════

describe('Setup flow — stuck spinner fix (root cause)', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const parent = readFile('src/pages/FarmerDashboardPage.jsx');

  it('parent handler throws on createProfile failure', () => {
    expect(parent).toContain('throw new Error(msg)');
    const throwCount = (parent.match(/throw new Error\(msg\)/g) || []).length;
    expect(throwCount).toBeGreaterThanOrEqual(2); // once for catch, once for null check
  });

  it('parent handler throws when createProfile returns null', () => {
    expect(parent).toContain('if (!result)');
    // After the null check, there should be a throw
    const nullIdx = parent.indexOf('if (!result)');
    const chunk = parent.slice(nullIdx, nullIdx + 300);
    expect(chunk).toContain('throw new Error');
  });

  it('parent handler does NOT silently return on failure', () => {
    // The old bug: "return; // stay on onboarding" without throwing
    const onCompleteStart = parent.indexOf('handleOnboardingComplete');
    const onCompleteEnd = parent.indexOf('setShowOnboarding(false)');
    const block = parent.slice(onCompleteStart, onCompleteEnd);
    // Every 'return' in the error paths should be preceded by a throw
    // There should be no bare "return;" without a throw before it
    const lines = block.split('\n');
    let foundBareReturn = false;
    for (const line of lines) {
      if (line.trim() === 'return;' || line.trim() === 'return; // stay on onboarding') {
        foundBareReturn = true;
      }
    }
    expect(foundBareReturn).toBe(false);
  });

  it('wizard stays on processing step on error (not photo step)', () => {
    // The old code navigated back to photo step on error, hiding the error UI
    const catchBlock = wizard.indexOf('} catch (err) {', wizard.indexOf('await onComplete'));
    const chunk = wizard.slice(catchBlock, catchBlock + 500);
    // Should NOT navigate back to photo step
    expect(chunk).not.toContain("setStep(photoStepIdx)");
    expect(chunk).not.toContain("STEP_KEYS.indexOf('photo')");
  });
});

describe('Setup flow — ProcessingStep timeout and retry', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('has timeout constant', () => {
    expect(wizard).toContain('PROCESSING_TIMEOUT_MS');
    expect(wizard).toContain('8000');
  });

  it('shows timeout UI with retry button', () => {
    expect(wizard).toContain("t('processing.takingLonger')");
    expect(wizard).toContain("t('common.retry')");
    expect(wizard).toContain("t('processing.goBack')");
  });

  it('shows error UI with network/general distinction', () => {
    expect(wizard).toContain("t('processing.noConnection')");
    expect(wizard).toContain("t('processing.somethingWrong')");
    expect(wizard).toContain("t('processing.retryWhenOnline')");
  });

  it('retry resets submitGuardRef so re-submit works', () => {
    expect(wizard).toContain('submitGuardRef.current = false; handleSubmit()');
  });

  it('back button from error resets guard and state', () => {
    expect(wizard).toContain("setStep(STEP_KEYS.indexOf('photo')); setError(''); setNetworkError(false); submitGuardRef.current = false;");
  });

  it('ProcessingStep resets animation on retry via retryCount', () => {
    expect(wizard).toContain('retryCount');
    expect(wizard).toContain('setRetryCount');
    expect(wizard).toContain('[submitting, retryCount]');
  });

  it('ProcessingStep resets timedOut state on retry', () => {
    // On each submitting change, timedOut should be reset
    const procStart = wizard.indexOf('function ProcessingStep');
    const procChunk = wizard.slice(procStart, procStart + 800);
    expect(procChunk).toContain('setTimedOut(false)');
  });

  it('success path clears draft and shows success state', () => {
    expect(wizard).toContain('clearDraft()');
    expect(wizard).toContain('setSubmitSuccess(true)');
    expect(wizard).toContain("t('wizard.farmCreated')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2 — Crop Selector (expanded, not limited to 4)
// ═══════════════════════════════════════════════════════════

describe('Crop selector — full dataset, not hardcoded', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const crops = readFile('src/utils/crops.js');
  const cropSelect = readFile('src/components/CropSelect.jsx');

  it('TOP_CROPS has 16 common crops (expanded from 6)', () => {
    // Count TOP_CROPS entries in getTopCrops factory
    const topStart = wizard.indexOf('function getTopCrops');
    const block = wizard.slice(topStart, topStart + 1200);
    const entries = (block.match(/code: '/g) || []).length;
    expect(entries).toBeGreaterThanOrEqual(12);
  });

  it('shows 8 top crops in the grid (country-aware)', () => {
    expect(wizard).toContain('countryTopCodes.slice(0, 8)');
    expect(wizard).toContain('TOP_CROPS.slice(0, 8)');
  });

  it('has an "Other..." quick-tap button directly in the grid', () => {
    expect(wizard).toContain('crop-other-tap');
    expect(wizard).toContain("t('wizard.otherCrop')");
    expect(wizard).toContain("borderStyle: 'dashed'");
  });

  it('has a prominent "Search all 80+ crops" button', () => {
    expect(wizard).toContain('crop-search-all');
    expect(wizard).toContain("t('wizard.searchAll60')");
    expect(wizard).toContain('searchAllBtn');
  });

  it('searchAllBtn style is prominent (green, not dashed grey)', () => {
    const idx = wizard.indexOf('searchAllBtn:');
    const chunk = wizard.slice(idx, idx + 300);
    expect(chunk).toContain('#22C55E');
    expect(chunk).toContain("minHeight: '48px'");
  });

  it('CropSelect supports "Other" custom crop entry', () => {
    expect(cropSelect).toContain('OTHER_CROP');
    expect(cropSelect).toContain('OTHER');
    expect(cropSelect).toContain('otherInput');
    expect(cropSelect).toContain('Enter your crop name');
  });

  it('crops.js has 60+ crop entries', () => {
    const entries = (crops.match(/code: '/g) || []).length;
    expect(entries).toBeGreaterThanOrEqual(60);
  });

  it('CropSelect is searchable with keyboard navigation', () => {
    expect(cropSelect).toContain('handleKeyDown');
    expect(cropSelect).toContain('ArrowDown');
    expect(cropSelect).toContain('highlightIdx');
  });

  it('CropSelect has recommendations section', () => {
    expect(cropSelect).toContain('Recommended for your land');
    expect(cropSelect).toContain('recommendCrops');
  });
});

// ═══════════════════════════════════════════════════════════
// PART 3 — Land Size Unit Selector
// ═══════════════════════════════════════════════════════════

describe('Land size — unit selector (acre + hectare)', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const landSize = readFile('src/utils/landSize.js');

  it('unit selector is visible (not hidden in details)', () => {
    expect(wizard).toContain('land-unit-selector');
    // Should NOT have the old details/summary pattern
    expect(wizard).not.toContain('Know exact size? Enter it here');
    expect(wizard).not.toContain('exactSizeDetails');
    expect(wizard).not.toContain('exactSizeSummary');
  });

  it('shows Acres and Hectares as unit options', () => {
    expect(wizard).toContain('UNIT_OPTIONS');
    expect(landSize).toContain("value: 'ACRE'");
    expect(landSize).toContain("value: 'HECTARE'");
  });

  it('farm size subtitles adapt to selected unit', () => {
    expect(wizard).toContain('FARM_SIZE_DEFS');
    expect(wizard).toContain("t('farmSize.under2acres')");
    expect(wizard).toContain("t('farmSize.under1hectare')");
    expect(wizard).toContain("t('farmSize.2to10acres')");
    expect(wizard).toContain("t('farmSize.1to4hectares')");
  });

  it('exact size input is always visible (not in details)', () => {
    expect(wizard).toContain('exact-size-input');
    expect(wizard).toContain("t('wizard.orEnterExact')");
  });

  it('exact size shows unit label next to input', () => {
    expect(wizard).toContain("form.landSizeUnit === 'HECTARE' ? t('wizard.hectares') : t('wizard.acres')");
  });

  it('normalizes to hectares via computeLandSizeFields', () => {
    expect(landSize).toContain('toHectares');
    expect(landSize).toContain('ACRE: 0.404686');
    expect(landSize).toContain('HECTARE: 1');
    expect(wizard).toContain('computeLandSizeFields');
  });

  it('submit derives size with selected unit (not hardcoded acres)', () => {
    const submitBlock = wizard.indexOf('handleSubmit');
    const chunk = wizard.slice(submitBlock, submitBlock + 1000);
    expect(chunk).toContain('sizeUnit');
    expect(chunk).toContain("form.landSizeUnit || 'ACRE'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 4 — Country Dropdown
// ═══════════════════════════════════════════════════════════

describe('Country selection — full dropdown', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');
  const countrySelect = readFile('src/components/CountrySelect.jsx');

  it('CountrySelect is searchable', () => {
    expect(countrySelect).toContain('Search country...');
    expect(countrySelect).toContain('search.trim().toLowerCase()');
  });

  it('CountrySelect has tap-to-choose placeholder in dropdown', () => {
    expect(countrySelect).toContain('Tap to choose country');
  });

  it('CountrySelect dropdown has 48px minHeight for mobile', () => {
    expect(countrySelect).toContain("minHeight: '48px'");
  });

  it('CountrySelect has data-testid on dropdown', () => {
    expect(countrySelect).toContain('country-select-dropdown');
  });

  it('wizard country step has auto-detect badge', () => {
    expect(wizard).toContain('country-auto-detected');
    expect(wizard).toContain("t('wizard.autoDetected')");
  });

  it('wizard auto-detects country from timezone', () => {
    expect(wizard).toContain("Intl.DateTimeFormat().resolvedOptions().timeZone");
    expect(wizard).toContain("'KE'");
    expect(wizard).toContain("'TZ'");
    expect(wizard).toContain("'UG'");
    expect(wizard).toContain("'NG'");
  });

  it('selected country highlights in green', () => {
    const countryStep = wizard.indexOf("currentStep === 'country'");
    const chunk = wizard.slice(countryStep, countryStep + 1200);
    expect(chunk).toContain("color: form.countryCode ? '#22C55E' : '#A1A1AA'");
  });

  it('country step shows search hint when no selection', () => {
    const countryStep = wizard.indexOf("currentStep === 'country'");
    const chunk = wizard.slice(countryStep, countryStep + 1800);
    expect(chunk).toContain("t('wizard.typeToSearch')");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 5 — Mobile UX
// ═══════════════════════════════════════════════════════════

describe('Tap-first mobile UX', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('primary buttons have 52px minHeight', () => {
    const idx = wizard.indexOf('primaryBtn:');
    const chunk = wizard.slice(idx, idx + 300);
    expect(chunk).toContain("minHeight: '52px'");
  });

  it('secondary buttons have 52px minHeight', () => {
    const idx = wizard.indexOf('secondaryBtn:');
    const chunk = wizard.slice(idx, idx + 300);
    expect(chunk).toContain("minHeight: '52px'");
  });

  it('farm size cards have 90px minHeight for large tap targets', () => {
    const idx = wizard.indexOf('farmSizeCard:');
    const chunk = wizard.slice(idx, idx + 300);
    expect(chunk).toContain("minHeight: '90px'");
  });

  it('top crop buttons have 72px minHeight', () => {
    const idx = wizard.indexOf('topCropBtn:');
    const chunk = wizard.slice(idx, idx + 300);
    expect(chunk).toContain("minHeight: '72px'");
  });

  it('all interactive buttons suppress tap highlight', () => {
    const matches = (wizard.match(/WebkitTapHighlightColor: 'transparent'/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(4);
  });

  it('input fields have 48px minHeight', () => {
    const inputIdx = wizard.indexOf("input: {", wizard.indexOf('// Fields'));
    const chunk = wizard.slice(inputIdx, inputIdx + 300);
    expect(chunk).toContain("minHeight: '48px'");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 6 — No regression in auth/flow
// ═══════════════════════════════════════════════════════════

describe('No regression — wizard flow integrity', () => {
  const wizard = readFile('src/components/OnboardingWizard.jsx');

  it('has all 10 step keys in order', () => {
    expect(wizard).toContain("['welcome', 'farmName', 'country', 'crop', 'farmSize', 'gender', 'age', 'location', 'photo', 'processing']");
  });

  it('has draft persistence via useDraft', () => {
    expect(wizard).toContain('useDraft');
    expect(wizard).toContain("'onboarding-wizard'");
  });

  it('has submit guard to prevent double-submit', () => {
    expect(wizard).toContain('submitGuardRef');
    expect(wizard).toContain('if (submitGuardRef.current) return');
  });

  it('logs onboarding events', () => {
    expect(wizard).toContain('logOnboarding');
    expect(wizard).toContain('trackPilotEvent');
  });

  it('handles photo compression', () => {
    expect(wizard).toContain('compressImage');
    expect(wizard).toContain('handlePhotoSelect');
  });

  it('farmStore createProfile has offline fallback', () => {
    const store = readFile('src/store/farmStore.js');
    expect(store).toContain('queueIfOffline');
    expect(store).toContain('_offline: true');
  });

  it('farmStore createProfile has duplicate-submit guard', () => {
    const store = readFile('src/store/farmStore.js');
    expect(store).toContain('_createInFlight');
    expect(store).toContain('if (get()._createInFlight) return null');
  });
});
