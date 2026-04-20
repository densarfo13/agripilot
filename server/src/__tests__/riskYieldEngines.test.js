/**
 * riskYieldEngines.test.js — contract for the three
 * prediction helpers: risk engine, yield engine, farmer
 * banner builder.
 */

import { describe, it, expect } from 'vitest';

// CommonJS modules
import riskPkg from '../../../server/src/modules/ngoAdmin/riskEngine.js';
const { calculateRisk, calculateRiskLevel } = riskPkg;

import yieldPkg from '../../../server/src/modules/ngoAdmin/yieldEngine.js';
const { estimateYield, estimateYieldNumber, yieldHasDropped } = yieldPkg;

import {
  buildFarmerAlertBanners, yieldDropPercent,
} from '../../../src/core/farm/riskYieldBanners.js';

// ─── calculateRisk ───────────────────────────────────────────
describe('calculateRisk', () => {
  it('low by default when nothing is set', () => {
    const r = calculateRisk({});
    expect(r.level).toBe('low');
    expect(r.score).toBe(0);
    expect(r.reasons).toEqual([]);
  });

  it('rain expected adds 20', () => {
    const r = calculateRisk({ weather: { rainExpected: true } });
    expect(r.score).toBe(20);
    expect(r.reasons).toContain('risk.reason.rain_expected');
  });

  it('extreme heat adds 20', () => {
    const r = calculateRisk({ weather: { extremeHeat: true } });
    expect(r.score).toBe(20);
  });

  it('drought also adds 20 (richer than spec)', () => {
    const r = calculateRisk({ weather: { drought: true } });
    expect(r.score).toBe(20);
    expect(r.reasons).toContain('risk.reason.drought');
  });

  it('low completion (<0.3) adds 40', () => {
    const r = calculateRisk({ completionRate: 0.1 });
    expect(r.score).toBe(40);
    expect(r.reasons).toContain('risk.reason.low_completion');
  });

  it('mid completion (<0.6) adds 20', () => {
    const r = calculateRisk({ completionRate: 0.5 });
    expect(r.score).toBe(20);
    expect(r.reasons).toContain('risk.reason.mid_completion');
  });

  it('high completion adds nothing', () => {
    expect(calculateRisk({ completionRate: 0.9 }).score).toBe(0);
  });

  it('planting stage adds 20', () => {
    const r = calculateRisk({ stage: 'planting' });
    expect(r.score).toBe(20);
    expect(r.reasons).toContain('risk.reason.stage_sensitive');
  });

  it('flowering + harvest are stage-sensitive too', () => {
    expect(calculateRisk({ stage: 'flowering' }).score).toBe(20);
    expect(calculateRisk({ stage: 'harvest'   }).score).toBe(20);
  });

  it('level thresholds: <40 low, 40-69 medium, ≥70 high', () => {
    expect(calculateRisk({}).level).toBe('low');
    expect(calculateRisk({ weather: { rainExpected: true }, completionRate: 0.5, stage: null }).level).toBe('medium');
    expect(calculateRisk({ weather: { rainExpected: true, extremeHeat: true }, completionRate: 0.1, stage: 'planting' }).level).toBe('high');
  });

  it('score is clamped to 0..100', () => {
    const r = calculateRisk({
      weather: { rainExpected: true, extremeHeat: true, drought: true },
      completionRate: 0.1, stage: 'planting',
    });
    // 20 + 20 + 20 + 40 + 20 = 120, but clamped at 100.
    expect(r.score).toBe(100);
  });

  it('returns frozen result', () => {
    const r = calculateRisk({});
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.reasons)).toBe(true);
  });

  it('calculateRiskLevel is spec-compatible string return', () => {
    expect(calculateRiskLevel({})).toBe('low');
    expect(calculateRiskLevel({
      weather: { rainExpected: true }, completionRate: 0.1, stage: 'planting',
    })).toBe('high');
  });

  it('safe on null / missing weather', () => {
    expect(calculateRisk({ weather: null }).score).toBe(0);
    expect(calculateRisk({ weather: 'bad' }).score).toBe(0);
  });
});

