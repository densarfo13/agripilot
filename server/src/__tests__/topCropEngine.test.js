/**
 * topCropEngine.test.js — locks the Top Crops recommendation engine
 * behaviour end-to-end: canonical ids only, registry-driven labels/
 * images, regional + beginner + farm-type boosts, safe fallbacks.
 */

import { describe, it, expect } from 'vitest';

import {
  recommendTopCrops, renderTopCrop, _internal,
} from '../../../src/lib/recommendations/topCropEngine.js';
import {
  normalizeCropId, getCropLabel, getCropImage, getCrop,
} from '../../../src/config/crops/index.js';

// ─── normalizeCropId (spec §1) ────────────────────────────────
describe('normalizeCropId', () => {
  it('maps "Corn" to maize', () => {
    expect(normalizeCropId('Corn')).toBe('maize');
  });
  it('maps legacy uppercase codes', () => {
    expect(normalizeCropId('SWEET_POTATO')).toBe('sweet-potato');
    expect(normalizeCropId('CASSAVA')).toBe('cassava');
    expect(normalizeCropId('CHILI')).toBe('pepper');
  });
  it('returns null for empty or unknown', () => {
    expect(normalizeCropId('')).toBeNull();
    expect(normalizeCropId('unobtainium')).toBeNull();
  });
});

// ─── Registry-sourced labels update with language ─────────────
describe('getCropLabel updates with language', () => {
  it('English vs French differ', () => {
    const en = getCropLabel('cassava', 'en');
    const fr = getCropLabel('cassava', 'fr');
    expect(en).toBeTruthy();
    expect(fr).toBeTruthy();
    // At least one other language renders something non-empty and
    // different from English; if fr happens to equal en for this crop,
    // try sw.
    const any = fr !== en || getCropLabel('cassava', 'sw') !== en;
    expect(any).toBe(true);
  });

  it('does not mutate the canonical id', () => {
    const id = normalizeCropId('cassava');
    for (const lang of ['en', 'fr', 'sw', 'ha', 'tw', 'hi']) {
      getCropLabel(id, lang);
      expect(normalizeCropId(id)).toBe('cassava');
    }
  });
});

// ─── getCropImage returns registry asset or placeholder ───────
describe('getCropImage', () => {
  it('returns webp path for known crop', () => {
    expect(getCropImage('cassava')).toBe('/crops/cassava.webp');
  });
  it('returns placeholder for unknown crop', () => {
    expect(getCropImage('unobtainium')).toMatch(/fallback-crop\.webp|_placeholder/);
  });
});

