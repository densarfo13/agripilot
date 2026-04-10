import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// Tap-First, Low-Literacy-Friendly UI — Test Coverage
// Validates: TapSelector, OnboardingWizard redesign (1-question-
// per-screen, gender/age/country/crop/farmSize tap steps,
// progress bar, processing with timeout), FarmerProgressTab
// upgrades, CountrySelect mobile UX, touch targets.
// ═══════════════════════════════════════════════════════════════

// ─── TapSelector Component ─────────────────────────────────────

describe('TapSelector component', () => {
  const src = readFile('src/components/TapSelector.jsx');

  it('exports a default TapSelector component', () => {
    expect(src).toContain('export default function TapSelector');
  });

  it('renders pill buttons with minHeight 44px', () => {
    expect(src).toContain("minHeight: '44px'");
  });

  it('supports options with icon, label, value, and color', () => {
    expect(src).toContain('opt.icon');
    expect(src).toContain('opt.label');
    expect(src).toContain('opt.value');
    expect(src).toContain('opt.color');
  });

  it('uses aria-pressed for accessibility', () => {
    expect(src).toContain('aria-pressed={isSelected}');
  });

  it('uses aria-label for screen readers', () => {
    expect(src).toContain('aria-label={opt.label}');
  });

  it('shows check mark on selected option', () => {
    expect(src).toMatch(/isSelected.*check/s);
  });

  it('supports grid columns configuration', () => {
    expect(src).toContain('gridTemplateColumns');
    expect(src).toContain('columns');
  });

  it('supports compact mode for smaller pills', () => {
    expect(src).toContain('compact');
    expect(src).toContain('pillCompact');
  });

  it('disables WebkitTapHighlightColor for clean mobile taps', () => {
    expect(src).toContain('WebkitTapHighlightColor');
  });

  it('includes hidden input for form validation when required', () => {
    expect(src).toContain('required');
    expect(src).toContain("type=\"text\"");
    expect(src).toContain('pointerEvents');
  });

  it('supports disabled state', () => {
    expect(src).toContain('disabled');
    expect(src).toContain('opacity: disabled');
  });
});

// ─── OnboardingWizard — 1-Question-Per-Screen Flow ─────────────

describe('OnboardingWizard flow structure', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has 10 step keys for the full flow', () => {
    expect(src).toContain("const STEP_KEYS = ['welcome', 'farmName', 'country', 'crop', 'farmSize', 'gender', 'age', 'location', 'photo', 'processing']");
  });

  it('tracks 8 interactive user steps', () => {
    expect(src).toContain('const TOTAL_USER_STEPS = 8');
  });

  it('imports TapSelector, CountrySelect, CropSelect, LocationDetect', () => {
    expect(src).toContain("import TapSelector from './TapSelector.jsx'");
    expect(src).toContain("import CountrySelect from './CountrySelect.jsx'");
    expect(src).toContain("import CropSelect from './CropSelect.jsx'");
    expect(src).toContain("import LocationDetect from './LocationDetect.jsx'");
  });

  it('imports cropRecommendations for country-specific top crops', () => {
    expect(src).toContain("import { getCountryRecommendedCodes }");
  });
});

// ─── OnboardingWizard — Welcome Screen ─────────────────────────

describe('OnboardingWizard welcome screen', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('shows welcome greeting with user name', () => {
    expect(src).toContain('Welcome');
    expect(src).toContain('userName');
  });

  it('shows time estimate badge', () => {
    expect(src).toContain('Takes about 60 seconds');
    expect(src).toContain('timeEstimate');
  });

  it('has Get Started button', () => {
    expect(src).toContain('Get Started');
  });
});

// ─── OnboardingWizard — Farm Name Step ─────────────────────────

describe('OnboardingWizard farm name step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated farmName step', () => {
    expect(src).toContain("currentStep === 'farmName'");
  });

  it('shows a single centered text input', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'farmName'"),
      src.indexOf("currentStep === 'country'")
    );
    expect(stepBlock).toContain('farmName');
    expect(stepBlock).toContain('Sunrise Farm');
    expect(stepBlock).toContain("textAlign: 'center'");
  });

  it('validates farm name is required before proceeding', () => {
    expect(src).toContain("Give your farm a name");
  });
});

