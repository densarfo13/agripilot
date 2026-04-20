/**
 * offlineAlertCore.test.js — contract for §8 offline helpers
 * and §9 alert trigger.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  saveOffline, getOffline, clearOffline, isStale, OFFLINE_KEYS,
} from '../../../src/core/offline/offlineStore.js';
import {
  generateAlerts, notifyAlerts,
} from '../../../src/core/alerts/alertTrigger.js';
import { USE_CROP_TRANSLATIONS } from '../../../src/i18n/useCropTranslations.js';

function makeBackend() {
  const store = new Map();
  return {
    setItem:    (k, v) => store.set(k, String(v)),
    getItem:    (k) => store.has(k) ? store.get(k) : null,
    removeItem: (k) => store.delete(k),
    _dump:      () => Object.fromEntries(store),
    _size:      () => store.size,
  };
}

// ─── offlineStore (§8) ───────────────────────────────────────
describe('saveOffline / getOffline', () => {
  it('round-trips JSON data with timestamp', () => {
    const b = makeBackend();
    const save = saveOffline('last_farm', { id: 'f1', crop: 'maize' },
      { backend: b, nowMs: 1000 });
    expect(save.ok).toBe(true);
    expect(save.at).toBe(1000);

    const got = getOffline('last_farm', { backend: b, nowMs: 2500 });
    expect(got.data).toEqual({ id: 'f1', crop: 'maize' });
    expect(got.lastUpdatedAt).toBe(1000);
    expect(got.ageMs).toBe(1500);
  });

  it('namespaces keys to avoid colliding with other caches', () => {
    const b = makeBackend();
    saveOffline('x', 'y', { backend: b });
    const keys = Object.keys(b._dump());
    expect(keys[0]).toMatch(/^farroway\.offline\./);
  });

  it('returns null on missing entries', () => {
    expect(getOffline('never', { backend: makeBackend() })).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    const b = makeBackend();
    b.setItem('farroway.offline.broken', '{ not json');
    expect(getOffline('broken', { backend: b })).toBeNull();
  });

  it('returns null on wrong schema version', () => {
    const b = makeBackend();
    b.setItem('farroway.offline.legacy', JSON.stringify({ data: {}, at: 1, v: 0 }));
    expect(getOffline('legacy', { backend: b })).toBeNull();
  });

  it('rejects bad keys', () => {
    expect(saveOffline('', 'x', { backend: makeBackend() }).ok).toBe(false);
    expect(saveOffline(null, 'x', { backend: makeBackend() }).ok).toBe(false);
  });

  it('returns false when no backend available', () => {
    expect(saveOffline('x', 1).ok).toBe(false);
    expect(getOffline('x')).toBeNull();
    expect(clearOffline('x')).toBe(false);
  });

  it('rejects non-serializable data cleanly', () => {
    const b = makeBackend();
    const circular = {};
    circular.self = circular;
    const r = saveOffline('c', circular, { backend: b });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('serialize_failed');
  });

  it('clearOffline removes one entry', () => {
    const b = makeBackend();
    saveOffline('a', 1, { backend: b });
    saveOffline('b', 2, { backend: b });
    expect(clearOffline('a', { backend: b })).toBe(true);
    expect(getOffline('a', { backend: b })).toBeNull();
    expect(getOffline('b', { backend: b })).toBeTruthy();
  });
});

describe('isStale', () => {
  it('returns true for null / no entry', () => {
    expect(isStale(null)).toBe(true);
    expect(isStale(undefined)).toBe(true);
    expect(isStale({ ageMs: null })).toBe(true);
  });
  it('returns false when within threshold', () => {
    expect(isStale({ ageMs: 1000 }, 5000)).toBe(false);
  });
  it('returns true when older than threshold', () => {
    expect(isStale({ ageMs: 10000 }, 5000)).toBe(true);
  });
  it('default threshold is 24h', () => {
    expect(isStale({ ageMs: 23 * 60 * 60 * 1000 })).toBe(false);
    expect(isStale({ ageMs: 25 * 60 * 60 * 1000 })).toBe(true);
  });
});

describe('OFFLINE_KEYS', () => {
  it('exposes stable namespaced keys', () => {
    expect(OFFLINE_KEYS.LAST_FARM).toBe('last_farm');
    expect(OFFLINE_KEYS.LAST_TASKS).toBe('last_tasks');
    expect(Object.isFrozen(OFFLINE_KEYS)).toBe(true);
  });
});

// ─── alertTrigger (§9) ───────────────────────────────────────
describe('generateAlerts', () => {
  it('empty list when no signals present', () => {
    expect(generateAlerts({})).toEqual([]);
  });

  it('rain tomorrow → warning alert with structured payloads', () => {
    const alerts = generateAlerts({
      farm: { stage: 'land_prep' },
      weather: { rainTomorrow: true },
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].title.key).toBe('alert.rain_tomorrow.title');
    expect(alerts[0].body.key).toBe('alert.rain_tomorrow.body');
    expect(typeof alerts[0].body.fallback).toBe('string');
  });

  it('heavy rain + harvest stage → critical alert', () => {
    const alerts = generateAlerts({
      farm: { stage: 'harvest' },
      weather: { heavyRainExpected: true },
    });
    expect(alerts.some((a) => a.severity === 'critical')).toBe(true);
  });

  it('heavy rain outside harvest → no critical alert', () => {
    const alerts = generateAlerts({
      farm: { stage: 'vegetative' },
      weather: { heavyRainExpected: true },
    });
    expect(alerts.some((a) => a.id === 'alert.heavy_rain_harvest')).toBe(false);
  });

  it('dry + hot + vegetative → watering alert', () => {
    const alerts = generateAlerts({
      farm: { stage: 'vegetative' },
      weather: { dry: true, tempHigh: true },
    });
    expect(alerts.some((a) => a.id === 'alert.heat_dry')).toBe(true);
  });

  it('high pest risk → warning; critical pest risk → critical', () => {
    const a1 = generateAlerts({ pestRisk: { level: 'high',     pest: 'fall armyworm' } });
    const a2 = generateAlerts({ pestRisk: { level: 'critical', pest: 'fall armyworm' } });
    expect(a1[0].severity).toBe('warning');
    expect(a2[0].severity).toBe('critical');
    expect(a1[0].body.params.pest).toBe('fall armyworm');
  });

  it('sorts critical before warning before info', () => {
    const alerts = generateAlerts({
      farm: { stage: 'harvest' },
      weather: { heavyRainExpected: true, rainTomorrow: true },
    });
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[1].severity).toBe('warning');
  });

  it('every alert entry is frozen with stable id', () => {
    const alerts = generateAlerts({ weather: { rainTomorrow: true } });
    for (const a of alerts) {
      expect(Object.isFrozen(a)).toBe(true);
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
    }
  });

  it('safe on null/undefined/missing inputs', () => {
    expect(generateAlerts()).toEqual([]);
    expect(generateAlerts({ farm: null, weather: null })).toEqual([]);
  });
});

describe('notifyAlerts', () => {
  it('fires notifier for each alert with id returned', () => {
    const seen = [];
    const ids = notifyAlerts(
      [{ id: 'a', severity: 'info', title: {}, body: {} },
       { id: 'b', severity: 'info', title: {}, body: {} }],
      (a) => seen.push(a.id),
    );
    expect(seen).toEqual(['a', 'b']);
    expect(ids).toEqual(['a', 'b']);
  });
  it('one notifier throw does not block others', () => {
    const seen = [];
    const ids = notifyAlerts(
      [{ id: 'a', severity: 'info', title: {}, body: {} },
       { id: 'b', severity: 'info', title: {}, body: {} }],
      (a) => {
        if (a.id === 'a') throw new Error('boom');
        seen.push(a.id);
      },
    );
    expect(seen).toEqual(['b']);
    expect(ids).toEqual(['b']);
  });
  it('returns [] for non-function notifier / non-array alerts', () => {
    expect(notifyAlerts(null, () => {})).toEqual([]);
    expect(notifyAlerts([{ id: 'a' }], null)).toEqual([]);
  });
});

// ─── USE_CROP_TRANSLATIONS ───────────────────────────────────
describe('USE_CROP_TRANSLATIONS', () => {
  it('English has all three required keys', () => {
    expect(USE_CROP_TRANSLATIONS.en['cropFit.results.useThisCrop']).toBeTruthy();
    expect(USE_CROP_TRANSLATIONS.en['cropFit.results.farmUpdated']).toBeTruthy();
    expect(USE_CROP_TRANSLATIONS.en['cropFit.results.useCropFailed']).toBeTruthy();
  });
  it('Hindi uses Devanagari for useThisCrop', () => {
    expect(USE_CROP_TRANSLATIONS.hi['cropFit.results.useThisCrop']).toMatch(/[\u0900-\u097F]/);
  });
  it('French has characters typical of French', () => {
    const s = USE_CROP_TRANSLATIONS.fr['cropFit.results.useThisCrop'];
    expect(s).toMatch(/Choisir|culture/i);
  });
});
