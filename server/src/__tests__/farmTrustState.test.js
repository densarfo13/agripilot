/**
 * farmTrustState.test.js — 4-state daily classifier.
 */

import { describe, it, expect } from 'vitest';

import {
  classifyFarmTrustState, TRUST_STATE, _internal,
} from '../../../src/core/trust/farmTrustState.js';

describe('classifyFarmTrustState — envelope shape', () => {
  it('empty input returns the building-trust fallback', () => {
    const v = classifyFarmTrustState({});
    expect(v.engineVersion).toBe('farm-trust-state-v1');
    expect(v.state).toBe(TRUST_STATE.BUILDING_TRUST);
    expect(typeof v.label.key).toBe('string');
    expect(typeof v.label.fallback).toBe('string');
    expect(typeof v.headline.key).toBe('string');
    expect(Array.isArray(v.contributors)).toBe(true);
  });

  it('null / garbage never throws', () => {
    expect(() => classifyFarmTrustState(null)).not.toThrow();
    expect(() => classifyFarmTrustState(undefined)).not.toThrow();
    expect(() => classifyFarmTrustState('str')).not.toThrow();
    expect(() => classifyFarmTrustState(99)).not.toThrow();
  });
});

describe('classifyFarmTrustState — state derivation', () => {
  it('< 3 total recommendations → BUILDING_TRUST', () => {
    const v = classifyFarmTrustState({
      loopHealth: { totalRecommendations: 2, improvedCount: 0 },
    });
    expect(v.state).toBe(TRUST_STATE.BUILDING_TRUST);
  });

  it('many improvements + high rate → HIGH_CONFIDENCE', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 10,
        improvedCount: 6, improvementRate: 0.6,
        ignoredCount: 0, worsenedCount: 0,
        engagementScore: 75,
      },
    });
    expect(v.state).toBe(TRUST_STATE.HIGH_CONFIDENCE);
  });

  it('any worsened outcome → NEEDS_REVIEW (overrides high confidence)', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 10,
        improvedCount: 6, improvementRate: 0.6,
        worsenedCount: 1,
      },
    });
    expect(v.state).toBe(TRUST_STATE.NEEDS_REVIEW);
  });

  it('5+ ignored → NEEDS_REVIEW', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 10,
        ignoredCount: 5,
      },
    });
    expect(v.state).toBe(TRUST_STATE.NEEDS_REVIEW);
  });

  it('hasWorseningTrend in farm memory → NEEDS_REVIEW', () => {
    const v = classifyFarmTrustState({
      loopHealth: { totalRecommendations: 10 },
      farmMemory: { activeFlags: { hasWorseningTrend: true } },
    });
    expect(v.state).toBe(TRUST_STATE.NEEDS_REVIEW);
  });

  it('large negative learning boost → NEEDS_REVIEW', () => {
    const v = classifyFarmTrustState({
      loopHealth:       { totalRecommendations: 10 },
      learningSnapshot: { averageBoost: -0.3 },
    });
    expect(v.state).toBe(TRUST_STATE.NEEDS_REVIEW);
  });

  it('average activity → STABLE', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 6,
        improvedCount: 1, improvementRate: 0.2,
        ignoredCount: 0, worsenedCount: 0,
      },
    });
    expect(v.state).toBe(TRUST_STATE.STABLE);
  });
});

describe('classifyFarmTrustState — contributors', () => {
  it('lists improved + ignored when both present', () => {
    const v = classifyFarmTrustState({
      loopHealth: { totalRecommendations: 8, improvedCount: 3, ignoredCount: 2 },
    });
    const kinds = v.contributors.map((c) => c.kind);
    expect(kinds).toContain('improved');
    expect(kinds).toContain('ignored');
  });

  it('caps contributors at 3', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 20,
        improvedCount: 5, worsenedCount: 2, ignoredCount: 4,
      },
      farmMemory: {
        activeFlags: {
          hasSuccessfulInterventions: true,
          hasWorseningTrend: true,
        },
      },
    });
    expect(v.contributors.length).toBeLessThanOrEqual(3);
  });

  it('every contributor has a tSafe envelope', () => {
    const v = classifyFarmTrustState({
      loopHealth: { totalRecommendations: 5, improvedCount: 3 },
    });
    for (const c of v.contributors) {
      expect(typeof c.key).toBe('string');
      expect(typeof c.fallback).toBe('string');
    }
  });
});

describe('classifyFarmTrustState — confidence + support line', () => {
  it('high confidence in the state when multiple sources contribute', () => {
    const v = classifyFarmTrustState({
      loopHealth:       { totalRecommendations: 5, improvedCount: 3, improvementRate: 0.6 },
      farmMemory:       { activeFlags: { hasSuccessfulInterventions: true } },
      learningSnapshot: { averageBoost: 0.1 },
    });
    expect(v.confidence).toBe('high');
  });

  it('low confidence with thin data', () => {
    const v = classifyFarmTrustState({});
    expect(v.confidence).toBe('low');
  });

  it('support line carries the matching key + params for HIGH_CONFIDENCE', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 8,
        improvedCount: 4, improvementRate: 0.7,
      },
    });
    expect(v.supportLine.key).toBe('farmTrustState.support.highConfidence');
    expect(v.supportLine.params.count).toBe(4);
  });
});

// ─── Calm UX contract ─────────────────────────────────────

describe('calm UX contract', () => {
  it('never emits "AI" / "model" / "%" in any visible string', () => {
    const v = classifyFarmTrustState({
      loopHealth: {
        totalRecommendations: 10, improvedCount: 6,
        improvementRate: 0.6,
      },
    });
    const allText = [
      v.label.fallback,
      v.headline.fallback,
      v.supportLine && v.supportLine.fallback,
      ...(v.contributors.map((c) => c.fallback)),
    ].filter(Boolean).join(' ');
    expect(allText).not.toMatch(/%/);
    expect(allText.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});

// ─── _internal helpers ────────────────────────────────────

describe('_internal helpers', () => {
  it('_labelFor returns an envelope for every state', () => {
    for (const s of Object.values(TRUST_STATE)) {
      const lbl = _internal._labelFor(s);
      expect(typeof lbl.key).toBe('string');
      expect(typeof lbl.fallback).toBe('string');
    }
  });

  it('_worseOf picks needs_review over building_trust', () => {
    const w = _internal._worseOf(TRUST_STATE.BUILDING_TRUST, TRUST_STATE.NEEDS_REVIEW);
    expect(w).toBe(TRUST_STATE.NEEDS_REVIEW);
  });
});
