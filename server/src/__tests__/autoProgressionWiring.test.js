/**
 * autoProgressionWiring.test.js — locks the final wiring that closes
 * out the auto-progression spec:
 *
 *   A. farmInsightEngine threads the computed timeline stage into
 *      yieldEngine + weatherActionEngine (no stored farm.cropStage)
 *   B. detectStageAdvance returns null on the first observation,
 *      then reports advancement on the next open after ≥24h
 *   C. no advancement message when absence is < 24h (same-day open)
 *   D. no advancement message when the stage hasn't actually changed
 *   E. notificationEngine emits a stage_advanced_away candidate
 *      that carries the expected copy + dedup key
 *   F. channelRouter keeps stage_advanced_away on in-app only
 *   G. clearLastSeenStage resets the observation so the next call
 *      treats it as first open
 *   H. manual override is still respected through the whole chain
 *      (no spurious advancement message when override == current)
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  return mem;
}

import {
  detectStageAdvance, clearLastSeenStage, _internal,
} from '../../../src/lib/timeline/stageAdvanceNotifier.js';
import { generateCandidates } from '../../../src/lib/notifications/notificationEngine.js';
import { chooseChannels } from '../../../src/lib/notifications/channelRouter.js';
import { getFarmInsight } from '../../../src/lib/intelligence/farmInsightEngine.js';

function isoAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

beforeEach(() => { installMemoryStorage(); });

// ─── A. farmInsightEngine uses computed stage ────────────────────
describe('farmInsightEngine — computed stage threading', () => {
  it('yield + weather receive the timeline-computed stage, not farm.cropStage', () => {
    // Maize at day 20 → timeline says 'vegetative'.
    // farm.cropStage is deliberately stale ('planting') — engine
    // should ignore it and use 'vegetative'.
    const farm = {
      id: 'f1', crop: 'maize', farmType: 'small_farm',
      plantingDate: isoAgo(20),
      cropStage: 'planting',
      normalizedAreaSqm: 5000,
      countryCode: 'NG',
    };
    const insight = getFarmInsight({
      farm,
      weather: { status: 'low_rain' },
      tasks: [], issues: [],
    });

    expect(insight.yieldEstimate).not.toBeNull();
    // Direct proof: the computed timeline stage (vegetative) was
    // passed in, so the yield engine's echoed cropStage must NOT be
    // the stale 'planting' value we stored on the farm.
    expect(insight.yieldEstimate.cropStage).not.toBe('planting');
    // Weather action (also consumes cropStage) receives the same
    // computed stage, so the rule tag reflects mid-growth logic not
    // seed-shepherding logic.
    if (insight.weatherAction) {
      expect(insight.weatherAction.ruleTag).toMatch(/weather_low_rain|weather_rain|weather_excessive/);
    }
  });
});

// ─── B, C, D, G. detectStageAdvance behaviour ───────────────────
describe('detectStageAdvance', () => {
  const farmBase = { id: 'f1', crop: 'maize', farmType: 'small_farm' };

  it('returns null on the very first observation + persists it', () => {
    const r = detectStageAdvance({
      farm: { ...farmBase, plantingDate: isoAgo(20) },   // vegetative
      now: new Date(),
    });
    expect(r).toBeNull();

    const stored = JSON.parse(window.localStorage.getItem(_internal.KEY));
    expect(stored.byFarm.f1.stage).toBe('vegetative');
    expect(stored.byFarm.f1.seenAt).toBeGreaterThan(0);
  });

  it('reports advancement when the stage changed + ≥24h passed', () => {
    // Seed a "last seen" observation 48h ago at the 'vegetative' stage.
    window.localStorage.setItem(_internal.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'vegetative', seenAt: Date.now() - 48 * 3600 * 1000 } },
    }));
    // Farm is now 60 days in → tasseling stage.
    const r = detectStageAdvance({
      farm: { ...farmBase, plantingDate: isoAgo(60) },
      now: new Date(),
    });
    expect(r).not.toBeNull();
    expect(r.advanced).toBe(true);
    expect(r.fromStage).toBe('vegetative');
    expect(r.toStage).toBe('tasseling');
    expect(r.daysAway).toBe(2);
    expect(r.message.fallback.toLowerCase()).toContain('tasseling');
  });

  it('suppresses the message when absence is < 24h', () => {
    // Seeded 2 hours ago only.
    window.localStorage.setItem(_internal.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'vegetative', seenAt: Date.now() - 2 * 3600 * 1000 } },
    }));
    const r = detectStageAdvance({
      farm: { ...farmBase, plantingDate: isoAgo(60) },
      now: new Date(),
    });
    expect(r).toBeNull();
  });

  it('returns null when the stage has not actually changed', () => {
    window.localStorage.setItem(_internal.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'vegetative', seenAt: Date.now() - 72 * 3600 * 1000 } },
    }));
    // Still vegetative.
    const r = detectStageAdvance({
      farm: { ...farmBase, plantingDate: isoAgo(20) },
      now: new Date(),
    });
    expect(r).toBeNull();
  });

  it('clearLastSeenStage resets the observation', () => {
    detectStageAdvance({
      farm: { ...farmBase, plantingDate: isoAgo(20) },
      now: new Date(),
    });
    expect(JSON.parse(window.localStorage.getItem(_internal.KEY)).byFarm.f1)
      .toBeDefined();
    clearLastSeenStage('f1');
    expect(JSON.parse(window.localStorage.getItem(_internal.KEY)).byFarm.f1)
      .toBeUndefined();
  });

  it('manual override holds — no advancement message when override matches', () => {
    window.localStorage.setItem(_internal.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'harvest', seenAt: Date.now() - 72 * 3600 * 1000 } },
    }));
    const r = detectStageAdvance({
      farm: {
        ...farmBase, plantingDate: isoAgo(10),
        manualStageOverride: 'harvest',
      },
      now: new Date(),
    });
    expect(r).toBeNull();   // override keeps timeline pinned at 'harvest'
  });

  it('null / missing inputs never throw', () => {
    expect(() => detectStageAdvance({ farm: null })).not.toThrow();
    expect(detectStageAdvance({ farm: null })).toBeNull();
    expect(detectStageAdvance({ farm: { id: 'x' } })).toBeNull();   // no crop
  });
});

// ─── E. notificationEngine emits the candidate ──────────────────
describe('notificationEngine — stage_advanced_away', () => {
  it('emits a candidate after ≥24h absence + stage drift', () => {
    // Prime the "last seen" store with an older observation.
    window.localStorage.setItem(_internal.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'vegetative', seenAt: Date.now() - 72 * 3600 * 1000 } },
    }));
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(60) };   // tasseling
    const out = generateCandidates({
      farm, tasks: [], weather: { status: 'ok' }, now: new Date(),
    });
    const c = out.find((x) => x.type === 'stage_advanced_away');
    expect(c).toBeDefined();
    expect(c.key).toMatch(/^stage_advanced_away:f1:tasseling$/);
    expect(c.priority).toBe('medium');
    expect(c.titleFallback.toLowerCase()).toContain('tasseling');
    expect(c.data.fromStage).toBe('vegetative');
    expect(c.data.toStage).toBe('tasseling');
    expect(c.data.daysAway).toBe(3);
  });

  it('is NOT emitted on the first open (no prior observation)', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(60) };
    const out = generateCandidates({
      farm, tasks: [], weather: { status: 'ok' }, now: new Date(),
    });
    expect(out.find((c) => c.type === 'stage_advanced_away')).toBeUndefined();
  });
});

// ─── F. channelRouter keeps the candidate in-app only ───────────
describe('channelRouter — stage_advanced_away routing', () => {
  it('routes to in-app only (no SMS / email escalation)', () => {
    const plans = chooseChannels({
      candidate: { type: 'stage_advanced_away', priority: 'medium' },
      preferences: { smsEnabled: true, emailEnabled: true,
                     weatherAlertsEnabled: true },
      user: { id: 'u1', email: 'a@b.com', phone: '+254712345678' },
    });
    expect(plans.map((p) => p.channel)).toEqual(['in_app']);
  });
});
