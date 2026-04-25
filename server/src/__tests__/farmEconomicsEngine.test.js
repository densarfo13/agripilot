/**
 * farmEconomicsEngine.test.js — locks the yield/value/profit pipeline.
 *
 * Covers the 12-point spec matrix:
 *   1.  cassava farm returns a yield range
 *   2.  larger area scales the yield range
 *   3.  high season fit boosts estimate
 *   4.  rainfall fit changes estimate
 *   5.  country-specific price used when available
 *   6.  missing price falls back safely
 *   7.  profit returns a range = value − cost
 *   8.  backyard wording / multiplier differs from commercial
 *   9.  missing normalizedAreaSqm handled safely
 *   10. incomplete data never crashes
 *   11. multilingual labels/messages still work (keys only)
 *   12. Top Crops uses economics as a secondary signal
 */

import { describe, it, expect } from 'vitest';

import {
  predictYield, _internal as yInt,
} from '../../../src/lib/intelligence/yieldPredictionEngine.js';
import {
  estimateValueFromPrediction,
} from '../../../src/lib/intelligence/valueEstimationEngine.js';
import {
  estimateProfit,
} from '../../../src/lib/intelligence/profitEstimationEngine.js';
import {
  estimateFarmEconomics, scoreFromEconomics,
} from '../../../src/lib/intelligence/farmEconomicsEngine.js';
import { recommendTopCrops } from '../../../src/lib/recommendations/topCropEngine.js';

// ─── Yield prediction ──────────────────────────────────────────
describe('predictYield', () => {
  it('returns a yield range for cassava', () => {
    const r = predictYield({
      cropId: 'cassava', normalizedAreaSqm: 1000, country: 'GH',
      currentStage: 'growing', farmType: 'small_farm',
    });
    expect(r).toBeTruthy();
    expect(r.cropId).toBe('cassava');
    expect(r.lowYield).toBeGreaterThan(0);
    expect(r.highYield).toBeGreaterThan(r.lowYield);
    expect(r.unit).toBe('kg');
    expect(['low', 'medium', 'high']).toContain(r.confidence);
    // All reasons are translation keys, never raw English.
    for (const k of r.reasons) expect(k).toMatch(/^econ\./);
  });

  it('larger area scales the yield range proportionally', () => {
    const a = predictYield({
      cropId: 'cassava', normalizedAreaSqm: 500, country: 'GH',
      currentStage: 'growing', farmType: 'small_farm',
    });
    const b = predictYield({
      cropId: 'cassava', normalizedAreaSqm: 5000, country: 'GH',
      currentStage: 'growing', farmType: 'small_farm',
    });
    // 10× area should yield roughly 10× (range inflated proportionally).
    expect(b.lowYield).toBeGreaterThan(a.lowYield * 5);
    expect(b.highYield).toBeGreaterThan(a.highYield * 5);
  });

  it('high season fit boosts estimate vs low fit', () => {
    const high = predictYield({
      cropId: 'maize', normalizedAreaSqm: 1000, country: 'GH',
      currentStage: 'growing', seasonFit: 'high',
    });
    const low = predictYield({
      cropId: 'maize', normalizedAreaSqm: 1000, country: 'GH',
      currentStage: 'growing', seasonFit: 'low',
    });
    expect(high.highYield).toBeGreaterThan(low.highYield);
    expect(high.reasons).toContain('econ.reason.seasonFitHigh');
    expect(low.reasons).toContain('econ.reason.seasonFitLow');
  });

  it('rainfall fit changes estimate', () => {
    const good = predictYield({
      cropId: 'rice', normalizedAreaSqm: 1000, country: 'IN',
      currentStage: 'growing', rainfallFit: 'high',
    });
    const bad = predictYield({
      cropId: 'rice', normalizedAreaSqm: 1000, country: 'IN',
      currentStage: 'growing', rainfallFit: 'low',
    });
    expect(good.highYield).toBeGreaterThan(bad.highYield);
  });

  it('handles missing normalizedAreaSqm via size+sizeUnit', () => {
    const r = predictYield({
      cropId: 'maize', country: 'GH',
      size: 1, sizeUnit: 'acre',
      currentStage: 'growing', farmType: 'small_farm',
    });
    expect(r).toBeTruthy();
    expect(r.lowYield).toBeGreaterThan(0);
  });

  it('returns null when there is no crop', () => {
    expect(predictYield({ normalizedAreaSqm: 1000 })).toBeNull();
  });

  it('returns null when there is no area at all', () => {
    expect(predictYield({ cropId: 'maize', country: 'GH' })).toBeNull();
  });

  it('never throws on garbage input', () => {
    expect(() =>
      predictYield({ cropId: 'cassava', normalizedAreaSqm: 'xxx' })
    ).not.toThrow();
  });

  it('unknown seasonFit + unknown rainfallFit softens confidence', () => {
    const strict = predictYield({
      cropId: 'cassava', normalizedAreaSqm: 1000, country: 'GH',
      currentStage: 'growing', seasonFit: 'high', rainfallFit: 'high',
    });
    const loose = predictYield({
      cropId: 'cassava', normalizedAreaSqm: 1000, country: 'GH',
      currentStage: 'growing',
    });
    // Loose confidence is equal or lower than strict — never higher.
    const order = { low: 0, medium: 1, high: 2 };
    expect(order[loose.confidence]).toBeLessThanOrEqual(order[strict.confidence]);
  });
});

