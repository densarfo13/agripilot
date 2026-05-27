/**
 * operationalLearningLoops.test.js — Operational Refinement +
 * Learning Loops regression suite.
 *
 * Covers:
 *   §1  recommendationIntelligenceEngine — single one-best-action
 *   §4  retentionLoopEngine
 *   §3  __offlineHealth diagnostic hook
 *   §11 __learningLoopAudit diagnostic hook
 *   §10 trust wording rules (no panic / no raw AI)
 *   §13 cross-screen consistency contract
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  runRecommendationIntelligence,
} from '../../../src/core/recommendations/recommendationIntelligenceEngine.js';
import {
  computeRetentionLoop, RETURN_REASON, _internal as retInternal,
} from '../../../src/core/retention/retentionLoopEngine.js';
import {
  installWeatherAndLanguageDiagnostics,
  _resetWeatherAndLanguageDiagnosticsForTests,
} from '../../../src/lib/weatherAndLanguageDiagnostics.js';
import {
  useCanonicalFarmStore,
} from '../../../src/store/canonicalFarmStore.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem:    (k) => _store.has(k) ? _store.get(k) : null,
      setItem:    (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear:      () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

function _stubWindow() {
  if (typeof globalThis.window === 'undefined') globalThis.window = {};
  globalThis.window.localStorage = globalThis.localStorage;
}

beforeEach(() => {
  _stubLocalStorage();
  _stubWindow();
  _resetWeatherAndLanguageDiagnosticsForTests();
  try { useCanonicalFarmStore.getState().clearFarm(); } catch { /* swallow */ }
});

afterEach(() => {
  for (const k of ['__weatherRuntimeHealth', '__languageHealth',
                   '__offlineHealth', '__learningLoopAudit']) {
    try { delete globalThis.window[k]; } catch { /* swallow */ }
  }
});

// ═══ §1 recommendationIntelligenceEngine ═════════════════════

describe('runRecommendationIntelligence — envelope shape', () => {
  it('empty input returns the calm fallback envelope', () => {
    const v = runRecommendationIntelligence({});
    expect(v.engineVersion).toBe('rec-intelligence-v1');
    expect(v.oneBestAction).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(v.urgency);
    expect(['high_confidence', 'medium_confidence', 'needs_review'])
      .toContain(v.confidenceTone);
  });

  it('null / garbage never throws', () => {
    expect(() => runRecommendationIntelligence(null)).not.toThrow();
    expect(() => runRecommendationIntelligence(undefined)).not.toThrow();
    expect(() => runRecommendationIntelligence('hi')).not.toThrow();
  });

  it('frost weather → one-best-action = crop survival, urgency high', () => {
    const v = runRecommendationIntelligence({
      activeFarm: { crop: 'pepper', lifecycleStage: 'flowering' },
      weather:    { temp: 2 },
    });
    expect(v.urgency).toBe('high');
    expect(v.oneBestAction.candidateId).toBe('crop_survival_frost');
    expect(v.expectedBenefit).toBeTruthy();
  });

  it('garden mode hides marketplace prompts', () => {
    const v = runRecommendationIntelligence({
      activeFarm:     { crop: 'pepper', sellState: { hasActiveListing: true, buyerMatchCount: 5 } },
      experienceMode: 'garden',
    });
    expect(v.oneBestAction.candidateId).not.toBe('marketplace_match');
  });

  it('rain in forecast → watering suggestion suppressed', () => {
    const v = runRecommendationIntelligence({
      activeFarm:       { crop: 'pepper' },
      weather:          { temp: 26, rainProbability24hPct: 70 },
      wateringHistory:  { daysSinceLastWatering: 5 },
    });
    expect(v.oneBestAction.candidateId).not.toMatch(/^watering_/);
  });

  it('serious scan + active marketplace → marketplace suppressed', () => {
    const v = runRecommendationIntelligence({
      activeFarm:   { crop: 'pepper',
        sellState:  { hasActiveListing: true, buyerMatchCount: 3 } },
      scanHistory:  [{ severity: 'serious', monitoringNeeded: true }],
    });
    expect(v.oneBestAction.candidateId).toBe('disease_escalation');
    expect(v.suppressedRecommendations.some(
      (s) => s.candidateId === 'marketplace_match')).toBe(true);
  });

  it('every visible string is an envelope (key + fallback)', () => {
    const v = runRecommendationIntelligence({
      activeFarm: { crop: 'pepper' },
      weather:    { temp: 2 },
    });
    expect(typeof v.oneBestAction.key).toBe('string');
    expect(typeof v.oneBestAction.fallback).toBe('string');
    expect(typeof v.reason.key).toBe('string');
    expect(typeof v.reason.fallback).toBe('string');
  });
});

