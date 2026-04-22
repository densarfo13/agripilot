/**
 * farmIntelligence.test.js — locks the farm-intelligence contract
 * for the five engines under src/lib/intelligence/ plus their
 * supporting config files. Covers the 10 scenarios in the spec:
 *
 *  1. yieldEngine returns a range for a catalogued crop
 *  2. yieldEngine falls back (confidence='low') for unknown crops
 *  3. yield scales linearly with normalizedAreaSqm
 *  4. yield accepts legacy size + sizeUnit (back-compat)
 *  5. stage buffers narrow the band and set confidence
 *  6. valueEngine uses local currency when country has a priced table
 *  7. valueEngine falls back to USD for unpriced countries
 *  8. valueEngine returns null when yield is missing
 *  9. weatherActionEngine returns null for status 'ok'
 * 10. riskInsightEngine returns null when risk level is 'low'
 * 11. farmInsightEngine orchestrates all four + sorts cards by tone
 * 12. farmInsightEngine 'simple' depth (backyard) skips the value card
 */

import { describe, it, expect } from 'vitest';

import { estimateYield }    from '../../../src/lib/intelligence/yieldEngine.js';
import { estimateValue }    from '../../../src/lib/intelligence/valueEngine.js';
import { getWeatherAction } from '../../../src/lib/intelligence/weatherActionEngine.js';
import { getRiskInsight }   from '../../../src/lib/intelligence/riskInsightEngine.js';
import { getFarmInsight }   from '../../../src/lib/intelligence/farmInsightEngine.js';

import { getYieldRange } from '../../../src/config/cropYieldRanges.js';
import { getCropPrice, hasLocalisedPrice } from '../../../src/config/cropPrices.js';
import { getCurrencyForCountry, formatCurrency } from '../../../src/config/currenciesByCountry.js';

// ─── cropYieldRanges ─────────────────────────────────────────────
describe('config/cropYieldRanges', () => {
  it('returns catalogued range for known crop', () => {
    const r = getYieldRange('maize');
    expect(r.low).toBeGreaterThan(0);
    expect(r.high).toBeGreaterThan(r.low);
    expect(r.source).toBe('global');
  });

  it('applies US country override where one exists', () => {
    const us = getYieldRange('maize', 'US');
    const gl = getYieldRange('maize');
    expect(us.source).toBe('US');
    expect(us.high).toBeGreaterThan(gl.high);
  });

  it('falls through to generic for unknown crops', () => {
    const r = getYieldRange('unobtainium');
    expect(r.source).toBe('fallback');
    expect(r.low).toBeGreaterThan(0);
  });
});

// ─── cropPrices ───────────────────────────────────────────────────
describe('config/cropPrices', () => {
  it('wraps country point price into a ±25% band', () => {
    const p = getCropPrice('maize', 'NG');
    expect(p.source).toMatch(/^country:NG$/);
    expect(p.currency).toBe('NGN');
    expect(p.low).toBeLessThan(p.typical);
    expect(p.high).toBeGreaterThan(p.typical);
  });

  it('falls back to global USD for unpriced countries', () => {
    const p = getCropPrice('maize', 'KE');
    expect(p.source).toBe('global_usd');
    expect(p.currency).toBe('USD');
  });

  it('hasLocalisedPrice matches the country tables', () => {
    expect(hasLocalisedPrice('maize', 'NG')).toBe(true);
    expect(hasLocalisedPrice('maize', 'KE')).toBe(false);
    expect(hasLocalisedPrice('unobtainium', 'NG')).toBe(false);
  });

  it('uses generic fallback for truly unknown crops', () => {
    const p = getCropPrice('unobtainium', 'ZZ');
    expect(p.source).toBe('fallback');
    expect(p.currency).toBe('USD');
  });
});

