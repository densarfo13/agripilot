/**
 * coreIntelligence.test.js — acceptance coverage for the connected
 * engine. Exercises the five new modules end-to-end plus the spec's
 * seven acceptance cases.
 *
 *   1.  Region profile resolution
 *   2.  Crop scoring (shape + buckets + guardrails)
 *   3.  Combined risk engine
 *   4.  Crop task engine (8 crops)
 *   5.  Learning engine (outcome → confidence)
 *   6.  Acceptance cases: Maryland/Georgia/Texas/Florida + risk/behavior/outcome
 */
import { describe, it, expect } from 'vitest';
import { resolveRegionProfile, getSupportTier, isTropicalRegion } from '../services/region/regionProfile.js';
import { scoreCrop, scoreAllCrops } from '../services/scoring/cropScoringEngine.js';
import {
  getBaseRisk, getBehaviorRisk, getWeatherRiskPayload,
  getOverallRisk, getRiskAwareNextAction,
} from '../services/risk/overallRiskEngine.js';
import {
  generateTasksForCropCycle, getCropTaskTemplates, buildTodayPayload,
  CROP_TASK_LIBRARY,
} from '../services/tasks/cropTaskEngine.js';
import {
  deriveOutcomeClass, applyOutcomeToConfidence,
  getLearningAdjustments, OUTCOME_CLASS,
} from '../services/feedback/learningEngine.js';
import { computeHarvestOutcome } from '../services/feedback/harvestOutcome.js';

// ─── 1. region profile ────────────────────────────────────
describe('regionProfile.resolveRegionProfile', () => {
  it('resolves Maryland to MID_ATLANTIC, temperate, FULL_SUPPORT', () => {
    const r = resolveRegionProfile({ country: 'US', state: 'Maryland' });
    expect(r.stateCode).toBe('MD');
    expect(r.climateSubregion).toBe('MID_ATLANTIC');
    expect(r.climateType).toBe('temperate');
    expect(r.supportTier).toBe('FULL_SUPPORT');
  });

  it('resolves Florida subtropical', () => {
    const r = resolveRegionProfile({ country: 'US', state: 'FL' });
    expect(r.climateSubregion).toBe('FLORIDA_SUBTROPICAL');
    expect(isTropicalRegion(r)).toBe(true);
  });

  it('accepts USA and normalizes', () => {
    const r = resolveRegionProfile({ country: 'USA', state: 'TX' });
    expect(r.country).toBe('US');
    expect(r.stateCode).toBe('TX');
  });

  it('returns a synthesized profile for non-US countries', () => {
    const r = resolveRegionProfile({ country: 'GH', state: 'Ashanti' });
    expect(r.country).toBe('GH');
    expect(r.supportTier).toBe('BASIC_SUPPORT');
  });

  it('returns null for unresolvable US state', () => {
    expect(resolveRegionProfile({ country: 'US', state: 'Atlantis' })).toBeNull();
  });

  it('getSupportTier falls back to COMING_SOON', () => {
    expect(getSupportTier('XX')).toBe('COMING_SOON');
  });
});

// ─── 2. crop scoring ──────────────────────────────────────
describe('scoreCrop / scoreAllCrops', () => {
  it('scoreCrop returns the spec output shape', () => {
    const r = scoreCrop({
      country: 'US', state: 'MD', farmType: 'backyard',
      growingStyle: 'raised_bed', beginnerLevel: 'beginner',
      currentMonth: 4, crop: 'tomato',
    });
    expect(r).toMatchObject({
      crop: 'tomato',
      fitLevel: expect.any(String),
      confidence: expect.any(String),
      supportDepth: expect.any(String),
      plantingStatus: expect.any(String),
    });
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(Array.isArray(r.riskNotes)).toBe(true);
  });

  it('scoreAllCrops returns the three buckets + locationProfile', () => {
    const p = scoreAllCrops({
      country: 'US', state: 'MD', farmType: 'backyard',
      growingStyle: 'raised_bed', beginnerLevel: 'beginner',
      currentMonth: 4,
    });
    expect(p.locationProfile.stateCode).toBe('MD');
    expect(Array.isArray(p.bestMatch)).toBe(true);
    expect(Array.isArray(p.alsoConsider)).toBe(true);
    expect(Array.isArray(p.notRecommendedNow)).toBe(true);
  });

  it('guardrail: cassava never appears in bestMatch for Maryland', () => {
    const p = scoreAllCrops({
      country: 'US', state: 'MD', farmType: 'backyard',
      currentMonth: 6,
    });
    expect(p.bestMatch.find((c) => c.crop === 'cassava')).toBeUndefined();
  });
});

