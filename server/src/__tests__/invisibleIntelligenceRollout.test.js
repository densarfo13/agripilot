/**
 * invisibleIntelligenceRollout.test.js — verifies the seven new
 * modules in the safe invisible-intelligence rollout.
 */

// localStorage / window shim for offlineStore-backed tests
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
import {
  detectFarmRisks, RISK_TYPE, RISK_SEVERITY,
} from '../../../src/core/intelligence/riskEngine.js';
import {
  computeHarvestReadiness, READINESS_LABEL,
} from '../../../src/core/intelligence/harvestReadinessEngine.js';
import {
  estimateYield,
} from '../../../src/core/intelligence/yieldForecastEngine.js';
import {
  listSatelliteProviders, getSatelliteProvider, isSatelliteEnabled,
} from '../../../src/core/satellite/satelliteProviderRegistry.js';
import {
  saveFieldBoundary, getFieldBoundaries, removeFieldBoundary, clearFieldBoundaries,
} from '../../../src/core/satellite/fieldBoundaryStore.js';
import {
  ndviPlaceholder, labelForNdvi, NDVI_LABEL,
} from '../../../src/core/satellite/ndviPlaceholder.js';
import {
  computeInvisibleIntelligence,
} from '../../../src/core/intelligence/invisibleIntelligenceEngine.js';

const NOW = Date.UTC(2026, 4, 24);
const DAY = 86400000;

// ─── riskEngine ─────────────────────────────────────────

describe('detectFarmRisks — operational risk classifier', () => {
  it('humid + low temp → fungal risk', () => {
    const r = detectFarmRisks({
      crop: 'tomato',
      weather: { humidityPct: 88, temperatureC: 22 },
    });
    expect(r.find((x) => x.type === RISK_TYPE.FUNGAL)).toBeTruthy();
  });

  it('high temp + tender stage → heat stress', () => {
    const r = detectFarmRisks({
      crop: 'tomato',
      weather: { temperatureC: 35 },
      lifecycle: { currentStage: 'flowering' },
    });
    const heat = r.find((x) => x.type === RISK_TYPE.HEAT_STRESS);
    expect(heat).toBeTruthy();
    expect(['medium','high']).toContain(heat.severity);
  });

  it('long dry spell → drought risk', () => {
    const r = detectFarmRisks({
      crop: 'maize',
      weather: { daysSinceRain: 10, rainProbability24hPct: 10 },
    });
    expect(r.find((x) => x.type === RISK_TYPE.DROUGHT)).toBeTruthy();
  });

  it('heavy rain on ready harvest → spoilage risk', () => {
    const r = detectFarmRisks({
      crop: 'tomato',
      weather: { rainProbability24hPct: 85 },
      lifecycle: { currentStage: 'harvest_ready' },
    });
    expect(r.find((x) => x.type === RISK_TYPE.HARVEST_SPOILAGE)).toBeTruthy();
  });

  it('every risk has hedged wording + prevention', () => {
    const r = detectFarmRisks({
      crop: 'tomato',
      weather: { humidityPct: 88, temperatureC: 22 },
    });
    for (const risk of r) {
      expect(risk.message.fallback).toMatch(/possible|may|likely|risk|rising/i);
      expect(risk.prevention.fallback.length).toBeGreaterThan(0);
    }
  });

  it('returns ranked by severity (highest first)', () => {
    const r = detectFarmRisks({
      crop: 'tomato',
      weather: { temperatureC: 38, humidityPct: 88, daysSinceRain: 15 },
      lifecycle: { currentStage: 'flowering' },
    });
    if (r.length >= 2) {
      const sev = { high: 3, medium: 2, low: 1 };
      for (let i = 1; i < r.length; i++) {
        expect(sev[r[i - 1].severity]).toBeGreaterThanOrEqual(sev[r[i].severity]);
      }
    }
  });

  it('never throws on garbage input', () => {
    expect(() => detectFarmRisks(null)).not.toThrow();
    expect(detectFarmRisks(null)).toEqual([]);
  });
});