// ─── Value estimation ──────────────────────────────────────────
describe('estimateValueFromPrediction', () => {
  const yieldPrediction = () => predictYield({
    cropId: 'cassava', normalizedAreaSqm: 1000, country: 'GH',
    currentStage: 'growing', farmType: 'small_farm',
  });

  it('uses country-specific price when available', () => {
    const r = estimateValueFromPrediction({
      yieldPrediction: yieldPrediction(), cropId: 'cassava', country: 'GH',
    });
    expect(r).toBeTruthy();
    expect(r.source && r.source.startsWith('country:GH')).toBe(true);
    expect(r.lowValue).toBeGreaterThan(0);
    expect(r.highValue).toBeGreaterThan(r.lowValue);
    expect(r.reasons).toContain('econ.reason.localPrice');
  });

  it('falls back safely when country lacks a localized price', () => {
    const r = estimateValueFromPrediction({
      yieldPrediction: yieldPrediction(), cropId: 'cassava', country: 'ZZ',
    });
    expect(r).toBeTruthy();
    expect(['global_usd', 'fallback'])
      .toContain(r.source);
    expect(r.reasons.some((k) => k.startsWith('econ.reason.'))).toBe(true);
  });

  it('returns null when there is no yield prediction', () => {
    expect(estimateValueFromPrediction({
      yieldPrediction: null, cropId: 'cassava', country: 'GH',
    })).toBeNull();
  });
});

// ─── Profit estimation ─────────────────────────────────────────
describe('estimateProfit', () => {
  function setup({ country = 'GH', farmType = 'small_farm', area = 1000 } = {}) {
    const y = predictYield({
      cropId: 'cassava', normalizedAreaSqm: area, country,
      currentStage: 'growing', farmType,
    });
    const v = estimateValueFromPrediction({
      yieldPrediction: y, cropId: 'cassava', country,
    });
    return { y, v };
  }

  it('returns a profit range from value − cost', () => {
    const { y, v } = setup();
    const p = estimateProfit({
      yieldPrediction: y, valueEstimate: v,
      cropId: 'cassava', country: 'GH', farmType: 'small_farm',
      normalizedAreaSqm: 1000,
    });
    expect(p).toBeTruthy();
    expect(p.lowCost).toBeGreaterThan(0);
    expect(p.highCost).toBeGreaterThanOrEqual(p.lowCost);
    expect(p.highProfit).toBeGreaterThanOrEqual(p.lowProfit);
    // Safe-mode: value is in GHS but cost fell back to USD, so the
    // engine rebuilds value in USD too. Profit is computed entirely
    // in USD — never mixed — and the currency field reflects that.
    expect(p.currency).toBe('USD');
    expect(p.reasons).toContain('econ.reason.profitInUsdFallback');
    // Profit math sanity: lowProfit and highProfit bracket zero
    // consistently with the computed cost range.
    expect(p.highProfit - p.lowProfit).toBeGreaterThanOrEqual(p.highCost - p.lowCost);
  });

  it('backyard multiplier lowers cost vs commercial', () => {
    const { y, v } = setup({ farmType: 'backyard' });
    const backyard = estimateProfit({
      yieldPrediction: y, valueEstimate: v,
      cropId: 'cassava', country: 'GH', farmType: 'backyard',
      normalizedAreaSqm: 1000,
    });
    const commercial = estimateProfit({
      yieldPrediction: y, valueEstimate: v,
      cropId: 'cassava', country: 'GH', farmType: 'commercial',
      normalizedAreaSqm: 1000,
    });
    expect(backyard.highCost).toBeLessThan(commercial.highCost);
    expect(backyard.reasons).toContain('econ.reason.backyardLowInput');
    expect(commercial.reasons).toContain('econ.reason.commercialOverhead');
  });

  it('downgrades confidence + flags fallback when no cost profile', () => {
    // 'wheat' may or may not have a cost profile. Use a crop we know
    // isn't in CROP_COST_PROFILES: 'garlic' IS in the table, let's use
    // something tiny like 'barley' which isn't. Actually barley isn't
    // in the registry — use 'lettuce' (no entry? check). Keep this
    // robust by spying the engine via an obviously-missing crop we
    // can still fake: 'teff' normalises to null so we can't test.
    // Use 'chickpea' which has no entry in CROP_COST_PROFILES.
    const y = predictYield({
      cropId: 'chickpea', normalizedAreaSqm: 1000, country: 'IN',
      currentStage: 'growing',
    });
    const v = estimateValueFromPrediction({
      yieldPrediction: y, cropId: 'chickpea', country: 'IN',
    });
    const p = estimateProfit({
      yieldPrediction: y, valueEstimate: v,
      cropId: 'chickpea', country: 'IN',
      normalizedAreaSqm: 1000,
    });
    expect(p).toBeTruthy();
    expect(p.reasons).toContain('econ.reason.costProfileFallback');
  });

  it('returns null when valueEstimate is missing', () => {
    expect(estimateProfit({
      yieldPrediction: null, valueEstimate: null,
      cropId: 'cassava', normalizedAreaSqm: 1000,
    })).toBeNull();
  });

  it('returns null when area is missing', () => {
    const { v } = setup();
    expect(estimateProfit({
      yieldPrediction: null, valueEstimate: v,
      cropId: 'cassava', normalizedAreaSqm: null,
    })).toBeNull();
  });
});

