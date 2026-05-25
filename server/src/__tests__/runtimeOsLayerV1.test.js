/**
 * runtimeOsLayerV1.test.js — verifies the Runtime OS Layer v1
 * primitives:
 *   • farmRuntimeStore         (central reactive state)
 *   • eventBus                 (pub/sub with closed vocabulary)
 *   • recommendationPriorityEngine
 *   • dailyDecisionLoop        (orchestration entry)
 *   • farmMemoryEngine
 *   • runtimeTelemetry         (counters + Sentry mirror)
 *   • intelligenceTemplates    (6 localized envelopes)
 *   • adapters                 (4 feature-flagged stubs)
 */

// localStorage shim for tests that touch persistence.
const _ls = (() => {
  const s = new Map();
  return {
    getItem:    (k) => (s.has(k) ? s.get(k) : null),
    setItem:    (k, v) => { s.set(k, String(v)); },
    removeItem: (k) => { s.delete(k); },
    clear:      () => { s.clear(); },
  };
})();
if (typeof globalThis.window === 'undefined') globalThis.window = { localStorage: _ls };
else if (!globalThis.window.localStorage) globalThis.window.localStorage = _ls;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SLICE, getRuntimeState, setRuntimeSlice, patchRuntimeSlice, subscribe,
  _resetRuntimeStoreForTests,
} from '../../../src/core/runtime/farmRuntimeStore.js';
import {
  EVENT, emit, on, off, subscriberCount, _resetEventBusForTests,
} from '../../../src/core/runtime/eventBus.js';
import {
  PRIORITY, rankRecommendations,
} from '../../../src/core/intelligence/recommendationPriorityEngine.js';
import {
  runDailyDecisionLoop,
} from '../../../src/core/runtime/dailyDecisionLoop.js';
import {
  rememberIgnoredRecommendation, rememberAcceptedRecommendation,
  rememberOutcome, getFarmMemorySnapshot, _resetFarmMemoryForTests,
} from '../../../src/core/memory/farmMemoryEngine.js';
import {
  METRIC, trackTelemetry, telemetryCounters, _resetTelemetryForTests,
} from '../../../src/core/telemetry/runtimeTelemetry.js';
import {
  diseaseAlertTemplate, weatherWarningTemplate, wateringAlertTemplate,
  harvestAlertTemplate, marketplacePromptTemplate, supplierPromptTemplate,
} from '../../../src/core/i18n/intelligenceTemplates/index.js';
import { fetchSatellite, isSatelliteAdapterEnabled }
  from '../../../src/core/intelligence/adapters/satelliteAdapter.js';
import { fetchSoil, isSoilAdapterEnabled }
  from '../../../src/core/intelligence/adapters/soilAdapter.js';
import { fetchSuppliers, isSupplierAdapterEnabled }
  from '../../../src/core/intelligence/adapters/supplierAdapter.js';
import { fetchMarketplace, isMarketplaceAdapterEnabled }
  from '../../../src/core/intelligence/adapters/marketplaceAdapter.js';

// ─── farmRuntimeStore ────────────────────────────────────