// ─── OnboardingWizard — Country Step ───────────────────────────

describe('OnboardingWizard country step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated country step', () => {
    expect(src).toContain("currentStep === 'country'");
  });

  it('uses CountrySelect component', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'country'"),
      src.indexOf("currentStep === 'crop'")
    );
    expect(stepBlock).toContain('<CountrySelect');
  });

  it('auto-detects country via timezone', () => {
    expect(src).toContain('Intl.DateTimeFormat');
    expect(src).toContain('resolvedOptions().timeZone');
    expect(src).toContain("'nairobi'");
    expect(src).toContain("'dar_es_salaam'");
  });

  it('shows auto-detected badge when country is set', () => {
    expect(src).toContain('Auto-detected');
    expect(src).toContain('autoDetectBadge');
  });

  it('allows skip if no country selected', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'country'"),
      src.indexOf("currentStep === 'crop'")
    );
    expect(stepBlock).toContain("'Skip'");
  });
});

// ─── OnboardingWizard — Crop Step ──────────────────────────────

describe('OnboardingWizard crop step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated crop step', () => {
    expect(src).toContain("currentStep === 'crop'");
  });

  it('shows top crop quick-tap buttons', () => {
    expect(src).toContain('topCropButtons');
    expect(src).toContain('topCropGrid');
    expect(src).toContain('topCropBtn');
  });

  it('has 6 default top crops with icons', () => {
    const block = src.substring(
      src.indexOf('const TOP_CROPS'),
      src.indexOf('];', src.indexOf('const TOP_CROPS')) + 2
    );
    expect(block).toContain("code: 'MAIZE'");
    expect(block).toContain("code: 'RICE'");
    expect(block).toContain("code: 'BEAN'");
    expect(block).toContain("code: 'COFFEE'");
    expect(block).toContain("code: 'CASSAVA'");
    expect(block).toContain("code: 'BANANA'");
    expect(block).toContain('icon:');
  });

  it('adapts top crops to country using getCountryRecommendedCodes', () => {
    expect(src).toContain('getCountryRecommendedCodes(form.countryCode)');
    expect(src).toContain('countryTopCodes');
  });

  it('has "Search all" button and "Other" quick-tap to open CropSelect', () => {
    expect(src).toContain('Search all 60+ crops');
    expect(src).toContain('crop-search-all');
    expect(src).toContain('crop-other-tap');
    expect(src).toContain('showCropSearch');
  });

  it('shows full CropSelect when search is opened', () => {
    expect(src).toContain('<CropSelect');
    expect(src).toContain('showCropSearch');
  });

  it('shows stage TapSelector only when crop is selected', () => {
    expect(src).toContain('{form.crop && (');
    expect(src).toContain("label=\"Current stage\"");
    expect(src).toContain('options={STAGE_OPTIONS}');
  });
});

// ─── OnboardingWizard — Farm Size Step ─────────────────────────

describe('OnboardingWizard farm size step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated farmSize step', () => {
    expect(src).toContain("currentStep === 'farmSize'");
  });

  it('has 3 tap-friendly size categories with unit-aware subtitles', () => {
    expect(src).toContain('FARM_SIZE_DEFS');
    expect(src).toContain('FARM_SIZE_KEYS');
    expect(src).toContain("small:");
    expect(src).toContain("medium:");
    expect(src).toContain("large:");
    expect(src).toContain('Under 2 acres');
    expect(src).toContain('Under 1 hectare');
  });

  it('renders size categories as large tap cards', () => {
    expect(src).toContain('farmSizeGrid');
    expect(src).toContain('farmSizeCard');
    expect(src).toContain("minHeight: '90px'");
  });

  it('has visible exact-size input with unit label', () => {
    expect(src).toContain('Or enter exact size:');
    expect(src).toContain('exact-size-input');
    expect(src).toContain('inputMode="decimal"');
  });

  it('has visible unit selector with Acres and Hectares', () => {
    expect(src).toContain('land-unit-selector');
    expect(src).toContain('UNIT_OPTIONS');
    expect(src).toContain('TapSelector');
  });

  it('derives numeric size from category for submission (unit-aware)', () => {
    expect(src).toContain('FARM_SIZE_DEFS[form.farmSizeCategory]');
    expect(src).toContain('defaultVal');
    expect(src).toContain('computeLandSizeFields');
    expect(src).toContain('landSizeHectares');
  });
});