// ─── estimateYield ───────────────────────────────────────────
describe('estimateYield', () => {
  it('default baseline 100 × completion=1 = 100', () => {
    expect(estimateYield({ completionRate: 1 }).estimated).toBe(100);
  });

  it('cassava baseline 120', () => {
    expect(estimateYield({ crop: 'cassava', completionRate: 1 }).estimated).toBe(120);
    // case insensitive
    expect(estimateYield({ crop: 'CASSAVA', completionRate: 1 }).estimated).toBe(120);
  });

  it('maize baseline 90', () => {
    expect(estimateYield({ crop: 'maize', completionRate: 1 }).estimated).toBe(90);
  });

  it('rainfall > 20 → +10', () => {
    expect(estimateYield({ rainfall: 25, completionRate: 1 }).estimated).toBe(110);
  });

  it('rainfall < 10 → -20', () => {
    expect(estimateYield({ rainfall: 5, completionRate: 1 }).estimated).toBe(80);
  });

  it('rainfall in the neutral band leaves baseline alone', () => {
    expect(estimateYield({ rainfall: 15, completionRate: 1 }).estimated).toBe(100);
  });

  it('multiplies by completionRate', () => {
    expect(estimateYield({ crop: 'maize', rainfall: 15, completionRate: 0.5 }).estimated).toBe(45);
  });

  it('clamps completionRate to [0, 1]', () => {
    expect(estimateYield({ completionRate: -1 }).estimated).toBe(0);
    expect(estimateYield({ completionRate: 5 }).estimated).toBe(100);
  });

  it('baselineOverride is honored', () => {
    const r = estimateYield({ baselineOverride: 50, completionRate: 1, rainfall: 15 });
    expect(r.baseline).toBe(50);
    expect(r.estimated).toBe(50);
  });

  it('returns explainable deltas', () => {
    const r = estimateYield({ crop: 'maize', rainfall: 25, completionRate: 0.5 });
    expect(r.deltas.some((d) => d.key === 'yield.delta.rain_good')).toBe(true);
    expect(r.deltas.some((d) => d.key === 'yield.delta.completion_rate')).toBe(true);
  });

  it('estimateYieldNumber returns the spec-compatible plain number', () => {
    expect(estimateYieldNumber({ crop: 'maize', rainfall: 15, completionRate: 0.8 })).toBe(72);
  });

  it('yieldHasDropped true when estimate <80% of baseline', () => {
    expect(yieldHasDropped({ estimated: 60, baseline: 100 })).toBe(true);
    expect(yieldHasDropped({ estimated: 85, baseline: 100 })).toBe(false);
  });

  it('yieldHasDropped safe on bad input', () => {
    expect(yieldHasDropped(null)).toBe(false);
    expect(yieldHasDropped({ estimated: 50, baseline: 0 })).toBe(false);
  });
});

// ─── buildFarmerAlertBanners ─────────────────────────────────
describe('buildFarmerAlertBanners', () => {
  it('empty when risk low and yield normal', () => {
    expect(buildFarmerAlertBanners({
      risk: { level: 'low' },
      yield: { estimated: 100, baseline: 100 },
    })).toEqual([]);
  });

  it('high risk → farmer.banner.high_risk', () => {
    const banners = buildFarmerAlertBanners({
      risk: { level: 'high', reasons: ['risk.reason.low_completion'] },
    });
    expect(banners.length).toBe(1);
    expect(banners[0].key).toBe('farmer.banner.high_risk');
    expect(banners[0].severity).toBe('critical');
  });

  it('yield drop ≥ 20% → farmer.banner.yield_reduced', () => {
    const banners = buildFarmerAlertBanners({
      risk: { level: 'low' },
      yield: { estimated: 60, baseline: 100 },
    });
    expect(banners.some((b) => b.key === 'farmer.banner.yield_reduced')).toBe(true);
  });

  it('high risk + yield drop → both, risk first', () => {
    const banners = buildFarmerAlertBanners({
      risk: { level: 'high', reasons: [] },
      yield: { estimated: 50, baseline: 100 },
    });
    expect(banners[0].key).toBe('farmer.banner.high_risk');
    expect(banners[1].key).toBe('farmer.banner.yield_reduced');
  });

  it('accepts plain-number yield for spec compatibility', () => {
    const banners = buildFarmerAlertBanners({ yield: 65 });
    expect(banners[0]?.key).toBe('farmer.banner.yield_reduced');
  });

  it('medium risk + completedToday → positive nudge', () => {
    const banners = buildFarmerAlertBanners({
      risk: { level: 'medium' }, completedToday: true,
    });
    expect(banners[0]?.key).toBe('farmer.banner.on_track');
    expect(banners[0]?.severity).toBe('positive');
  });

  it('medium risk without completion → no nudge', () => {
    expect(buildFarmerAlertBanners({ risk: { level: 'medium' } })).toEqual([]);
  });

  it('accepts string-only risk (spec compatibility)', () => {
    expect(buildFarmerAlertBanners({ risk: 'high' })[0].key).toBe('farmer.banner.high_risk');
  });

  it('every banner is a frozen LocalizedPayload shape', () => {
    const banners = buildFarmerAlertBanners({
      risk: { level: 'high' }, yield: { estimated: 50, baseline: 100 },
    });
    for (const b of banners) {
      expect(Object.isFrozen(b)).toBe(true);
      expect(typeof b.key).toBe('string');
      expect(typeof b.fallback).toBe('string');
    }
  });
});

describe('yieldDropPercent', () => {
  it('0 when estimate >= baseline', () => {
    expect(yieldDropPercent(100, 100)).toBe(0);
    expect(yieldDropPercent(120, 100)).toBe(0);
  });
  it('calculates integer percent dropped', () => {
    expect(yieldDropPercent(60, 100)).toBe(40);
    expect(yieldDropPercent(50, 100)).toBe(50);
  });
  it('safe on bad input', () => {
    expect(yieldDropPercent(NaN, 100)).toBe(0);
    expect(yieldDropPercent(50, 0)).toBe(0);
  });
});
