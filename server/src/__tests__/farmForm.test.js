/**
 * farmForm.test.js — source-level contract tests for the integrated
 * FarmForm component.
 *
 *   1. Pulls options from centralised configs (no hardcoded lists)
 *   2. Uses areaConversion utilities (no local unit math)
 *   3. Uses the shared lib/api.js helpers (no direct axios)
 *   4. Normalizes legacy crop / stage / unit values on load
 *   5. Emits canonical values on submit (payload preview)
 *   6. Adds plantingDate + manualStageOverride fields
 *   7. Surfaces backend errors via formatApiError (no silent
 *      "Validation failed")
 *   8. Debug preview is gated to import.meta.env.DEV
 *   9. Validation blocks empty + non-positive sizes with explicit
 *      error copy
 *  10. Required fields are all enforced with distinct messages
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const SRC = readFile('src/components/FarmForm.jsx');

// ─── 1. Centralised configs wired in ─────────────────────────────
describe('FarmForm — sources options from centralised configs', () => {
  it('imports CROPS + ALL_CROPS_WITH_OTHER from the canonical catalog', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/utils\/crops\.js['"]/);
    expect(SRC).toMatch(/ALL_CROPS_WITH_OTHER/);
    expect(SRC).toMatch(/getCropLabel/);
  });

  it('imports COUNTRIES + getStatesForCountry from countriesStates.js', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/config\/countriesStates\.js['"]/);
    expect(SRC).toMatch(/COUNTRIES\.map/);
    expect(SRC).toMatch(/getStatesForCountry/);
    expect(SRC).toMatch(/hasStatesForCountry/);
  });

  it('imports stage helpers from cropStages.js and renders stage options', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/utils\/cropStages\.js['"]/);
    // Accept either the legacy STAGES.map OR the Crop Intelligence
    // Layer's per-crop getStagesForCrop(...).map — both satisfy the
    // contract: stage options source from cropStages.js, not hardcoded.
    expect(SRC).toMatch(/(STAGES\.map|getStagesForCrop\([^)]*\)\.map)/);
    expect(SRC).toMatch(/resolveStage/);
  });

  it('imports FARM_TYPES + normalizeFarmType + getFarmTypeLabel', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/config\/onboardingLabels\.js['"]/);
    expect(SRC).toMatch(/FARM_TYPES\.map/);
    expect(SRC).toMatch(/normalizeFarmType/);
    expect(SRC).toMatch(/getFarmTypeLabel/);
  });

  it('no hardcoded CROP_OPTIONS / STATE_OPTIONS_BY_COUNTRY / SMALL_AREA_UNITS arrays', () => {
    expect(SRC).not.toMatch(/const CROP_OPTIONS\s*=/);
    expect(SRC).not.toMatch(/const STATE_OPTIONS_BY_COUNTRY\s*=/);
    expect(SRC).not.toMatch(/const SMALL_AREA_UNITS\s*=\s*\[/);
    expect(SRC).not.toMatch(/const LAND_AREA_UNITS\s*=\s*\[/);
    expect(SRC).not.toMatch(/const FARM_TYPE_OPTIONS\s*=\s*\[/);
  });
});

// ─── 2. Area conversion delegation ───────────────────────────────
describe('FarmForm — uses areaConversion utilities', () => {
  it('imports conversion helpers from lib/units/areaConversion.js', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/lib\/units\/areaConversion\.js['"]/);
    for (const fn of ['toSquareMeters', 'fromSquareMeters',
                       'normalizeUnit', 'getDefaultUnit',
                       'getAllowedUnits', 'getAreaUnitLabel']) {
      expect(SRC).toMatch(new RegExp(fn));
    }
  });

  it('does NOT define local unit conversion math', () => {
    // Look for the telltale floats of the old inline conversion.
    expect(SRC).not.toMatch(/0\.092903/);
    expect(SRC).not.toMatch(/4046\.8564224/);
  });
});

// ─── 3. API wiring ──────────────────────────────────────────────
describe('FarmForm — uses shared API helpers', () => {
  it('imports createNewFarm + updateFarm from src/lib/api.js', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/lib\/api\.js['"]/);
    expect(SRC).toMatch(/createNewFarm/);
    expect(SRC).toMatch(/updateFarm/);
  });

  it('does NOT import axios directly', () => {
    expect(SRC).not.toMatch(/from ['"]axios['"]/);
    expect(SRC).not.toMatch(/import axios/);
  });

  it('does NOT call the legacy /api/v1 endpoint', () => {
    expect(SRC).not.toMatch(/\/api\/v1\/farms/);
  });

  it('uses formatApiError to surface backend error messages', () => {
    expect(SRC).toMatch(/formatApiError/);
    expect(SRC).toMatch(/from ['"]\.\.\/api\/client\.js['"]/);
  });
});

// ─── 4. Legacy value normalisation on load ──────────────────────
describe('FarmForm — normalises legacy values on buildInitialForm', () => {
  it('uses parseCropValue + normalizeCropCode for crop inputs', () => {
    expect(SRC).toMatch(/parseCropValue/);
    expect(SRC).toMatch(/normalizeCropCode/);
  });

  it('uses resolveStage for stage inputs', () => {
    expect(SRC).toMatch(/resolveStage\(initialData/);
  });

  it('uses normalizeUnit for unit inputs', () => {
    expect(SRC).toMatch(/normalizeUnit\(initialData\.sizeUnit\)/);
  });

  it('uses normalizeFarmType for farmType inputs', () => {
    expect(SRC).toMatch(/normalizeFarmType\(initialData\.farmType\)/);
  });

  it('also consults the i18n crop alias map (catches localised names)', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/utils\/localization\.js['"]/);
    expect(SRC).toMatch(/normalizeI18nCropKey/);
  });
});

// ─── 5. Canonical values on submit ──────────────────────────────
describe('FarmForm — buildPayload emits canonical values only', () => {
  it('lowercases canonical crop codes and uses buildOtherCropValue for OTHER', () => {
    expect(SRC).toMatch(/normalizeCropCode\(form\.crop\) \|\| ''\)\.toLowerCase\(\)/);
    expect(SRC).toMatch(/buildOtherCropValue\(form\.otherCropName\)/);
  });

  it('normalises sizeUnit + cropStage + farmType on submit', () => {
    expect(SRC).toMatch(/normalizeUnit\(form\.sizeUnit\)/);
    expect(SRC).toMatch(/resolveStage\(form\.cropStage\)/);
    expect(SRC).toMatch(/normalizeFarmType\(form\.farmType\)/);
  });

  it('always includes normalizedAreaSqm in the payload', () => {
    expect(SRC).toMatch(/normalizedAreaSqm:\s*toSquareMeters/);
  });
});

// ─── 6. plantingDate + manualStageOverride ──────────────────────
describe('FarmForm — new timeline fields', () => {
  it('renders a <input type="date"> for plantingDate', () => {
    expect(SRC).toMatch(/type="date"[\s\S]*data-testid="farm-planting-date"/);
  });

  it('renders a checkbox for manualStageOverride', () => {
    expect(SRC).toMatch(/data-testid="farm-manual-override"/);
    expect(SRC).toMatch(/checked=\{form\.manualStageOverride\}/);
  });

  it('serialises manualStageOverride as the resolved stage, not the boolean', () => {
    expect(SRC).toMatch(/manualStageOverride:\s*form\.manualStageOverride\s*\?\s*stageCanon/);
  });

  it('rejects future plantingDate via inline validation', () => {
    expect(SRC).toMatch(/plantingDateFuture/);
    expect(SRC).toMatch(/cannot be in the future/);
  });
});

// ─── 7. Backend error propagation ──────────────────────────────
describe('FarmForm — backend error messages reach the UI', () => {
  it('submitError is populated by formatApiError', () => {
    expect(SRC).toMatch(/setSubmitError\(formatApiError\(error/);
  });

  it('never shows a bare "Validation failed" without context', () => {
    expect(SRC).not.toMatch(/'Validation failed'/);
    // The fallback message explicitly asks the user to check inputs
    // and mentions saving — proves we're not silent on errors.
    expect(SRC).toMatch(/Unable to save the farm right now/);
  });
});

// ─── 8. Debug preview gated to dev ─────────────────────────────
describe('FarmForm — debug preview is dev-only', () => {
  it('renders the JSON preview only when import.meta.env.DEV', () => {
    expect(SRC).toMatch(/\{isDev && \(/);
    expect(SRC).toMatch(/import\.meta\.env[\s\S]*DEV/);
    expect(SRC).toMatch(/data-testid="farm-form-debug"/);
  });
});

// ─── 9, 10. Validation coverage ────────────────────────────────
describe('FarmForm — validation rules', () => {
  it('flags empty farm size AND non-positive numbers distinctly', () => {
    expect(SRC).toMatch(/Farm size is required/);
    expect(SRC).toMatch(/must be a number greater than 0/);
  });

  it('every required field has its own error message key', () => {
    const requiredCopy = [
      'Farm name is required',
      'Main crop is required',
      'Country is required',
      'State is required',
      'Farm type is required',
      'Size unit is required',
      'Crop stage is required',
    ];
    for (const expected of requiredCopy) {
      expect(SRC, `expected error copy "${expected}"`).toMatch(expected);
    }
  });

  it('surfaces "fix the highlighted fields" when validate() fails', () => {
    expect(SRC).toMatch(/fixHighlighted/);
    expect(SRC).toMatch(/fix the highlighted fields/);
  });
});

// ─── i18n hooks ─────────────────────────────────────────────────
describe('FarmForm — localisation', () => {
  it('uses useTranslation for every label with a safe English fallback', () => {
    expect(SRC).toMatch(/from ['"]\.\.\/i18n\/index\.js['"]/);
    expect(SRC).toMatch(/useTranslation/);
    // Spot-check the pattern: `t('foo.bar') || 'English fallback'`
    expect(SRC).toMatch(/t\('farm\.fields\.name'\) \|\| 'Farm Name'/);
    expect(SRC).toMatch(/t\('common\.cancel'\) \|\| 'Cancel'/);
  });
});