// ─── OnboardingWizard — Gender Step ────────────────────────────

describe('OnboardingWizard gender step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated gender step', () => {
    expect(src).toContain("currentStep === 'gender'");
  });

  it('has 4 gender tap options with icons', () => {
    expect(src).toContain('GENDER_OPTIONS');
    expect(src).toContain("value: 'male'");
    expect(src).toContain("value: 'female'");
    expect(src).toContain("value: 'other'");
    expect(src).toContain("value: 'prefer_not_to_say'");
  });

  it('uses TapSelector for gender selection', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'gender'"),
      src.indexOf("currentStep === 'age'")
    );
    expect(stepBlock).toContain('<TapSelector');
    expect(stepBlock).toContain('options={GENDER_OPTIONS}');
  });

  it('allows skip if no gender selected', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'gender'"),
      src.indexOf("currentStep === 'age'")
    );
    expect(stepBlock).toContain("'Skip'");
  });
});

// ─── OnboardingWizard — Age Group Step ─────────────────────────

describe('OnboardingWizard age group step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated age step', () => {
    expect(src).toContain("currentStep === 'age'");
  });

  it('has 4 age range tap options', () => {
    expect(src).toContain('AGE_OPTIONS');
    expect(src).toContain("value: 'under_25'");
    expect(src).toContain("value: '25_35'");
    expect(src).toContain("value: '36_50'");
    expect(src).toContain("value: 'over_50'");
  });

  it('uses TapSelector for age group selection', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'age'"),
      src.indexOf("currentStep === 'location'")
    );
    expect(stepBlock).toContain('<TapSelector');
    expect(stepBlock).toContain('options={AGE_OPTIONS}');
  });
});

// ─── OnboardingWizard — Location Step ──────────────────────────

describe('OnboardingWizard location step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated location step', () => {
    expect(src).toContain("currentStep === 'location'");
  });

  it('uses LocationDetect for auto-detection', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'location'"),
      src.indexOf("currentStep === 'photo'")
    );
    expect(stepBlock).toContain('<LocationDetect');
    expect(stepBlock).toContain('Detect my location');
  });

  it('shows GPS confirmation after detection', () => {
    expect(src).toContain('gpsConfirm');
  });

  it('has fallback text input for manual entry', () => {
    const stepBlock = src.substring(
      src.indexOf("currentStep === 'location'"),
      src.indexOf("currentStep === 'photo'")
    );
    expect(stepBlock).toContain('Or type');
    expect(stepBlock).toContain('Nakuru, Kenya');
  });
});

// ─── OnboardingWizard — Photo Step ─────────────────────────────

describe('OnboardingWizard photo step', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has a dedicated photo step', () => {
    expect(src).toContain("currentStep === 'photo'");
  });

  it('supports camera capture on mobile', () => {
    expect(src).toContain('capture="user"');
  });

  it('shows photo preview when selected', () => {
    expect(src).toContain('photoPreview');
    expect(src).toContain('photoPlaceholder');
  });

  it('allows skip without photo', () => {
    expect(src).toContain("Skip & Create Farm");
  });
});

// ─── OnboardingWizard — Progress Indicator ─────────────────────

describe('OnboardingWizard progress indicator', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('shows progress bar (not just dots)', () => {
    expect(src).toContain('progressBar');
    expect(src).toContain('progressFill');
    expect(src).toContain('progressPercent');
  });

  it('shows step count text', () => {
    expect(src).toContain('Step {progressNum} of {TOTAL_USER_STEPS}');
  });

  it('calculates percent from step count', () => {
    expect(src).toContain('Math.round((progressNum / TOTAL_USER_STEPS) * 100)');
  });

  it('hides progress on welcome and processing steps', () => {
    expect(src).toContain("step > 0 && step < STEP_KEYS.indexOf('processing')");
  });
});

// ─── OnboardingWizard — Processing + Success ───────────────────