// ─── harvestReadinessEngine ─────────────────────────────

describe('computeHarvestReadiness — calm readiness view', () => {
  it('80 days past planting tomato → ready or close to ready', () => {
    const r = computeHarvestReadiness({
      crop: 'tomato',
      plantingDate: new Date(NOW - 80 * DAY).toISOString(),
      nowMs: NOW,
    });
    expect(r.ok).toBe(true);
    expect([
      READINESS_LABEL.READY_WINDOW,
      READINESS_LABEL.MATURING,
      READINESS_LABEL.OVERDUE,
    ]).toContain(r.readinessLabel);
    expect(r.isEstimate).toBe(true);
    expect(r.confidence).not.toBe('high');
  });

  it('no planting date → unknown + calm message', () => {
    const r = computeHarvestReadiness({ crop: 'tomato', nowMs: NOW });
    expect(r.ok).toBe(false);
    expect(r.readinessLabel).toBe(READINESS_LABEL.UNKNOWN);
  });

  it('rain on a ready window flags spoilage risk', () => {
    const r = computeHarvestReadiness({
      crop: 'tomato',
      plantingDate: new Date(NOW - 75 * DAY).toISOString(),
      weather: { rainProbability24hPct: 80 },
      nowMs: NOW,
    });
    if (r.readinessLabel === READINESS_LABEL.READY_WINDOW) {
      expect(r.spoilageRisk).toBe(true);
    }
  });

  it('never claims high confidence', () => {
    const r = computeHarvestReadiness({
      crop: 'tomato',
      plantingDate: new Date(NOW - 80 * DAY).toISOString(),
      nowMs: NOW,
    });
    expect(r.confidence).not.toBe('high');
  });

  it('never throws on garbage input', () => {
    expect(() => computeHarvestReadiness(null)).not.toThrow();
    expect(computeHarvestReadiness(null).readinessLabel).toBe(READINESS_LABEL.UNKNOWN);
  });
});

// ─── yieldForecastEngine — honest, hedged ───────────────

describe('estimateYield — wide ranges, never guaranteed', () => {
  it('returns not_enough_data without plant count', () => {
    expect(estimateYield({ crop: 'tomato' }).reason).toBe('not_enough_data');
  });

  it('returns not_enough_data for unknown crops', () => {
    expect(estimateYield({ crop: 'xyz', plantCount: 5 }).reason).toBe('not_enough_data');
  });

  it('confidence is always "low" — no real model', () => {
    const r = estimateYield({ crop: 'tomato', plantCount: 10 });
    expect(r.confidenceLabel).toBe('low');
  });

  it('range MAX is always >= MIN', () => {
    const r = estimateYield({ crop: 'tomato', plantCount: 10 });
    expect(r.estimatedRangeKg.max).toBeGreaterThanOrEqual(r.estimatedRangeKg.min);
  });

  it('disclaimer warns against financial planning', () => {
    const r = estimateYield({ crop: 'tomato', plantCount: 10 });
    expect(r.disclaimer).toMatch(/ballpark|local|do not plan finances/i);
  });

  it('poor health (recent fungal scan) reduces upper bound', () => {
    const healthy = estimateYield({ crop: 'tomato', plantCount: 10,
      scanHistory: [{ issueCategory: 'healthy' }], taskCompletionRate: 0.9 });
    const sick   = estimateYield({ crop: 'tomato', plantCount: 10,
      scanHistory: [{ issueCategory: 'fungal_risk' }], taskCompletionRate: 0.4 });
    expect(sick.estimatedRangeKg.max).toBeLessThan(healthy.estimatedRangeKg.max);
  });
});

// ─── satellite preparation seams ────────────────────────

