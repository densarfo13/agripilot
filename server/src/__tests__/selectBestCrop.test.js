/**
 * selectBestCrop.test.js — contract for the pure helper behind
 * the high-conversion /crop-fit/quick page.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  selectBestCrop,
  resolveCropDecisionDestination,
  persistSelectedCrop,
  readSelectedCrop,
  _internal,
} from '../../../src/core/welcome/selectBestCrop.js';

function installLocalStorage() {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => store.has(k) ? store.get(k) : null,
      setItem:    (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
  return store;
}

// ─── Rule: always returns one best + frozen result ───────────
describe('selectBestCrop — safety rules', () => {
  it('always returns best + alternatives', () => {
    const r = selectBestCrop({});
    expect(r.best).toBeTruthy();
    expect(Array.isArray(r.alternatives)).toBe(true);
  });

  it('result is frozen', () => {
    const r = selectBestCrop({});
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.alternatives)).toBe(true);
  });

  it('best always has code/name/score/risk/reasonKey/reasonFallback', () => {
    const { best } = selectBestCrop({});
    for (const k of ['code', 'name', 'score', 'risk', 'reasonKey', 'reasonFallback']) {
      expect(best[k]).toBeTruthy();
    }
  });

  it('maxAlternatives capped to [0..4] and coerced', () => {
    expect(selectBestCrop({ maxAlternatives: -5 }).alternatives.length).toBe(0);
    expect(selectBestCrop({ maxAlternatives: 999 }).alternatives.length).toBeLessThanOrEqual(4);
    expect(selectBestCrop({ maxAlternatives: 'two' }).alternatives.length).toBe(2);
  });
});

// ─── Rule: existing-user profile shortcut ────────────────────
describe('selectBestCrop — profile_crop source', () => {
  it('known crop: returns the matching starter as best', () => {
    const r = selectBestCrop({ profile: { id: 'F1', cropType: 'MAIZE' } });
    expect(r.source).toBe('profile_crop');
    expect(r.best.code).toBe('maize');
    // Alternatives exclude the chosen crop.
    expect(r.alternatives.every((a) => a.code !== 'maize')).toBe(true);
  });

  it('unknown crop: synthesizes a friendly "current crop" entry', () => {
    const r = selectBestCrop({ profile: { id: 'F1', cropType: 'quinoa' } });
    expect(r.source).toBe('profile_crop');
    expect(r.best.code).toBe('quinoa');
    expect(r.best.name).toBe('Quinoa'); // capitalized
    expect(r.best.reasonKey).toBe('cropFit.reason.current_crop_still_good');
  });

  it('legacy profile.crop field also recognised', () => {
    const r = selectBestCrop({ profile: { id: 'F1', crop: 'rice' } });
    expect(r.source).toBe('profile_crop');
    expect(r.best.code).toBe('rice');
  });
});

// ─── Rule: latitude bias when no profile crop ───────────────
describe('selectBestCrop — lat_biased source', () => {
  it('tropical band (|lat|<15) keeps starter order', () => {
    const r = selectBestCrop({
      profile: null,
      onboarding: { location: { lat: 5, lng: 0 } },
    });
    expect(r.source).toBe('lat_biased');
    expect(r.best.code).toBe('cassava');
  });

  it('subtropical band promotes maize', () => {
    const r = selectBestCrop({
      onboarding: { location: { lat: 25, lng: 0 } },
    });
    expect(r.source).toBe('lat_biased');
    expect(r.best.code).toBe('maize');
  });

  it('temperate band puts maize + rice at the top', () => {
    const r = selectBestCrop({
      onboarding: { location: { lat: 45, lng: 0 } },
    });
    expect(r.best.code).toBe('maize');
    expect(r.alternatives[0].code).toBe('rice');
  });

  it('non-finite lat falls through to fallback', () => {
    const r = selectBestCrop({
      onboarding: { location: { lat: 'bad', lng: 0 } },
    });
    expect(r.source).toBe('fallback');
  });
});

// ─── Rule: safe fallback ────────────────────────────────────
describe('selectBestCrop — fallback source', () => {
  it('returns starter[0] when zero signal', () => {
    const r = selectBestCrop();
    expect(r.source).toBe('fallback');
    expect(r.best.code).toBe('cassava');
  });

  it('null onboarding + null profile still returns best', () => {
    const r = selectBestCrop({ profile: null, onboarding: null });
    expect(r.best).toBeTruthy();
  });
});

// ─── resolveCropDecisionDestination ─────────────────────────
describe('resolveCropDecisionDestination', () => {
  it('profile with id → /edit-farm?farmId=X', () => {
    expect(resolveCropDecisionDestination({ profile: { id: 'F1' } }))
      .toBe('/edit-farm?farmId=F1');
  });

  it('URL-encodes the farmId', () => {
    expect(resolveCropDecisionDestination({ profile: { id: 'a b&c' } }))
      .toBe('/edit-farm?farmId=a%20b%26c');
  });

  it('no profile → /farm/new', () => {
    expect(resolveCropDecisionDestination({})).toBe('/farm/new');
    expect(resolveCropDecisionDestination()).toBe('/farm/new');
  });
});

// ─── persistSelectedCrop / readSelectedCrop ─────────────────
describe('persistSelectedCrop / readSelectedCrop', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('round-trips a crop code', () => {
    expect(persistSelectedCrop('maize')).toBe(true);
    expect(readSelectedCrop()).toBe('maize');
  });

  it('rejects non-string / empty inputs', () => {
    expect(persistSelectedCrop('')).toBe(false);
    expect(persistSelectedCrop(null)).toBe(false);
    expect(persistSelectedCrop(123)).toBe(false);
  });

  it('degrades safely without localStorage', () => {
    delete globalThis.window;
    expect(persistSelectedCrop('maize')).toBe(false);
    expect(readSelectedCrop()).toBeNull();
  });
});

// ─── STARTER_CROPS sanity ───────────────────────────────────
describe('STARTER_CROPS catalog', () => {
  it('is frozen and every entry has required fields', () => {
    expect(Object.isFrozen(_internal.STARTER_CROPS)).toBe(true);
    for (const c of _internal.STARTER_CROPS) {
      expect(Object.isFrozen(c)).toBe(true);
      expect(c.code).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(typeof c.score).toBe('number');
      expect(c.reasonKey).toMatch(/^cropFit\.reason\./);
    }
  });
});