describe('OnboardingWizard processing and success', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('has ProcessingStep component with step-based progress', () => {
    expect(src).toContain('function ProcessingStep');
    expect(src).toContain('PROCESSING_STEPS');
  });

  it('processing steps show meaningful labels', () => {
    expect(src).toContain('Creating your farm profile');
    expect(src).toContain('Setting up crop tracking');
    expect(src).toContain('Preparing recommendations');
  });

  it('has 30-second timeout fallback', () => {
    expect(src).toContain('PROCESSING_TIMEOUT_MS');
    expect(src).toContain('30000');
    expect(src).toContain('timedOut');
  });

  it('timeout state shows retry option', () => {
    expect(src).toContain('Taking longer than expected');
    expect(src).toContain('onRetry');
    expect(src).toContain('onBack');
  });

  it('success screen shows completion time', () => {
    expect(src).toContain('Completed in');
    expect(src).toContain('completionTime');
    expect(src).toContain('startTimeRef');
  });

  it('success screen has continue button', () => {
    expect(src).toContain('Continue to Dashboard');
    expect(src).toContain('Farm created!');
  });
});

// ─── OnboardingWizard — Submission Payload ─────────────────────

describe('OnboardingWizard submission payload', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('sends gender in payload', () => {
    expect(src).toContain('gender: form.gender');
  });

  it('sends ageGroup in payload', () => {
    expect(src).toContain('ageGroup: form.ageGroup');
  });

  it('sends countryCode in payload', () => {
    expect(src).toContain('countryCode: form.countryCode');
  });

  it('sends farmSizeCategory in payload', () => {
    expect(src).toContain('farmSizeCategory: form.farmSizeCategory');
  });

  it('sends elapsed time in tracking event', () => {
    expect(src).toContain("elapsed");
    expect(src).toContain("startTimeRef.current");
  });
});

// ─── OnboardingWizard — Mobile UX ──────────────────────────────