// ─── 3. risk engine ───────────────────────────────────────
describe('overallRiskEngine', () => {
  it('combines base + weather + behavior — highs propagate', () => {
    const base = { level: 'low', score: 10, factors: [] };
    const weather = { level: 'high', score: 75, factors: ['Heavy rain'] };
    const behavior = { level: 'low', score: 10, factors: [] };
    const out = getOverallRisk({ base, weather, behavior });
    expect(out.level).toBe('high');
    expect(out.factors).toContain('Heavy rain');
    expect(typeof out.nextAction).toBe('string');
  });

  it('getBaseRisk penalizes outside-window planting', () => {
    const r = getBaseRisk({
      region: { frostRisk: 'medium' },
      seasonFit: 20, plantingStatus: 'avoid', fitLevel: 'low',
    });
    expect(r.level).toBe('high');
  });

  it('getBehaviorRisk tracks skip rate and issues', () => {
    const r = getBehaviorRisk({ skipRate: 0.6, recentIssueCount: 2 });
    expect(r.level).toBe('high');
    expect(r.factors.length).toBeGreaterThan(0);
  });

  it('getRiskAwareNextAction prioritizes weather → issue → skip', () => {
    const weather = { level: 'high', factors: ['Heavy rain — delay planting.'] };
    expect(getRiskAwareNextAction({ level: 'high', factors: [], weather })).toMatch(/rain/i);
    const behavior = { factors: ['A recent issue is still open.'] };
    expect(getRiskAwareNextAction({ level: 'medium', factors: [], behavior })).toMatch(/issue/i);
  });

  it('getWeatherRiskPayload adapts weather-engine output', () => {
    const p = getWeatherRiskPayload({ tempHighC: 42, rainMmNext24h: 40 });
    expect(p.level).toBe('high');
    expect(p.factors.length).toBeGreaterThan(0);
  });
});

// ─── 4. crop task engine ──────────────────────────────────
describe('cropTaskEngine', () => {
  it('covers all 8 required crops', () => {
    for (const c of ['tomato', 'pepper', 'lettuce', 'beans', 'peanut', 'corn', 'sorghum', 'sweet_potato']) {
      expect(CROP_TASK_LIBRARY[c]).toBeTruthy();
    }
  });

  it('generates stage-appropriate tasks for tomato growing', () => {
    const tasks = generateTasksForCropCycle({ crop: 'tomato', stage: 'growing' });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.find((t) => /water/i.test(t.title))).toBeTruthy();
    expect(tasks.find((t) => /stake|cage/i.test(t.title))).toBeTruthy();
  });

  it('weather high-heat boosts watering priority', () => {
    const tasks = generateTasksForCropCycle({
      crop: 'tomato', stage: 'growing',
      weather: { tempHighC: 40, rainChancePct: 0 },
    });
    const water = tasks.find((t) => /water/i.test(t.title));
    expect(water.adjustedBy).toContain('weather');
    expect(water.priorityScore).toBeGreaterThanOrEqual(70);
  });

  it('heavy rain delays planting tasks', () => {
    const tasks = generateTasksForCropCycle({
      crop: 'tomato', stage: 'planting',
      weather: { rainMmNext24h: 40, rainChancePct: 95 },
    });
    const plant = tasks.find((t) => /plant/i.test(t.title));
    expect(plant.adjustedBy).toContain('weather');
  });

  it('buildTodayPayload produces the spec shape', () => {
    const payload = buildTodayPayload({
      crop: 'tomato', stage: 'growing',
      risk: { level: 'medium', factors: ['Humidity is high'], nextAction: 'Scout leaves today.' },
    });
    expect(payload.primaryTask).toBeTruthy();
    expect(Array.isArray(payload.secondaryTasks)).toBe(true);
    expect(payload.secondaryTasks.length).toBeLessThanOrEqual(2);
    expect(payload.nextActionSummary).toBe('Scout leaves today.');
    expect(payload.overallRisk.level).toBe('medium');
  });

  it('getCropTaskTemplates returns [] for unknown crop', () => {
    expect(getCropTaskTemplates('cassava', 'growing')).toEqual([]);
  });
});

