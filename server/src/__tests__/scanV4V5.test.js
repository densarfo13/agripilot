/**
 * scanV4V5.test.js — verifies the Scan v4 visible composer +
 * Scan v5 invisible adaptive engine + the 5 new feature flags.
 */

// localStorage shim for flag overrides.
const _s = new Map();
const _ls = {
  getItem:    (k) => (_s.has(k) ? _s.get(k) : null),
  setItem:    (k, v) => { _s.set(k, String(v)); },
  removeItem: (k) => { _s.delete(k); },
  clear:      () => { _s.clear(); },
};
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach } from 'vitest';
import { runScanV4 }       from '../../../src/core/scan/v4/scanV4Engine.js';
import { runScanV5Invisible } from '../../../src/core/scan/v5/scanV5InvisibleEngine.js';
import {
  FEATURE, isFeatureEnabled, setFeatureOverride,
} from '../../../src/config/featureFlags.js';

const DAY = 86400000;
const HOUR = 3600000;
const NOW = Date.UTC(2026, 5, 1);

// ─── feature flags ───────────────────────────────────────

describe('scan v4/v5 feature flags', () => {
  beforeEach(() => _s.clear());

  it('SCAN_V4 default ON', () => {
    expect(isFeatureEnabled(FEATURE.SCAN_V4)).toBe(true);
  });

  it('SCAN_V5_INVISIBLE / regional / yield / outcome default OFF', () => {
    expect(isFeatureEnabled(FEATURE.SCAN_V5_INVISIBLE)).toBe(false);
    expect(isFeatureEnabled(FEATURE.SCAN_REGIONAL_RISK)).toBe(false);
    expect(isFeatureEnabled(FEATURE.SCAN_YIELD_IMPACT)).toBe(false);
    expect(isFeatureEnabled(FEATURE.SCAN_OUTCOME_LEARNING)).toBe(false);
  });

  it('per-user override flips a flag', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    expect(isFeatureEnabled(FEATURE.SCAN_V5_INVISIBLE)).toBe(true);
  });
});

// ─── Scan v4 ─────────────────────────────────────────────

describe('runScanV4 — visible contextual composer', () => {
  beforeEach(() => _s.clear());

  it('returns the documented 13-key shape', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
      crop:             'tomato',
      lifecycle:        { currentStage: 'fruiting' },
      weather:          { humidityPct: 88, rainProbability24hPct: 60 },
      nowMs:            NOW,
    });
    for (const k of ['possibleIssue', 'confidenceTone', 'whatWeNoticed',
                     'whyNow', 'riskFactors', 'whatToDoNext',
                     'preventionTip', 'followUpTask', 'journalSummary',
                     'lifecycleImpact', 'wateringAdjustment',
                     'harvestImpact', 'disclaimer']) {
      expect(k in v4).toBe(true);
    }
  });

  it('healthy + cool weather → ok:true with healthy harvest outlook', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'healthy', confidenceLabel: 'high' },
      lifecycle:        { currentStage: 'vegetative' },
      weather:          { humidityPct: 50, temperatureC: 24 },
    });
    expect(v4.ok).toBe(true);
    expect(v4.harvestImpact.fallback).toMatch(/normal|healthy/i);
    expect(v4.lifecycleImpact.fallback).toMatch(/on track|healthy/i);
  });

  it('fungal + fruiting → harvest impact warns about yield', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
      lifecycle:        { currentStage: 'fruiting' },
      weather:          { humidityPct: 88 },
    });
    expect(v4.harvestImpact.fallback).toMatch(/yield|harvest/i);
  });

  it('fungal → watering adjustment routes to "base of plant"', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
      lifecycle:        { currentStage: 'fruiting' },
    });
    expect(v4.wateringAdjustment.fallback).toMatch(/base|avoid wetting/i);
  });

  it('whyNow + riskFactors populated from contextual signals', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
      crop:             'tomato',
      lifecycle:        { currentStage: 'fruiting' },
      weather:          { humidityPct: 88, rainProbability24hPct: 70 },
      scanHistory: [
        { issueCategory: 'fungal_risk', createdAt: NOW - 30 * DAY },
        { issueCategory: 'fungal_risk', createdAt: NOW - 15 * DAY },
      ],
    });
    expect(v4.whyNow.length).toBeGreaterThan(0);
    expect(v4.riskFactors.length).toBeGreaterThan(0);
    const text = v4.riskFactors.map((r) => r.fallback).join(' ');
    expect(text.toLowerCase()).toMatch(/humidity|recurring|seen/);
  });

  it('needs_review → ok:false with "choose a clearer photo" wording', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'unknown_needs_clearer_photo', confidenceLabel: 'needs_review' },
    });
    expect(v4.ok).toBe(false);
    expect(v4.suppressed.reason).toBe('image_invalid');
    expect(v4.whatToDoNext.fallback).toMatch(/new photo|clearer/i);
    // Impact fields suppressed on failed image.
    expect(v4.lifecycleImpact).toBe(null);
    expect(v4.wateringAdjustment).toBe(null);
    expect(v4.harvestImpact).toBe(null);
  });

  it('every visible field is a localizable envelope', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'water_stress', confidenceLabel: 'medium' },
      crop:             'tomato',
      lifecycle:        { currentStage: 'vegetative' },
      weather:          { daysSinceRain: 10 },
    });
    for (const e of [v4.possibleIssue, v4.confidenceTone, v4.whatWeNoticed,
                     v4.whatToDoNext, v4.lifecycleImpact,
                     v4.wateringAdjustment, v4.harvestImpact,
                     v4.journalSummary, v4.disclaimer]) {
      expect(e).toBeTruthy();
      expect(e.key).toBeTruthy();
      expect(typeof e.fallback).toBe('string');
    }
  });

  it('hedged wording — no "confirmed" / "guaranteed" / "definitely"', () => {
    const samples = [
      runScanV4({ classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'high' },
                  lifecycle: { currentStage: 'fruiting' } }),
      runScanV4({ classifierResult: { issueCategory: 'pest_damage', confidenceLabel: 'medium' },
                  lifecycle: { currentStage: 'harvest_ready' } }),
      runScanV4({ classifierResult: { issueCategory: 'healthy',     confidenceLabel: 'high' } }),
    ];
    for (const v4 of samples) {
      const blob = JSON.stringify(v4);
      expect(blob.toLowerCase()).not.toMatch(/confirmed disease|guaranteed|definitely/);
    }
  });

  it('v5 invisible hints NOT attached when flag OFF', () => {
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
    });
    expect('invisibleHints' in v4).toBe(false);
  });

  it('v5 invisible hints ATTACHED when flag ON', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const v4 = runScanV4({
      classifierResult: { issueCategory: 'fungal_risk', confidenceLabel: 'medium' },
    });
    expect(v4.invisibleHints).toBeTruthy();
    expect(typeof v4.invisibleHints.trustScore).toBe('number');
  });

  it('never throws on garbage input', () => {
    expect(() => runScanV4(null)).not.toThrow();
    expect(runScanV4(null).ok).toBe(false);
  });
});

