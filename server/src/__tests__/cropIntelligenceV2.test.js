/**
 * cropIntelligenceV2.test.js — locks the Intelligence Layer v2:
 *
 *   A. Crop suggestion (location + season + weather) — recommendCrops
 *      additively emits riskNotes + seasonalGuidance per item and
 *      resolves `{ month, season, climate }` context. All existing
 *      recommendation contract tests still hold (we don't rewrite
 *      them here — they live in cropRecommendationEngine.test.js
 *      and keep passing).
 *
 *   B. Yield prediction (crop + area + stage + weather) — estimateYield
 *      accepts optional { weather, climate, season } and returns
 *      { riskFactors, recommendations, isEstimate, weatherStatus }.
 *      All existing yield tests still hold.
 *
 *   C. Photo detection foundation — cropDetector + heuristic provider.
 *      Pluggable provider abstraction, confidence never exaggerated,
 *      filename-hint matching routes through confirm UX, empty
 *      inputs never crash.
 */

import { describe, it, expect } from 'vitest';

import { recommendCrops, recommendCropsForScreen, _internal as recInternal }
  from '../../../src/lib/recommendations/cropRecommendationEngine.js';
import { estimateYield, _internal as yieldInternal }
  from '../../../src/lib/intelligence/yieldEngine.js';
import { detectCrop, identify, _internal as detectorInternal }
  from '../../../src/lib/vision/cropDetector.js';
import { listProviders, getActiveProvider }
  from '../../../src/lib/vision/providers/index.js';

// ═══════════════════════════════════════════════════════════════
// A. Crop suggestion
// ═══════════════════════════════════════════════════════════════