// ═══ §10 calm wording contract ════════════════════════════════

describe('Calm wording contract', () => {
  it('no AI / model / % / panic wording across the envelope', () => {
    const v = runRecommendationIntelligence({
      activeFarm: { crop: 'pepper', lifecycleStage: 'flowering' },
      weather:    { temp: 2 },
      scanHistory:[{ severity: 'serious' }],
    });
    const text = [
      v.oneBestAction.fallback,
      v.reason.fallback,
      v.expectedBenefit && v.expectedBenefit.fallback,
      v.followUp && v.followUp.fallback,
    ].filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/!{2,}/);
    expect(text).not.toMatch(/URGENT|PANIC|EMERGENCY/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability|guaranteed|confirmed)\b/);
  });
});

// ═══ §4 retentionLoopEngine ══════════════════════════════════

describe('computeRetentionLoop — envelope shape', () => {
  it('empty input returns calm default', () => {
    const v = computeRetentionLoop({});
    expect(v.engineVersion).toBe('retention-loop-v1');
    expect(v.returnReason).toBe(RETURN_REASON.CALM_DEFAULT);
    expect(v.dailyHook).toBeTruthy();
    expect(typeof v.dailyHook.key).toBe('string');
  });

  it('null / garbage never throws', () => {
    expect(() => computeRetentionLoop(null)).not.toThrow();
    expect(() => computeRetentionLoop(undefined)).not.toThrow();
    expect(() => computeRetentionLoop('x')).not.toThrow();
  });
});

describe('computeRetentionLoop — priority cascade', () => {
  const oldFollowUp = (idsAgo) => ({
    recommendationId: 'rec_1',
    event:            'followup_scan',
    recordedAt:       Date.now() - (idsAgo * 60 * 60 * 1000),
  });

  it('pending follow-up beats every other reason', () => {
    const v = computeRetentionLoop({
      loopEvents:  [oldFollowUp(8)],
      tasksToday:  [{ id: 't1' }],
      weather:     { rainProbability24hPct: 80 },
      activeFarm:  { lifecycleStage: 'harvest' },
    });
    expect(v.returnReason).toBe(RETURN_REASON.PENDING_FOLLOW_UP);
    expect(v.suppressed.length).toBeGreaterThan(0);
  });

  it('missed critical task beats weather / task / harvest', () => {
    const v = computeRetentionLoop({
      activeFarm: {
        lifecycleStage: 'flowering',
        taskState:      { criticalTaskOverdueDays: 3 },
      },
      tasksToday: [{ id: 't1' }],
      weather:    { rainProbability24hPct: 80 },
    });
    expect(v.returnReason).toBe(RETURN_REASON.MISSED_CRITICAL_TASK);
  });

  it('weather change beats task due', () => {
    const v = computeRetentionLoop({
      activeFarm: { lifecycleStage: 'flowering' },
      weather:    { temp: 34 },
      tasksToday: [{ id: 't1' }],
    });
    expect(v.returnReason).toBe(RETURN_REASON.WEATHER_CHANGE);
  });

  it('harvest stage wins when no urgent signals', () => {
    const v = computeRetentionLoop({
      activeFarm: { lifecycleStage: 'harvest' },
    });
    expect(v.returnReason).toBe(RETURN_REASON.HARVEST_COUNTDOWN);
  });

  it('sell readiness fires when sellState.harvestReady is true', () => {
    const v = computeRetentionLoop({
      activeFarm: {
        lifecycleStage: 'vegetative',
        sellState:      { harvestReady: true },
      },
    });
    expect(v.returnReason).toBe(RETURN_REASON.SELL_READINESS);
  });

  it('completed follow-up does NOT trigger pending state', () => {
    const events = [
      { recommendationId: 'r', event: 'followup_scan', recordedAt: Date.now() - 8 * 3600000 },
      { recommendationId: 'r', event: 'improved',      recordedAt: Date.now() - 1 * 3600000 },
    ];
    const v = computeRetentionLoop({ loopEvents: events });
    expect(v.returnReason).not.toBe(RETURN_REASON.PENDING_FOLLOW_UP);
  });

  it('recent follow-up (< 6h) does not trigger pending state', () => {
    const events = [{
      recommendationId: 'r', event: 'followup_scan',
      recordedAt: Date.now() - 1 * 3600000,
    }];
    const v = computeRetentionLoop({ loopEvents: events });
    expect(v.returnReason).not.toBe(RETURN_REASON.PENDING_FOLLOW_UP);
  });

  it('every visible string is an envelope', () => {
    const v = computeRetentionLoop({
      activeFarm: { lifecycleStage: 'harvest' },
    });
    expect(typeof v.dailyHook.key).toBe('string');
    expect(typeof v.dailyHook.fallback).toBe('string');
  });

  it('returns exactly ONE reason — suppressed carries the rest', () => {
    const v = computeRetentionLoop({
      activeFarm: { lifecycleStage: 'harvest' },
      tasksToday: [{ id: 't1' }],
      weather:    { temp: 34 },
    });
    expect(typeof v.returnReason).toBe('string');
    // suppressed is the candidates that lost
    expect(Array.isArray(v.suppressed)).toBe(true);
  });
});

