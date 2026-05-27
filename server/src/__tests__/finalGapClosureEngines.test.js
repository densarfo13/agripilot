/**
 * finalGapClosureEngines.test.js — covers the 4 new engines shipped
 * in the Final Gap Closure + Production Governance pass.
 *
 *   • mobileOptimizationEngine
 *   • eventTraceEngine
 *   • deploymentGovernance
 *   • recommendationGovernanceEngine
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  detectDeviceTier, getOptimizationProfile,
  shouldReduceMotion, shouldThrottleImages,
  suggestedImageMaxEdge, suggestedAnimationStyle,
  installLowEndHints, TIER,
} from '../../../src/core/performance/mobileOptimizationEngine.js';

import {
  traceEvent, getTrace, getTraceCounts, clearTrace, installTraceHook,
  TRACE_CATEGORY, _internal as traceInternal,
} from '../../../src/core/observability/eventTraceEngine.js';

import {
  FLAG, KILL_SWITCH,
  isFeatureFlagOn, killSwitch,
  verifyDeploymentIntegrity, reportDeploymentHealth,
} from '../../../src/core/deployment/deploymentGovernance.js';

import {
  runRecommendationGovernance,
} from '../../../src/core/recommendations/recommendationGovernanceEngine.js';

import { TRUST_ACTION } from '../../../src/core/trust/trustExplanationEngine.js';

// ═══ mobileOptimizationEngine ════════════════════════════════

describe('mobileOptimizationEngine — tier detection', () => {
  it('returns MID when no navigator is available', () => {
    expect(detectDeviceTier({ navigator: null })).toBe(TIER.MID);
  });

  it('classifies low RAM as LOW or VERY_LOW', () => {
    const tier = detectDeviceTier({
      navigator: { deviceMemory: 1, hardwareConcurrency: 8 },
    });
    expect([TIER.LOW, TIER.VERY_LOW]).toContain(tier);
  });

  it('classifies high RAM + many cores as HIGH', () => {
    const tier = detectDeviceTier({
      navigator: { deviceMemory: 8, hardwareConcurrency: 8 },
    });
    expect(tier).toBe(TIER.HIGH);
  });

  it('Save-Data ON drops to VERY_LOW', () => {
    const tier = detectDeviceTier({
      navigator: { deviceMemory: 8, hardwareConcurrency: 8,
        connection: { saveData: true, effectiveType: '4g' } },
    });
    expect(tier).toBe(TIER.VERY_LOW);
  });

  it('slow-2g triggers VERY_LOW', () => {
    const tier = detectDeviceTier({
      navigator: { deviceMemory: 8, hardwareConcurrency: 8,
        connection: { effectiveType: 'slow-2g' } },
    });
    expect(tier).toBe(TIER.VERY_LOW);
  });

  it('garbage navigator never throws', () => {
    expect(() => detectDeviceTier({ navigator: 'string' })).not.toThrow();
    expect(() => detectDeviceTier(null)).not.toThrow();
    expect(() => detectDeviceTier(undefined)).not.toThrow();
  });
});

describe('mobileOptimizationEngine — profile + predicates', () => {
  it('profile has all documented fields', () => {
    const p = getOptimizationProfile({});
    expect(p.tier).toBeTruthy();
    expect(typeof p.imageMaxEdgePx).toBe('number');
    expect(typeof p.imageJpegQuality).toBe('number');
    expect(typeof p.heavyAnimationsAllowed).toBe('boolean');
    expect(typeof p.maxConcurrentUploads).toBe('number');
  });

  it('low tier shrinks image max-edge + jpeg quality', () => {
    const p = getOptimizationProfile({
      navigator: { deviceMemory: 1, hardwareConcurrency: 2 },
    });
    expect(p.imageMaxEdgePx).toBeLessThanOrEqual(1600);
    expect(p.imageJpegQuality).toBeLessThan(0.82);
  });

  it('shouldThrottleImages true on LOW tier', () => {
    expect(shouldThrottleImages({
      navigator: { deviceMemory: 2, hardwareConcurrency: 2 },
    })).toBe(true);
  });

  it('suggestedAnimationStyle returns static for VERY_LOW', () => {
    const style = suggestedAnimationStyle({
      navigator: { deviceMemory: 1, hardwareConcurrency: 1,
        connection: { saveData: true } },
    });
    expect(style).toBe('static');
  });

  it('suggestedImageMaxEdge returns a positive integer', () => {
    expect(suggestedImageMaxEdge({})).toBeGreaterThan(0);
  });

  it('installLowEndHints returns false without document', () => {
    // server-side test env has no document
    if (typeof document === 'undefined') {
      expect(installLowEndHints()).toBe(false);
    } else {
      // jsdom — should succeed
      expect(installLowEndHints()).toBe(true);
    }
  });
});

// ═══ eventTraceEngine ═════════════════════════════════════════

describe('eventTraceEngine — recording', () => {
  beforeEach(() => { clearTrace(); });

  it('records a valid event', () => {
    const row = traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'capture_complete', { ms: 120 });
    expect(row).toBeTruthy();
    expect(row.category).toBe(TRACE_CATEGORY.SCAN_LIFECYCLE);
    expect(row.name).toBe('capture_complete');
    expect(getTrace().length).toBe(1);
  });

  it('rejects invalid categories', () => {
    expect(traceEvent('made_up', 'x')).toBeNull();
  });

  it('rejects empty names', () => {
    expect(traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, '')).toBeNull();
  });

  it('strips PII keys (image/blob/dataUrl)', () => {
    const row = traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'x', {
      image: 'should_not_be_here',
      blob:  'nope',
      dataUrl: 'data:image/png;base64,xxxxxxxxx',
      sessionId: 'ok',
      ms: 100,
    });
    expect(row.payload.image).toBeUndefined();
    expect(row.payload.blob).toBeUndefined();
    expect(row.payload.dataUrl).toBeUndefined();
    expect(row.payload.sessionId).toBe('ok');
  });

  it('caps the ring at 200', () => {
    for (let i = 0; i < 250; i++) {
      traceEvent(TRACE_CATEGORY.RECOMMENDATION, 'tick_' + i);
    }
    expect(traceInternal._ring.length).toBeLessThanOrEqual(200);
  });

  it('getTrace filters by category', () => {
    traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'a');
    traceEvent(TRACE_CATEGORY.LOCALE_LIFECYCLE, 'b');
    const filtered = getTrace({ category: TRACE_CATEGORY.LOCALE_LIFECYCLE });
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('b');
  });

  it('getTraceCounts returns per-category counts', () => {
    traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'a');
    traceEvent(TRACE_CATEGORY.SCAN_LIFECYCLE, 'b');
    traceEvent(TRACE_CATEGORY.LOCALE_LIFECYCLE, 'c');
    const counts = getTraceCounts();
    expect(counts.scan_lifecycle).toBe(2);
    expect(counts.locale_lifecycle).toBe(1);
    expect(counts._total).toBe(3);
  });

  it('caps long string values at 240 chars', () => {
    const long = 'x'.repeat(500);
    const row = traceEvent(TRACE_CATEGORY.ERROR, 'long', { msg: long });
    expect(row.payload.msg.length).toBeLessThanOrEqual(241);
  });

  it('garbage never throws', () => {
    expect(() => traceEvent(null, null, null)).not.toThrow();
    expect(() => getTrace(null)).not.toThrow();
  });
});

describe('eventTraceEngine — DevTools hook', () => {
  it('installTraceHook returns false without window in this env', () => {
    if (typeof window === 'undefined') {
      expect(installTraceHook()).toBe(false);
    } else {
      expect(installTraceHook()).toBe(true);
      // idempotent
      expect(installTraceHook()).toBe(true);
    }
  });
});

// ═══ deploymentGovernance ════════════════════════════════════

describe('deploymentGovernance — feature flags', () => {
  it('core flags default ON', () => {
    expect(isFeatureFlagOn(FLAG.CORE_SCAN)).toBe(true);
    expect(isFeatureFlagOn(FLAG.LIFECYCLE)).toBe(true);
    expect(isFeatureFlagOn(FLAG.DAILY_DECISION)).toBe(true);
    expect(isFeatureFlagOn(FLAG.TRUST_EXPLANATION)).toBe(true);
    expect(isFeatureFlagOn(FLAG.CONFIDENCE_LOOP)).toBe(true);
  });

  it('advanced intelligence flags default OFF', () => {
    expect(isFeatureFlagOn(FLAG.SOIL_INTELLIGENCE)).toBe(false);
    expect(isFeatureFlagOn(FLAG.SUPPLIER_INTELLIGENCE)).toBe(false);
    expect(isFeatureFlagOn(FLAG.MARKETPLACE_INTELLIGENCE)).toBe(false);
    expect(isFeatureFlagOn(FLAG.YIELD_PREDICTION)).toBe(false);
    expect(isFeatureFlagOn(FLAG.NGO_ANALYTICS)).toBe(false);
    expect(isFeatureFlagOn(FLAG.SATELLITE_READINESS)).toBe(false);
    expect(isFeatureFlagOn(FLAG.SCAN_V5_INVISIBLE)).toBe(false);
  });

  it('unknown flag returns false', () => {
    expect(isFeatureFlagOn('totally_made_up_flag')).toBe(false);
  });

  it('killSwitch defaults OFF', () => {
    expect(killSwitch(KILL_SWITCH.ALL_RECOMMENDATIONS)).toBe(false);
    expect(killSwitch('made_up')).toBe(false);
  });

  it('handles garbage input', () => {
    expect(() => isFeatureFlagOn(null)).not.toThrow();
    expect(() => killSwitch(null)).not.toThrow();
  });
});

describe('deploymentGovernance — integrity + health', () => {
  it('verifyDeploymentIntegrity reports honest "unknown" when env missing', () => {
    const v = verifyDeploymentIntegrity();
    expect(typeof v.healthy).toBe('boolean');
    expect(Array.isArray(v.problems)).toBe(true);
  });

  it('reportDeploymentHealth returns score 0..100 + a band', () => {
    const r = reportDeploymentHealth();
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(['healthy', 'degraded', 'risky', 'unhealthy']).toContain(r.band);
    expect(r.flagSnapshot[FLAG.CORE_SCAN]).toBe(true);
  });
});

// ═══ recommendationGovernanceEngine ══════════════════════════

describe('recommendationGovernanceEngine — envelope shape', () => {
  it('returns the calm fallback for empty input', () => {
    const v = runRecommendationGovernance({});
    expect(v.engineVersion).toBe('rec-governance-v1');
    expect(v.oneBestAction).toBeTruthy();
    expect(Array.isArray(v.suppressedRecommendations)).toBe(true);
    expect(['high_confidence', 'medium_confidence', 'needs_review'])
      .toContain(v.confidenceTone);
    expect(typeof v.escalationRequired).toBe('boolean');
  });

  it('null / garbage never throws', () => {
    expect(() => runRecommendationGovernance(null)).not.toThrow();
    expect(() => runRecommendationGovernance(undefined)).not.toThrow();
    expect(() => runRecommendationGovernance('hi')).not.toThrow();
  });

  it('frost scenario → crop survival winner + high urgency', () => {
    const v = runRecommendationGovernance({
      decisionInput: { weather: { temp: 2 } },
    });
    expect(v.oneBestAction.candidateId).toBe('crop_survival_frost');
    expect(v.urgency).toBe('high');
    expect(v.confidenceTone).toBe('high_confidence');
    expect(v.escalationRequired).toBe(true);
  });

  it('serious scan → escalationRequired flag set', () => {
    const v = runRecommendationGovernance({
      decisionInput: { scan: { severity: 'serious' } },
    });
    expect(v.escalationRequired).toBe(true);
  });

  it('rain conflict suppresses watering at the decision layer', () => {
    const v = runRecommendationGovernance({
      decisionInput: {
        weather: { temp: 26, rainProbability24hPct: 70 },
        wateringHistory: { daysSinceLastWatering: 5 },
      },
    });
    // Watering should not be the winner; weather protection wins.
    expect(v.oneBestAction.candidateId).not.toMatch(/^watering_/);
  });

  it('marketplace prompt suppressed when disease escalation fires', () => {
    const v = runRecommendationGovernance({
      decisionInput: {
        scan: { severity: 'moderate', monitoringNeeded: true },
        marketplace: { hasActiveListing: true, buyerMatchCount: 3 },
      },
    });
    expect(v.oneBestAction.candidateId).toBe('disease_escalation');
    expect(v.suppressedRecommendations.some(
      (s) => s.candidateId === 'marketplace_match')).toBe(true);
  });

  it('honors trust noise — repeatedly-ignored winner is held off', () => {
    const memory = [];
    for (let i = 0; i < 4; i++) {
      memory.push({
        recommendationId: 'crop_survival_frost',
        action: TRUST_ACTION.IGNORED,
        recordedAt: Date.now() - (i * 1000),
      });
    }
    const v = runRecommendationGovernance({
      decisionInput: { weather: { temp: 2 } },
      trustMemory:   memory,
    });
    expect(v.oneBestAction.candidateId).toBeNull();
    expect(v.confidenceTone).toBe('needs_review');
    expect(v.suppressedRecommendations.some(
      (s) => s.reason === 'repeatedly_ignored')).toBe(true);
  });

  it('every suppressed entry carries a tSafe reasonLabel envelope', () => {
    const v = runRecommendationGovernance({
      decisionInput: {
        weather: { temp: 2 },
        scan: { severity: 'serious' },
        marketplace: { hasActiveListing: true, buyerMatchCount: 2 },
      },
    });
    expect(v.suppressedRecommendations.length).toBeGreaterThan(0);
    for (const s of v.suppressedRecommendations) {
      expect(typeof s.reasonLabel.key).toBe('string');
      expect(typeof s.reasonLabel.fallback).toBe('string');
    }
  });

  it('confidenceTone is always one of the 3 allowed strings', () => {
    const cases = [
      {},
      { decisionInput: { weather: { temp: 2 } } },
      { decisionInput: { scan: { severity: 'moderate' } } },
      { decisionInput: { marketplace: { hasActiveListing: true, buyerMatchCount: 1 } } },
    ];
    for (const c of cases) {
      const v = runRecommendationGovernance(c);
      expect(['high_confidence', 'medium_confidence', 'needs_review'])
        .toContain(v.confidenceTone);
    }
  });
});

// ═══ Calm UX contract ════════════════════════════════════════

describe('Calm UX contract — no AI / % leaks across all 4 engines', () => {
  it('recommendation governance never leaks AI / % wording', () => {
    const v = runRecommendationGovernance({
      decisionInput: { weather: { temp: 2 }, scan: { severity: 'serious' } },
    });
    const allText = [
      v.oneBestAction.fallback,
      v.reason.fallback,
      ...(v.suppressedRecommendations.map((s) => s.reasonLabel.fallback)),
    ].filter(Boolean).join(' ');
    expect(allText).not.toMatch(/%/);
    expect(allText.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});
