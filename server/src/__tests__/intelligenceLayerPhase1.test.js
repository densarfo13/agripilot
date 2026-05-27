/**
 * intelligenceLayerPhase1.test.js — Intelligence Layer Phase 1
 * regression suite.
 *
 * Covers:
 *   §1  farmIntelligenceEngine composer
 *   §7  __weatherRuntimeHealth + __languageHealth
 *   §10 aiFoundations interfaces + readiness gating
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  runFarmIntelligence, _internal as intelInternal,
} from '../../../src/intelligence/farmIntelligenceEngine.js';
import {
  installWeatherAndLanguageDiagnostics,
  _resetWeatherAndLanguageDiagnosticsForTests,
} from '../../../src/lib/weatherAndLanguageDiagnostics.js';
import {
  AI_PROVIDER, getProviderReadiness,
  fetchSatelliteSignal, fetchSoilSignal,
  classifyDiseaseStub, forecastYieldStub,
  voiceAssistantHandshake, predictBuyersStub,
} from '../../../src/intelligence/aiFoundations.js';
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
  try { delete globalThis.window.__weatherRuntimeHealth; } catch { /* swallow */ }
  try { delete globalThis.window.__languageHealth; } catch { /* swallow */ }
});

// ═══ §1 farmIntelligenceEngine ════════════════════════════════

describe('runFarmIntelligence — envelope shape', () => {
  it('empty input returns the calm fallback envelope', () => {
    const v = runFarmIntelligence({});
    expect(v.engineVersion).toBe('farm-intelligence-v1');
    expect(v.nextBestAction).toBeTruthy();
    expect(Array.isArray(v.riskAlerts)).toBe(true);
    expect(['low', 'medium', 'high']).toContain(v.diseaseLikelihood);
    expect(['low', 'medium', 'high']).toContain(v.growthConfidence);
    expect(['low', 'medium', 'high']).toContain(v.scanUrgency);
  });

  it('null / garbage never throws', () => {
    expect(() => runFarmIntelligence(null)).not.toThrow();
    expect(() => runFarmIntelligence(undefined)).not.toThrow();
    expect(() => runFarmIntelligence('hi')).not.toThrow();
    expect(() => runFarmIntelligence(42)).not.toThrow();
  });

  it('every visible string is a tSafe envelope', () => {
    const v = runFarmIntelligence({
      crop: 'pepper', region: 'Maryland',
    });
    expect(typeof v.nextBestAction.key).toBe('string');
    expect(typeof v.nextBestAction.fallback).toBe('string');
  });

  it('disease likelihood escalates on a serious scan', () => {
    const v = runFarmIntelligence({
      scanHistory: [{ severity: 'serious' }],
    });
    expect(v.diseaseLikelihood).toBe('high');
  });

  it('disease likelihood = medium on a moderate scan', () => {
    const v = runFarmIntelligence({
      scanHistory: [{ severity: 'moderate' }],
    });
    expect(v.diseaseLikelihood).toBe('medium');
  });

  it('watering suggestion = "skip rain" when rain probability ≥ 60%', () => {
    const v = runFarmIntelligence({
      weather: { rainProbability24hPct: 70 },
    });
    expect(v.wateringRecommendation).toBeTruthy();
    expect(v.wateringRecommendation.fallback.toLowerCase()).toContain('rain');
  });

  it('harvest estimate fires when stage = harvest', () => {
    const v = runFarmIntelligence({ stage: 'harvest' });
    expect(v.harvestReadinessEstimate).toBeTruthy();
    expect(v.harvestReadinessEstimate.key).toBe('intelligence.harvest.now');
  });

  it('funding relevance fires when region + crop both set', () => {
    const v = runFarmIntelligence({ crop: 'pepper', region: 'Maryland' });
    expect(v.fundingRelevance).toBeTruthy();
    expect(v.fundingRelevance.params.crop).toBe('pepper');
    expect(v.fundingRelevance.params.region).toBe('Maryland');
  });

  it('funding relevance is null when region missing', () => {
    const v = runFarmIntelligence({ crop: 'pepper' });
    expect(v.fundingRelevance).toBeNull();
  });

  it('scan urgency = high when frost weather + serious scan', () => {
    const v = runFarmIntelligence({
      weather: { temp: 2 },
      scanHistory: [{ severity: 'serious' }],
    });
    expect(v.scanUrgency).toBe('high');
  });

  it('growth confidence reflects signal count', () => {
    const v = runFarmIntelligence({
      stage: 'flowering',
      scanHistory: [{ severity: 'mild' }],
      completedTasks: [{ id: 't1' }],
      weather: { temp: 24 },
    });
    expect(v.growthConfidence).toBe('high');
  });

  it('growth confidence drops to low on any high risk', () => {
    const v = runFarmIntelligence({
      weather: { humidityPct: 90, temp: 24, recentRainHours: 6 },
      stage: 'flowering',
    });
    expect(v.growthConfidence).toBe('low');
  });

  it('riskAlerts surface medium + high predictive risks (max 3)', () => {
    const v = runFarmIntelligence({
      weather: { temp: 39, windSpeedKph: 55,
        humidityPct: 88, recentRainHours: 4 },
      cropLifecycle: { currentStage: 'flowering' },
      stage: 'flowering',
    });
    expect(v.riskAlerts.length).toBeGreaterThan(0);
    expect(v.riskAlerts.length).toBeLessThanOrEqual(3);
    for (const r of v.riskAlerts) {
      expect(['medium', 'high']).toContain(r.severity);
    }
  });
});

// ═══ §1 calm UX contract ══════════════════════════════════════