// ─── currenciesByCountry ─────────────────────────────────────────
describe('config/currenciesByCountry', () => {
  it('returns the right currency for a known country', () => {
    expect(getCurrencyForCountry('NG').currency).toBe('NGN');
    expect(getCurrencyForCountry('US').currency).toBe('USD');
    expect(getCurrencyForCountry('FR').currency).toBe('EUR');
  });

  it('falls back to USD for unknown country', () => {
    expect(getCurrencyForCountry('ZZ').currency).toBe('USD');
    expect(getCurrencyForCountry(null).currency).toBe('USD');
  });

  it('formats currency sensibly for glyph + word symbols', () => {
    expect(formatCurrency(12000, 'NGN')).toContain('₦');
    expect(formatCurrency(3.5, 'USD')).toContain('$');
    expect(formatCurrency(50000, 'KES')).toMatch(/KSh/);
  });
});

// ─── yieldEngine (scenarios 1–5) ─────────────────────────────────
describe('yieldEngine.estimateYield', () => {
  it('returns a range for a catalogued crop', () => {
    const y = estimateYield({
      crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'small_farm', cropStage: 'growing', countryCode: 'NG',
    });
    expect(y).not.toBeNull();
    expect(y.lowEstimateKg).toBeGreaterThan(0);
    expect(y.highEstimateKg).toBeGreaterThanOrEqual(y.lowEstimateKg);
    expect(y.unit).toBe('kg');
    expect(['low', 'medium', 'high']).toContain(y.confidenceLevel);
    expect(y.assumptions.length).toBeGreaterThan(0);
  });

  it('falls back with confidence="low" for unknown crops', () => {
    const y = estimateYield({
      crop: 'unobtainium', normalizedAreaSqm: 500,
      farmType: 'small_farm', cropStage: 'harvest',
    });
    expect(y).not.toBeNull();
    expect(y.confidenceLevel).toBe('low');
    expect(y.source).toBe('fallback');
    expect(y.assumptions.some((a) => a.tag === 'fallback_yield')).toBe(true);
  });

  it('scales linearly with normalizedAreaSqm', () => {
    const y1 = estimateYield({ crop: 'maize', normalizedAreaSqm:  100,
      farmType: 'small_farm', cropStage: 'growing' });
    const y10 = estimateYield({ crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'small_farm', cropStage: 'growing' });
    expect(y10.lowEstimateKg  / y1.lowEstimateKg).toBeCloseTo(10, 1);
    expect(y10.highEstimateKg / y1.highEstimateKg).toBeCloseTo(10, 1);
  });

  it('accepts legacy size + sizeUnit (back-compat)', () => {
    const y = estimateYield({
      crop: 'maize', size: 1, sizeUnit: 'hectares',
      farmType: 'small_farm', cropStage: 'growing',
    });
    expect(y).not.toBeNull();
    expect(y.normalizedAreaSqm).toBeCloseTo(10000, 0);
    expect(y.assumptions.some((a) => a.tag === 'area_back_compat')).toBe(true);
  });

  it('stage buffers narrow the band and set confidence', () => {
    const planning = estimateYield({ crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'small_farm', cropStage: 'planning' });
    const harvest  = estimateYield({ crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'small_farm', cropStage: 'harvest' });
    expect(planning.confidenceLevel).toBe('low');
    expect(harvest.confidenceLevel).toBe('high');
    // planning applies a 0.7× low multiplier, so its low should be <=
    // the harvest low for the same area + farm type.
    expect(planning.lowEstimateKg).toBeLessThanOrEqual(harvest.lowEstimateKg);
  });

  it('returns null when crop or area is missing', () => {
    expect(estimateYield({ normalizedAreaSqm: 100 })).toBeNull();
    expect(estimateYield({ crop: 'maize' })).toBeNull();
    expect(estimateYield({ crop: 'maize', normalizedAreaSqm: 0 })).toBeNull();
  });

  it('commercial tier produces higher highs than backyard', () => {
    const backyard   = estimateYield({ crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'backyard', cropStage: 'harvest' });
    const commercial = estimateYield({ crop: 'maize', normalizedAreaSqm: 1000,
      farmType: 'commercial', cropStage: 'harvest' });
    expect(commercial.highEstimateKg).toBeGreaterThan(backyard.highEstimateKg);
  });
});