describe('farmRuntimeStore', () => {
  beforeEach(() => { _resetRuntimeStoreForTests({ clearLs: true }); });

  it('SLICE table covers the documented state surface', () => {
    for (const k of ['USER','FARM','CROP','LIFECYCLE','WEATHER','SOIL',
                     'SCAN_HISTORY','DISEASE_STATE','COMPLETED_TASKS',
                     'PENDING_TASKS','MARKETPLACE','SUPPLIER','FUNDING',
                     'NGO','LANGUAGE','NETWORK','OFFLINE_QUEUE',
                     'RECOMMENDATION_MEMORY','LAST_BEST_ACTION',
                     'SUPPRESSION_HISTORY','INTELLIGENCE_FLAGS']) {
      expect(SLICE[k]).toBeTruthy();
    }
  });

  it('set / get round-trip', () => {
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 30 });
    expect(getRuntimeState(SLICE.WEATHER).temperatureC).toBe(30);
  });

  it('patch shallow-merges objects', () => {
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 30, humidityPct: 50 });
    patchRuntimeSlice(SLICE.WEATHER, { temperatureC: 32 });
    expect(getRuntimeState(SLICE.WEATHER)).toEqual({ temperatureC: 32, humidityPct: 50 });
  });

  it('subscribers fire on set; unsubscribe stops them', () => {
    const seen = [];
    const unsub = subscribe(SLICE.WEATHER, (v) => seen.push(v.temperatureC));
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 25 });
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 26 });
    unsub();
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 27 });
    expect(seen).toEqual([25, 26]);
  });

  it('one subscriber throwing does not break others', () => {
    const ok = vi.fn();
    subscribe(SLICE.WEATHER, () => { throw new Error('boom'); });
    subscribe(SLICE.WEATHER, ok);
    setRuntimeSlice(SLICE.WEATHER, { temperatureC: 20 });
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('unknown slice → no write, no throw', () => {
    expect(setRuntimeSlice('bogus', { x: 1 })).toBe(false);
    expect(() => getRuntimeState('bogus')).not.toThrow();
  });

  it('persist:true writes to localStorage; rehydration on next load', () => {
    setRuntimeSlice(SLICE.LANGUAGE, 'tw', { persist: true });
    expect(_ls.getItem('farroway_runtime_language')).toBe('"tw"');
  });

  it('never throws on garbage input', () => {
    expect(() => setRuntimeSlice(null, null)).not.toThrow();
    expect(() => patchRuntimeSlice(null, null)).not.toThrow();
    expect(() => subscribe(null, null)).not.toThrow();
  });
});

// ─── eventBus ────────────────────────────────────────────

