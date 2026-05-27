/**
 * farmLoopEngine.test.js — Continuous Farm Loop tick orchestrator.
 */

import { describe, it, expect } from 'vitest';

import {
  runFarmLoopTick, TRIGGER, _internal,
} from '../../../src/core/runtime/farmLoopEngine.js';
import { STATE } from '../../../src/core/runtime/farmStateEngine.js';

describe('runFarmLoopTick — envelope shape', () => {
  it('empty input returns the calm fallback', () => {
    const v = runFarmLoopTick({});
    expect(v.engineVersion).toBe('farm-loop-v1');
    expect(typeof v.trigger).toBe('string');
    expect(v.oneBestAction).toBeTruthy();
    expect(Array.isArray(v.recommendedTasks)).toBe(true);
    expect(Array.isArray(v.suppressedTasks)).toBe(true);
    expect(['calm', 'measured', 'urgent']).toContain(v.confidenceTone);
  });

  it('garbage / null never throws', () => {
    expect(() => runFarmLoopTick(null)).not.toThrow();
    expect(() => runFarmLoopTick(undefined)).not.toThrow();
    expect(() => runFarmLoopTick('hi')).not.toThrow();
    expect(() => runFarmLoopTick(42)).not.toThrow();
  });

  it('honors all valid trigger sources', () => {
    for (const t of Object.values(TRIGGER)) {
      const v = runFarmLoopTick({ trigger: t });
      expect(v.trigger).toBe(t);
    }
  });

  it('falls back to DAILY_REFRESH on an unknown trigger', () => {
    const v = runFarmLoopTick({ trigger: 'made_up' });
    expect(v.trigger).toBe(TRIGGER.DAILY_REFRESH);
  });
});

describe('runFarmLoopTick — composition over decision engine', () => {
  it('frost signal in decisionInput surfaces high tone + high-risk state', () => {
    const v = runFarmLoopTick({
      trigger: TRIGGER.WEATHER_REFRESH,
      decisionInput: {
        weather: { temp: 2 },
      },
    });
    expect(v.decisionUrgency).toBe('high');
    expect(v.farmHealthState.state).toBe(STATE.HIGH_RISK);
    expect(v.confidenceTone).toBe('urgent');
    expect(v.recommendedTasks[0].urgency).toBe('high');
  });

  it('no signals → calm tone + stable state', () => {
    const v = runFarmLoopTick({
      trigger:       TRIGGER.APP_OPEN,
      decisionInput: { weather: { temp: 22, humidityPct: 50 } },
    });
    expect(v.confidenceTone).toBe('calm');
    expect(v.farmHealthState.state).toBe(STATE.STABLE);
  });
});

describe('runFarmLoopTick — predictive risk composition', () => {
  it('surfaces emerging risks from riskInput even without scan', () => {
    const v = runFarmLoopTick({
      trigger:   TRIGGER.WEATHER_REFRESH,
      riskInput: {
        weather: { temp: 39 },
      },
    });
    expect(v.emergingRisks).toBeTruthy();
    expect(v.emergingRisks.anyHigh).toBe(true);
  });

  it('water-stress risk gets surfaced as irrigationAdjustment', () => {
    const v = runFarmLoopTick({
      riskInput: {
        weather: { temp: 32, daysWithoutRain: 6 },
        wateringHistory: { daysSinceLastWatering: 4 },
      },
    });
    expect(v.irrigationAdjustment).toBeTruthy();
    expect(v.irrigationAdjustment.severity).toBe('high');
  });
});

describe('runFarmLoopTick — marketplace timing pass-through', () => {
  it('forwards marketplace candidate from decision', () => {
    const v = runFarmLoopTick({
      decisionInput: {
        marketplace: { hasActiveListing: true, buyerMatchCount: 3 },
      },
    });
    expect(v.marketplaceTiming).toBeTruthy();
    expect(v.marketplaceTiming.title).toBeTruthy();
  });

  it('returns null marketplace timing when no marketplace data', () => {
    const v = runFarmLoopTick({ decisionInput: {} });
    expect(v.marketplaceTiming).toBeNull();
  });
});

describe('runFarmLoopTick — recommendedTasks ordering', () => {
  it('decision winner is rank 1 and predictive risks come after', () => {
    const v = runFarmLoopTick({
      decisionInput: {
        scan: { severity: 'moderate', monitoringNeeded: true },
      },
      riskInput: {
        weather: { humidityPct: 88, temp: 24, recentRainHours: 5 },
      },
    });
    expect(v.recommendedTasks.length).toBeGreaterThanOrEqual(2);
    expect(v.recommendedTasks[0].source).toBe('decision');
    expect(v.recommendedTasks[0].rank).toBe(1);
  });

  it('caps recommended tasks at 3', () => {
    const v = runFarmLoopTick({
      decisionInput: { scan: { severity: 'moderate', monitoringNeeded: true } },
      riskInput: {
        weather: { humidityPct: 88, temp: 24, recentRainHours: 5, daysWithoutRain: 6, windSpeedKph: 55 },
        wateringHistory: { daysSinceLastWatering: 5 },
        cropLifecycle: { currentStage: 'flowering' },
      },
    });
    expect(v.recommendedTasks.length).toBeLessThanOrEqual(3);
  });
});

describe('runFarmLoopTick — follow-ups', () => {
  it('aggregates decision follow-up + risk suggested actions', () => {
    const v = runFarmLoopTick({
      decisionInput: { scan: { severity: 'moderate', monitoringNeeded: true, followUpWindowDays: 4 } },
      riskInput: {
        weather: { temp: 35 },
      },
    });
    expect(v.followUpRecommendations.length).toBeGreaterThanOrEqual(1);
  });
});

describe('runFarmLoopTick — timeline always populated', () => {
  it('produces a timeline envelope even with empty sources', () => {
    const v = runFarmLoopTick({});
    expect(v.timeline).toBeTruthy();
    expect(Array.isArray(v.timeline.events)).toBe(true);
  });

  it('injects the freshest decision into the timeline', () => {
    const v = runFarmLoopTick({
      decisionInput: { scan: { severity: 'serious' } },
    });
    expect(v.timeline.events.length).toBeGreaterThan(0);
    const decisions = v.timeline.events.filter((e) => e.kind === 'decision');
    expect(decisions.length).toBeGreaterThanOrEqual(1);
  });
});

describe('runFarmLoopTick — garden mode honored', () => {
  it('garden mode hides marketplace/supplier/ngo even when active', () => {
    const v = runFarmLoopTick({
      mode: 'garden',
      decisionInput: {
        marketplace: { hasActiveListing: true, buyerMatchCount: 2 },
        ngo:         { eligiblePrograms: ['p'] },
      },
    });
    expect(v.marketplaceTiming).toBeNull();
  });
});

describe('_internal helpers', () => {
  it('_toneFor maps to urgent/measured/calm', () => {
    expect(_internal._toneFor(STATE.HIGH_RISK, 'low', false)).toBe('urgent');
    expect(_internal._toneFor(STATE.STABLE, 'high', false)).toBe('urgent');
    expect(_internal._toneFor(STATE.NEEDS_ATTENTION, 'low', false)).toBe('measured');
    expect(_internal._toneFor(STATE.STABLE, 'low', false)).toBe('calm');
  });

  it('_buildRecommendedTasks handles empty inputs', () => {
    const out = _internal._buildRecommendedTasks(null, null);
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(0);
  });
});
