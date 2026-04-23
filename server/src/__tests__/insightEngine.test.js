/**
 * insightEngine.test.js — locks the 10-point dashboard insight spec:
 *   1.  dry weather triggers water stress insight
 *   2.  heavy rain triggers flooding alert
 *   3.  vegetative stage shows growth task
 *   4.  low season fit triggers warning
 *   5.  high yield potential shows positive insight
 *   6.  low confidence shows warning
 *   7.  max 5 insights displayed
 *   8.  no crash with missing data
 *   9.  language switching works (keys only)
 *   10. backyard vs commercial messaging differs
 */

import { describe, it, expect } from 'vitest';
import {
  buildFarmInsights, _internal,
} from '../../../src/lib/intelligence/insightEngine.js';

// ─── Weather-based ─────────────────────────────────────────────
describe('weather insights', () => {
  it('dry + low rainfall fit → water stress warning (high priority)', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      farmType: 'small_farm',
    });
    const match = out.find((i) => i.id === 'insight.water.stress');
    expect(match).toBeTruthy();
    expect(match.type).toBe('warning');
    expect(match.priority).toBe('high');
    expect(match.messageKey).toBe('insight.water.stress.msg');
    expect(match.linkedTaskTemplateId).toBe('irrigate_crop');
  });

  it('heavy rain + low rainfall fit → flooding warning', () => {
    const out = buildFarmInsights({
      cropId: 'tomato', stage: 'flowering',
      rainfallFit: 'low', weatherState: 'heavy_rain',
      farmType: 'small_farm',
    });
    const match = out.find((i) => i.id === 'insight.flood.risk');
    expect(match).toBeTruthy();
    expect(match.type).toBe('warning');
    expect(match.priority).toBe('high');
    expect(match.linkedTaskTemplateId).toBe('check_drainage');
  });

  it('high rainfall fit → supportive info insight', () => {
    const out = buildFarmInsights({
      cropId: 'rice', stage: 'vegetative',
      rainfallFit: 'high', weatherState: 'heavy_rain',
    });
    const match = out.find((i) => i.id === 'insight.rainfall.supports');
    expect(match).toBeTruthy();
    expect(match.type).toBe('info');
  });
});

// ─── Seasonal ──────────────────────────────────────────────────
describe('seasonal insights', () => {
  it('low season fit → timing warning', () => {
    const out = buildFarmInsights({
      cropId: 'cassava', stage: 'planting',
      seasonFit: 'low',
    });
    const match = out.find((i) => i.id === 'insight.season.mismatch');
    expect(match).toBeTruthy();
    expect(match.type).toBe('warning');
    expect(match.messageKey).toBe('insight.season.mismatch.msg');
  });

  it('high season+rainfall → yield opportunity info', () => {
    const out = buildFarmInsights({
      cropId: 'cassava', stage: 'growing',
      seasonFit: 'high', rainfallFit: 'high',
    });
    const match = out.find((i) => i.id === 'insight.yield.opportunity');
    expect(match).toBeTruthy();
    expect(match.type).toBe('info');
    expect(match.priority).toBe('medium');
  });

  it('only one of season/rainfall high → softer favorable info', () => {
    const out = buildFarmInsights({
      cropId: 'cassava', stage: 'growing',
      seasonFit: 'high', rainfallFit: 'unknown',
    });
    const match = out.find((i) => i.id === 'insight.yield.favorable');
    expect(match).toBeTruthy();
  });
});

// ─── Stage-based ───────────────────────────────────────────────
describe('stage insights', () => {
  it('vegetative stage → leaf-growth action insight', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
    });
    const match = out.find((i) => i.id === 'insight.stage.vegetative');
    expect(match).toBeTruthy();
    expect(match.type).toBe('action');
    expect(match.messageKey).toMatch(/^insight\.stage\.vegetative\.msg/);
    expect(match.recommendedActionKey).toBe('insight.stage.vegetative.action');
  });

  it('harvest stage is high priority', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'harvest',
    });
    const match = out.find((i) => i.id === 'insight.stage.harvest');
    expect(match.priority).toBe('high');
  });

  it('unknown stage with known crop → generic fallback', () => {
    const out = buildFarmInsights({
      cropId: 'cassava', stage: 'made_up_stage',
    });
    // Stage key wouldn't resolve — we fall through to the generic
    // stage row instead of producing nothing.
    const stageRow = out.find((i) => i.id === 'insight.stage.generic');
    expect(stageRow).toBeTruthy();
  });

  it('no crop + no stage → still returns an insight (never empty)', () => {
    const out = buildFarmInsights({});
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].id).toBe('insight.generic.checkDaily');
  });
});