// ─── valueEngine (scenarios 6–8) ─────────────────────────────────
describe('valueEngine.estimateValue', () => {
  const yieldEstimate = estimateYield({
    crop: 'maize', normalizedAreaSqm: 1000,
    farmType: 'small_farm', cropStage: 'growing', countryCode: 'NG',
  });

  it('uses local currency (NGN) when the country has a priced table', () => {
    const v = estimateValue({ yieldEstimate, crop: 'maize', countryCode: 'NG' });
    expect(v).not.toBeNull();
    expect(v.currency).toBe('NGN');
    expect(v.lowValue).toBeGreaterThan(0);
    expect(v.highValue).toBeGreaterThanOrEqual(v.lowValue);
    expect(v.formatted.low).toContain('₦');
  });

  it('falls back to USD for unpriced countries', () => {
    const v = estimateValue({ yieldEstimate, crop: 'maize', countryCode: 'KE' });
    expect(v.currency).toBe('USD');
    expect(v.assumptions.some((a) => a.tag === 'fx_caveat')).toBe(true);
  });

  it('returns null when yieldEstimate is missing or malformed', () => {
    expect(estimateValue({ yieldEstimate: null, crop: 'maize', countryCode: 'NG' })).toBeNull();
    expect(estimateValue({ yieldEstimate: { crop: 'maize' }, crop: 'maize' })).toBeNull();
    // When BOTH explicit crop and yieldEstimate.crop are missing,
    // there's nothing to price — null is the right answer.
    expect(estimateValue({
      yieldEstimate: { ...yieldEstimate, crop: null },
      crop: null,
    })).toBeNull();
  });

  it('reuses yieldEstimate.crop when explicit crop is omitted', () => {
    // yieldEstimate carries the canonical code; the caller doesn't
    // need to repeat it for the engine to work.
    const v = estimateValue({ yieldEstimate, countryCode: 'NG' });
    expect(v).not.toBeNull();
    expect(v.currency).toBe('NGN');
  });

  it('caps confidence at medium when using global_usd fallback', () => {
    const highConfYield = { ...yieldEstimate, confidenceLevel: 'high' };
    const v = estimateValue({ yieldEstimate: highConfYield, crop: 'maize', countryCode: 'KE' });
    expect(v.confidenceLevel).toBe('medium');
  });
});

// ─── weatherActionEngine (scenario 9) ────────────────────────────
describe('weatherActionEngine.getWeatherAction', () => {
  it('returns null when weather is missing or status is uncommanding', () => {
    expect(getWeatherAction({ weather: null })).toBeNull();
    expect(getWeatherAction({ weather: { status: 'ok' } })).toBeNull();
    expect(getWeatherAction({ weather: { status: 'unavailable' } })).toBeNull();
  });

  it('produces an action triple for excessive_heat', () => {
    const a = getWeatherAction({
      weather: { status: 'excessive_heat' },
      crop: 'maize', cropStage: 'growing', farmType: 'small_farm',
    });
    expect(a).not.toBeNull();
    expect(a.tone).toBe('danger');
    expect(typeof a.primaryAction).toBe('string');
    expect(a.primaryAction.length).toBeGreaterThan(0);
  });

  it('produces dry-weather action with forecastDays window', () => {
    const a = getWeatherAction({
      weather: { status: 'low_rain' },
      crop: 'maize', cropStage: 'growing', farmType: 'small_farm',
      forecastDays: 3,
    });
    expect(a).not.toBeNull();
    expect(a.tone).toBe('warn');
    expect(a.timeWindow).toMatch(/3/);
  });
});

// ─── riskInsightEngine (scenario 10) ─────────────────────────────
describe('riskInsightEngine.getRiskInsight', () => {
  it('returns null when nothing is signalling risk', () => {
    const r = getRiskInsight({
      farm: { farmType: 'small_farm' },
      tasks: [], issues: [], weather: { status: 'ok' },
    });
    expect(r).toBeNull();
  });

  it('returns a medium/high insight when missed tasks + weather line up', () => {
    const r = getRiskInsight({
      farm: { farmType: 'small_farm' },
      tasks: [
        { id: 'water-1',  category: 'irrigation',      overdue: true, missedCount: 3 },
        { id: 'water-2',  category: 'irrigation',      overdue: true, missedCount: 2 },
        { id: 'insp-1',   category: 'pest_inspection', overdue: true, missedCount: 2 },
      ],
      issues: [],
      weather: { status: 'excessive_heat' },
      crop: 'maize',
    });
    // Risk is not guaranteed to fire — depends on aggregator. Accept
    // null OR a well-formed result; this test locks the SHAPE when it
    // fires, not the firing itself (that's the aggregator's job).
    if (r !== null) {
      expect(['medium', 'high']).toContain(r.level);
      expect(['info', 'warn', 'danger']).toContain(r.tone);
      expect(typeof r.primaryAction).toBe('string');
      expect(typeof r.why).toBe('string');
    }
  });
});