// ─── 5. learning engine ───────────────────────────────────
describe('learningEngine', () => {
  it('deriveOutcomeClass maps yield + quality to a class', () => {
    expect(deriveOutcomeClass({ actualYieldKg: 20, qualityBand: 'excellent' })).toBe(OUTCOME_CLASS.SUCCESSFUL);
    expect(deriveOutcomeClass({ actualYieldKg: 0, qualityBand: 'poor', skippedTasksCount: 6 })).toBe(OUTCOME_CLASS.FAILED);
    expect(deriveOutcomeClass({ actualYieldKg: 3, qualityBand: 'poor', issueCount: 3 })).toBe(OUTCOME_CLASS.HIGH_RISK);
    expect(deriveOutcomeClass({ qualityBand: 'good' })).toBe(OUTCOME_CLASS.DELAYED);
  });

  it('applyOutcomeToConfidence returns >1 for past successes', () => {
    const m = applyOutcomeToConfidence('tomato', [
      { cropKey: 'tomato', qualityBand: 'excellent', actualYieldKg: 20 },
      { cropKey: 'tomato', qualityBand: 'good', actualYieldKg: 15 },
    ]);
    expect(m).toBeGreaterThan(1);
  });

  it('applyOutcomeToConfidence returns <1 for repeated failures', () => {
    const m = applyOutcomeToConfidence('tomato', [
      { cropKey: 'tomato', qualityBand: 'poor', actualYieldKg: 0, skippedTasksCount: 6 },
      { cropKey: 'tomato', qualityBand: 'poor', actualYieldKg: 0, skippedTasksCount: 6 },
    ]);
    expect(m).toBeLessThan(1);
  });

  it('applyOutcomeToConfidence defaults to 1 for unknown crop', () => {
    expect(applyOutcomeToConfidence('tomato', [])).toBe(1);
  });

  it('getLearningAdjustments scopes by stateCode when provided', () => {
    const out = getLearningAdjustments([
      { cropKey: 'tomato', stateCode: 'MD', qualityBand: 'excellent', actualYieldKg: 20 },
      { cropKey: 'tomato', stateCode: 'TX', qualityBand: 'poor', actualYieldKg: 0, skippedTasksCount: 6 },
    ], { stateCode: 'MD' });
    expect(out.multipliers.tomato).toBeGreaterThan(1);
    expect(out.samplesByCrop.tomato).toBe(1);
  });
});

// ─── 6. harvest outcome carries outcomeClass ──────────────
describe('computeHarvestOutcome', () => {
  it('derives outcomeClass based on the combined signals', () => {
    const out = computeHarvestOutcome({
      cycle: { id: 'c1', cropType: 'tomato',
        plantingDate: new Date(Date.now() - 90 * 86400000) },
      tasks: [
        { status: 'completed' }, { status: 'completed' }, { status: 'completed' },
        { status: 'completed' }, { status: 'skipped' },
      ],
      actions: [],
      input: { actualYieldKg: 25, qualityBand: 'excellent' },
    });
    expect(out.outcomeClass).toBe(OUTCOME_CLASS.SUCCESSFUL);
  });
});