describe('Calm UX contract', () => {
  it('no AI / % wording in any rendered fallback', () => {
    const v = runFarmIntelligence({
      crop: 'pepper', region: 'Maryland',
      weather: { temp: 35, humidityPct: 80, rainProbability24hPct: 70 },
      stage: 'flowering',
    });
    const text = [
      v.nextBestAction.fallback,
      v.wateringRecommendation && v.wateringRecommendation.fallback,
      v.fundingRelevance && v.fundingRelevance.fallback,
      v.harvestReadinessEstimate && v.harvestReadinessEstimate.fallback,
      ...v.riskAlerts.map((r) => r.fallback),
    ].filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});

// ═══ §7 diagnostic hooks ══════════════════════════════════════

describe('installWeatherAndLanguageDiagnostics', () => {
  it('is idempotent', () => {
    expect(installWeatherAndLanguageDiagnostics()).toBe(true);
    expect(installWeatherAndLanguageDiagnostics()).toBe(true);
  });

  it('pins window.__weatherRuntimeHealth', () => {
    installWeatherAndLanguageDiagnostics();
    expect(typeof globalThis.window.__weatherRuntimeHealth).toBe('function');
    const snap = globalThis.window.__weatherRuntimeHealth();
    expect(snap).toBeTruthy();
    expect(typeof snap.hasCoords).toBe('boolean');
    expect(typeof snap.fallbackActive).toBe('boolean');
  });

  it('pins window.__languageHealth', () => {
    installWeatherAndLanguageDiagnostics();
    expect(typeof globalThis.window.__languageHealth).toBe('function');
    const snap = globalThis.window.__languageHealth();
    expect(snap).toBeTruthy();
    expect(snap.bridged).toBeTruthy();
    expect(typeof snap.driftBetweenStores).toBe('boolean');
  });

  it('SSR-safe — returns false without window', () => {
    const win = globalThis.window;
    delete globalThis.window;
    try {
      _resetWeatherAndLanguageDiagnosticsForTests();
      expect(installWeatherAndLanguageDiagnostics()).toBe(false);
    } finally {
      globalThis.window = win;
    }
  });

  it('weather snapshot reports hasCoords=true when farm has lat/lng', () => {
    useCanonicalFarmStore.getState().updateFarm({
      crop: 'pepper', lat: 39.04, lng: -77.49,
    });
    installWeatherAndLanguageDiagnostics();
    const snap = globalThis.window.__weatherRuntimeHealth();
    expect(snap.hasCoords).toBe(true);
    // lat/lng rounded to 2 decimals to avoid leaking exact coords.
    expect(Math.abs(snap.lat - 39.04)).toBeLessThan(0.01);
  });
});

// ═══ §10 aiFoundations ════════════════════════════════════════

describe('aiFoundations — provider readiness', () => {
  it('exposes the 6 documented providers', () => {
    expect(Object.values(AI_PROVIDER).length).toBe(6);
    expect(AI_PROVIDER.SATELLITE).toBe('satellite');
    expect(AI_PROVIDER.DISEASE).toBe('disease');
  });

  it('all providers default to NOT ready in production', () => {
    const r = getProviderReadiness();
    for (const p of Object.values(AI_PROVIDER)) {
      // every advanced provider is OFF by default per deploymentGovernance
      expect(r[p]).toBe(false);
    }
  });
});

describe('aiFoundations — stub responses', () => {
  it('satellite stub returns not-ready envelope', () => {
    const r = fetchSatelliteSignal({ region: 'Maryland' });
    expect(r.ok).toBe(false);
    expect(r.ready).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.SATELLITE);
    expect(r.payload).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('soil stub returns not-ready envelope', () => {
    const r = fetchSoilSignal({ latLng: { lat: 1, lng: 1 } });
    expect(r.ok).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.SOIL_API);
  });

  it('disease stub returns not-ready envelope', () => {
    const r = classifyDiseaseStub({ crop: 'pepper' });
    expect(r.ok).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.DISEASE);
  });

  it('yield stub returns not-ready envelope', () => {
    const r = forecastYieldStub({ crop: 'pepper' });
    expect(r.ok).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.YIELD);
  });

  it('voice handshake returns not-ready envelope', () => {
    const r = voiceAssistantHandshake({ locale: 'en' });
    expect(r.ok).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.VOICE_ASSISTANT);
  });

  it('buyer prediction stub returns not-ready envelope', () => {
    const r = predictBuyersStub({ crop: 'pepper', region: 'Maryland' });
    expect(r.ok).toBe(false);
    expect(r.provider).toBe(AI_PROVIDER.BUYER_PREDICTION);
  });

  it('stubs never throw on garbage input', () => {
    expect(() => fetchSatelliteSignal(null)).not.toThrow();
    expect(() => classifyDiseaseStub('string')).not.toThrow();
    expect(() => forecastYieldStub(42)).not.toThrow();
    expect(() => voiceAssistantHandshake(undefined)).not.toThrow();
  });
});

// ═══ _internal helpers ════════════════════════════════════════

describe('_internal helpers', () => {
  it('_diseaseLikelihoodFrom returns one of the 3 bands', () => {
    expect(intelInternal._diseaseLikelihoodFrom([], null)).toBe('low');
    expect(intelInternal._diseaseLikelihoodFrom([{ severity: 'serious' }], null)).toBe('high');
    expect(intelInternal._diseaseLikelihoodFrom([{ severity: 'moderate' }], null)).toBe('medium');
  });

  it('_scanUrgencyFrom respects worse-of decision + predictive', () => {
    expect(intelInternal._scanUrgencyFrom(null, null)).toBe('low');
    expect(intelInternal._scanUrgencyFrom({ urgency: 'high' }, null)).toBe('high');
    expect(intelInternal._scanUrgencyFrom(null, { anyHigh: true })).toBe('high');
  });
});
