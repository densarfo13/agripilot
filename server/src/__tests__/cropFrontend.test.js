import { describe, it, expect, beforeAll } from 'vitest';

// Static top-level import: the previous pattern used an `it('loads…',
// async () => { const mod = await import(...) })` test inside each
// describe block, with the loaded module assigned to closure vars
// shared with later tests. Under load (full test-run with many files
// transforming in parallel) the dynamic import sometimes exceeded
// the 5s test timeout, leaving every later test in that describe
// block reading `undefined` and failing with TypeErrors.
//
// Static imports happen at transform time, so the module is loaded
// once per file before any test runs — no shared-state ordering
// assumption, no per-test timeout pressure.
import * as cropsMod from '../../../src/utils/crops.js';
import * as cropRecommendationsMod from '../../../src/utils/cropRecommendations.js';

/**
 * Crop Frontend Utilities — Tests
 *
 * Tests the shared crop dataset, structured "Other" parsing,
 * search-compatible helpers, and the recommendation engine.
 * These test the JS modules directly (no React rendering needed).
 */

// ─── 1. Crop dataset structure ──────────────────────────────

describe('Crop dataset — code/name structure', () => {
  const { ALL_CROPS, OTHER_CROP, ALL_CROPS_WITH_OTHER, CROP_CODE_SET, CATEGORY_LABELS } = cropsMod;

  it('loads the crop module', () => {
    expect(ALL_CROPS).toBeDefined();
  });

  it('contains at least 60 crops', () => {
    expect(ALL_CROPS.length).toBeGreaterThanOrEqual(60);
  });

  it('every crop has code, name, and category', () => {
    for (const c of ALL_CROPS) {
      expect(c.code).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(c.code).toBe(c.code.toUpperCase()); // codes are uppercase
    }
  });

  it('ALL_CROPS is sorted alphabetically by name', () => {
    for (let i = 1; i < ALL_CROPS.length; i++) {
      expect(ALL_CROPS[i].name.localeCompare(ALL_CROPS[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('OTHER_CROP has code "OTHER"', () => {
    expect(OTHER_CROP.code).toBe('OTHER');
    expect(OTHER_CROP.name).toBe('Other');
    expect(OTHER_CROP.category).toBe('other');
  });

  it('ALL_CROPS_WITH_OTHER has OTHER as last entry', () => {
    expect(ALL_CROPS_WITH_OTHER.length).toBe(ALL_CROPS.length + 1);
    expect(ALL_CROPS_WITH_OTHER[ALL_CROPS_WITH_OTHER.length - 1].code).toBe('OTHER');
  });

  it('CROP_CODE_SET matches ALL_CROPS codes', () => {
    expect(CROP_CODE_SET.size).toBe(ALL_CROPS.length);
    for (const c of ALL_CROPS) {
      expect(CROP_CODE_SET.has(c.code)).toBe(true);
    }
  });

  it('CATEGORY_LABELS covers all categories in the dataset', () => {
    const categories = new Set(ALL_CROPS.map(c => c.category));
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });
});

// ─── 2. Search helpers — first letter and partial match ─────

describe('Crop search helpers', () => {
  const { ALL_CROPS, getCropByCode, getCropByValue, getCropLabel } = cropsMod;

  it('loads helpers', () => {
    expect(ALL_CROPS).toBeDefined();
    expect(getCropByCode).toBeTypeOf('function');
  });

  it('first-letter filter returns matching crops', () => {
    // Simulates typing "M" in the search box
    const q = 'm';
    const matches = ALL_CROPS.filter(c => c.name.toLowerCase().startsWith(q));
    expect(matches.length).toBeGreaterThanOrEqual(3); // Maize, Mango, Millet, Moringa, etc.
    expect(matches.some(c => c.code === 'MAIZE')).toBe(true);
  });

  it('partial search returns matching crops', () => {
    // Simulates typing "cass" → should find Cassava
    const q = 'cass';
    const matches = ALL_CROPS.filter(c => c.name.toLowerCase().includes(q));
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].code).toBe('CASSAVA');
  });

  it('partial search for "sun" returns Sunflower', () => {
    const q = 'sun';
    const matches = ALL_CROPS.filter(c => c.name.toLowerCase().includes(q));
    expect(matches.some(c => c.code === 'SUNFLOWER')).toBe(true);
  });

  it('getCropByCode finds by uppercase code', () => {
    const crop = getCropByCode('MAIZE');
    expect(crop).toBeTruthy();
    expect(crop.name).toBe('Maize');
  });

  it('getCropByValue handles legacy lowercase', () => {
    const crop = getCropByValue('maize');
    expect(crop).toBeTruthy();
    expect(crop.code).toBe('MAIZE');
  });

  it('getCropLabel returns display name', () => {
    expect(getCropLabel('MAIZE')).toBe('Maize');
    expect(getCropLabel('maize')).toBe('Maize'); // legacy
    expect(getCropLabel('SWEET_POTATO')).toBe('Sweet Potato');
  });

  it('getCropLabel handles OTHER:CustomName', () => {
    expect(getCropLabel('OTHER:Teff')).toBe('Teff');
    expect(getCropLabel('OTHER')).toBe('Other');
  });

  it('getCropLabel falls back to raw value for unknowns', () => {
    expect(getCropLabel('UNKNOWN_CROP')).toBe('UNKNOWN_CROP');
  });
});

// ─── 3. Structured "Other" parsing ──────────────────────────

describe('parseCropValue — structured Other', () => {
  const { parseCropValue, buildOtherCropValue } = cropsMod;

  it('loads', () => {
    expect(parseCropValue).toBeTypeOf('function');
    expect(buildOtherCropValue).toBeTypeOf('function');
  });

  it('standard crop → cropCode, isCustomCrop=false', () => {
    const r = parseCropValue('MAIZE');
    expect(r.cropCode).toBe('MAIZE');
    expect(r.cropName).toBe('Maize');
    expect(r.customCropName).toBeNull();
    expect(r.isCustomCrop).toBe(false);
  });

  it('OTHER → isCustomCrop=true, customCropName=null', () => {
    const r = parseCropValue('OTHER');
    expect(r.cropCode).toBe('OTHER');
    expect(r.isCustomCrop).toBe(true);
    expect(r.customCropName).toBeNull();
  });

  it('OTHER:Teff → isCustomCrop=true, customCropName="Teff"', () => {
    const r = parseCropValue('OTHER:Teff');
    expect(r.cropCode).toBe('OTHER');
    expect(r.customCropName).toBe('Teff');
    expect(r.isCustomCrop).toBe(true);
  });

  it('empty/null → empty result', () => {
    const r = parseCropValue('');
    expect(r.cropCode).toBe('');
    expect(r.isCustomCrop).toBe(false);
    const r2 = parseCropValue(null);
    expect(r2.cropCode).toBe('');
  });

  it('buildOtherCropValue creates "OTHER:Name"', () => {
    expect(buildOtherCropValue('Teff')).toBe('OTHER:Teff');
    expect(buildOtherCropValue('  Finger Millet Local  ')).toBe('OTHER:Finger Millet Local');
  });

  it('buildOtherCropValue with empty name returns "OTHER"', () => {
    expect(buildOtherCropValue('')).toBe('OTHER');
    expect(buildOtherCropValue(null)).toBe('OTHER');
  });
});

// ─── 4. isValidCrop helper ──────────────────────────────────

describe('isValidCrop', () => {
  const { isValidCrop } = cropsMod;

  it('loads', () => {
    expect(isValidCrop).toBeTypeOf('function');
  });

  it('returns true for known codes', () => {
    expect(isValidCrop('MAIZE')).toBe(true);
    expect(isValidCrop('COFFEE')).toBe(true);
    expect(isValidCrop('SWEET_POTATO')).toBe(true);
  });

  it('returns true for legacy lowercase', () => {
    expect(isValidCrop('maize')).toBe(true);
    expect(isValidCrop('coffee')).toBe(true);
  });

  it('returns true for OTHER and OTHER:Name', () => {
    expect(isValidCrop('OTHER')).toBe(true);
    expect(isValidCrop('OTHER:Teff')).toBe(true);
  });

  it('returns false for OTHER:X (too short)', () => {
    expect(isValidCrop('OTHER:X')).toBe(false);
  });

  it('returns false for empty/null', () => {
    expect(isValidCrop('')).toBe(false);
    expect(isValidCrop(null)).toBe(false);
  });

  it('returns false for unknown crops', () => {
    expect(isValidCrop('UNOBTANIUM')).toBe(false);
  });
});

// ─── 5. Recommendation engine ───────────────────────────────

describe('Recommendation engine', () => {
  const { recommendCrops } = cropRecommendationsMod;

  it('loads', () => {
    expect(recommendCrops).toBeTypeOf('function');
  });

  it('returns empty recommendations when no context', () => {
    const r = recommendCrops({});
    expect(r.hasContext).toBe(false);
    expect(r.recommendations).toEqual([]);
    expect(r.contextUsed).toEqual([]);
  });

  it('returns recommendations when country is provided', () => {
    const r = recommendCrops({ country: 'KE' });
    expect(r.hasContext).toBe(true);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(r.contextUsed).toContain('country');
    // Each recommendation has code, name, reason
    for (const rec of r.recommendations) {
      expect(rec.code).toBeTruthy();
      expect(rec.name).toBeTruthy();
      expect(rec.reason).toBeTruthy();
    }
  });

  it('returns recommendations for TZ', () => {
    const r = recommendCrops({ country: 'TZ' });
    expect(r.hasContext).toBe(true);
    expect(r.recommendations.some(c => c.code === 'RICE')).toBe(true);
  });

  it('uses season context when provided', () => {
    const r = recommendCrops({ country: 'KE', season: 'long_rains' });
    expect(r.contextUsed).toContain('season');
    expect(r.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it('uses soil type context when provided', () => {
    const r = recommendCrops({ soilType: 'sandy' });
    expect(r.hasContext).toBe(true);
    expect(r.contextUsed).toContain('soilType');
    expect(r.recommendations.some(c => c.code === 'GROUNDNUT' || c.code === 'CASSAVA')).toBe(true);
  });

  it('uses land type context', () => {
    const r = recommendCrops({ landType: 'irrigated' });
    expect(r.contextUsed).toContain('landType');
    expect(r.recommendations.some(c => c.code === 'RICE')).toBe(true);
  });

  it('uses farm size context — small farm', () => {
    const r = recommendCrops({ farmSize: 1 });
    expect(r.contextUsed).toContain('farmSize');
    expect(r.recommendations.some(c => c.code === 'MAIZE' || c.code === 'BEAN')).toBe(true);
  });

  it('uses farm size context — large farm', () => {
    const r = recommendCrops({ farmSize: 50 });
    expect(r.contextUsed).toContain('farmSize');
    expect(r.recommendations.some(c => c.code === 'TEA' || c.code === 'WHEAT' || c.code === 'COFFEE')).toBe(true);
  });

  it('ranks by number of matching context factors', () => {
    // Multiple context factors should boost some crops higher
    const r = recommendCrops({ country: 'KE', season: 'long_rains', soilType: 'loam', farmSize: 5 });
    expect(r.contextUsed.length).toBeGreaterThanOrEqual(3);
    // MAIZE should score high (common in KE + long rains + loam)
    const maize = r.recommendations.find(c => c.code === 'MAIZE');
    expect(maize).toBeTruthy();
    // It should be near the top
    const idx = r.recommendations.indexOf(maize);
    expect(idx).toBeLessThan(4);
  });

  it('returns max 8 recommendations', () => {
    const r = recommendCrops({ country: 'KE', season: 'long_rains', soilType: 'loam', farmSize: 5, landType: 'rainfed' });
    expect(r.recommendations.length).toBeLessThanOrEqual(8);
  });

  it('recommendations are hidden when context is insufficient', () => {
    const r = recommendCrops({});
    expect(r.hasContext).toBe(false);
    expect(r.recommendations.length).toBe(0);
  });

  it('each recommendation has an explainable reason string', () => {
    const r = recommendCrops({ country: 'KE', soilType: 'clay' });
    for (const rec of r.recommendations) {
      expect(typeof rec.reason).toBe('string');
      expect(rec.reason.length).toBeGreaterThan(5);
    }
  });
});

// ─── 6. normalizeCropCode helper ────────────────────────────

describe('normalizeCropCode', () => {
  let normalizeCropCode;

  it('loads', async () => {
    const mod = await import('../../../src/utils/crops.js');
    normalizeCropCode = mod.normalizeCropCode;
  });

  it('normalizes lowercase to uppercase', () => {
    expect(normalizeCropCode('maize')).toBe('MAIZE');
    expect(normalizeCropCode('sweet_potato')).toBe('SWEET_POTATO');
  });

  it('preserves already-uppercase codes', () => {
    expect(normalizeCropCode('MAIZE')).toBe('MAIZE');
  });

  it('normalizes OTHER but preserves custom name casing', () => {
    expect(normalizeCropCode('other:Teff')).toBe('OTHER:Teff');
    expect(normalizeCropCode('OTHER:My Special Crop')).toBe('OTHER:My Special Crop');
  });

  it('returns empty for empty/null', () => {
    expect(normalizeCropCode('')).toBe('');
    expect(normalizeCropCode(null)).toBe('');
  });

  it('returns raw value for unknown crops', () => {
    expect(normalizeCropCode('something_unknown')).toBe('something_unknown');
  });
});