// ─── Profit ─────────────────────────────────────────────────────
describe('profit insights', () => {
  it('profitable range → strong info insight', () => {
    const out = buildFarmInsights({
      cropId: 'tomato', stage: 'fruiting',
      profitEstimate: { lowProfit: 10, highProfit: 40, currency: 'USD' },
    });
    const match = out.find((i) => i.id === 'insight.profit.strong');
    expect(match).toBeTruthy();
    expect(match.type).toBe('info');
  });

  it('negative profit range → tight profit warning', () => {
    const out = buildFarmInsights({
      cropId: 'tomato', stage: 'planting',
      profitEstimate: { lowProfit: -20, highProfit: -5, currency: 'USD' },
    });
    const match = out.find((i) => i.id === 'insight.profit.tight');
    expect(match).toBeTruthy();
    expect(match.type).toBe('warning');
  });
});

// ─── Confidence ────────────────────────────────────────────────
describe('confidence insights', () => {
  it('low confidence → info warning', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'growing', confidence: 'low',
    });
    const match = out.find((i) => i.id === 'insight.confidence.low');
    expect(match).toBeTruthy();
    expect(match.messageKey).toBe('insight.confidence.low.msg');
  });
});

// ─── Priority & capping ────────────────────────────────────────
describe('priority + capping', () => {
  it('returns at most 5 insights', () => {
    const out = buildFarmInsights({
      cropId: 'tomato', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      seasonFit: 'low',
      profitEstimate: { lowProfit: -20, highProfit: -5 },
      confidence: 'low',
    });
    expect(out.length).toBeLessThanOrEqual(_internal.MAX_INSIGHTS);
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('high priority insights sort first', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      seasonFit: 'low',
      confidence: 'low',
    });
    expect(out[0].priority).toBe('high');
    const priorities = out.map((i) => i.priority);
    const rank = (p) => ({ high: 3, medium: 2, low: 1 }[p] || 0);
    for (let i = 1; i < priorities.length; i += 1) {
      expect(rank(priorities[i - 1])).toBeGreaterThanOrEqual(rank(priorities[i]));
    }
  });

  it('deduplicates by id', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
    });
    const ids = out.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── Farm-type personalisation ─────────────────────────────────
describe('farm-type messaging', () => {
  it('backyard vs commercial produces different stage message keys', () => {
    const backyard = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative', farmType: 'backyard',
    });
    const commercial = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative', farmType: 'commercial',
    });
    const bStage = backyard.find((i) => i.id === 'insight.stage.vegetative');
    const cStage = commercial.find((i) => i.id === 'insight.stage.vegetative');
    expect(bStage.messageKey).toMatch(/\.simple$/);
    expect(cStage.messageKey).toMatch(/\.commercial$/);
  });

  it('backyard water-stress uses a simpler action', () => {
    const backyard = buildFarmInsights({
      cropId: 'tomato', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      farmType: 'backyard',
    });
    const water = backyard.find((i) => i.id === 'insight.water.stress');
    expect(water.recommendedActionKey).toBe('insight.water.stress.action.simple');
  });

  it('small_farm water-stress uses the default action', () => {
    const sf = buildFarmInsights({
      cropId: 'tomato', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      farmType: 'small_farm',
    });
    const water = sf.find((i) => i.id === 'insight.water.stress');
    expect(water.recommendedActionKey).toBe('insight.water.stress.action');
  });

  it('commercial profit uses operational copy', () => {
    const commercial = buildFarmInsights({
      cropId: 'tomato', stage: 'fruiting',
      profitEstimate: { lowProfit: 20, highProfit: 80 },
      farmType: 'commercial',
    });
    const p = commercial.find((i) => i.id === 'insight.profit.strong');
    expect(p.messageKey).toBe('insight.profit.strong.msg.commercial');
  });
});

// ─── Language safety ───────────────────────────────────────────
describe('language safety', () => {
  it('messageKey is always an i18n key, never raw English', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
      rainfallFit: 'low', weatherState: 'dry',
      seasonFit: 'low',
    });
    for (const i of out) {
      expect(i.messageKey).toMatch(/^insight\./);
      if (i.reasonKey) expect(i.reasonKey).toMatch(/^insight\./);
      if (i.recommendedActionKey) expect(i.recommendedActionKey).toMatch(/^insight\./);
    }
  });

  it('fallbackMessage is always a non-empty string', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
    });
    for (const i of out) {
      expect(typeof i.fallbackMessage).toBe('string');
      expect(i.fallbackMessage.length).toBeGreaterThan(0);
    }
  });
});

// ─── Safety nets ───────────────────────────────────────────────
describe('safety', () => {
  it('never throws on garbage input', () => {
    expect(() => buildFarmInsights(null)).not.toThrow();
    expect(() => buildFarmInsights(undefined)).not.toThrow();
    expect(() => buildFarmInsights({ cropId: 123, stage: {} })).not.toThrow();
  });

  it('returns at least one insight even with zero context', () => {
    const out = buildFarmInsights({});
    expect(out.length).toBeGreaterThan(0);
  });

  it('profit estimate with NaN is ignored safely', () => {
    const out = buildFarmInsights({
      cropId: 'maize', stage: 'vegetative',
      profitEstimate: { highProfit: NaN, lowProfit: NaN },
    });
    expect(out.some((i) => i.id.startsWith('insight.profit'))).toBe(false);
  });
});