describe('recommendCrops — v2 enrichment', () => {
  it('attaches riskNotes to every item when climate + season are resolvable', () => {
    const r = recommendCrops({ country: 'GH', month: 5 /* wet */ });
    // Engine infers climate=tropical, season=wet for GH in May
    expect(r.context.climate).toBe('tropical');
    expect(r.context.season).toBe('wet');
    // Every item has a frozen riskNotes array
    for (const item of r.items) {
      expect(Array.isArray(item.riskNotes)).toBe(true);
      expect(Object.isFrozen(item.riskNotes)).toBe(true);
    }
  });

  it('cassava in GH wet season surfaces whitefly/mosaic hint', () => {
    const r = recommendCrops({ country: 'GH', month: 5 });
    const cassava = r.items.find((i) => i.crop === 'cassava');
    expect(cassava).toBeTruthy();
    const keys = cassava.riskNotes.map((n) => n.messageKey);
    expect(keys.some((k) => k.includes('whitefly') || k.includes('mosaic'))).toBe(true);
  });

  it('attaches seasonalGuidance when the crop has a catalogue entry', () => {
    const r = recommendCrops({ country: 'GH', state: 'AS' });
    const cassava = r.items.find((i) => i.crop === 'cassava');
    expect(cassava.seasonalGuidance).toBeTruthy();
    expect(cassava.seasonalGuidance.plantingWindow).toMatch(/rain|plant/i);
  });

  it('resolves season from month for tropical countries', () => {
    // GH May → wet
    expect(recommendCrops({ country: 'GH', month: 5 }).context.season).toBe('wet');
    // GH January → dry
    expect(recommendCrops({ country: 'GH', month: 1 }).context.season).toBe('dry');
    // KE April → wet (East Africa long rains)
    expect(recommendCrops({ country: 'KE', month: 4 }).context.season).toBe('wet');
    // KE August → dry
    expect(recommendCrops({ country: 'KE', month: 8 }).context.season).toBe('dry');
  });

  it('resolves temperate seasons for US', () => {
    expect(recommendCrops({ country: 'US', month: 1 }).context.season).toBe('winter');
    expect(recommendCrops({ country: 'US', month: 4 }).context.season).toBe('spring');
    expect(recommendCrops({ country: 'US', month: 7 }).context.season).toBe('summer');
    expect(recommendCrops({ country: 'US', month: 10 }).context.season).toBe('fall');
  });

  it('falls back gracefully when region/month are missing', () => {
    const r = recommendCrops();
    expect(r.isGeneral).toBe(true);
    expect(r.items.length).toBeGreaterThanOrEqual(3);
    // No context inferred — but riskNotes should still be an empty
    // array (never undefined, never null).
    for (const item of r.items) {
      expect(Array.isArray(item.riskNotes)).toBe(true);
    }
  });

  it('explicit season overrides inferred month', () => {
    const r = recommendCrops({ country: 'GH', month: 5, season: 'dry' });
    expect(r.context.season).toBe('dry');
  });

  it('passes weather context through for UI introspection', () => {
    const r = recommendCrops({
      country: 'GH',
      weather: { status: 'low_rain' },
    });
    expect(r.context.weatherStatus).toBe('low_rain');
  });

  it('recommendCropsForScreen surfaces riskNotes + seasonalGuidance', () => {
    const list = recommendCropsForScreen({ country: 'NG', month: 6 });
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const r of list) {
      expect(r.riskNotes).toBeDefined();
      // Legacy fields still present:
      expect(r).toHaveProperty('crop');
      expect(r).toHaveProperty('plantingWindow');
    }
  });

  it('inferSeason/inferClimate are pure + exposed for tests', () => {
    expect(recInternal.inferSeason({ country: 'GH', month: 5 })).toBe('wet');
    expect(recInternal.inferClimate({ country: 'US' })).toBe('temperate');
    expect(recInternal.inferClimate({ country: 'GH' })).toBe('tropical');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Yield prediction v2
// ═══════════════════════════════════════════════════════════════

describe('estimateYield — v2 enrichment', () => {
  const BASE = {
    crop: 'maize',
    normalizedAreaSqm: 10000,
    farmType: 'small_farm',
    cropStage: 'vegetative',
    countryCode: 'GH',
  };

  it('still returns the legacy range shape (no regressions)', () => {
    const est = estimateYield(BASE);
    expect(est).not.toBeNull();
    expect(est.lowEstimateKg).toBeGreaterThan(0);
    expect(est.highEstimateKg).toBeGreaterThanOrEqual(est.lowEstimateKg);
    expect(est.unit).toBe('kg');
  });

  it('adds isEstimate=true to every result (UI honesty contract)', () => {
    expect(estimateYield(BASE).isEstimate).toBe(true);
  });

  it('adds riskFactors array (empty for unknown contexts)', () => {
    const est = estimateYield(BASE);
    expect(Array.isArray(est.riskFactors)).toBe(true);
    expect(Object.isFrozen(est.riskFactors)).toBe(true);
  });

  it('surfaces crop-stage risks when climate + season provided', () => {
    const est = estimateYield({
      ...BASE, cropStage: 'tasseling',
      climate: 'tropical', season: 'wet',
    });
    const keys = est.riskFactors.map((r) => r.messageKey);
    // Maize at tasseling should expose drought or FAW hints.
    expect(
      keys.some((k) => k.includes('drought') || k.includes('armyworm') || k.includes('heat')),
    ).toBe(true);
  });

  it('adds recommendations (0–2 levers)', () => {
    const est = estimateYield(BASE);
    expect(Array.isArray(est.recommendations)).toBe(true);
    expect(est.recommendations.length).toBeLessThanOrEqual(2);
  });

  it('weather:low_rain narrows the high end + triggers irrigation recommendation', () => {
    const dry = estimateYield({ ...BASE, weather: { status: 'low_rain' } });
    const ok  = estimateYield({ ...BASE, weather: { status: 'ok' } });
    expect(dry.highEstimateKg).toBeLessThan(ok.highEstimateKg);
    expect(dry.weatherStatus).toBe('low_rain');
    expect(dry.recommendations.some((r) => r.id === 'rec.irrigate')).toBe(true);
  });

  it('weather:excessive_heat surfaces the shade recommendation', () => {
    const hot = estimateYield({ ...BASE, weather: { status: 'excessive_heat' } });
    expect(hot.recommendations.some((r) => r.id === 'rec.shade')).toBe(true);
  });

  it('weather:unavailable leaves the band untouched + no weather assumption added', () => {
    const a = estimateYield(BASE);
    const b = estimateYield({ ...BASE, weather: { status: 'unavailable' } });
    expect(a.lowEstimateKg).toBe(b.lowEstimateKg);
    expect(a.highEstimateKg).toBe(b.highEstimateKg);
  });

  it('null crop or zero area → still null (legacy contract preserved)', () => {
    expect(estimateYield({ ...BASE, crop: null })).toBeNull();
    expect(estimateYield({ ...BASE, normalizedAreaSqm: 0 })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Photo detection foundation
// ═══════════════════════════════════════════════════════════════

describe('cropDetector + heuristic provider', () => {
  it('detectCrop returns a safe shape for null/empty inputs', async () => {
    const r1 = await detectCrop(null);
    expect(r1.best).toBeNull();
    expect(r1.candidates).toEqual([]);
    expect(r1.provider).toBe('none');
    expect(r1.reason).toBe('no_image_input');
    expect(r1.meta.tookMs).toBe(0);
  });

  it('heuristic provider matches maize from a clear filename', async () => {
    const fakeFile = mockFile('maize-field-IMG_0023.jpg');
    const r = await detectCrop(fakeFile);
    expect(r.provider).toBe('heuristic');
    expect(r.candidates.length).toBe(1);
    expect(r.candidates[0].cropKey).toBe('maize');
    // Confidence capped well below MIN_CONFIDENT so UI routes through confirm:
    expect(r.candidates[0].confidence).toBeLessThan(0.6);
  });

  it('heuristic matches synonyms via the alias table (corn → maize)', async () => {
    const r = await detectCrop(mockFile('field_of_corn.png'));
    expect(r.candidates[0] && r.candidates[0].cropKey).toBe('maize');
  });

  it('heuristic returns no best when filename gives no signal (manual fallback)', async () => {
    const r = await detectCrop(mockFile('IMG_0023.jpg'));
    expect(r.best).toBeNull();
    expect(r.reason).toBe('heuristic_no_match');
    expect(r.candidates).toEqual([]);
  });

  it('best is null whenever top confidence < MIN_CONFIDENT threshold', async () => {
    // Heuristic caps at 0.45, so there is NEVER a best — always routes
    // to confirm / manual picker.
    const r = await detectCrop(mockFile('maize.jpg'));
    expect(r.best).toBeNull();
    expect(r.candidates[0].confidence).toBeLessThan(detectorInternal.MIN_CONFIDENT);
  });

  it('identify() returns the best candidate or null', async () => {
    expect(await identify(null)).toBeNull();
    expect(await identify(mockFile('maize.jpg'))).toBeNull(); // 0.45 < 0.6
  });

  it('result shape is frozen end-to-end', async () => {
    const r = await detectCrop(mockFile('tomato.webp'));
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.candidates)).toBe(true);
    if (r.candidates.length) expect(Object.isFrozen(r.candidates[0])).toBe(true);
  });

  it('provider registry exposes heuristic + default lookup works', () => {
    expect(listProviders()).toContain('heuristic');
    expect(getActiveProvider('heuristic').name).toBe('heuristic');
    // Unknown name falls back to default, never throws
    expect(getActiveProvider('made-up').name).toBe('heuristic');
  });

  it('meta captures filename + size for upstream analytics', async () => {
    const f = mockFile('cassava-near-ridges.jpg', 12345);
    const r = await detectCrop(f);
    expect(r.meta.filename).toBe('cassava-near-ridges.jpg');
    expect(r.meta.sizeBytes).toBe(12345);
    expect(r.meta.tookMs).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
function mockFile(name, size = 4096) {
  // Minimal File-shaped object — enough for the heuristic + meta
  // extractor which only read name/size/type.
  return {
    name,
    size,
    type: name.endsWith('.png') ? 'image/png'
        : name.endsWith('.webp') ? 'image/webp'
        : 'image/jpeg',
  };
}
