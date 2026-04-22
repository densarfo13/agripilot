/**
 * onboardingV3.test.js — covers the testable parts of the clean
 * three-step onboarding spec:
 *   1. normalizers resolve every canonical code AND legacy label
 *   2. getXxxLabel returns the correct translation per language
 *   3. translated output NEVER leaks back into storage
 *   4. farmType / sizeUnit / cropStage / crop normalisers are
 *      idempotent (normalize(normalize(x)) === normalize(x))
 *   5. isNewFarmer / isOnboardingComplete read the canonical slot
 *
 * DOM / JSX rendering is covered by manual test steps (documented
 * in the commit for 0c3fac6). These tests lock the pure contract
 * so a regression in the helpers trips red in CI.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

function installWindow() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/', search: '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear:      () => map.clear(),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
  };
}

import {
  FARM_TYPES, SIZE_UNITS, CROP_STAGES,
  normalizeFarmType, normalizeSizeUnit, normalizeCropStage,
  getFarmTypeLabel, getUnitLabel, getCropStageLabel,
  isNewFarmer, isOnboardingComplete, getOnboardingStatus,
  _internal,
} from '../../../src/config/onboardingLabels.js';

import {
  normalizeCrop, getCropLabel, CROP_OTHER,
} from '../../../src/config/crops.js';
import { _internal as cropsInternal } from '../../../src/config/crops.js';

beforeEach(() => { installWindow(); });
afterEach(()  => { delete globalThis.window; });

// ─── 1. Normalizers canonical + legacy + mixed case ─────────────
describe('normalizeFarmType', () => {
  it('returns every canonical code unchanged', () => {
    for (const code of FARM_TYPES) expect(normalizeFarmType(code)).toBe(code);
  });

  it('maps legacy + alias shortforms to the canonical code', () => {
    expect(normalizeFarmType('small')).toBe('small_farm');
    expect(normalizeFarmType('small_farm')).toBe('small_farm');
    expect(normalizeFarmType('sell_locally')).toBe('small_farm');
    expect(normalizeFarmType('backyard_home')).toBe('backyard');
    expect(normalizeFarmType('home')).toBe('backyard');
    expect(normalizeFarmType('home_food')).toBe('backyard');
    expect(normalizeFarmType('commercial_farm')).toBe('commercial');
    expect(normalizeFarmType('large')).toBe('commercial');
    expect(normalizeFarmType('enterprise')).toBe('commercial');
  });

  it('reverse-maps from an English label stored on legacy records', () => {
    expect(normalizeFarmType('Small farm')).toBe('small_farm');
    expect(normalizeFarmType('Small Farm')).toBe('small_farm');
    expect(normalizeFarmType('Backyard / Home')).toBe('backyard');
    expect(normalizeFarmType('Commercial farm')).toBe('commercial');
  });

  it('reverse-maps from a translated label (Hindi / Swahili) too', () => {
    const hiSmall = _internal.FARM_TYPE_LABELS_BY_LANG.hi.small_farm;
    const swCommercial = _internal.FARM_TYPE_LABELS_BY_LANG.sw.commercial;
    expect(normalizeFarmType(hiSmall)).toBe('small_farm');
    expect(normalizeFarmType(swCommercial)).toBe('commercial');
  });

  it('falls back to small_farm when the value is null / unknown', () => {
    expect(normalizeFarmType(null)).toBe('small_farm');
    expect(normalizeFarmType(undefined)).toBe('small_farm');
    expect(normalizeFarmType('')).toBe('small_farm');
    expect(normalizeFarmType('martian_farm')).toBe('small_farm');
  });

  it('is idempotent — normalize(normalize(x)) === normalize(x)', () => {
    for (const v of ['small', 'Small Farm', 'commercial', 'garbage']) {
      expect(normalizeFarmType(normalizeFarmType(v))).toBe(normalizeFarmType(v));
    }
  });
});

describe('normalizeSizeUnit', () => {
  it('returns canonical uppercase codes', () => {
    expect(normalizeSizeUnit('ACRE')).toBe('ACRE');
    expect(normalizeSizeUnit('HECTARE')).toBe('HECTARE');
  });

  it('accepts lowercase / plural / shorthand', () => {
    expect(normalizeSizeUnit('acre')).toBe('ACRE');
    expect(normalizeSizeUnit('acres')).toBe('ACRE');
    expect(normalizeSizeUnit('ac')).toBe('ACRE');
    expect(normalizeSizeUnit('hectare')).toBe('HECTARE');
    expect(normalizeSizeUnit('hectares')).toBe('HECTARE');
    expect(normalizeSizeUnit('ha')).toBe('HECTARE');
  });

  it('accepts Swahili drift ("Ekari") and reverse-maps', () => {
    expect(normalizeSizeUnit('Ekari')).toBe('ACRE');
    expect(normalizeSizeUnit('ekari')).toBe('ACRE');
    expect(normalizeSizeUnit('Hekta')).toBe('HECTARE');
  });

  it('falls back to ACRE on garbage input', () => {
    expect(normalizeSizeUnit(null)).toBe('ACRE');
    expect(normalizeSizeUnit('banana')).toBe('ACRE');
  });
});

describe('normalizeCropStage', () => {
  it('returns every canonical code unchanged', () => {
    for (const s of CROP_STAGES) expect(normalizeCropStage(s)).toBe(s);
  });

  it('accepts hyphen + whitespace + shortform aliases', () => {
    expect(normalizeCropStage('land-prep')).toBe('land_preparation');
    expect(normalizeCropStage('Land Preparation')).toBe('land_preparation');
    expect(normalizeCropStage('harvesting')).toBe('harvest');
    expect(normalizeCropStage('bloom')).toBe('flowering');
    expect(normalizeCropStage('growing')).toBe('vegetative');
    expect(normalizeCropStage('postharvest')).toBe('post_harvest');
    expect(normalizeCropStage('post-harvest')).toBe('post_harvest');
  });

  it('reverse-maps from any language label', () => {
    const hiHarvest = _internal.CROP_STAGE_LABELS_BY_LANG.hi.harvest;
    expect(normalizeCropStage(hiHarvest)).toBe('harvest');
  });

  it('falls back to planning on garbage', () => {
    expect(normalizeCropStage(null)).toBe('planning');
    expect(normalizeCropStage('blooming_wildly')).toBe('planning');
  });
});

describe('normalizeCrop (from src/config/crops.js)', () => {
  it('returns canonical lowercase codes unchanged', () => {
    expect(normalizeCrop('cassava')).toBe('cassava');
    expect(normalizeCrop('sweet_potato')).toBe('sweet_potato');
  });

  it('reverse-maps English labels to codes', () => {
    expect(normalizeCrop('Cassava')).toBe('cassava');
    expect(normalizeCrop('Maize (corn)')).toBe('maize');
  });

  it('is idempotent', () => {
    for (const v of ['Cassava', 'cassava', 'Maize', 'Groundnut / peanut']) {
      expect(normalizeCrop(normalizeCrop(v))).toBe(normalizeCrop(v));
    }
  });

  it('accepts the Hindi label for cassava', () => {
    const hi = cropsInternal.CROP_LABELS_BY_LANG.hi.cassava;
    expect(normalizeCrop(hi)).toBe('cassava');
  });
});

// ─── 2. getXxxLabel returns the right language ──────────────────
describe('getFarmTypeLabel', () => {
  it('returns English labels by default', () => {
    expect(getFarmTypeLabel('backyard')).toBe('Backyard / Home');
    expect(getFarmTypeLabel('small_farm')).toBe('Small farm');
    expect(getFarmTypeLabel('commercial')).toBe('Commercial farm');
  });

  it('returns localized labels for supported languages', () => {
    expect(getFarmTypeLabel('commercial', 'fr')).toMatch(/Exploitation/);
    expect(getFarmTypeLabel('small_farm', 'sw')).toBe('Shamba dogo');
    expect(getFarmTypeLabel('commercial', 'hi')).toBeTruthy();
    // Verify Hindi renders Devanagari, not English.
    expect(getFarmTypeLabel('commercial', 'hi')).not.toMatch(/Commercial/i);
  });

  it('falls back to English when the language is missing', () => {
    expect(getFarmTypeLabel('backyard', 'xx')).toBe('Backyard / Home');
  });

  it('normalizes legacy input before looking up', () => {
    expect(getFarmTypeLabel('Small Farm', 'fr')).toMatch(/Petite/);
    expect(getFarmTypeLabel('sell_locally', 'hi')).toBeTruthy();
  });
});

describe('getUnitLabel', () => {
  it('returns language-specific labels', () => {
    expect(getUnitLabel('ACRE', 'en')).toBe('Acres');
    expect(getUnitLabel('HECTARE', 'en')).toBe('Hectares');
    expect(getUnitLabel('ACRE', 'sw')).toBe('Ekari');
    expect(getUnitLabel('HECTARE', 'hi')).toBeTruthy();
  });

  it('normalizes input before lookup', () => {
    expect(getUnitLabel('acres', 'en')).toBe('Acres');
    expect(getUnitLabel('ha', 'fr')).toBe('Hectares');
  });

  it('falls back to Acres on garbage input', () => {
    expect(getUnitLabel(null, 'en')).toBe('Acres');
  });
});

describe('getCropStageLabel', () => {
  it('returns language-specific labels for every canonical stage', () => {
    for (const stage of CROP_STAGES) {
      expect(getCropStageLabel(stage, 'en')).toBeTruthy();
      expect(getCropStageLabel(stage, 'fr')).toBeTruthy();
      expect(getCropStageLabel(stage, 'sw')).toBeTruthy();
      expect(getCropStageLabel(stage, 'hi')).toBeTruthy();
    }
  });

  it('normalizes alias inputs before lookup', () => {
    expect(getCropStageLabel('harvesting', 'en')).toBe('Harvest');
    expect(getCropStageLabel('Land-prep', 'fr')).toMatch(/Pr\u00E9paration/);
  });
});

describe('getCropLabel (from src/config/crops.js)', () => {
  it('returns English labels by default', () => {
    expect(getCropLabel('cassava')).toBe('Cassava');
    expect(getCropLabel('maize')).toBe('Maize (corn)');
  });

  it('returns Hindi Devanagari script for hi', () => {
    const label = getCropLabel('cassava', 'hi');
    expect(label).toBeTruthy();
    // Contains at least one Devanagari codepoint.
    expect(/[\u0900-\u097F]/.test(label)).toBe(true);
  });

  it('falls back to English on an unknown lang', () => {
    expect(getCropLabel('cassava', 'klingon')).toBe('Cassava');
  });

  it('handles the CROP_OTHER sentinel', () => {
    expect(getCropLabel(CROP_OTHER, 'en')).toBe('Other');
    expect(getCropLabel(CROP_OTHER, 'hi')).toBeTruthy();
  });
});

// ─── 3. Canonical codes never include translated strings ────────
describe('canonical storage purity', () => {
  it('FARM_TYPES + SIZE_UNITS + CROP_STAGES contain only code strings', () => {
    const anyLang = _internal.FARM_TYPE_LABELS_BY_LANG.en;
    for (const code of FARM_TYPES) {
      expect(anyLang[code]).toBeTruthy();
      expect(code).toMatch(/^[a-z_]+$/);
    }
    for (const u of SIZE_UNITS) expect(u).toMatch(/^[A-Z]+$/);
    for (const s of CROP_STAGES) expect(s).toMatch(/^[a-z_]+$/);
  });

  it('normalizing any localised label never returns a localised string back', () => {
    const probes = [
      ['farmType', 'backyard'], ['farmType', 'small_farm'], ['farmType', 'commercial'],
    ];
    for (const [kind, canonical] of probes) {
      for (const lang of Object.keys(_internal.FARM_TYPE_LABELS_BY_LANG)) {
        const label = _internal.FARM_TYPE_LABELS_BY_LANG[lang][canonical];
        if (label) {
          const back = normalizeFarmType(label);
          expect(back).toBe(canonical);
          expect(back).toMatch(/^[a-z_]+$/);
        }
      }
    }
  });
});

// ─── 4. Onboarding status flags ─────────────────────────────────
describe('onboarding completion flags', () => {
  it('returns false before onboarding runs', () => {
    expect(isOnboardingComplete()).toBe(false);
    expect(isNewFarmer()).toBe(false);
    expect(getOnboardingStatus()).toEqual({ onboardingCompleted: false, isNewFarmer: false });
  });

  it('flips true after OnboardingV3 writes the canonical slot', () => {
    window.localStorage.setItem('farroway.onboardingV3', JSON.stringify({
      onboardingCompleted: true, isNewFarmer: true, completedAt: 123,
    }));
    expect(isOnboardingComplete()).toBe(true);
    expect(isNewFarmer()).toBe(true);
    expect(getOnboardingStatus().completedAt).toBe(123);
  });

  it('returns isNewFarmer=false for experienced-farmer completions', () => {
    window.localStorage.setItem('farroway.onboardingV3', JSON.stringify({
      onboardingCompleted: true, isNewFarmer: false, completedAt: 456,
    }));
    expect(isOnboardingComplete()).toBe(true);
    expect(isNewFarmer()).toBe(false);
  });

  it('is safe on malformed JSON', () => {
    window.localStorage.setItem('farroway.onboardingV3', '{not json}');
    expect(isOnboardingComplete()).toBe(false);
    expect(isNewFarmer()).toBe(false);
  });
});

// ─── 5. Page-source contract (no English leakage, no hardcode) ──
describe('OnboardingV3.jsx source contract', () => {
  const code = readFile('src/pages/onboarding/OnboardingV3.jsx');

  it('imports the canonical helpers (no English-label hardcoding)', () => {
    expect(code).toContain('getFarmTypeLabel');
    expect(code).toContain('getUnitLabel');
    expect(code).toContain('getCropStageLabel');
    expect(code).toContain('getCropLabel');
    expect(code).toContain('normalizeFarmType');
    expect(code).toContain('normalizeSizeUnit');
    expect(code).toContain('normalizeCropStage');
    expect(code).toContain('normalizeCrop');
  });

  it('three step branches exist', () => {
    expect(code).toContain('step === 1');
    expect(code).toContain('step === 2');
    expect(code).toContain('step === 3');
  });

  it('every field for the three steps is present', () => {
    // Step 1
    expect(code).toContain('isNewFarmer');
    expect(code).toContain("update('country'");
    expect(code).toContain("update('language'");
    // Step 2
    expect(code).toContain("update('farmName'");
    expect(code).toContain("update('farmType'");
    expect(code).toContain("update('farmSize'");
    expect(code).toContain("update('sizeUnit'");
    // Step 3
    expect(code).toContain("update('mainCrop'");
    expect(code).toContain("update('cropStage'");
  });

  it('runs every stored value through a normalizer before saveFarm', () => {
    expect(code).toMatch(/farmType:\s*normalizeFarmType/);
    expect(code).toMatch(/sizeUnit:\s*normalizeSizeUnit/);
    expect(code).toMatch(/stage:\s*normalizeCropStage/);
    expect(code).toMatch(/normalizeCrop\(form/);
  });

  it('persists a draft on every edit + clears it on completion', () => {
    expect(code).toContain('safeSetDraft');
    expect(code).toContain('safeClearDraft');
    expect(code).toContain("'farroway.onboardingV3.draft'");
  });

  it('marks onboarding complete with the canonical flag shape', () => {
    expect(code).toContain('markOnboardingComplete');
    expect(code).toContain("'farroway.onboardingV3'");
    expect(code).toMatch(/onboardingCompleted:\s*true/);
    expect(code).toMatch(/isNewFarmer:\s*/);
  });

  it('redirects new farmers to beginner landing and existing farmers to dashboard', () => {
    expect(code).toMatch(/navigate\(\s*form\.isNewFarmer\s*\?\s*['"]\/today['"]\s*:\s*['"]\/dashboard['"]/);
  });

  it('country auto-detect falls back silently on failure', () => {
    expect(code).toContain('detectCountryByIP');
    expect(code).toMatch(/catch\s*\{\s*\/\*\s*silent fallback/);
  });

  it('step-gated validation disables Continue until the step passes', () => {
    expect(code).toContain('validateStep');
    expect(code).toContain('canContinue');
    expect(code).toMatch(/disabled=\{!canContinue/);
  });

  it('uses the canonical label keys in every choice chip', () => {
    // Every chip renders a translated label, not a literal string.
    expect(code).toMatch(/getFarmTypeLabel\(code,\s*lang\)/);
    expect(code).toMatch(/getUnitLabel\(u,\s*lang\)/);
    expect(code).toMatch(/getCropLabel\(c\.code,\s*lang\)/);
    expect(code).toMatch(/getCropStageLabel\(s,\s*lang\)/);
  });

  it('Register.jsx post-signup now points at /onboarding', () => {
    const reg = readFile('src/pages/Register.jsx');
    expect(reg).toContain("navigate('/onboarding')");
    expect(reg).not.toContain("navigate('/onboarding/fast')");
  });

  it('App.jsx exposes the new route', () => {
    const app = readFile('src/App.jsx');
    expect(app).toContain("path=\"/onboarding\"");
    expect(app).toContain('OnboardingV3');
  });
});
