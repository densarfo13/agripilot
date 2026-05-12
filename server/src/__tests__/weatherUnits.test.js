/**
 * weatherUnits.test.js — pins the resolver + conversion contract.
 * Covers every test case the spec calls out plus boundary cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveTemperatureUnit,
  cToF,
  fToC,
  formatTemperature,
  getUserTemperatureUnitPreference,
  setUserTemperatureUnitPreference,
  TEMPERATURE_UNIT_STORAGE_KEY,
  _resetUnitCache,
} from '../../../src/lib/weatherUnits.js';

function _installLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:      () => { store.clear(); },
  };
}

beforeEach(() => {
  _installLocalStorage();
  _resetUnitCache();
});

describe('resolveTemperatureUnit — country defaults (spec test cases)', () => {
  it('US → F', () => {
    const r = resolveTemperatureUnit({ countryCode: 'US', session: false });
    expect(r.unit).toBe('F');
    expect(r.source).toBe('country');
  });

  it('Ghana (GH) → C', () => {
    const r = resolveTemperatureUnit({ countryCode: 'GH', session: false });
    expect(r.unit).toBe('C');
    expect(r.source).toBe('country');
  });

  it('India (IN) → C', () => {
    const r = resolveTemperatureUnit({ countryCode: 'IN', session: false });
    expect(r.unit).toBe('C');
  });

  it('Liberia (LR) → F', () => {
    const r = resolveTemperatureUnit({ countryCode: 'LR', session: false });
    expect(r.unit).toBe('F');
    expect(r.source).toBe('country');
  });

  it('Myanmar (MM) → F', () => {
    const r = resolveTemperatureUnit({ countryCode: 'MM', session: false });
    expect(r.unit).toBe('F');
    expect(r.source).toBe('country');
  });

  it('unknown country → C (fallback)', () => {
    const r = resolveTemperatureUnit({ countryCode: 'ZZ', session: false });
    expect(r.unit).toBe('C');
  });

  it('missing country → C (fallback)', () => {
    const r = resolveTemperatureUnit({ session: false });
    expect(r.unit).toBe('C');
    expect(r.source).toBe('fallback');
  });
});

describe('resolveTemperatureUnit — user override', () => {
  it('user preference C overrides US country default', () => {
    const r = resolveTemperatureUnit({
      countryCode: 'US',
      userPreference: 'C',
      session: false,
    });
    expect(r.unit).toBe('C');
    expect(r.source).toBe('user');
  });

  it('user preference F overrides Ghana country default', () => {
    const r = resolveTemperatureUnit({
      countryCode: 'GH',
      userPreference: 'F',
      session: false,
    });
    expect(r.unit).toBe('F');
    expect(r.source).toBe('user');
  });

  it('user preference accepts "Celsius" / "Fahrenheit" full names', () => {
    expect(resolveTemperatureUnit({ userPreference: 'Celsius',    session: false }).unit).toBe('C');
    expect(resolveTemperatureUnit({ userPreference: 'Fahrenheit', session: false }).unit).toBe('F');
  });

  it('garbage user preference falls through to country', () => {
    const r = resolveTemperatureUnit({
      countryCode: 'US',
      userPreference: 'totally_invalid',
      session: false,
    });
    expect(r.unit).toBe('F');
    expect(r.source).toBe('country');
  });
});

describe('resolveTemperatureUnit — session stability', () => {
  it('caches the first resolved unit for the session', () => {
    // First call resolves US → F + caches.
    expect(resolveTemperatureUnit({ countryCode: 'US' }).unit).toBe('F');
    // Subsequent call WITHOUT country still returns F from cache.
    expect(resolveTemperatureUnit({}).unit).toBe('F');
  });

  it('session=false bypasses + does not pollute the cache', () => {
    resolveTemperatureUnit({ countryCode: 'GH', session: false });
    expect(resolveTemperatureUnit({}).unit).toBe('C');  // fallback, cache was not set
  });

  it('_resetUnitCache clears between tests', () => {
    resolveTemperatureUnit({ countryCode: 'US' });
    _resetUnitCache();
    expect(resolveTemperatureUnit({}).source).toBe('fallback');
  });
});

describe('cToF / fToC conversions', () => {
  it('cToF: 0°C → 32°F', () => {
    expect(cToF(0)).toBe(32);
  });

  it('cToF: 100°C → 212°F', () => {
    expect(cToF(100)).toBe(212);
  });

  it('cToF: 26°C → ~78.8°F', () => {
    expect(Math.round(cToF(26))).toBe(79);
  });

  it('fToC: 32°F → 0°C', () => {
    expect(fToC(32)).toBe(0);
  });

  it('fToC: 79°F → ~26.1°C', () => {
    expect(Math.round(fToC(79))).toBe(26);
  });

  it('returns null on non-numeric input', () => {
    expect(cToF(null)).toBeNull();
    expect(cToF(undefined)).toBeNull();
    expect(cToF('hot')).toBeNull();
    expect(cToF(NaN)).toBeNull();
    expect(fToC(null)).toBeNull();
    expect(fToC(NaN)).toBeNull();
  });
});

describe('formatTemperature', () => {
  it('formats native unit without conversion', () => {
    expect(formatTemperature(26, 'C', 'C')).toBe('26°C');
    expect(formatTemperature(79, 'F', 'F')).toBe('79°F');
  });

  it('converts when source ≠ target', () => {
    expect(formatTemperature(26, 'C', 'F')).toBe('79°F');
    expect(formatTemperature(82, 'F', 'C')).toBe('28°C');
  });

  it('rounds to nearest whole number', () => {
    expect(formatTemperature(26.4, 'C', 'C')).toBe('26°C');
    expect(formatTemperature(26.5, 'C', 'C')).toBe('27°C');
  });

  it('NEVER shows NaN — null temp returns empty string', () => {
    expect(formatTemperature(null, 'C', 'F')).toBe('');
    expect(formatTemperature(undefined, 'C', 'F')).toBe('');
    expect(formatTemperature(NaN, 'C', 'C')).toBe('');
    expect(formatTemperature('hot', 'C', 'C')).toBe('');
  });

  it('defaults unknown units sanely', () => {
    expect(formatTemperature(26, 'bogus', 'C')).toBe('26°C');
    expect(formatTemperature(26, 'C', 'bogus')).toBe('26°C');
  });

  it('display matches the spec examples', () => {
    expect(formatTemperature(26, 'C', 'C')).toBe('26°C');
    expect(formatTemperature(79, 'F', 'F')).toBe('79°F');
  });
});

describe('user preference store', () => {
  it('roundtrip: set / get C', () => {
    expect(setUserTemperatureUnitPreference('C')).toBe(true);
    expect(getUserTemperatureUnitPreference()).toBe('C');
  });

  it('roundtrip: set / get F', () => {
    expect(setUserTemperatureUnitPreference('Fahrenheit')).toBe(true);
    expect(getUserTemperatureUnitPreference()).toBe('F');
  });

  it("'Auto' clears the override", () => {
    setUserTemperatureUnitPreference('C');
    setUserTemperatureUnitPreference('Auto');
    expect(getUserTemperatureUnitPreference()).toBeNull();
  });

  it('null clears the override', () => {
    setUserTemperatureUnitPreference('C');
    setUserTemperatureUnitPreference(null);
    expect(getUserTemperatureUnitPreference()).toBeNull();
  });

  it('garbage values rejected', () => {
    expect(setUserTemperatureUnitPreference('bogus')).toBe(false);
    expect(getUserTemperatureUnitPreference()).toBeNull();
  });

  it('returns null when localStorage is missing (SSR)', () => {
    delete globalThis.localStorage;
    expect(getUserTemperatureUnitPreference()).toBeNull();
  });

  it('exposes a stable storage key', () => {
    expect(TEMPERATURE_UNIT_STORAGE_KEY).toBe('farroway_temperature_unit_preference');
  });
});

describe('language ≠ region — confirm spec rule', () => {
  it('English speaker in Ghana sees Celsius (locale ignored)', () => {
    const r = resolveTemperatureUnit({
      countryCode: 'GH',
      locale: 'en-GB',
      session: false,
    });
    expect(r.unit).toBe('C');
  });

  it('French speaker in US sees Fahrenheit (locale ignored)', () => {
    const r = resolveTemperatureUnit({
      countryCode: 'US',
      locale: 'fr-FR',
      session: false,
    });
    expect(r.unit).toBe('F');
  });
});
