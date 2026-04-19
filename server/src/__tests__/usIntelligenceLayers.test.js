/**
 * usIntelligenceLayers.test.js — unit tests for the four composable
 * intelligence layers (time, risk, action, market) and their
 * integration into scoreCrop.
 */
import { describe, it, expect } from 'vitest';
import { evaluateTiming } from '../domain/us/timeEngine.js';
import { assessRisks } from '../domain/us/riskEngine.js';
import { buildActionPlan } from '../domain/us/actionEngine.js';
import { assessMarket } from '../domain/us/marketEngine.js';
import { recommendCropsForUSFarm } from '../domain/us/recommend.js';

// ─── timeEngine ─────────────────────────────────────────────
describe('timeEngine.evaluateTiming', () => {
  it('plant_now when current month is inside the window', () => {
    expect(evaluateTiming({ currentMonth: 4, plantingStartMonth: 3, plantingEndMonth: 5 }).recommendation).toBe('plant_now');
  });
  it('plant_soon one month before the window opens', () => {
    expect(evaluateTiming({ currentMonth: 2, plantingStartMonth: 3, plantingEndMonth: 5 }).recommendation).toBe('plant_soon');
  });
  it('wait when the window is still far away', () => {
    expect(evaluateTiming({ currentMonth: 10, plantingStartMonth: 3, plantingEndMonth: 5 }).recommendation).toBe('wait');
  });
  it('too_late just after the window closes', () => {
    expect(evaluateTiming({ currentMonth: 6, plantingStartMonth: 3, plantingEndMonth: 5 }).recommendation).toBe('too_late');
  });
  it('handles wrap-around windows (Oct–Feb)', () => {
    expect(evaluateTiming({ currentMonth: 12, plantingStartMonth: 10, plantingEndMonth: 2 }).inWindow).toBe(true);
    expect(evaluateTiming({ currentMonth: 6, plantingStartMonth: 10, plantingEndMonth: 2 }).inWindow).toBe(false);
  });
  it('returns unknown with missing inputs', () => {
    expect(evaluateTiming({ currentMonth: null, plantingStartMonth: 3, plantingEndMonth: 5 }).recommendation).toBe('unknown');
  });
});

// ─── riskEngine ─────────────────────────────────────────────
describe('riskEngine.assessRisks', () => {
  const frostStateWinter = { frostRisk: 'high', heatBand: 'low', rainfallBand: 'medium' };
  const heatStateSummer = { frostRisk: 'low', heatBand: 'high', rainfallBand: 'medium' };
  const drylandState   = { frostRisk: 'low', heatBand: 'medium', rainfallBand: 'low' };
  const frostSensitive = { frostSensitive: true, heatTolerance: 'medium', waterNeed: 'medium' };
  const coolLoving     = { frostSensitive: false, heatTolerance: 'low', waterNeed: 'medium' };
  const thirsty        = { frostSensitive: false, heatTolerance: 'medium', waterNeed: 'high' };

  it('flags high frost risk for a frost-sensitive crop in a cold state in winter', () => {
    const r = assessRisks({ profile: frostSensitive, stateProfile: frostStateWinter, currentMonth: 1 });
    expect(r.frostRisk).toBe('high');
    expect(r.overallRisk).toBe('high');
  });
  it('flags high heat risk for a cool-loving crop in a hot state in summer', () => {
    const r = assessRisks({ profile: coolLoving, stateProfile: heatStateSummer, currentMonth: 7 });
    expect(r.heatRisk).toBe('high');
    expect(r.overallRisk).toBe('high');
  });
  it('flags high water stress for a thirsty crop in a dry zone', () => {
    const r = assessRisks({ profile: thirsty, stateProfile: drylandState, currentMonth: 6 });
    expect(r.waterStressRisk).toBe('high');
    expect(r.overallRisk).toBe('high');
  });
  it('returns low risks when everything aligns', () => {
    const safe = { frostSensitive: false, heatTolerance: 'high', waterNeed: 'low' };
    const r = assessRisks({ profile: safe, stateProfile: heatStateSummer, currentMonth: 7 });
    expect(r.overallRisk).toBe('low');
  });
});

// ─── actionEngine ───────────────────────────────────────────
describe('actionEngine.buildActionPlan', () => {
  it('produces a specialized plan for tomato and a doThisNow rooted in timing', () => {
    const plan = buildActionPlan({
      cropKey: 'tomato', cropName: 'Tomato',
      timing: { recommendation: 'plant_now' },
    });
    expect(plan.actionSteps[0].label).toMatch(/transplant|seeds|deep/i);
    expect(plan.doThisNow).toMatch(/plant your tomato/i);
    expect(plan.nextAction).toBeTruthy();
    expect(plan.weeklyGuide.length).toBeGreaterThanOrEqual(6);
  });
  it('falls back to the default template for crops without a specialized plan', () => {
    const plan = buildActionPlan({
      cropKey: 'swiss_chard', cropName: 'Swiss Chard',
      timing: { recommendation: 'plant_now' },
    });
    expect(plan.actionSteps.length).toBeGreaterThanOrEqual(5);
    expect(plan.doThisNow).toMatch(/plant your swiss chard/i);
  });
  it('shifts the doThisNow copy based on timing', () => {
    const tooLate = buildActionPlan({
      cropKey: 'okra', cropName: 'Okra', timing: { recommendation: 'too_late' },
    });
    expect(tooLate.doThisNow).toMatch(/closed|next season/i);
  });
});

// ─── marketEngine ───────────────────────────────────────────
describe('marketEngine.assessMarket', () => {
  it('maps high marketStrength → high_demand + high profitability for commercial', () => {
    const m = assessMarket({
      rule: { marketStrength: 'high' },
      farmType: 'commercial',
    });
    expect(m.marketDemand).toBe('high_demand');
    expect(m.profitability).toBe('high');
    expect(m.marketTags).toContain('high_demand');
  });
  it('backyard profitability follows localSellValue before marketStrength', () => {
    const m = assessMarket({
      rule: { marketStrength: 'low', localSellValue: 'high' },
      farmType: 'backyard',
    });
    expect(m.profitability).toBe('high');
    expect(m.marketTags).toContain('direct_market');
  });
});

// ─── Integration ────────────────────────────────────────────
describe('scoreCrop integration', () => {
  it('recommendation cards include timing / risks / actionPlan / market', () => {
    const out = recommendCropsForUSFarm({
      country: 'USA', state: 'TX', farmType: 'backyard',
      growingStyle: 'container', purpose: 'home_food',
      beginnerLevel: 'beginner', currentMonth: 4,
    });
    expect(out.ok).toBe(true);
    const top = out.bestMatch[0];
    expect(top.timing).toMatchObject({ recommendation: expect.any(String), inWindow: expect.any(Boolean) });
    expect(top.risks).toMatchObject({
      frostRisk: expect.any(String), heatRisk: expect.any(String),
      waterStressRisk: expect.any(String), overallRisk: expect.any(String),
    });
    expect(top.riskLevel).toBeTruthy();
    expect(typeof top.doThisNow).toBe('string');
    expect(Array.isArray(top.actionSteps)).toBe(true);
    expect(top.actionSteps.length).toBeGreaterThan(0);
    expect(Array.isArray(top.weeklyGuide)).toBe(true);
    expect(top.marketDemand).toBeTruthy();
    expect(top.profitability).toBeTruthy();
  });
});
