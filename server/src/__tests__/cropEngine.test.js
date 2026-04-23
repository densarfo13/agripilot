/**
 * cropEngine.test.js — locks the 12-point spec matrix for the Crop
 * Intelligence Engine helpers added in the latest pass:
 *
 *   1.  normalizeCropId('Corn')            → 'maize'
 *   2.  getCropLabel('cassava', 'en')      → 'Cassava'
 *   3.  getCropImage('cassava')            → '/crops/cassava.webp'
 *   4.  getCropImage(unknown)              → placeholder
 *   5.  maize lifecycle differs from cassava
 *   6.  stage durations are crop-specific
 *   7.  maize vegetative tasks ≠ tomato vegetative tasks
 *   8.  risk patterns filter correctly by stage
 *   9.  yield profile shape is normalised
 *   10. harvest profile loads correctly (+generic fallback)
 *   11. legacy crop values normalise safely
 *   12. multilingual labels don't change stored ids
 *   +   getCropsForRegion + getRegionForCountry
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeCropKey,
  normalizeCropId,
  getCrop,
  getCropLabel,
  getCropImage,
  getCropLifecycle,
  getStageDuration,
  getTasksForCropStage,
  getRiskPatternsForCropStage,
  getYieldProfile,
  getHarvestProfile,
  getCropsForRegion,
  getRegionForCountry,
  GENERIC_HARVEST_PROFILE,
} from '../../../src/config/crops/index.js';

// ── 1. normalizeCropId
describe('normalizeCropId', () => {
  it('maps "Corn" to maize', () => {
    expect(normalizeCropId('Corn')).toBe('maize');
  });

  it('handles legacy storage shapes', () => {
    expect(normalizeCropId('SWEET_POTATO')).toBe('sweet-potato');
    expect(normalizeCropId('Sweet Potato')).toBe('sweet-potato');
    expect(normalizeCropId('peanut')).toBe('groundnut');
    expect(normalizeCropId('chili')).toBe('pepper');
    expect(normalizeCropId('chilli')).toBe('pepper');
  });

  it('returns null for unknown + empty', () => {
    expect(normalizeCropId('')).toBeNull();
    expect(normalizeCropId(null)).toBeNull();
    expect(normalizeCropId('unobtainium')).toBeNull();
  });

  it('is a strict alias of normalizeCropKey', () => {
    for (const input of ['Corn', 'maize', 'Sweet Potato', 'CASSAVA']) {
      expect(normalizeCropId(input)).toBe(normalizeCropKey(input));
    }
  });
});

// ── 2. getCropLabel
describe('getCropLabel', () => {
  it('returns the localised label for cassava', () => {
    expect(getCropLabel('cassava', 'en')).toMatch(/cassava/i);
  });

  it('does not change the stored canonical id', () => {
    // Render in French; canonical id stays 'cassava'.
    const label = getCropLabel('cassava', 'fr');
    expect(label).toBeTruthy();
    // id we pass in is the canonical form — helper never mutates.
    expect(normalizeCropId('cassava')).toBe('cassava');
  });

  it('returns a non-empty string for every canonical crop in English', () => {
    for (const key of ['maize', 'rice', 'tomato', 'cassava', 'beans']) {
      expect(getCropLabel(key, 'en').length).toBeGreaterThan(0);
    }
  });
});

// ── 3 + 4. getCropImage
describe('getCropImage', () => {
  it('returns the webp path for cassava', () => {
    expect(getCropImage('cassava')).toBe('/crops/cassava.webp');
  });

  it('resolves aliases before mapping', () => {
    expect(getCropImage('corn')).toBe('/crops/maize.webp');
  });

  it('falls back to the placeholder for unknown crops', () => {
    expect(getCropImage('unobtainium')).toMatch(/fallback-crop\.webp|_placeholder/);
  });
});

// ── 5 + 6. Lifecycles + stage durations are crop-specific
describe('getCropLifecycle + getStageDuration', () => {
  it('maize lifecycle has different stages from cassava', () => {
    const maize   = getCropLifecycle('maize').map((s) => s.key);
    const cassava = getCropLifecycle('cassava').map((s) => s.key);
    expect(maize).toContain('tasseling');
    expect(maize).toContain('grain_fill');
    expect(cassava).toContain('bulking');
    expect(cassava).not.toContain('tasseling');
  });

  it('stage durations vary by crop', () => {
    // Maize tasseling is short, cassava bulking is long.
    const maizeTassel    = getStageDuration('maize',   'tasseling');
    const cassavaBulking = getStageDuration('cassava', 'bulking');
    expect(maizeTassel).toBeGreaterThan(0);
    expect(cassavaBulking).toBeGreaterThan(maizeTassel);
  });

  it('returns null for a stage the crop doesn\u2019t have', () => {
    expect(getStageDuration('maize', 'bulking')).toBeNull();
  });

  it('accepts alias stage keys', () => {
    expect(getStageDuration('maize', 'grain-fill')).toBe(getStageDuration('maize', 'grain_fill'));
  });
});

// ── 7. Stage tasks differ by crop
describe('getTasksForCropStage', () => {
  it('returns crop-specific tasks for maize vegetative', () => {
    const tasks = getTasksForCropStage('maize', 'vegetative');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.id.startsWith('maize.'))).toBe(true);
  });

  it('returns different tasks for tomato vegetative', () => {
    const maize  = getTasksForCropStage('maize',  'vegetative').map((t) => t.id);
    const tomato = getTasksForCropStage('tomato', 'vegetative').map((t) => t.id);
    // Every maize id starts with "maize.", none should leak into tomato.
    expect(maize.some((id) => tomato.includes(id))).toBe(false);
  });

  it('returns an empty list for an unknown crop', () => {
    expect(getTasksForCropStage('unobtainium', 'vegetative')).toEqual([]);
  });

  it('accepts farm type filtering (no audience tag = always shown)', () => {
    const all       = getTasksForCropStage('maize', 'vegetative');
    const backyard  = getTasksForCropStage('maize', 'vegetative', 'backyard');
    // Nothing in the maize pool has an audience tag, so backyard sees
    // the same set — the helper never accidentally hides a template.
    expect(backyard.length).toBe(all.length);
  });
});

// ── 8. Risk patterns filter by stage
describe('getRiskPatternsForCropStage', () => {
  it('filters maize risks to the requested stage + cross-stage', () => {
    const tasseling = getRiskPatternsForCropStage('maize', 'tasseling');
    expect(tasseling.length).toBeGreaterThan(0);
    // Every returned risk either has no stage trigger or matches tasseling.
    for (const r of tasseling) {
      const s = r.trigger && r.trigger.stage;
      expect(!s || s === 'tasseling').toBe(true);
    }
  });

  it('returns the full list when no stage is supplied', () => {
    const all = getRiskPatternsForCropStage('maize', null);
    expect(all.length).toBeGreaterThan(0);
  });

  it('returns an empty list for an unknown crop', () => {
    expect(getRiskPatternsForCropStage('unobtainium', 'vegetative')).toEqual([]);
  });
});

// ── 9. Yield profile shape
describe('getYieldProfile', () => {
  it('returns normalised low/high/typical for maize', () => {
    const p = getYieldProfile('maize');
    expect(p).toBeTruthy();
    expect(p.lowPerSqm).toBeGreaterThan(0);
    expect(p.highPerSqm).toBeGreaterThan(p.lowPerSqm);
    expect(p.unit).toBe('kg/m²');
  });

  it('legacy verbose aliases still present', () => {
    const p = getYieldProfile('maize');
    expect(p.lowYieldPerSqm).toBe(p.lowPerSqm);
    expect(p.highYieldPerSqm).toBe(p.highPerSqm);
  });

  it('returns null for a crop with no real data', () => {
    expect(getYieldProfile('unobtainium')).toBeNull();
  });
});

// ── 10. Harvest profile
describe('getHarvestProfile', () => {
  it('returns crop-specific profile for cassava', () => {
    const p = getHarvestProfile('cassava');
    expect(p).toBeTruthy();
    expect(p.perishability).toBe('high');
    expect(p.suggestedUnits[0]).toBe('kg');
  });

  it('returns GENERIC_HARVEST_PROFILE for unknown crops', () => {
    const p = getHarvestProfile('unobtainium');
    expect(p).toBe(GENERIC_HARVEST_PROFILE);
  });

  it('expectedHarvestWindowDays is a finite positive number', () => {
    for (const key of ['maize', 'tomato', 'cassava', 'banana', 'cocoa']) {
      expect(getHarvestProfile(key).expectedHarvestWindowDays).toBeGreaterThan(0);
    }
  });
});

// ── 11. Legacy / backward-compat
describe('backward compatibility', () => {
  it('does not crash when fed legacy storage codes', () => {
    const crop = getCrop('SWEET_POTATO');
    expect(crop).toBeTruthy();
    expect(crop.id).toBe('sweet-potato');
  });

  it('legacy "Pepper / chili" normalises to pepper', () => {
    expect(normalizeCropId('chili')).toBe('pepper');
    expect(normalizeCropId('chilli')).toBe('pepper');
  });

  it('getCrop returns null for unknown input without throwing', () => {
    expect(() => getCrop('completely-made-up-crop')).not.toThrow();
    expect(getCrop('completely-made-up-crop')).toBeNull();
  });
});

// ── 12. Multilingual render without changing stored id
describe('multilingual labels', () => {
  it('rendering in multiple languages never rewrites the canonical id', () => {
    const id = normalizeCropId('cassava');
    expect(id).toBe('cassava');
    for (const lang of ['en', 'fr', 'sw', 'ha', 'tw']) {
      const label = getCropLabel(id, lang);
      expect(label).toBeTruthy();
      // Id didn't change — it's still the registry key.
      expect(normalizeCropId(id)).toBe('cassava');
    }
  });
});

// ── Regions
describe('getCropsForRegion + getRegionForCountry', () => {
  it('maps country code to region', () => {
    expect(getRegionForCountry('GH')).toBe('africa');
    expect(getRegionForCountry('IN')).toBe('asia');
    expect(getRegionForCountry('US')).toBe('north-america');
    expect(getRegionForCountry('zz')).toBeNull();
  });

  it('returns crops tagged for the region', () => {
    const afr = getCropsForRegion('africa');
    expect(afr.length).toBeGreaterThan(0);
    expect(afr).toContain('cassava');
    expect(afr).toContain('maize');
  });

  it('accepts countryCode for lookup', () => {
    const afr = getCropsForRegion({ countryCode: 'GH' });
    expect(afr).toContain('cassava');
  });

  it('respects a supplied pool', () => {
    const out = getCropsForRegion('africa', { pool: ['cassava', 'lettuce'] });
    // Both are "relevant" — cassava by tag, lettuce by no-tag default.
    // This asserts the filter is a filter, not a hide list.
    expect(out).toContain('cassava');
  });

  it('getCrop exposes regions on the composed shape', () => {
    expect(getCrop('cassava').regions).toContain('africa');
  });
});

// ── Integration: registry composes every layer
describe('getCrop composed shape', () => {
  it('cassava composed shape includes every intelligence layer', () => {
    const c = getCrop('cassava');
    expect(c).toBeTruthy();
    expect(c.id).toBe('cassava');
    expect(c.key).toBe('cassava');           // legacy alias
    expect(c.image).toBe('/crops/cassava.webp');
    expect(Array.isArray(c.lifecycle)).toBe(true);
    expect(c.tasksByStage.bulking.length).toBeGreaterThan(0);
    expect(c.defaultTaskTemplates).toBe(c.tasksByStage); // same object
    expect(c.riskPatterns.length).toBeGreaterThan(0);
    expect(c.yieldProfile).toBeTruthy();
    expect(c.harvestProfile.perishability).toBe('high');
    expect(c.regions).toContain('africa');
  });
});
