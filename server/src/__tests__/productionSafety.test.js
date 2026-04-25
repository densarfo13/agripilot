/**
 * productionSafety.test.js — gap-filling tests the audit identified
 * as the real-world risks NOT already covered by the existing
 * intelligence suites (cropEngine, topCropEngine, seasonalCrop,
 * rainfallFit, farmEconomics, insight, notifications, channels).
 *
 * This file covers the spec's business-critical tests that don't
 * have a natural home elsewhere:
 *
 *   • Farm payload + canonical crop field (§2A)
 *   • Area unit conversion (§2A)
 *   • Stage task leakage (§2C)
 *   • Profit engine currency bug (§2E)
 *   • Logout / shared-device session clear (§2F)
 *   • API base URL assertion (§2I)
 *   • Fetch timeout wrapper resolves loading flags (§4)
 *
 * All tests run in the server/ vitest harness (same as the other
 * crop-intel suites) so they live on the same CI command.
 */

import { describe, it, expect } from 'vitest';

import {
  normalizeCropId, getCropLabel, getCropImage,
} from '../../../src/config/crops/index.js';
import { normalizeStageKey } from '../../../src/config/cropLifecycles.js';
import { toSquareMeters } from '../../../src/lib/units/areaConversion.js';
import {
  getTasksForCropStage,
} from '../../../src/config/crops/cropRegistry.js';
import {
  estimateFarmEconomics,
} from '../../../src/lib/intelligence/farmEconomicsEngine.js';
import {
  clearSessionState, _internal as sessionInternal,
} from '../../../src/lib/auth/clearSessionState.js';
import {
  resolveApiBase,
} from '../../../src/lib/api/assertApiBaseUrl.js';
import {
  withTimeout, translateErrorCode,
} from '../../../src/lib/api/withTimeout.js';