describe('satellite seams — architecture only, nothing live', () => {
  it('default state: no provider enabled', () => {
    expect(isSatelliteEnabled()).toBe(false);
  });

  it('registry lists multiple candidate providers, none enabled (except none)', () => {
    const providers = listSatelliteProviders();
    expect(providers.length).toBeGreaterThan(1);
    const others = providers.filter((p) => p.id !== 'none');
    for (const p of others) expect(p.enabled).toBe(false);
  });

  it('unknown provider id falls back to "none"', () => {
    expect(getSatelliteProvider('not_a_provider').id).toBe('none');
  });

  it('ndviPlaceholder always returns no_provider until one is enabled', () => {
    expect(ndviPlaceholder({ fieldId: 'f1' }).reason).toBe('no_provider');
  });

  it('labelForNdvi maps numeric values to honest bands', () => {
    expect(labelForNdvi(0.05)).toBe(NDVI_LABEL.BARE);
    expect(labelForNdvi(0.7)).toBe(NDVI_LABEL.DENSE);
    expect(labelForNdvi(null)).toBe(null);
  });
});

describe('fieldBoundaryStore — offline-safe geometry persistence', () => {
  beforeEach(() => { _s.clear(); clearFieldBoundaries(); });

  it('saves a valid polygon and retrieves it', () => {
    const e = saveFieldBoundary({
      name: 'Test field',
      coordinates: [[0, 0], [1, 0], [1, 1], [0, 1]],
    });
    expect(e).toBeTruthy();
    expect(e.id).toBeTruthy();
    expect(getFieldBoundaries().length).toBe(1);
  });

  it('rejects invalid coordinates (out of range / wrong shape)', () => {
    expect(saveFieldBoundary({ coordinates: [[200, 0], [1, 0], [1, 1]] })).toBe(null);
    expect(saveFieldBoundary({ coordinates: [[0, 0]] })).toBe(null);
  });

  it('removeFieldBoundary deletes by id', () => {
    const e = saveFieldBoundary({
      name: 'X', coordinates: [[0, 0], [1, 0], [1, 1]],
    });
    removeFieldBoundary(e.id);
    expect(getFieldBoundaries().length).toBe(0);
  });

  it('never throws on garbage input', () => {
    expect(() => saveFieldBoundary(null)).not.toThrow();
    expect(saveFieldBoundary(null)).toBe(null);
  });
});

// ─── invisible intelligence facade ──────────────────────

describe('computeInvisibleIntelligence — one structured snapshot', () => {
  it('returns the documented shape with no thrown errors', () => {
    const v = computeInvisibleIntelligence({
      crop: 'tomato',
      plantingDate: new Date(NOW - 50 * DAY).toISOString(),
      weather: { temperatureC: 26, humidityPct: 60, rainProbability24hPct: 10 },
      scanHistory: [{ issueCategory: 'healthy' }],
      mode: 'gardener',
      plantCount: 10,
      taskCompletionRate: 0.8,
      nowMs: NOW,
    });
    expect(v.ok).toBe(true);
    expect(v.lifecycle).toBeTruthy();
    expect(v.weatherInsight).toBeTruthy();
    expect(v.watering).toBeTruthy();
    expect(Array.isArray(v.risks)).toBe(true);
    expect(v.harvestReadiness).toBeTruthy();
    expect(v.yieldEstimate).toBeTruthy();
    expect(v.dailyDecision).toBeTruthy();
    expect(v.top3).toBeTruthy();
    expect(v.disclaimer).toMatch(/estimates|local conditions/i);
  });

  it('handles a minimal snapshot — empty inputs produce safe defaults', () => {
    const v = computeInvisibleIntelligence({});
    expect(v.ok).toBe(true);
    expect(Array.isArray(v.risks)).toBe(true);
    // No plant count + no planting date → no yieldEstimate / harvest.
    expect(v.yieldEstimate).toBe(null);
    expect(v.harvestReadiness).toBe(null);
  });

  it('never throws on garbage input', () => {
    expect(() => computeInvisibleIntelligence(null)).not.toThrow();
  });
});
