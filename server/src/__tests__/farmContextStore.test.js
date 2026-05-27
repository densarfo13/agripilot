/**
 * farmContextStore.test.js — canonical activeFarm + hydration priority
 * + location normalization + cross-screen consistency contracts.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  getActiveFarm, setActiveFarm, hydrateActiveFarm,
  subscribeActiveFarm, clearActiveFarm,
  getHydrationSource, normalizeFarmShape,
  HYDRATION_SOURCE, ACTIVE_FARM_STORAGE_KEY,
} from '../../../src/core/farm/farmContextStore.js';

import {
  normalizeLocationDisplay, normalizeLocationDisplayString,
} from '../../../src/core/farm/normalizeLocationDisplay.js';

import {
  buildFarmContinuity,
} from '../../../src/core/continuity/farmContinuityEngine.js';

import {
  buildJournalMoments, MOMENT_KIND,
} from '../../../src/core/journal/journalMemoryEngine.js';

import {
  runStateMismatchAudit,
} from '../../../src/core/farm/farmContextDebug.js';

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

beforeEach(() => { _stubLocalStorage(); clearActiveFarm(); });

// ═══ normalizeFarmShape ══════════════════════════════════════

describe('normalizeFarmShape — legacy aliases', () => {
  it('accepts canonical {cropId}', () => {
    const f = normalizeFarmShape({ cropId: 'pepper' });
    expect(f.cropId).toBe('pepper');
    expect(f.crop).toBe('pepper');
  });

  it('accepts legacy cropType', () => {
    const f = normalizeFarmShape({ cropType: 'pepper' });
    expect(f.cropId).toBe('pepper');
  });

  it('accepts legacy selectedCrop', () => {
    const f = normalizeFarmShape({ selectedCrop: 'pepper' });
    expect(f.cropId).toBe('pepper');
  });

  it('accepts legacy crop_name', () => {
    const f = normalizeFarmShape({ crop_name: 'pepper' });
    expect(f.cropId).toBe('pepper');
  });

  it('accepts legacy cropLabel', () => {
    const f = normalizeFarmShape({ cropLabel: 'pepper' });
    expect(f.cropId).toBe('pepper');
  });

  it('accepts legacy plantName', () => {
    const f = normalizeFarmShape({ plantName: 'pepper' });
    expect(f.cropId).toBe('pepper');
  });

  it('emits a localizedCropName when cropId present', () => {
    const f = normalizeFarmShape({ cropId: 'pepper' }, { locale: 'en' });
    expect(typeof f.localizedCropName).toBe('string');
    expect(f.localizedCropName.length).toBeGreaterThan(0);
  });

  it('normalizes stage / lifecycleStage / currentStage', () => {
    expect(normalizeFarmShape({ lifecycleStage: 'flowering' }).lifecycleStage).toBe('flowering');
    expect(normalizeFarmShape({ currentStage: 'fruiting' }).lifecycleStage).toBe('fruiting');
    expect(normalizeFarmShape({ stage: 'harvest' }).lifecycleStage).toBe('harvest');
  });

  it('coerces type to farm | garden', () => {
    expect(normalizeFarmShape({ type: 'GARDEN' }).type).toBe('garden');
    expect(normalizeFarmShape({ type: 'whatever' }).type).toBe('farm');
  });

  it('garbage never throws', () => {
    expect(() => normalizeFarmShape(null)).not.toThrow();
    expect(() => normalizeFarmShape('hi')).not.toThrow();
    expect(() => normalizeFarmShape(42)).not.toThrow();
  });
});

// ═══ normalizeLocationDisplay ════════════════════════════════

describe('normalizeLocationDisplay — production-bug fix', () => {
  it('drops "United States, United States" duplicate', () => {
    expect(normalizeLocationDisplay('Maryland, United States, United States'))
      .toBe('Maryland, United States');
  });

  it('drops same-token repeats anywhere', () => {
    expect(normalizeLocationDisplay('Ghana, Ghana')).toBe('Ghana');
  });

  it('handles single-country input', () => {
    expect(normalizeLocationDisplay('Ghana')).toBe('Ghana');
  });

  it('handles object form {region, country}', () => {
    expect(normalizeLocationDisplay({ region: 'Ashanti', country: 'Ghana' }))
      .toBe('Ashanti, Ghana');
  });

  it('handles full object form {city, region, country}', () => {
    expect(normalizeLocationDisplay({ city: 'Kumasi', region: 'Ashanti', country: 'Ghana' }))
      .toBe('Kumasi, Ashanti, Ghana');
  });

  it('case-insensitive dedupe', () => {
    expect(normalizeLocationDisplay('united states, United States'))
      .toBe('united states');
  });

  it('null safe', () => {
    expect(normalizeLocationDisplay(null)).toBeNull();
    expect(normalizeLocationDisplay(undefined)).toBeNull();
    expect(normalizeLocationDisplayString(null)).toBe('');
  });
});

// ═══ Hydration priority ══════════════════════════════════════

describe('hydrateActiveFarm — hydration priority', () => {
  it('server beats onboarding draft', () => {
    const v = hydrateActiveFarm({
      server:          { cropId: 'pepper', name: 'Sunny Field' },
      onboardingDraft: { cropType: 'cassava' },
    });
    expect(v.hydrationSource).toBe(HYDRATION_SOURCE.SERVER);
    expect(v.activeFarm.cropId).toBe('pepper');
  });

  it('local active beats onboarding draft', () => {
    const v = hydrateActiveFarm({
      localActive:     { cropId: 'pepper', name: 'Sunny Field' },
      onboardingDraft: { cropType: 'cassava' },
    });
    expect(v.hydrationSource).toBe(HYDRATION_SOURCE.LOCAL_ACTIVE);
    expect(v.activeFarm.cropId).toBe('pepper');
  });

  it('onboarding draft wins when no other source', () => {
    const v = hydrateActiveFarm({
      onboardingDraft: { cropType: 'pepper' },
    });
    expect(v.hydrationSource).toBe(HYDRATION_SOURCE.ONBOARDING);
    expect(v.activeFarm.cropId).toBe('pepper');
  });

  it('empty shell when nothing has signal', () => {
    const v = hydrateActiveFarm({});
    expect(v.hydrationSource).toBe(HYDRATION_SOURCE.EMPTY_SHELL);
    expect(v.activeFarm.cropId).toBeNull();
  });

  it('garbage never throws', () => {
    expect(() => hydrateActiveFarm(null)).not.toThrow();
    expect(() => hydrateActiveFarm(undefined)).not.toThrow();
  });
});

// ═══ Higher-rank refuses to be overwritten by lower-rank ═════

describe('setActiveFarm — rank protection', () => {
  it('refuses to downgrade complete server farm with onboarding draft', () => {
    setActiveFarm({ cropId: 'pepper', name: 'X' }, { source: HYDRATION_SOURCE.SERVER });
    setActiveFarm({ cropType: 'cassava' }, { source: HYDRATION_SOURCE.ONBOARDING });
    expect(getActiveFarm().cropId).toBe('pepper');
    expect(getHydrationSource()).toBe(HYDRATION_SOURCE.SERVER);
  });

  it('higher-rank source overwrites lower-rank', () => {
    setActiveFarm({ cropType: 'cassava' }, { source: HYDRATION_SOURCE.ONBOARDING });
    setActiveFarm({ cropId: 'pepper', name: 'X' }, { source: HYDRATION_SOURCE.SERVER });
    expect(getActiveFarm().cropId).toBe('pepper');
  });

  it('force:true bypasses rank protection', () => {
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    setActiveFarm({ cropId: 'cassava' }, {
      source: HYDRATION_SOURCE.ONBOARDING, force: true,
    });
    expect(getActiveFarm().cropId).toBe('cassava');
  });
});

// ═══ Subscribers ═════════════════════════════════════════════

describe('subscribeActiveFarm', () => {
  it('fires on setActiveFarm', () => {
    let received = null;
    const unsub = subscribeActiveFarm((f) => { received = f; });
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    expect(received).toBeTruthy();
    expect(received.cropId).toBe('pepper');
    unsub();
  });

  it('unsubscribe stops fires', () => {
    let count = 0;
    const unsub = subscribeActiveFarm(() => { count++; });
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    unsub();
    setActiveFarm({ cropId: 'cassava' }, {
      source: HYDRATION_SOURCE.SERVER, force: true,
    });
    expect(count).toBe(1);
  });

  it('one throwing handler does not break others', () => {
    let safeCount = 0;
    subscribeActiveFarm(() => { throw new Error('boom'); });
    subscribeActiveFarm(() => { safeCount++; });
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    expect(safeCount).toBe(1);
  });
});

// ═══ farmContinuityEngine ════════════════════════════════════

describe('buildFarmContinuity', () => {
  it('returns calm fallback for null input', () => {
    const v = buildFarmContinuity(null);
    expect(v.engineVersion).toBe('farm-continuity-v1');
    expect(v.oneBestAction).toBeTruthy();
  });

  it('emits cropStarted insight when cropId present + no stage', () => {
    const v = buildFarmContinuity({
      cropId: 'pepper', localizedCropName: 'Pepper',
    });
    expect(v.continuityInsight).toBeTruthy();
    expect(v.continuityInsight.params.crop).toBe('Pepper');
  });

  it('emits firstScan action when no scans yet but crop set', () => {
    const v = buildFarmContinuity({
      cropId: 'pepper', localizedCropName: 'Pepper', scanHistory: [],
    });
    expect(v.oneBestAction.key).toBe('farmContinuity.action.firstScan');
  });

  it('emits routine action when scans exist', () => {
    const v = buildFarmContinuity({
      cropId: 'pepper', localizedCropName: 'Pepper',
      scanHistory: [{ id: 's1' }],
    });
    expect(v.oneBestAction.key).toBe('farmContinuity.action.walkField');
  });

  it('harvest stage routes through harvest insight', () => {
    const v = buildFarmContinuity({
      cropId: 'pepper', localizedCropName: 'Pepper',
      lifecycleStage: 'harvest',
    });
    expect(v.continuityInsight.key).toBe('farmContinuity.insight.harvest');
  });
});

// ═══ journalMemoryEngine ═════════════════════════════════════

describe('buildJournalMoments', () => {
  it('setupIncomplete=true ONLY when farm is empty', () => {
    const v = buildJournalMoments(null);
    expect(v.setupIncomplete).toBe(true);
  });

  it('setupIncomplete=false when crop exists, even with no scans', () => {
    const v = buildJournalMoments({
      id: 'f1', cropId: 'pepper', localizedCropName: 'Pepper',
      createdAt: Date.now(), updatedAt: Date.now(),
      scanHistory: [], journalMoments: [],
    });
    expect(v.setupIncomplete).toBe(false);
    expect(v.showStarterContinuity).toBe(true);
    expect(v.starterContinuityCards.length).toBeGreaterThan(0);
  });

  it('shows full moments when scans exist', () => {
    const now = Date.now();
    const v = buildJournalMoments({
      id: 'f1', cropId: 'pepper', localizedCropName: 'Pepper',
      createdAt: now - 86400e3, updatedAt: now,
      scanHistory: [
        { id: 's1', createdAt: now - 3600e3, severity: 'mild' },
      ],
    });
    expect(v.setupIncomplete).toBe(false);
    expect(v.moments.length).toBeGreaterThan(0);
    expect(v.moments.some((m) => m.kind === MOMENT_KIND.CROP_SELECTED)).toBe(true);
  });

  it('starter cards mention crop + location when both present', () => {
    const v = buildJournalMoments({
      id: 'f1', cropId: 'pepper', localizedCropName: 'Pepper',
      location: 'Maryland, United States',
      createdAt: Date.now(), updatedAt: Date.now(),
      scanHistory: [],
    });
    expect(v.starterContinuityCards[0].key).toBe('journal.starter.cropAndLocation');
    expect(v.starterContinuityCards[0].params.location).toContain('Maryland');
  });
});

// ═══ Cross-screen consistency contract ═══════════════════════

describe('Cross-screen consistency contract', () => {
  it('pepper hydrated once is pepper everywhere', () => {
    hydrateActiveFarm({
      server: { cropId: 'pepper', name: 'Sunny Field',
        location: 'Maryland, United States, United States',
        lifecycleStage: 'flowering' },
    });
    const farm = getActiveFarm();
    expect(farm.cropId).toBe('pepper');
    expect(farm.location).toBe('Maryland, United States');

    const continuity = buildFarmContinuity(farm);
    expect(continuity.continuityInsight.fallback.toLowerCase()).toContain('active growth stage');

    const journal = buildJournalMoments(farm);
    expect(journal.setupIncomplete).toBe(false);
    expect(journal.showStarterContinuity).toBe(true);
  });
});

// ═══ runStateMismatchAudit ═══════════════════════════════════

describe('runStateMismatchAudit', () => {
  it('reports clean when no legacy keys exist', () => {
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    const a = runStateMismatchAudit();
    expect(a.clean).toBe(true);
    expect(a.duplicateStateDetected).toBe(false);
  });

  it('detects crop mismatch in legacy onboardingFarm', () => {
    setActiveFarm({ cropId: 'pepper' }, { source: HYDRATION_SOURCE.SERVER });
    localStorage.setItem(
      'farroway:onboardingFarm',
      JSON.stringify({ cropType: 'cassava' }),
    );
    const a = runStateMismatchAudit();
    expect(a.clean).toBe(false);
    expect(a.cropMismatches.length).toBeGreaterThan(0);
    expect(a.staleSourcesDetected).toContain('farroway:onboardingFarm');
  });

  it('detects multiple drift sources', () => {
    setActiveFarm({ cropId: 'pepper', lifecycleStage: 'flowering' },
      { source: HYDRATION_SOURCE.SERVER });
    localStorage.setItem('farroway:selectedFarm',
      JSON.stringify({ cropType: 'cassava' }));
    localStorage.setItem('farroway:taskFarm',
      JSON.stringify({ stage: 'harvest' }));
    const a = runStateMismatchAudit();
    expect(a.totalMismatches).toBeGreaterThanOrEqual(2);
  });
});

// ═══ Calm UX contract ════════════════════════════════════════

describe('Calm UX contract — no AI / % leaks', () => {
  it('farmContinuityEngine never leaks raw AI / %', () => {
    const v = buildFarmContinuity({
      cropId: 'pepper', localizedCropName: 'Pepper',
      lifecycleStage: 'flowering', scanHistory: [],
    });
    const text = [
      v.continuityInsight && v.continuityInsight.fallback,
      v.oneBestAction.fallback,
      v.reason.fallback,
      v.followUp && v.followUp.fallback,
    ].filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });

  it('journalMemoryEngine never leaks raw AI / %', () => {
    const v = buildJournalMoments({
      id: 'f1', cropId: 'pepper', localizedCropName: 'Pepper',
      location: 'Maryland, United States',
      createdAt: Date.now(), updatedAt: Date.now(),
      scanHistory: [],
    });
    const text = [
      ...v.starterContinuityCards.map((c) => c.fallback),
      ...v.moments.flatMap((m) => [m.title.fallback, m.detail.fallback]),
    ].join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});