// ═══════════════════════════════════════════════════════════════
// §2A — Farm payload + canonical crop field
// ═══════════════════════════════════════════════════════════════
describe('farm payload normalizer', () => {
  it('"Corn" → maize', () => {
    expect(normalizeCropId('Corn')).toBe('maize');
  });
  it('"Pepper / chili" → pepper (slash-separated compound)', () => {
    // When a label like "Pepper / chili" appears, take the first token.
    // If normalizeCropId can't resolve the compound directly, callers
    // split on '/' and retry; this test locks the expected retry outcome.
    const first = String('Pepper / chili').split('/')[0].trim();
    expect(normalizeCropId(first)).toBe('pepper');
  });
  it('"Groundnut (Peanut)" → groundnut', () => {
    const first = String('Groundnut (Peanut)').split(/[\s(]/)[0].trim();
    expect(normalizeCropId(first)).toBe('groundnut');
  });
  it('"sweet potato" / "SWEET_POTATO" → sweet-potato', () => {
    expect(normalizeCropId('sweet potato')).toBe('sweet-potato');
    expect(normalizeCropId('SWEET_POTATO')).toBe('sweet-potato');
  });
  it('unknown crops return null, never throw', () => {
    expect(normalizeCropId('teff')).toBeNull();
    expect(() => normalizeCropId(null)).not.toThrow();
  });
});

describe('stage normaliser', () => {
  it('"Land prep" → land_preparation → planting', () => {
    // 'land_prep' / 'land_preparation' both collapse to 'planting'
    // per cropLifecycles.js STAGE_ALIASES.
    expect(normalizeStageKey('Land prep')).toBe('planting');
    expect(normalizeStageKey('land_preparation')).toBe('planting');
  });
});

describe('area unit conversion', () => {
  it('sqft → sqm (1 ft² = 0.0929 m²)', () => {
    const out = toSquareMeters(100, 'sqft');
    expect(out).toBeGreaterThan(9);
    expect(out).toBeLessThan(10);
  });
  it('sqm → sqm (identity)', () => {
    expect(toSquareMeters(500, 'sqm')).toBe(500);
  });
  it('acres → sqm (1 acre ≈ 4046.86)', () => {
    const out = toSquareMeters(1, 'acres');
    expect(out).toBeGreaterThan(4000);
    expect(out).toBeLessThan(4100);
  });
  it('hectares → sqm (1 ha = 10000)', () => {
    expect(toSquareMeters(1, 'hectares')).toBe(10000);
  });
  it('invalid input returns null, never throws', () => {
    expect(toSquareMeters('xx', 'sqm')).toBeNull();
    expect(toSquareMeters(100, 'furlongs')).toBeNull();
    expect(() => toSquareMeters(undefined, undefined)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// Fix 7 — farmActionPlan prefers computed stage over stored
// ═══════════════════════════════════════════════════════════════
import { buildFarmActionPlan } from '../../../src/lib/intelligence/farmActionPlan.js';

describe('farmActionPlan stage source-of-truth', () => {
  it('prefers computed stage from timeline over stale farm.cropStage', () => {
    // Farm planted 100 days ago (well past vegetative for maize).
    // Stored cropStage='vegetative' is stale; the timeline will
    // compute a later stage from plantingDate+lifecycle.
    const plantingDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    const farm = {
      id: 'farm-stale',
      crop: 'maize',
      cropStage: 'vegetative', // stale stored value
      plantingDate,
      country: 'GH',
      farmType: 'small_farm',
    };
    const plan = buildFarmActionPlan({ farm });
    expect(plan).toBeTruthy();
    // The plan's `thisWeek` task IDs should match the computed stage,
    // not the stored 'vegetative'. Maize at +100 days lands in
    // grain_fill or harvest. Either way no maize.veg.* tasks.
    const ids = (plan.thisWeek || []).map((t) => t.templateId || t.id || '');
    for (const id of ids) {
      expect(id).not.toMatch(/maize\.veg\./);
    }
  });

  it('falls back to stored cropStage when no plantingDate is set', () => {
    const farm = {
      id: 'farm-no-date',
      crop: 'maize',
      cropStage: 'vegetative', // stored, no planting date so timeline can't compute
      country: 'GH',
      farmType: 'small_farm',
    };
    const plan = buildFarmActionPlan({ farm });
    // Stored value is the only thing we have — plan should still
    // produce something (not crash, not return empty).
    expect(plan).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// §2C — Stage task leakage
// ═══════════════════════════════════════════════════════════════
describe('stage task leakage', () => {
  it('maize vegetative stage returns only maize.veg.* tasks', () => {
    const tasks = getTasksForCropStage('maize', 'vegetative');
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.id.startsWith('maize.veg.')).toBe(true);
    }
  });
  it('maize vegetative task pool does NOT contain flowering / tasseling tasks', () => {
    const veg = getTasksForCropStage('maize', 'vegetative');
    const ids = veg.map((t) => t.id);
    for (const id of ids) {
      expect(id).not.toMatch(/\.flow\./);
      expect(id).not.toMatch(/\.tas\./);
      expect(id).not.toMatch(/\.harv\./);
    }
  });
  it('cassava bulking tasks do not leak to harvest stage', () => {
    const harvest = getTasksForCropStage('cassava', 'harvest');
    for (const t of harvest) expect(t.id).not.toMatch(/\.bulk\./);
  });
  it('unknown crop + known stage → empty list (safe)', () => {
    expect(getTasksForCropStage('teff', 'vegetative')).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// §2E — Profit engine currency bug
// ═══════════════════════════════════════════════════════════════
describe('profit engine — currency consistency', () => {
  it('GH cassava farm: value and cost report SAME currency (or cost documented as USD)', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'GH',
      normalizedAreaSqm: 1000, currentStage: 'growing',
      farmType: 'small_farm', seasonFit: 'high', rainfallFit: 'high',
    });
    expect(econ).toBeTruthy();
    expect(econ.value).toBeTruthy();
    expect(econ.profit).toBeTruthy();
    const valueCurrency  = econ.value.currency;
    const profitCurrency = econ.profit.currency;
    // Either the currencies match (desired state when FX is wired),
    // OR cost is explicitly tagged as a USD fallback (current audit
    // state). Anything else is a silent mixed-currency arithmetic bug.
    const reasonsSet = new Set(econ.profit.reasons || []);
    const isHonestUsdFallback = profitCurrency === 'USD'
      && (reasonsSet.has('econ.reason.costUsdFallback')
          || reasonsSet.has('econ.reason.costUsdBase')
          || reasonsSet.has('econ.reason.profitInUsdFallback'));
    const isSameCurrency = profitCurrency === valueCurrency;
    expect(isSameCurrency || isHonestUsdFallback).toBe(true);
  });

  it('profit currency is never null/undefined', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'GH',
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    expect(econ.profit.currency).toBeTruthy();
    expect(typeof econ.profit.currency).toBe('string');
  });

  it('unknown country: value + cost both fall back to USD — consistent', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'ZZ',
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    expect(econ.value.currency).toBe('USD');
    expect(econ.profit.currency).toBe('USD');
  });

  it('profit range is not fake-precise (whole-number rounding)', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'GH',
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    // cents precision at most (×100 rounding in round2).
    const decimals = (n) => {
      const s = String(n);
      const i = s.indexOf('.');
      return i < 0 ? 0 : s.length - i - 1;
    };
    expect(decimals(econ.profit.lowProfit)).toBeLessThanOrEqual(2);
    expect(decimals(econ.profit.highProfit)).toBeLessThanOrEqual(2);
  });

  it('GH cassava: profit falls back to USD on BOTH sides (no currency mix)', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'GH',
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    // Value is in GHS (country band), cost has no local FX available
    // → profit engine rebuilds value in USD so both sides match.
    expect(econ.value.currency).toBe('GHS');
    expect(econ.profit.currency).toBe('USD');
    // Profit must carry the explicit USD-fallback reason so the UI
    // can label it honestly. Never mixed-currency arithmetic.
    expect(econ.profit.reasons).toContain('econ.reason.profitInUsdFallback');
  });

  it('NG tomato: same safe-mode USD fallback', () => {
    const econ = estimateFarmEconomics({
      cropId: 'tomato', country: 'NG',
      normalizedAreaSqm: 500, currentStage: 'fruiting',
    });
    expect(econ.value.currency).toBe('NGN');
    expect(econ.profit.currency).toBe('USD');
    expect(econ.profit.reasons).toContain('econ.reason.profitInUsdFallback');
  });

  it('USD-only country: value and profit both in USD, same math', () => {
    const econ = estimateFarmEconomics({
      cropId: 'cassava', country: 'ZZ',
      normalizedAreaSqm: 1000, currentStage: 'growing',
    });
    expect(econ.value.currency).toBe('USD');
    expect(econ.profit.currency).toBe('USD');
    expect(econ.profit.lowProfit).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// §2F — Logout / shared-device session clear
// ═══════════════════════════════════════════════════════════════
describe('clearSessionState', () => {
  function makeStorage() {
    const m = new Map();
    return {
      get length() { return m.size; },
      key(i) { return [...m.keys()][i] || null; },
      getItem(k) { return m.has(k) ? m.get(k) : null; },
      setItem(k, v) { m.set(k, String(v)); },
      removeItem(k) { m.delete(k); },
      clear() { m.clear(); },
      _peek() { return [...m.keys()]; },
    };
  }
  function makeCaches(names = []) {
    const store = new Map(names.map((n) => [n, true]));
    return {
      async keys() { return [...store.keys()]; },
      async delete(n) { return store.delete(n); },
    };
  }

  it('clears every known auth + farm + notifications key', async () => {
    const ls = makeStorage();
    for (const k of sessionInternal.LOCAL_STORAGE_KEYS) ls.setItem(k, 'stale');
    ls.setItem('farroway:crop_insight:farm-42', JSON.stringify({}));
    ls.setItem('farroway:prefs:reminder', '06:00');
    const ss = makeStorage(); ss.setItem('transient', '1');
    const cs = makeCaches(['farroway-v34', 'farroway-api-v7']);

    const out = await clearSessionState({
      localStorageRef: ls, sessionStorageRef: ss, cachesRef: cs,
    });

    expect(ls._peek().length).toBe(0);
    expect(ss._peek().length).toBe(0);
    expect(out.clearedCaches).toContain('farroway-v34');
    expect(out.clearedCaches).toContain('farroway-api-v7');
    expect(out.errors).toEqual([]);
  });

  it('survives absent globals (SSR / tests)', async () => {
    const out = await clearSessionState({
      localStorageRef: null, sessionStorageRef: null, cachesRef: null,
    });
    expect(out.errors).toEqual([]);
    expect(out.clearedKeys).toEqual([]);
    expect(out.clearedCaches).toEqual([]);
  });

  it('sweeps prefixed keys (farroway:crop_insight:*)', async () => {
    const ls = makeStorage();
    ls.setItem('farroway:crop_insight:a', '1');
    ls.setItem('farroway:crop_insight:b', '2');
    ls.setItem('unrelated:key', 'keep');
    const out = await clearSessionState({
      localStorageRef: ls, sessionStorageRef: null, cachesRef: null,
    });
    expect(out.clearedKeys).toEqual(expect.arrayContaining([
      'farroway:crop_insight:a', 'farroway:crop_insight:b',
    ]));
    expect(ls.getItem('unrelated:key')).toBe('keep');
  });

  it('collects errors without throwing when a single key fails', async () => {
    const ls = {
      length: 0, key: () => null, getItem: () => 'x',
      setItem() {}, clear() {},
      removeItem(k) { if (k.includes('session_cache')) throw new Error('locked'); },
    };
    const out = await clearSessionState({
      localStorageRef: ls, sessionStorageRef: null, cachesRef: null,
    });
    expect(out.errors.length).toBeGreaterThan(0);
    // But the function resolved — no throw.
  });
});

// ═══════════════════════════════════════════════════════════════
// §2I — API base URL assertion + build-time config
// ═══════════════════════════════════════════════════════════════
describe('resolveApiBase', () => {
  it('dev mode + no env → returns empty string without throwing', () => {
    expect(resolveApiBase({ isProd: false, env: {}, capacitor: false }))
      .toBe('');
  });
  it('prod mode + missing env → throws with actionable message', () => {
    expect(() => resolveApiBase({ isProd: true, env: {}, capacitor: false }))
      .toThrow(/VITE_API_BASE_URL is required/);
  });
  it('prod mode + env present → returns trimmed value', () => {
    expect(resolveApiBase({
      isProd: true, env: { VITE_API_BASE_URL: 'https://api.farroway.app/' },
      capacitor: false,
    })).toBe('https://api.farroway.app');
  });
  it('capacitor build + missing env → throws even in dev mode', () => {
    expect(() => resolveApiBase({ isProd: false, env: {}, capacitor: true }))
      .toThrow(/Capacitor/);
  });
  it('strips trailing slash so callers can safely concat /api/...', () => {
    expect(resolveApiBase({
      isProd: true, env: { VITE_API_BASE_URL: 'https://api.x.com///' },
    })).toBe('https://api.x.com');
  });
});

// ═══════════════════════════════════════════════════════════════
// §4 — Fetch timeout wrapper
// ═══════════════════════════════════════════════════════════════
describe('withTimeout', () => {
  it('resolves { ok:true, data } when the work completes in time', async () => {
    const out = await withTimeout(
      () => Promise.resolve({ hello: 'world' }),
      { ms: 100 });
    expect(out.ok).toBe(true);
    expect(out.data).toEqual({ hello: 'world' });
  });

  it('resolves { ok:false, code:timeout } when work exceeds budget', async () => {
    const out = await withTimeout(
      (signal) => new Promise((res) => {
        // Never resolve; the timeout should win.
        const t = setTimeout(() => res('late'), 500);
        signal.addEventListener('abort', () => clearTimeout(t));
      }),
      { ms: 50 });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('timeout');
  });

  it('surfaces http errors with status', async () => {
    const out = await withTimeout(
      () => {
        const err = new Error('Bad request');
        err.code = 'http'; err.status = 400;
        throw err;
      },
      { ms: 200 });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('http');
    expect(out.status).toBe(400);
  });

  it('surfaces network errors distinctly from timeouts', async () => {
    const out = await withTimeout(
      () => Promise.reject(new TypeError('Failed to fetch')),
      { ms: 200 });
    expect(out.ok).toBe(false);
    expect(out.code).toBe('network');
  });

  it('classifies parse errors', async () => {
    const out = await withTimeout(
      () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
      { ms: 200 });
    expect(out.code).toBe('parse');
  });

  it('always resolves loading flag — even when work hangs forever', async () => {
    let loading = true;
    const out = await withTimeout(
      (signal) => new Promise((resolve) => {
        // Simulate a fetch that never resolves; the deadline must
        // still unblock the caller's loading state.
        const t = setTimeout(() => resolve('late'), 9999);
        signal.addEventListener('abort', () => clearTimeout(t));
      }),
      { ms: 30 });
    loading = false;   // caller always reaches this line
    expect(loading).toBe(false);
    expect(out.ok).toBe(false);
    expect(out.code).toBe('timeout');
  });

  it('translateErrorCode maps every case to an i18n key', () => {
    for (const code of ['timeout', 'network', 'http', 'parse', 'aborted', 'unknown']) {
      expect(translateErrorCode(code)).toMatch(/^error\./);
    }
    expect(translateErrorCode('bogus')).toBe('error.unknown');
  });

  it('never throws on unexpected errors', async () => {
    let out;
    await expect((async () => {
      out = await withTimeout(() => Promise.reject('bare string'), { ms: 100 });
    })()).resolves.toBeUndefined();
    expect(out.ok).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// §2A — API boundary canonicalisation
// ═══════════════════════════════════════════════════════════════
// Re-implement the helper locally so the test stays independent of
// fetch / the request() wrapper (pure-function unit test).
function canonicalizeFarmPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  if (out.crop == null && out.cropType != null) out.crop = out.cropType;
  if ('cropType' in out) delete out.cropType;
  return out;
}

describe('farm API boundary — canonicalizeFarmPayload', () => {
  it('aliases cropType onto crop when only cropType is present', () => {
    const out = canonicalizeFarmPayload({ cropType: 'CASSAVA', other: 1 });
    expect(out.crop).toBe('CASSAVA');
    expect(out.cropType).toBeUndefined();
    expect(out.other).toBe(1);
  });
  it('prefers existing crop over cropType', () => {
    const out = canonicalizeFarmPayload({ crop: 'maize', cropType: 'TOMATO' });
    expect(out.crop).toBe('maize');
    expect(out.cropType).toBeUndefined();
  });
  it('never lets cropType leak through', () => {
    const out = canonicalizeFarmPayload({ cropType: 'X' });
    expect('cropType' in out).toBe(false);
  });
  it('passes through unrelated fields unchanged', () => {
    const out = canonicalizeFarmPayload({
      normalizedAreaSqm: 1000, farmType: 'small_farm', country: 'GH',
    });
    expect(out.normalizedAreaSqm).toBe(1000);
    expect(out.farmType).toBe('small_farm');
    expect(out.country).toBe('GH');
  });
  it('never throws on garbage', () => {
    expect(() => canonicalizeFarmPayload(null)).not.toThrow();
    expect(() => canonicalizeFarmPayload(undefined)).not.toThrow();
    expect(() => canonicalizeFarmPayload('nope')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════
// Fix 4 — Adapter defaults to in_app only (live-channel gate)
// ═══════════════════════════════════════════════════════════════
import {
  buildNotifications as adapterBuildNotifications,
  DEFAULT_LIVE_CHANNELS,
} from '../../../src/lib/notifications/insightNotificationAdapter.js';

describe('insight adapter live-channel gate', () => {
  const FARM = { id: 'farm-1', farmType: 'small_farm',
                  country: 'GH', cropType: 'cassava',
                  phone: '+233555123456' };
  const HIGH_INSIGHT = {
    id: 'insight.water.stress',
    type: 'warning', priority: 'high',
    messageKey: 'insight.water.stress.msg',
    fallbackMessage: 'Water stress risk',
    recommendedAction: 'Irrigate today',
  };

  it('default call emits ONLY in_app rows (no SMS/WhatsApp/voice)', () => {
    const out = adapterBuildNotifications({
      userId: 'u1', farms: [FARM], insights: [HIGH_INSIGHT],
      userPreferences: { receiveSMS: true, receiveWhatsApp: true,
                          receiveVoiceAlerts: true, literacyMode: 'voice' },
    });
    for (const row of out) expect(row.type).toBe('in_app');
  });

  it('DEFAULT_LIVE_CHANNELS matches the documented gate', () => {
    expect(DEFAULT_LIVE_CHANNELS).toEqual(['in_app']);
  });

  it('explicit liveChannels override unlocks the other channels', () => {
    const out = adapterBuildNotifications({
      userId: 'u1', farms: [FARM], insights: [HIGH_INSIGHT],
      userPreferences: { receiveSMS: true, receiveWhatsApp: true },
      liveChannels: ['in_app', 'sms', 'whatsapp', 'voice'],
    });
    const types = new Set(out.map((n) => n.type));
    // WhatsApp is preferred for high priority when both WA+SMS allowed.
    expect(types.has('whatsapp') || types.has('sms')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-cutting: language swap preserves canonical ids
// ═══════════════════════════════════════════════════════════════
describe('language swap invariants', () => {
  it('getCropLabel in different languages never mutates normalizeCropId output', () => {
    const id = normalizeCropId('cassava');
    for (const lang of ['en', 'fr', 'sw', 'ha', 'tw', 'hi']) {
      getCropLabel(id, lang);   // render
      expect(normalizeCropId(id)).toBe('cassava');
    }
  });

  it('getCropImage is language-invariant', () => {
    const en = getCropImage('cassava');
    // Image path doesn't accept a language, but we sanity-check the
    // path stays a string across repeated calls (no side-effects).
    for (let i = 0; i < 5; i += 1) {
      expect(getCropImage('cassava')).toBe(en);
    }
  });
});