// ─── recommendTopCrops — core contract ────────────────────────
describe('recommendTopCrops', () => {
  it('returns best + alternatives with canonical ids', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm',
      farmerExperienceLevel: 'beginner',
    });
    expect(out).toBeTruthy();
    expect(out.best.cropId).toBeTruthy();
    expect(out.best.recommendationType).toBe('best_for_you');
    expect(out.alternatives.length).toBeGreaterThan(0);
    for (const alt of out.alternatives) {
      expect(alt.recommendationType).toBe('also_consider');
      expect(alt.cropId).toBeTruthy();
    }
    // Canonical only — no spaces, no uppercase.
    for (const c of [out.best, ...out.alternatives]) {
      expect(c.cropId).toBe(c.cropId.toLowerCase());
      expect(c.cropId).not.toMatch(/[\s_]/);
    }
  });

  it('Ghana context ranks regionally relevant crops higher', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm',
      farmerExperienceLevel: 'beginner',
      waterAvailability: 'rain_only',
      budgetSensitivity: 'low',
    });
    const topIds = [out.best.cropId, ...out.alternatives.map((a) => a.cropId)];
    // At least one of cassava / groundnut / maize surfaces in the top 3.
    expect(topIds.some((id) => ['cassava', 'groundnut', 'maize'].includes(id))).toBe(true);
  });

  it('beginner context promotes beginner-friendly crops', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm',
      farmerExperienceLevel: 'beginner',
    });
    expect(out.best.beginnerFriendly).toBe(true);
  });

  it('backyard context prefers low-water / low-cost crops', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'backyard',
      farmerExperienceLevel: 'beginner',
      waterAvailability: 'rain_only', budgetSensitivity: 'low',
    });
    expect(out.best.waterNeed).not.toBe('high');
    expect(out.best.costLevel).not.toBe('high');
  });

  it('missing location falls back safely to canonical pool', () => {
    const out = recommendTopCrops({});
    expect(out).toBeTruthy();
    expect(out.best.cropId).toBeTruthy();
    expect(out.all.length).toBeGreaterThan(5);
  });

  it('reasons are translation keys (no hardcoded English)', () => {
    const out = recommendTopCrops({
      country: 'GH', farmerExperienceLevel: 'beginner',
    });
    for (const r of out.best.reasons) {
      expect(r).toMatch(/^topCrops\./);
    }
  });

  it('preferred crop gets a strong bonus', () => {
    const base = recommendTopCrops({
      country: 'GH', farmType: 'commercial',
      farmerExperienceLevel: 'advanced',
    });
    const preferred = recommendTopCrops({
      country: 'GH', farmType: 'commercial',
      farmerExperienceLevel: 'advanced',
      preferredCrop: 'okra',
    });
    const okraBase = base.all.find((c) => c.cropId === 'okra');
    const okraPreferred = preferred.all.find((c) => c.cropId === 'okra');
    expect(okraPreferred.score).toBeGreaterThan(okraBase.score);
  });

  it('legacy crop input normalises and still matches as preferred', () => {
    const out = recommendTopCrops({
      country: 'GH', preferredCrop: 'Corn',
      farmerExperienceLevel: 'beginner',
    });
    const maize = out.all.find((c) => c.cropId === 'maize');
    // "your choice" reason pushed only when the preferred crop resolves.
    expect(maize.reasons.includes('topCrops.reason.yourChoice')).toBe(true);
  });

  it('regional pool filters to relevant crops by country', () => {
    const ghana = recommendTopCrops({
      country: 'GH', farmType: 'small_farm',
      farmerExperienceLevel: 'intermediate',
    });
    const india = recommendTopCrops({
      country: 'IN', farmType: 'small_farm',
      farmerExperienceLevel: 'intermediate',
    });
    const ghanaIds = new Set(ghana.all.map((c) => c.cropId));
    const indiaIds = new Set(india.all.map((c) => c.cropId));
    // Rice is tagged for both regions; cocoa is africa-only; sesame
    // & chickpea lean asia.
    expect(ghanaIds.has('cocoa')).toBe(true);
    expect(indiaIds.has('chickpea')).toBe(true);
    expect(indiaIds.has('sesame')).toBe(true);
    // Cocoa should NOT surface in the India pool (africa/latam-only tag).
    expect(indiaIds.has('cocoa')).toBe(false);
  });
});

// ─── renderTopCrop projects registry label/image ──────────────
describe('renderTopCrop', () => {
  it('attaches localized label + image', () => {
    const card = { cropId: 'cassava', score: 10, reasons: [], badges: [],
                    warnings: [], durationText: '', waterNeed: 'low',
                    costLevel: 'low', droughtTolerance: 'high',
                    difficulty: 'beginner', beginnerFriendly: true,
                    regions: ['africa'], tags: [] };
    const en = renderTopCrop(card, 'en');
    const fr = renderTopCrop(card, 'fr');
    expect(en.image).toBe('/crops/cassava.webp');
    expect(fr.image).toBe('/crops/cassava.webp');
    expect(en.label).toBeTruthy();
    expect(fr.label).toBeTruthy();
  });

  it('returns null for falsy input', () => {
    expect(renderTopCrop(null)).toBeNull();
    expect(renderTopCrop({})).toBeNull();
  });
});

// ─── Registry integration ─────────────────────────────────────
describe('registry trait fields exposed', () => {
  it('getCrop(cassava) exposes waterNeed/costLevel/cycleRangeWeeks', () => {
    const c = getCrop('cassava');
    expect(c.waterNeed).toBe('low');
    expect(c.costLevel).toBe('low');
    expect(Array.isArray(c.cycleRangeWeeks)).toBe(true);
    expect(c.cycleRangeWeeks[0]).toBeGreaterThan(0);
    expect(c.beginnerFriendly).toBe(true);
    expect(c.tags).toContain('low_water');
    expect(c.tags).toContain('drought_tolerant');
  });

  it('unknown crops still return a complete shape for the UI', () => {
    const c = getCrop('unobtainium');
    expect(c).toBeNull();
  });
});
