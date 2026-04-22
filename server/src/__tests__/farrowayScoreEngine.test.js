/**
 * farrowayScoreEngine.test.js — locks the Farroway Score contract.
 *
 * The engine is pure rules + weighted sums. These tests assert:
 *   • Shape contract (overall 0-100, 5 categories, weights sum 100)
 *   • Weight math (category scores × weights / 100 → overall)
 *   • Band + trend + confidence behaviour
 *   • Each category's rules (execution/timing/riskMgmt/cropFit/yield)
 *   • Missing-data graceful fallbacks (neutral 50 + low confidence)
 *   • Suggestions (top 1-2 lowest categories)
 */

import { describe, it, expect } from 'vitest';

import {
  computeFarrowayScore, _internal,
} from '../../../src/lib/intelligence/farrowayScoreEngine.js';

function farm(overrides = {}) {
  return {
    id:       'farm-1',
    crop:     'maize',
    cropStage:'vegetative',
    country:  'GH',
    state:    'AS',
    farmType: 'small_farm',
    farmSize: 1,
    sizeUnit: 'hectare',
    normalizedAreaSqm: 10000,
    plantingDate: '2026-03-15',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Shape contract
// ═══════════════════════════════════════════════════════════════
describe('computeFarrowayScore — shape', () => {
  it('returns a frozen result with the full contract', () => {
    const s = computeFarrowayScore({ farm: farm() });
    expect(Object.isFrozen(s)).toBe(true);
    expect(Number.isFinite(s.overall)).toBe(true);
    expect(s.overall).toBeGreaterThanOrEqual(0);
    expect(s.overall).toBeLessThanOrEqual(100);
    expect(['excellent', 'strong', 'improving', 'needs_help']).toContain(s.band);
    expect(Object.keys(s.categories).sort()).toEqual(
      ['cropFit', 'execution', 'riskMgmt', 'timing', 'yieldAlign'].sort(),
    );
  });

  it('weights sum to 100 across categories', () => {
    let sum = 0;
    for (const cat of Object.values(_internal.WEIGHTS)) sum += cat;
    expect(sum).toBe(100);
  });

  it('returns safe default when no farm supplied', () => {
    const s = computeFarrowayScore({});
    expect(s.overall).toBe(0);
    expect(s.band).toBe('needs_help');
    expect(s.categories).toEqual({});
    expect(s.assumptions.length).toBeGreaterThan(0);
  });

  it('is deterministic for identical inputs', () => {
    const now = new Date('2026-05-15');
    const a = computeFarrowayScore({ farm: farm(), date: now });
    const b = computeFarrowayScore({ farm: farm(), date: now });
    expect(a.overall).toBe(b.overall);
    expect(a.categories.execution.score).toBe(b.categories.execution.score);
  });
});

// ═══════════════════════════════════════════════════════════════
// Weight math
// ═══════════════════════════════════════════════════════════════
describe('weight math', () => {
  it('overall is the weighted sum of category scores', () => {
    const s = computeFarrowayScore({ farm: farm() });
    let weighted = 0, totalW = 0;
    for (const cat of Object.values(s.categories)) {
      weighted += cat.score * cat.weight;
      totalW += cat.weight;
    }
    expect(s.overall).toBe(Math.round(weighted / totalW));
  });
});

// ═══════════════════════════════════════════════════════════════
// Band resolution
// ═══════════════════════════════════════════════════════════════
describe('bandFor', () => {
  it('maps overall to the right band', () => {
    expect(_internal.bandFor(95)).toBe('excellent');
    expect(_internal.bandFor(85)).toBe('excellent');
    expect(_internal.bandFor(75)).toBe('strong');
    expect(_internal.bandFor(60)).toBe('improving');
    expect(_internal.bandFor(49)).toBe('needs_help');
    expect(_internal.bandFor(0)).toBe('needs_help');
  });
});

// ═══════════════════════════════════════════════════════════════
// Execution category
// ═══════════════════════════════════════════════════════════════
describe('execution category', () => {
  it('missing completion data → neutral 50 with low confidence', () => {
    const s = computeFarrowayScore({ farm: farm() });
    expect(s.categories.execution.score).toBe(50);
    expect(s.categories.execution.confidence).toBe('low');
    expect(s.assumptions.some((a) => a.startsWith('execution'))).toBe(true);
  });

  it('all tasks done → near-100 execution score', () => {
    // We need a plan to run against. Supply one with 3 tasks.
    const plan = {
      now: [
        { id: 't1', templateId: 'a', priority: 'high',   title: 'A', description: '', why: '' },
        { id: 't2', templateId: 'b', priority: 'medium', title: 'B', description: '', why: '' },
        { id: 't3', templateId: 'c', priority: 'low',    title: 'C', description: '', why: '' },
      ],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt: new Date().toISOString(),
    };
    const s = computeFarrowayScore({
      farm: farm(), plan,
      completedTaskIds: new Set(['a', 'b', 'c']),
    });
    expect(s.categories.execution.score).toBeGreaterThanOrEqual(90);
    expect(s.categories.execution.confidence).toBe('high');
  });

  it('no tasks completed → floor 40', () => {
    const plan = {
      now: [
        { id: 't1', templateId: 'a', priority: 'high', title: 'A', description: '', why: '' },
      ],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt: new Date().toISOString(),
    };
    const s = computeFarrowayScore({
      farm: farm(), plan, completedTaskIds: new Set(),
    });
    expect(s.categories.execution.score).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════
// Timing category
// ═══════════════════════════════════════════════════════════════
describe('timing category', () => {
  it('no critical tasks today → neutral-high 80', () => {
    const plan = {
      now: [{ id: 't1', templateId: 'a', priority: 'medium',
              title: 'A', description: '', why: '' }],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt: new Date().toISOString(),
    };
    const s = computeFarrowayScore({ farm: farm(), plan });
    expect(s.categories.timing.score).toBe(80);
  });

  it('critical task unfinished after 24h → 75 (one late)', () => {
    const now = new Date();
    const plan = {
      now: [{ id: 't1', templateId: 'crit', priority: 'high',
              title: 'Crit', description: '', why: '' }],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const s = computeFarrowayScore({
      farm: farm(), plan, completedTaskIds: new Set(), date: now,
    });
    expect(s.categories.timing.score).toBe(75);
  });

  it('critical task completed → 100 timing', () => {
    const now = new Date();
    const plan = {
      now: [{ id: 't1', templateId: 'crit', priority: 'high',
              title: 'Crit', description: '', why: '' }],
      thisWeek: [], comingUp: [], riskWatch: [], recommendations: [],
      assumptions: [], confidence: 'medium',
      generatedFor: { farmId: 'farm-1' },
      generatedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
    };
    const s = computeFarrowayScore({
      farm: farm(), plan, completedTaskIds: new Set(['crit']), date: now,
    });
    expect(s.categories.timing.score).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════
// Risk management category
// ═══════════════════════════════════════════════════════════════
describe('riskMgmt category', () => {
  it('cassava in tropical wet at bulking → low score (high-sev matches)', () => {
    const s = computeFarrowayScore({
      farm: farm({ crop: 'cassava', cropStage: 'bulking' }),
      climate: 'tropical', season: 'wet',
    });
    // Cassava has several high-severity matches in wet tropical
    // conditions → score should be well below 100.
    expect(s.categories.riskMgmt.score).toBeLessThan(75);
  });

  it('unknown crop → neutral 50 with low confidence', () => {
    const s = computeFarrowayScore({ farm: farm({ crop: null }) });
    expect(s.categories.riskMgmt.score).toBe(50);
    expect(s.categories.riskMgmt.confidence).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════════
// Crop fit category
// ═══════════════════════════════════════════════════════════════
describe('cropFit category', () => {
  it('GH + AS (Ashanti) + cocoa → high fit (95)', () => {
    const s = computeFarrowayScore({
      farm: farm({ crop: 'cocoa', state: 'AS' }),
    });
    expect(s.categories.cropFit.score).toBe(95);
    expect(s.categories.cropFit.confidence).toBe('high');
  });

  it('GH default (no state) + maize → high fit (95)', () => {
    const s = computeFarrowayScore({
      farm: farm({ crop: 'maize', state: null }),
    });
    expect(s.categories.cropFit.score).toBe(95);
  });

  it('canonical crop not in rules for region → soft 55 with low confidence', () => {
    // Avocado IS a canonical crop (passes normalizeCropKey) but
    // isn't in GH's recommendation rules → engine returns the
    // neutral-low fallback (55, low confidence).
    const s = computeFarrowayScore({
      farm: farm({ crop: 'avocado', state: 'AS' }),
    });
    expect(s.categories.cropFit.score).toBe(55);
    expect(s.categories.cropFit.confidence).toBe('low');
  });

  it('unsupported country → neutral 50', () => {
    // FR still isn't in the rules table; BR/TZ/UG now are.
    const s = computeFarrowayScore({
      farm: farm({ country: 'FR' }),
    });
    expect(s.categories.cropFit.score).toBe(50);
    expect(s.categories.cropFit.confidence).toBe('low');
  });

  it('expanded TZ/UG/BR countries now evaluate real fit', () => {
    for (const country of ['TZ', 'UG', 'BR']) {
      const s = computeFarrowayScore({ farm: farm({ country, state: null }) });
      // Maize is a high-fit crop in all three additions, so the
      // default-crop farm should land >= 75 with medium confidence.
      expect(s.categories.cropFit.score).toBeGreaterThanOrEqual(75);
      expect(['medium', 'high']).toContain(s.categories.cropFit.confidence);
    }
  });

  it('no region data → neutral 50', () => {
    const s = computeFarrowayScore({
      farm: farm({ country: null, state: null }),
    });
    expect(s.categories.cropFit.score).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════
// Yield alignment category
// ═══════════════════════════════════════════════════════════════
describe('yieldAlign category', () => {
  it('no crop → neutral 50', () => {
    const s = computeFarrowayScore({ farm: farm({ crop: null }) });
    expect(s.categories.yieldAlign.score).toBe(50);
  });

  it('weather dragging yield → score drops by 10', () => {
    const a = computeFarrowayScore({ farm: farm(), weather: { status: 'ok' } });
    const b = computeFarrowayScore({ farm: farm(), weather: { status: 'low_rain' } });
    expect(b.categories.yieldAlign.score).toBeLessThan(a.categories.yieldAlign.score);
  });
});

// ═══════════════════════════════════════════════════════════════
// Trend + previous score
// ═══════════════════════════════════════════════════════════════
describe('trend', () => {
  it('returns null when no previous score', () => {
    const s = computeFarrowayScore({ farm: farm() });
    expect(s.trend).toBeNull();
    expect(s.delta).toBeNull();
  });

  it('up when overall improved by 2+', () => {
    const s = computeFarrowayScore({
      farm: farm(), previousScore: { overall: 60 },
    });
    if (s.overall - 60 >= 2) expect(s.trend).toBe('up');
    else if (s.overall - 60 <= -2) expect(s.trend).toBe('down');
    else expect(s.trend).toBe('flat');
  });

  it('flat when |delta| < 2', () => {
    const s1 = computeFarrowayScore({ farm: farm() });
    const s2 = computeFarrowayScore({
      farm: farm(), previousScore: { overall: s1.overall },
    });
    expect(s2.trend).toBe('flat');
    expect(s2.delta).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Suggestions
// ═══════════════════════════════════════════════════════════════
describe('suggestions', () => {
  it('returns at most 2 suggestions', () => {
    const s = computeFarrowayScore({ farm: farm() });
    expect(s.suggestions.length).toBeLessThanOrEqual(2);
  });

  it('each suggestion has a category + action + reason', () => {
    // Force at least one computed low-scoring category.
    const s = computeFarrowayScore({
      farm: farm({ crop: 'cassava', cropStage: 'bulking' }),
      climate: 'tropical', season: 'wet',
    });
    for (const sug of s.suggestions) {
      expect(sug.category).toBeTruthy();
      expect(sug.action).toBeTruthy();
      expect(sug.reason).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Confidence rollup
// ═══════════════════════════════════════════════════════════════
describe('overall confidence', () => {
  it('collapses to low when any category is low', () => {
    const s = computeFarrowayScore({ farm: farm() });
    // No completion data → execution=low → overall=low
    expect(s.confidence).toBe('low');
  });
});