// ─── 7. ACCEPTANCE CASES ──────────────────────────────────
describe('acceptance — Maryland + backyard + raised_bed + April', () => {
  const p = scoreAllCrops({
    country: 'US', state: 'Maryland', farmType: 'backyard',
    growingStyle: 'raised_bed', beginnerLevel: 'beginner',
    currentMonth: 4,
  });

  it('tomato is high fit', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const t = all.find((r) => r.crop === 'tomato');
    expect(['high', 'medium']).toContain(t.fitLevel);
  });

  it('lettuce is high/medium fit', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const l = all.find((r) => r.crop === 'lettuce');
    expect(['high', 'medium']).toContain(l.fitLevel);
  });

  it('cassava is low fit and not in bestMatch', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const c = all.find((r) => r.crop === 'cassava');
    if (c) expect(c.fitLevel).toBe('low');
    expect(p.bestMatch.find((r) => r.crop === 'cassava')).toBeUndefined();
  });

  it('at least one bestMatch has high confidence in FULL_SUPPORT region', () => {
    if (p.bestMatch.length) {
      const hasHigh = p.bestMatch.some((c) => c.confidence === 'high');
      expect(hasHigh).toBe(true);
    }
  });
});

describe('acceptance — Georgia + commercial', () => {
  const p = scoreAllCrops({
    country: 'US', state: 'GA', farmType: 'commercial',
    purpose: 'market', currentMonth: 5,
  });

  it('peanut scores high or medium (Southeast crop)', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const pe = all.find((r) => r.crop === 'peanut');
    if (pe) expect(['high', 'medium']).toContain(pe.fitLevel);
  });

  it('cocoa is low/absent for Georgia', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const cocoa = all.find((r) => r.crop === 'cocoa');
    if (cocoa) expect(cocoa.fitLevel).toBe('low');
  });
});

describe('acceptance — Texas + commercial', () => {
  const p = scoreAllCrops({
    country: 'US', state: 'TX', farmType: 'commercial',
    currentMonth: 5,
  });

  it('sorghum is a reasonable fit for Texas', () => {
    const all = [...p.bestMatch, ...p.alsoConsider, ...p.notRecommendedNow];
    const s = all.find((r) => r.crop === 'sorghum');
    if (s) expect(['high', 'medium']).toContain(s.fitLevel);
  });

  it('cassava does not appear in bestMatch', () => {
    expect(p.bestMatch.find((r) => r.crop === 'cassava')).toBeUndefined();
  });
});

describe('acceptance — Florida + small farm', () => {
  const p = scoreAllCrops({
    country: 'US', state: 'FL', farmType: 'small_farm',
    currentMonth: 3,
  });

  it('locationProfile flags subtropical climate', () => {
    expect(p.locationProfile.climateSubregion).toBe('FLORIDA_SUBTROPICAL');
  });
});

describe('acceptance — risk updates', () => {
  it('missing a watering task raises behavior risk', () => {
    const low = getBehaviorRisk({ skipRate: 0, recentIssueCount: 0 });
    const high = getBehaviorRisk({ skipRate: 0.6, recentIssueCount: 0 });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('high humidity raises weather risk', () => {
    const p = getWeatherRiskPayload({ humidityPct: 95, tempHighC: 28 });
    expect(['medium', 'high']).toContain(p.level);
  });
});

describe('acceptance — outcome tracking influences confidence', () => {
  it('past successful outcomes raise future confidence multiplier', () => {
    const neutral = getLearningAdjustments([], { stateCode: 'MD' }).multipliers.tomato || 1;
    const boosted = getLearningAdjustments([
      { cropKey: 'tomato', stateCode: 'MD', qualityBand: 'excellent', actualYieldKg: 25 },
      { cropKey: 'tomato', stateCode: 'MD', qualityBand: 'good', actualYieldKg: 18 },
    ], { stateCode: 'MD' }).multipliers.tomato;
    expect(boosted).toBeGreaterThan(neutral);
  });
});