// ═══ §10 calm wording contract — retention ════════════════════

describe('retention calm wording', () => {
  it('no panic / no raw AI in any visible string', () => {
    const v = computeRetentionLoop({
      activeFarm: {
        lifecycleStage: 'harvest',
        sellState:      { harvestReady: true },
      },
      tasksToday: [{ id: 't1' }],
      weather:    { temp: 34 },
    });
    const text = [v.dailyHook && v.dailyHook.fallback,
                  v.continuityMessage && v.continuityMessage.fallback,
                  v.nextBestMoment && v.nextBestMoment.fallback]
      .filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/!{2,}/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|guaranteed|urgent|emergency)\b/);
  });
});

// ═══ §3 __offlineHealth diagnostic hook ═══════════════════════

describe('__offlineHealth', () => {
  it('pins the global', () => {
    installWeatherAndLanguageDiagnostics();
    expect(typeof globalThis.window.__offlineHealth).toBe('function');
    const snap = globalThis.window.__offlineHealth();
    expect(snap).toBeTruthy();
    expect(snap.generatedAt).toBeTruthy();
    expect(typeof snap.hasNavigator).toBe('boolean');
  });

  it('reports queueLength when a localStorage queue exists', () => {
    localStorage.setItem('farroway:offlineQueue',
      JSON.stringify([{ op: 'task_complete' }, { op: 'scan_save' }]));
    installWeatherAndLanguageDiagnostics();
    const snap = globalThis.window.__offlineHealth();
    expect(snap.queueLength).toBe(2);
  });
});

// ═══ §11 __learningLoopAudit diagnostic hook ══════════════════

describe('__learningLoopAudit', () => {
  it('pins the global', () => {
    installWeatherAndLanguageDiagnostics();
    expect(typeof globalThis.window.__learningLoopAudit).toBe('function');
  });

  it('snapshot reports learning + loop event count', () => {
    installWeatherAndLanguageDiagnostics();
    const snap = globalThis.window.__learningLoopAudit();
    expect(snap).toBeTruthy();
    expect(typeof snap.loopEventCount).toBe('number');
    expect(snap.learning).toBeTruthy();
  });
});

// ═══ §13 _internal helpers ════════════════════════════════════

describe('_internal helpers', () => {
  it('_PRIORITY ranks pending follow-up at the top', () => {
    expect(retInternal._PRIORITY[RETURN_REASON.PENDING_FOLLOW_UP]).toBe(1);
    expect(retInternal._PRIORITY[RETURN_REASON.CALM_DEFAULT]).toBe(9);
  });

  it('every RETURN_REASON has a priority', () => {
    for (const r of Object.values(RETURN_REASON)) {
      expect(retInternal._PRIORITY[r]).toBeGreaterThan(0);
    }
  });
});