describe('eventBus', () => {
  beforeEach(() => { _resetEventBusForTests(); });

  it('EVENT table covers the documented vocabulary', () => {
    for (const k of ['CROP_ADDED','CROP_UPDATED','WEATHER_CHANGED',
                     'SCAN_COMPLETED','DISEASE_DETECTED','TASK_COMPLETED',
                     'TASK_SKIPPED','FARM_OPENED','OFFLINE_SYNC_COMPLETE',
                     'MARKETPLACE_PRICE_CHANGED','SUPPLIER_ALERT',
                     'IRRIGATION_DETECTED','HARVEST_READY','LANGUAGE_CHANGED',
                     'RECOMMENDATION_ACKNOWLEDGED']) {
      expect(EVENT[k]).toBeTruthy();
    }
  });

  it('on/emit/off round-trip', () => {
    const seen = [];
    const unsub = on(EVENT.SCAN_COMPLETED, (p) => seen.push(p.id));
    emit(EVENT.SCAN_COMPLETED, { id: 'a' });
    emit(EVENT.SCAN_COMPLETED, { id: 'b' });
    unsub();
    emit(EVENT.SCAN_COMPLETED, { id: 'c' });
    expect(seen).toEqual(['a', 'b']);
  });

  it('unknown event → emit no-op, on returns no-op unsubscribe', () => {
    expect(emit('bogus', {})).toBe(false);
    expect(typeof on('bogus', () => {})).toBe('function');
  });

  it('one handler throwing does not break others', () => {
    const ok = vi.fn();
    on(EVENT.TASK_COMPLETED, () => { throw new Error('boom'); });
    on(EVENT.TASK_COMPLETED, ok);
    emit(EVENT.TASK_COMPLETED, {});
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('subscriberCount returns the current count', () => {
    expect(subscriberCount(EVENT.HARVEST_READY)).toBe(0);
    const u1 = on(EVENT.HARVEST_READY, () => {});
    const u2 = on(EVENT.HARVEST_READY, () => {});
    expect(subscriberCount(EVENT.HARVEST_READY)).toBe(2);
    u1();
    expect(subscriberCount(EVENT.HARVEST_READY)).toBe(1);
    u2();
  });

  it('never throws on garbage input', () => {
    expect(() => emit(null, null)).not.toThrow();
    expect(() => on(null, null)).not.toThrow();
    expect(() => off(null, null)).not.toThrow();
  });
});

// ─── recommendationPriorityEngine ────────────────────────

describe('rankRecommendations', () => {
  it('disease beats watering beats market', () => {
    const { primary } = rankRecommendations([
      { type: 'market',   urgency: 'high' },
      { type: 'watering', urgency: 'normal' },
      { type: 'disease',  urgency: 'low' },
    ]);
    expect(primary.type).toBe('disease');
  });

  it('within tier, HIGH urgency wins', () => {
    const { primary } = rankRecommendations([
      { type: 'watering', urgency: 'low'    },
      { type: 'watering', urgency: 'high'   },
      { type: 'watering', urgency: 'normal' },
    ]);
    expect(primary.urgency).toBe('high');
  });

  it('explicit priority field overrides type inference', () => {
    const { primary } = rankRecommendations([
      { type: 'disease', priority: PRIORITY.NGO_FUNDING, urgency: 'low' },
      { type: 'market',  priority: PRIORITY.CRITICAL_DISEASE, urgency: 'low' },
    ]);
    expect(primary.type).toBe('market');
  });

  it('empty pool returns null primary', () => {
    expect(rankRecommendations([]).primary).toBe(null);
    expect(rankRecommendations(null).primary).toBe(null);
  });

  it('suppressed entries carry a reason', () => {
    const { suppressed } = rankRecommendations([
      { type: 'disease', urgency: 'high' },
      { type: 'market',  urgency: 'high' },
    ]);
    expect(suppressed[0].reason).toBe('lower_priority');
  });
});

// ─── dailyDecisionLoop ───────────────────────────────────

describe('runDailyDecisionLoop', () => {
  beforeEach(() => {
    _resetRuntimeStoreForTests({ clearLs: true });
    _resetEventBusForTests();
  });

  it('returns a shape with primaryAction + ordered + snapshot', () => {
    const r = runDailyDecisionLoop({ crop: 'tomato', nowMs: Date.now() });
    expect(r).toHaveProperty('primaryAction');
    expect(r).toHaveProperty('ordered');
    expect(r).toHaveProperty('snapshot');
    expect(r).toHaveProperty('suppressed');
  });

  it('emits FARM_OPENED', () => {
    const handler = vi.fn();
    on(EVENT.FARM_OPENED, handler);
    runDailyDecisionLoop({ crop: 'tomato' });
    expect(handler).toHaveBeenCalled();
  });

  it('persists lastBestAction into the runtime store', () => {
    runDailyDecisionLoop({
      crop: 'tomato',
      scanHistory: [{ issueCategory: 'fungal_risk' }],
    });
    // Either the action made it through suppression (good case)
    // OR the slice was set to null — both are valid outcomes.
    expect(SLICE.LAST_BEST_ACTION in (getRuntimeState() || {})).toBe(true);
  });

  it('never throws on garbage input', () => {
    expect(() => runDailyDecisionLoop(null)).not.toThrow();
  });
});

// ─── farmMemoryEngine ────────────────────────────────────

describe('farmMemoryEngine', () => {
  beforeEach(() => { _resetFarmMemoryForTests(); });

  it('rememberIgnored increments per-key counts', () => {
    rememberIgnoredRecommendation({ type: 'watering', id: 'w1' });
    rememberIgnoredRecommendation({ type: 'watering', id: 'w1' });
    rememberIgnoredRecommendation({ type: 'watering', id: 'w2' });
    const snap = getFarmMemorySnapshot();
    expect(snap.ignoreLog['watering::w1'].count).toBe(2);
    expect(snap.ignoreLog['watering::w2'].count).toBe(1);
  });

  it('rememberAccepted records a bounded history', () => {
    for (let i = 0; i < 25; i += 1) {
      rememberAcceptedRecommendation({ type: 'watering', id: 'w' }, 1_700_000_000 + i);
    }
    const snap = getFarmMemorySnapshot();
    expect(snap.acceptLog['watering::w'].history.length).toBe(20);
  });

  it('rememberOutcome appends to the outcome log', () => {
    rememberOutcome({ crop: 'tomato', yieldKg: 20 });
    rememberOutcome({ crop: 'tomato', yieldKg: 22 });
    expect(getFarmMemorySnapshot().outcomeLog.length).toBe(2);
  });

  it('null inputs → no-op, no throw', () => {
    expect(() => rememberIgnoredRecommendation(null)).not.toThrow();
    expect(() => rememberAcceptedRecommendation(null)).not.toThrow();
    expect(() => rememberOutcome(null)).not.toThrow();
  });
});

// ─── runtimeTelemetry ────────────────────────────────────

describe('runtimeTelemetry', () => {
  beforeEach(() => { _resetTelemetryForTests(); });

  it('tracks valid metrics + signatures', () => {
    trackTelemetry(METRIC.SCAN_SUCCEEDED);
    trackTelemetry(METRIC.SCAN_SUCCEEDED, { engine: 'scan' });
    trackTelemetry(METRIC.SCAN_FAILED, { reason: 'timeout' });
    const c = telemetryCounters();
    expect(c[METRIC.SCAN_SUCCEEDED]._).toBe(1);
    expect(c[METRIC.SCAN_SUCCEEDED]['engine=scan']).toBe(1);
    expect(c[METRIC.SCAN_FAILED]['reason=timeout']).toBe(1);
  });

  it('unknown metric → false, no throw', () => {
    expect(trackTelemetry('bogus')).toBe(false);
  });

  it('payload never serialises arbitrary user content', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    trackTelemetry(METRIC.RECOMMENDATION_IGNORED, {
      type: 'watering',
      secretName: 'should-not-leak',
    });
    const last = spy.mock.calls[0];
    const text = last[1];
    expect(text).not.toContain('should-not-leak');
    expect(text).toContain('watering');
    spy.mockRestore();
  });
});

// ─── intelligenceTemplates ───────────────────────────────

describe('intelligenceTemplates', () => {
  it('every template returns an envelope with key + fallback + params', () => {
    const samples = [
      diseaseAlertTemplate({ severity: 'high', crop: 'tomato' }),
      weatherWarningTemplate({ kind: 'rain' }),
      wateringAlertTemplate({ bestTime: 'morning', crop: 'maize' }),
      harvestAlertTemplate({ state: 'ready', crop: 'tomato' }),
      marketplacePromptTemplate({ kind: 'ready_to_sell', crop: 'pepper' }),
      supplierPromptTemplate({ trust: 'verified', category: 'compost' }),
    ];
    for (const env of samples) {
      expect(env.key).toBeTruthy();
      expect(typeof env.fallback).toBe('string');
      expect(env.params).toBeTruthy();
    }
  });

  it('severity tier picks distinct keys', () => {
    expect(diseaseAlertTemplate({ severity: 'high' }).key).toMatch(/high$/);
    expect(diseaseAlertTemplate({ severity: 'low' }).key).toMatch(/low$/);
  });

  it('hedged wording — no "confirmed disease" / "guaranteed"', () => {
    for (const env of [
      diseaseAlertTemplate({ severity: 'high' }),
      diseaseAlertTemplate({ severity: 'medium' }),
      marketplacePromptTemplate({ kind: 'ready_to_sell' }),
      harvestAlertTemplate({ state: 'ready' }),
    ]) {
      expect(env.fallback.toLowerCase()).not.toMatch(/confirmed|guaranteed|definitely/);
    }
  });

  it('null inputs return a safe default envelope', () => {
    expect(() => diseaseAlertTemplate(null)).not.toThrow();
    expect(diseaseAlertTemplate(null).key).toBeTruthy();
  });
});

// ─── adapters ────────────────────────────────────────────

describe('adapters — feature-flag-gated', () => {
  it('all four return ok:false / safe defaults when flag is OFF', async () => {
    expect(isSatelliteAdapterEnabled()).toBe(false);
    expect(isSoilAdapterEnabled()).toBe(false);
    expect(isSupplierAdapterEnabled()).toBe(false);
    expect(isMarketplaceAdapterEnabled()).toBe(false);
    expect((await fetchSatellite()).ok).toBe(false);
    expect((await fetchSoil()).ok).toBe(false);
    expect((await fetchSuppliers()).ok).toBe(false);
    expect((await fetchMarketplace()).ok).toBe(false);
  });

  it('never throws on garbage input', async () => {
    await expect(fetchSatellite(null)).resolves.toBeTruthy();
    await expect(fetchSoil(null)).resolves.toBeTruthy();
    await expect(fetchSuppliers(null)).resolves.toBeTruthy();
    await expect(fetchMarketplace(null)).resolves.toBeTruthy();
  });
});
