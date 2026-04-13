/**
 * Crop "Other" Input — source-code enforcement tests.
 *
 * Verifies that:
 * 1. CropSelect shows "Other (type your crop)" option with custom input
 * 2. ProfileSetup (V2) uses CropSelect instead of hardcoded select
 * 3. Backend returns structured cropCategory/cropName fields
 * 4. Backend validates "Other" requires a crop name
 * 5. Frontend crop utilities handle OTHER:CustomName correctly
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..', '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
//  CropSelect — "Other (type your crop)" option
// ═══════════════════════════════════════════════════════════

describe('CropSelect — Other option with custom input', () => {
  const src = read('src/components/CropSelect.jsx');

  it('shows "Other (type your crop)" in dropdown', () => {
    expect(src).toContain('Other (type your crop)');
  });

  it('has custom input field when Other is selected', () => {
    expect(src).toContain('placeholder="Enter your crop"');
  });

  it('auto-focuses custom input', () => {
    expect(src).toContain('autoFocus');
  });

  it('builds OTHER:value via buildOtherCropValue', () => {
    expect(src).toContain('buildOtherCropValue');
  });

  it('supports required validation on custom input', () => {
    expect(src).toContain('required={required}');
  });

  it('allows clearing Other selection to pick a different crop', () => {
    // Clicking the "Other ×" tag should clear and reopen dropdown
    expect(src).toContain("onChange('')");
    expect(src).toContain('setOpen(true)');
  });
});

// ═══════════════════════════════════════════════════════════
//  ProfileSetup (V2) — uses CropSelect, not hardcoded select
// ═══════════════════════════════════════════════════════════

describe('ProfileSetup (V2) — uses CropSelect', () => {
  const src = read('src/pages/ProfileSetup.jsx');

  it('imports CropSelect component', () => {
    expect(src).toContain("import CropSelect from '../components/CropSelect.jsx'");
  });

  it('does NOT have hardcoded CROP_OPTIONS array', () => {
    expect(src).not.toContain("CROP_OPTIONS = ['maize'");
    expect(src).not.toContain("CROP_OPTIONS = [\"maize\"");
  });

  it('renders CropSelect component', () => {
    expect(src).toContain('<CropSelect');
  });

  it('does NOT use plain <select> for crop', () => {
    // Should not have the old <select> with CROP_OPTIONS.map
    expect(src).not.toContain('CROP_OPTIONS.map');
  });

  it('passes countryCode to CropSelect for recommendations', () => {
    expect(src).toContain('countryCode={form.country}');
  });

  it('still stores cropType in form state', () => {
    expect(src).toContain("updateField('cropType'");
  });
});

// ═══════════════════════════════════════════════════════════
//  ProfileSetupPage (V1) — already uses CropSelect
// ═══════════════════════════════════════════════════════════

describe('ProfileSetupPage (V1) — uses CropSelect', () => {
  const src = read('src/pages/ProfileSetupPage.jsx');

  it('imports CropSelect', () => {
    expect(src).toContain('CropSelect');
  });

  it('renders CropSelect component', () => {
    expect(src).toContain('<CropSelect');
  });
});

// ═══════════════════════════════════════════════════════════
//  FarmerRegisterPage — uses CropSelect
// ═══════════════════════════════════════════════════════════

describe('FarmerRegisterPage — uses CropSelect', () => {
  const src = read('src/pages/FarmerRegisterPage.jsx');

  it('imports CropSelect', () => {
    expect(src).toContain('CropSelect');
  });

  it('renders CropSelect component', () => {
    expect(src).toContain('<CropSelect');
  });

  it('passes countryCode for recommendations', () => {
    expect(src).toContain('countryCode={form.countryCode}');
  });
});

// ═══════════════════════════════════════════════════════════
//  Backend — structured crop response
// ═══════════════════════════════════════════════════════════

describe('Backend farmProfile — structured crop fields', () => {
  const src = read('server/routes/farmProfile.js');

  it('has parseCrop helper function', () => {
    expect(src).toContain('function parseCrop(stored)');
  });

  it('parseCrop returns cropCategory for standard crops', () => {
    expect(src).toContain("cropCategory: 'standard'");
  });

  it('parseCrop returns cropCategory for other crops', () => {
    expect(src).toContain("cropCategory: 'other'");
  });

  it('mapProfile includes cropCategory in response', () => {
    expect(src).toContain('cropCategory: crop.cropCategory');
  });

  it('mapProfile includes cropName in response', () => {
    expect(src).toContain('cropName: crop.cropName');
  });

  it('still includes cropType for backward compat', () => {
    expect(src).toContain('cropType: profile.crop');
  });
});

// ═══════════════════════════════════════════════════════════
//  Backend validation — "Other" requires crop name
// ═══════════════════════════════════════════════════════════

describe('Backend validation — Other crop requires name', () => {
  const src = read('server/lib/validation.js');

  it('rejects bare "OTHER" without a crop name', () => {
    expect(src).toContain("'OTHER'");
    expect(src).toContain('Please enter your crop name');
  });

  it('rejects OTHER:X with name < 2 characters', () => {
    expect(src).toContain("'OTHER:'");
    expect(src).toContain('at least 2 characters');
  });

  it('still requires cropType field', () => {
    expect(src).toContain('Crop type is required');
  });
});

// ═══════════════════════════════════════════════════════════
//  Frontend utils — OTHER parsing and validation
// ═══════════════════════════════════════════════════════════

describe('Frontend crop utilities — Other handling', () => {
  const src = read('src/utils/crops.js');

  it('OTHER_CROP constant has code OTHER', () => {
    expect(src).toContain("code: 'OTHER'");
  });

  it('parseCropValue handles OTHER:CustomName', () => {
    expect(src).toContain('OTHER:');
    expect(src).toContain('customCropName');
    expect(src).toContain('isCustomCrop: true');
  });

  it('buildOtherCropValue creates structured value', () => {
    expect(src).toContain('function buildOtherCropValue');
    expect(src).toContain('`OTHER:${trimmed}`');
  });

  it('isValidCrop requires custom name >= 2 chars', () => {
    expect(src).toContain('.slice(6).trim().length >= 2');
  });

  it('getCropLabel extracts custom name from OTHER:Name', () => {
    expect(src).toContain("value.slice(6).trim() || 'Other'");
  });
});