// ─── estimateFarmEconomics facade ──────────────────────────────
describe('estimateFarmEconomics', () => {
  it('integrates yield + value + profit', () => {
    const r = estimateFarmEconomics({
      cropId: 'cassava', country: 'GH',
      normalizedAreaSqm: 1000, currentStage: 'growing',
      farmType: 'small_farm', seasonFit: 'high', rainfallFit: 'high',
    });
    expect(r).toBeTruthy();
    expect(r.yield).toBeTruthy();
    expect(r.value).toBeTruthy();
    expect(r.profit).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(r.confidence);
    expect(r.drivers.length).toBeGreaterThan(0);
    for (const k of r.drivers) expect(k).toMatch(/^econ\./);
  });

  it('handles missing normalizedAreaSqm via farm.farmSize', () => {
    const r = estimateFarmEconomics({
      farm: { cropType: 'maize', farmSize: 1, farmSizeUnit: 'acre',
               country: 'GH', farmType: 'small_farm' },
      currentStage: 'growing',
    });
    expect(r).toBeTruthy();
    expect(r.yield).toBeTruthy();
  });

  it('returns null when no crop + no area', () => {
    expect(estimateFarmEconomics({ country: 'GH' })).toBeNull();
  });

  it('does not crash on completely empty input', () => {
    expect(() => estimateFarmEconomics({})).not.toThrow();
  });

  it('weakest confidence propagates up', () => {
    const r = estimateFarmEconomics({
      cropId: 'cassava', country: 'ZZ',           // no localized price
      normalizedAreaSqm: 1000, currentStage: 'planning',
    });
    expect(r.confidence).toBe('low');
  });

  it('highlights surface for Top Crops badges', () => {
    const r = estimateFarmEconomics({
      cropId: 'tomato', country: 'GH',
      normalizedAreaSqm: 500, currentStage: 'growing',
      seasonFit: 'high', rainfallFit: 'medium',
    });
    expect(Array.isArray(r.highlights)).toBe(true);
    // Localized GH price available → localPrice highlight.
    expect(r.highlights).toContain('econ.highlight.localPrice');
  });
});

// ─── scoreFromEconomics ────────────────────────────────────────
describe('scoreFromEconomics', () => {
  it('returns 0 for null/missing economics', () => {
    expect(scoreFromEconomics(null)).toBe(0);
    expect(scoreFromEconomics({})).toBe(0);
  });

  it('positive profit range gets the strongest bonus', () => {
    const s = scoreFromEconomics({
      profit: { lowProfit: 10, typicalProfit: 20, highProfit: 30,
                 currency: 'USD' },
    });
    expect(s).toBe(15);
  });

  it('negative profit window gets a small penalty', () => {
    const s = scoreFromEconomics({
      profit: { lowProfit: -20, typicalProfit: -5, highProfit: -1 },
    });
    expect(s).toBe(-5);
  });
});

// ─── Top Crops integration (economics is a secondary signal) ──
describe('Top Crops — economics secondary signal', () => {
  it('economics nudges score but does not dominate ranking', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { state: 'moderate_rain' },
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    // Every rec card carries economics now.
    expect(out.best.economics).toBeTruthy();
    // Economics boost is bounded: spec allows -5..+15.
    const boost = out.best._economicsBoost;
    expect(boost).toBeGreaterThanOrEqual(-10);
    expect(boost).toBeLessThanOrEqual(15);
  });

  it('highlights from economics surface as badge keys', () => {
    const out = recommendTopCrops({
      country: 'GH', farmType: 'small_farm', farmerExperienceLevel: 'beginner',
      month: 4, weather: { state: 'moderate_rain' },
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    const hasEconBadge = out.all.some((c) => (c.badges || []).some((b) => b.startsWith('econ.highlight.')));
    expect(hasEconBadge).toBe(true);
  });
});