// ─── Scan v5 invisible ───────────────────────────────────

describe('runScanV5Invisible', () => {
  beforeEach(() => _s.clear());

  it('disabled by default → suppressed:disabled', () => {
    const r = runScanV5Invisible({});
    expect(r.suppressed && r.suppressed.reason).toBe('disabled');
    expect(r.trustScore).toBe(null);
  });

  it('flag ON + cold start → neutral trust score', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({});
    expect(r.suppressed).toBe(null);
    expect(r.trustScore).toBeCloseTo(0.6, 1);
  });

  it('many ignored alerts → calibrate confidence DOWN', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: { confidenceTone: { key: 'scan.confidenceTone.high' } },
      diseaseMemory: {
        ignoredAlerts: [{ issue: 'fungal_risk', count: 6 }],
      },
    });
    expect(r.calibratedConfidence).toBe('medium');  // high → medium
  });

  it('strong recovery track → calibrate confidence UP', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: { confidenceTone: { key: 'scan.confidenceTone.medium' } },
      diseaseMemory: {
        recoverySuccess: 0.8,
      },
    });
    expect(r.calibratedConfidence).toBe('high');
  });

  it('repeated WORSE outcomes → tighten follow-up window', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: { possibleIssue: { key: 'scan.issue.fungal' } },
      outcomeLog: [
        { issueCategory: 'fungal', outcome: 'worse' },
        { issueCategory: 'fungal', outcome: 'worse' },
      ],
    });
    expect(r.suggestedFollowupAdjMs).toBe(-DAY);
  });

  it('repeated IMPROVED outcomes → loosen follow-up window', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: { possibleIssue: { key: 'scan.issue.fungal' } },
      outcomeLog: [
        { issueCategory: 'fungal', outcome: 'improved' },
        { issueCategory: 'fungal', outcome: 'improved' },
      ],
    });
    expect(r.suggestedFollowupAdjMs).toBe(+DAY);
  });

  it('ignored alert count >= 3 → suppression hint', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: { confidenceTone: { key: 'scan.confidenceTone.medium' } },
      diseaseMemory: {
        ignoredAlerts: [{ issue: 'pest_damage', count: 4 }],
      },
    });
    expect(r.suppressionHints.length).toBeGreaterThan(0);
    expect(r.suppressionHints[0].kind).toBe('demote_repeated_alert');
  });

  it('trust score bounded [0, 1] and rises with recovery', () => {
    setFeatureOverride(FEATURE.SCAN_V5_INVISIBLE, true);
    const r = runScanV5Invisible({
      v4Output: {},
      diseaseMemory: { recoverySuccess: 0.95 },
      scanHistory: Array.from({ length: 35 }, (_, i) => ({ id: 'x' + i })),
    });
    expect(r.trustScore).toBeGreaterThan(0.6);
    expect(r.trustScore).toBeLessThanOrEqual(1);
  });

  it('never throws on garbage input', () => {
    expect(() => runScanV5Invisible(null)).not.toThrow();
  });
});
