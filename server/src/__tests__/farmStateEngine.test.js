/**
 * farmStateEngine.test.js — 4-state classifier contract.
 */

import { describe, it, expect } from 'vitest';

import {
  classifyFarmState, STATE, _internal,
} from '../../../src/core/runtime/farmStateEngine.js';

describe('classifyFarmState — envelope shape', () => {
  it('empty input returns the stable fallback', () => {
    const v = classifyFarmState({});
    expect(v.engineVersion).toBe('farm-state-v1');
    expect(v.state).toBe(STATE.STABLE);
    expect(typeof v.label.key).toBe('string');
    expect(typeof v.label.fallback).toBe('string');
    expect(typeof v.headline.key).toBe('string');
    expect(Array.isArray(v.contributors)).toBe(true);
  });

  it('null / undefined / garbage never throws', () => {
    expect(() => classifyFarmState(null)).not.toThrow();
    expect(() => classifyFarmState(undefined)).not.toThrow();
    expect(() => classifyFarmState('hi')).not.toThrow();
    expect(() => classifyFarmState(42)).not.toThrow();
  });
});

describe('classifyFarmState — state derivation', () => {
  it('high decision urgency → HIGH_RISK', () => {
    const v = classifyFarmState({
      decision: {
        urgency: 'high',
        reason:  { key: 'r', fallback: 'Frost is likely' },
      },
    });
    expect(v.state).toBe(STATE.HIGH_RISK);
    expect(v.contributors.length).toBeGreaterThan(0);
  });

  it('medium decision urgency → NEEDS_ATTENTION', () => {
    const v = classifyFarmState({
      decision: {
        urgency: 'medium',
        reason:  { key: 'r', fallback: 'Moderate scan' },
      },
    });
    expect(v.state).toBe(STATE.NEEDS_ATTENTION);
  });

  it('high predictive risk → HIGH_RISK', () => {
    const v = classifyFarmState({
      riskForecast: { risks: [{ severity: 'high', label: { key: 'k', fallback: 'fungal' } }] },
    });
    expect(v.state).toBe(STATE.HIGH_RISK);
  });

  it('worsening memory trend → HIGH_RISK', () => {
    const v = classifyFarmState({
      farmMemory: { activeFlags: { hasWorseningTrend: true } },
    });
    expect(v.state).toBe(STATE.HIGH_RISK);
  });

  it('only successful interventions → IMPROVING', () => {
    const v = classifyFarmState({
      farmMemory: {
        resolvedCount: 3,
        activeFlags: { hasSuccessfulInterventions: true },
      },
    });
    expect(v.state).toBe(STATE.IMPROVING);
  });

  it('score 85+ → STABLE absent worse signals', () => {
    const v = classifyFarmState({ scoreSnapshot: { overall: 88 } });
    expect(v.state).toBe(STATE.STABLE);
  });

  it('score band collides with rule — worse wins (high risk dominates good score)', () => {
    const v = classifyFarmState({
      scoreSnapshot: { overall: 90 },
      decision:      { urgency: 'high', reason: { key: 'k', fallback: 'frost' } },
    });
    expect(v.state).toBe(STATE.HIGH_RISK);
  });

  it('low score → HIGH_RISK on its own', () => {
    const v = classifyFarmState({ scoreSnapshot: { overall: 25 } });
    expect(v.state).toBe(STATE.HIGH_RISK);
  });
});

describe('classifyFarmState — confidence + trend', () => {
  it('multiple sources → high confidence', () => {
    const v = classifyFarmState({
      decision:      { urgency: 'low', reason: { key: 'r', fallback: '' } },
      riskForecast:  { risks: [] },
      farmMemory:    { activeFlags: {} },
      scoreSnapshot: { overall: 70, trend: 'up' },
    });
    expect(v.confidence).toBe('high');
    expect(v.trend).toBe('up');
  });

  it('single source → low confidence', () => {
    const v = classifyFarmState({ decision: { urgency: 'low' } });
    expect(v.confidence).toBe('low');
  });
});

describe('classifyFarmState — headline composition', () => {
  it('high-risk headline references the top contributor reason when available', () => {
    const v = classifyFarmState({
      decision: { urgency: 'high', reason: { key: 'r', fallback: 'Frost is likely' } },
    });
    // Headline is a tSafe envelope — fallback is the template,
    // params carry the runtime substitution.
    expect(v.headline.key).toBe('farmState.headline.highRisk.withReason');
    expect(v.headline.params.reason).toBe('Frost is likely');
  });

  it('stable headline is the calm default', () => {
    const v = classifyFarmState({});
    expect(v.headline.key).toBe('farmState.headline.stable.generic');
  });
});

describe('_internal helpers', () => {
  it('_scoreToState bands', () => {
    expect(_internal._scoreToState(95)).toBe(STATE.STABLE);
    expect(_internal._scoreToState(70)).toBe(STATE.IMPROVING);
    expect(_internal._scoreToState(50)).toBe(STATE.NEEDS_ATTENTION);
    expect(_internal._scoreToState(30)).toBe(STATE.HIGH_RISK);
    expect(_internal._scoreToState(NaN)).toBeNull();
  });

  it('_worseOf picks worse state', () => {
    expect(_internal._worseOf(STATE.STABLE, STATE.HIGH_RISK)).toBe(STATE.HIGH_RISK);
    expect(_internal._worseOf(STATE.IMPROVING, STATE.STABLE)).toBe(STATE.IMPROVING);
  });
});