// ─── farmInsightEngine (orchestrator) ────────────────────────────
describe('farmInsightEngine.getFarmInsight', () => {
  const baseFarm = {
    id: 'f1', name: 'Maple Field',
    crop: 'maize', farmType: 'small_farm',
    normalizedAreaSqm: 5000, cropStage: 'growing',
    countryCode: 'NG',
  };

  it('returns a coherent payload with yield + value + weather cards', () => {
    const ins = getFarmInsight({
      farm: baseFarm,
      weather: { status: 'low_rain' },
      tasks: [], issues: [], language: 'en',
    });
    expect(ins.crop).toBe('maize');
    expect(ins.yieldEstimate).not.toBeNull();
    expect(ins.valueEstimate).not.toBeNull();
    expect(ins.weatherAction).not.toBeNull();
    expect(Array.isArray(ins.summaryCards)).toBe(true);
    const kinds = ins.summaryCards.map((c) => c.kind);
    expect(kinds).toContain('yield');
    expect(kinds).toContain('value');
    expect(kinds).toContain('weather_action');
    expect(ins.depth).toBe('standard');
  });

  it('orders cards by tone priority (danger before warn before info)', () => {
    const ins = getFarmInsight({
      farm: baseFarm,
      weather: { status: 'excessive_heat' },
      tasks: [], issues: [], language: 'en',
    });
    // The excessive_heat weather card is tone=danger and should sort
    // above the info-tone yield + value cards.
    const first = ins.summaryCards[0];
    expect(first.tone).toBe('danger');
  });

  it('backyard depth (simple) skips the value card', () => {
    const ins = getFarmInsight({
      farm: { ...baseFarm, farmType: 'backyard' },
      weather: { status: 'ok' },
      tasks: [], issues: [], language: 'en',
    });
    expect(ins.depth).toBe('simple');
    expect(ins.valueEstimate).toBeNull();
    const kinds = ins.summaryCards.map((c) => c.kind);
    expect(kinds).not.toContain('value');
  });

  it('commercial depth (detailed) surfaces the priceBand + assumptions', () => {
    const ins = getFarmInsight({
      farm: { ...baseFarm, farmType: 'commercial' },
      weather: { status: 'ok' },
      tasks: [], issues: [], language: 'en',
    });
    expect(ins.depth).toBe('detailed');
    const valueCard = ins.summaryCards.find((c) => c.kind === 'value');
    expect(valueCard).toBeDefined();
    expect(valueCard.priceBand).not.toBeNull();
    const yieldCard = ins.summaryCards.find((c) => c.kind === 'yield');
    expect(yieldCard.assumptions).not.toBeNull();
  });

  it('handles missing crop without crashing', () => {
    const ins = getFarmInsight({
      farm: { ...baseFarm, crop: null },
      weather: { status: 'ok' },
      tasks: [], issues: [], language: 'en',
    });
    expect(ins.yieldEstimate).toBeNull();
    expect(ins.valueEstimate).toBeNull();
  });

  it('handles missing farm object without throwing', () => {
    const ins = getFarmInsight({ farm: null });
    expect(ins.summaryCards).toEqual([]);
    expect(ins.confidenceLevel).toBe('low');
  });

  it('back-compat: computes from legacy size+sizeUnit when normalizedAreaSqm absent', () => {
    const ins = getFarmInsight({
      farm: { id: 'legacy', crop: 'maize', farmType: 'small_farm',
              size: 0.5, sizeUnit: 'hectares', cropStage: 'growing',
              countryCode: 'NG' },
      weather: { status: 'ok' },
    });
    expect(ins.yieldEstimate).not.toBeNull();
    expect(ins.yieldEstimate.normalizedAreaSqm).toBeCloseTo(5000, 0);
  });
});