describe('OnboardingWizard mobile UX', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('primary buttons have minHeight 52px for large touch targets', () => {
    const btnStyle = src.substring(
      src.indexOf("primaryBtn: {"),
      src.indexOf('},', src.indexOf("primaryBtn: {")) + 2
    );
    expect(btnStyle).toContain("minHeight: '52px'");
  });

  it('secondary buttons have minHeight 52px', () => {
    const btnStyle = src.substring(
      src.indexOf("secondaryBtn: {"),
      src.indexOf('},', src.indexOf("secondaryBtn: {")) + 2
    );
    expect(btnStyle).toContain("minHeight: '52px'");
  });

  it('inputs have minHeight 48px', () => {
    const inputStyle = src.substring(
      src.indexOf("input: {"),
      src.indexOf('},', src.indexOf("input: {")) + 2
    );
    expect(inputStyle).toContain("minHeight: '48px'");
  });

  it('all interactive buttons disable WebkitTapHighlight', () => {
    const matches = src.match(/WebkitTapHighlightColor/g);
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('modal has max-height with scroll for small screens', () => {
    expect(src).toContain("maxHeight: '90vh'");
    expect(src).toContain("overflowY: 'auto'");
  });

  it('modal is constrained to 94vw width', () => {
    expect(src).toContain("94vw");
  });
});

// ─── OnboardingWizard — Draft Persistence ──────────────────────

describe('OnboardingWizard draft persistence', () => {
  const src = readFile('src/components/OnboardingWizard.jsx');

  it('uses useDraft for form + step persistence', () => {
    expect(src).toContain("useDraft(");
    expect(src).toContain("'onboarding-wizard'");
  });

  it('shows draft restored banner', () => {
    expect(src).toContain('Draft restored');
    expect(src).toContain('draftRestored');
  });

  it('clears draft on successful completion', () => {
    expect(src).toContain('clearDraft()');
  });

  it('has reset/start-over flow', () => {
    expect(src).toContain('handleReset');
    expect(src).toContain('Start over');
    expect(src).toContain('showResetConfirm');
  });

  it('supports browser back button', () => {
    expect(src).toContain('popstate');
    expect(src).toContain('pushState');
  });
});

// ─── FarmerProgressTab — Tap-First Upgrades ────────────────────

describe('FarmerProgressTab tap-first upgrades', () => {
  const src = readFile('src/pages/FarmerProgressTab.jsx');

  it('imports TapSelector component', () => {
    expect(src).toContain("import TapSelector from '../components/TapSelector.jsx'");
  });

  it('has ACTIVITY_OPTIONS with icons for tap selection', () => {
    expect(src).toContain('const ACTIVITY_OPTIONS');
    expect(src).toContain("value: 'planting'");
    expect(src).toContain("value: 'spraying'");
    expect(src).toContain("value: 'fertilizing'");
    expect(src).toContain("value: 'irrigation'");
    expect(src).toContain("value: 'weeding'");
    expect(src).toContain("value: 'harvesting'");
    expect(src).toContain("value: 'storage'");
    expect(src).toContain("value: 'selling'");
    expect(src).toContain("value: 'other'");
  });

  it('uses TapSelector for activity type', () => {
    expect(src).toContain("label=\"Activity Type *\"");
    expect(src).toContain('options={ACTIVITY_OPTIONS}');
  });

  it('uses TapSelector for image stage', () => {
    expect(src).toContain("label=\"Growth Stage\"");
    expect(src).toContain('options={IMAGE_STAGE_OPTIONS}');
  });

  it('uses TapSelector for followed-advice', () => {
    expect(src).toContain("label=\"Followed advice?\"");
    expect(src).toContain('options={ADVICE_OPTIONS}');
  });

  it('stage confirmation pills have minHeight 44px', () => {
    const block = src.substring(
      src.indexOf('Confirm Growth Stage'),
      src.indexOf('</form>', src.indexOf('Confirm Growth Stage'))
    );
    expect(block).toContain("minHeight: '44px'");
  });

  it('condition pills have minHeight 48px', () => {
    const block = src.substring(
      src.indexOf('Update Crop Condition'),
      src.indexOf('</form>', src.indexOf('Update Crop Condition'))
    );
    expect(block).toContain("minHeight: '48px'");
  });
});

// ─── CountrySelect — Mobile UX ────────────────────────────────

describe('CountrySelect mobile UX', () => {
  const src = readFile('src/components/CountrySelect.jsx');

  it('search input has minHeight 44px', () => {
    expect(src).toContain("minHeight: '44px'");
  });

  it('select element has minHeight 44px', () => {
    const selectBlock = src.substring(src.indexOf('<select'), src.indexOf('</select>'));
    expect(selectBlock).toContain("minHeight: '44px'");
  });

  it('search input has proper font size for mobile', () => {
    expect(src).toContain("fontSize: '0.9rem'");
  });
});

// ─── FarmersPage — Touch Targets ──────────────────────────────

describe('FarmersPage touch targets', () => {
  const src = readFile('src/pages/FarmersPage.jsx');

  it('delivery buttons in CreateFarmerModal have minHeight 44px', () => {
    const createModal = src.substring(
      src.indexOf('function CreateFarmerModal'),
      src.indexOf('function InviteFarmerModal')
    );
    const section = createModal.substring(
      createModal.indexOf('Delivery method'),
      createModal.indexOf('Delivery method') + 1200
    );
    expect(section).toContain("minHeight: '44px'");
  });

  it('delivery buttons in InviteFarmerModal have minHeight 44px', () => {
    const inviteModal = src.substring(src.indexOf('function InviteFarmerModal'));
    const section = inviteModal.substring(
      inviteModal.indexOf('Invite delivery'),
      inviteModal.indexOf('Invite delivery') + 1200
    );
    expect(section).toContain("minHeight: '44px'");
  });
});

// ─── Cross-Cutting: Touch Target Compliance ───────────────────

describe('Cross-cutting touch target compliance', () => {
  it('OnboardingWizard buttons exceed 44px minimum', () => {
    const src = readFile('src/components/OnboardingWizard.jsx');
    expect(src).toMatch(/primaryBtn:.*minHeight.*52px/s);
    expect(src).toMatch(/secondaryBtn:.*minHeight.*52px/s);
    expect(src).toMatch(/input:.*minHeight.*48px/s);
  });

  it('TapSelector pills meet 44px minimum', () => {
    const src = readFile('src/components/TapSelector.jsx');
    expect(src).toMatch(/pill:.*minHeight.*44px/s);
  });

  it('CountrySelect elements meet 44px+ minimum', () => {
    const src = readFile('src/components/CountrySelect.jsx');
    const matches = src.match(/minHeight.*4[4-9]px/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('CropSelect elements meet 44px minimum', () => {
    const src = readFile('src/components/CropSelect.jsx');
    const matches = src.match(/minHeight.*44px/g);
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
