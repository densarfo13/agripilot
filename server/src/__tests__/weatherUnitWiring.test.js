/**
 * weatherUnitWiring.test.js — Weather Unit System Audit fix.
 *
 *   Root cause: ImmersiveHomeHero rendered `{temp}°` raw - the
 *   backend's Celsius value reached the screen without conversion
 *   or unit suffix. Maryland users saw "13°" instead of "55°F".
 *
 *   The conversion helpers + region detection + user-preference
 *   store ALREADY existed in weatherUnits.js. This commit wires
 *   them up + adds a reactive hook (useTemperatureUnit) that the
 *   hero now consumes. This suite locks the contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

import {
  cToF,
  fToC,
  formatTemperature,
  resolveTemperatureUnit,
  getUserTemperatureUnitPreference,
  setUserTemperatureUnitPreference,
  _resetUnitCache,
} from '../../../src/lib/weatherUnits.js';

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
}

beforeEach(() => {
  vi.resetModules();
  globalThis.localStorage = makeStorage();
  globalThis.window = {
    localStorage: globalThis.localStorage,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
  _resetUnitCache();
});

// ─── 1. Conversion math ──────────────────────────────────────

describe('weatherUnits — conversion math', () => {
  it.each([
    [0,   32],
    [13,  55.4],       // The Maryland morning - Celsius value
    [25,  77],
    [28,  82.4],
    [100, 212],
  ])('cToF(%i) ≈ %f', (c, fExpected) => {
    expect(cToF(c)).toBeCloseTo(fExpected, 1);
  });

  it('fToC is the inverse of cToF', () => {
    for (const c of [-10, 0, 13, 25, 28, 100]) {
      expect(fToC(cToF(c))).toBeCloseTo(c, 4);
    }
  });

  it('cToF / fToC return null on non-numeric input', () => {
    expect(cToF(null)).toBeNull();
    expect(cToF('hot')).toBeNull();
    expect(cToF(NaN)).toBeNull();
    expect(fToC(undefined)).toBeNull();
  });

  it('formatTemperature("C" → "F") on 13 returns "55°F" (Maryland repro)', () => {
    expect(formatTemperature(13, 'C', 'F')).toBe('55°F');
  });

  it('formatTemperature("C" → "C") on 13 returns "13°C"', () => {
    expect(formatTemperature(13, 'C', 'C')).toBe('13°C');
  });

  it('formatTemperature returns empty string on null / NaN', () => {
    expect(formatTemperature(null, 'C', 'F')).toBe('');
    expect(formatTemperature(NaN,  'C', 'F')).toBe('');
  });
});

// ─── 2. Region resolution ────────────────────────────────────

describe('weatherUnits — region resolution', () => {
  it('US → Fahrenheit', () => {
    const out = resolveTemperatureUnit({ countryCode: 'US', session: false });
    expect(out.unit).toBe('F');
    expect(out.source).toBe('country');
  });

  it.each([
    ['LR', 'F'],
    ['MM', 'F'],
    ['GH', 'C'],
    ['KE', 'C'],
    ['IN', 'C'],
    ['BR', 'C'],
  ])('%s → %s', (countryCode, expected) => {
    const out = resolveTemperatureUnit({ countryCode, session: false });
    expect(out.unit).toBe(expected);
  });

  it('Unknown country → Celsius fallback', () => {
    const out = resolveTemperatureUnit({ countryCode: 'ZZ', session: false });
    expect(out.unit).toBe('C');
    expect(out.source).toBe('country');
  });
});

// ─── 3. User override wins ───────────────────────────────────

describe('weatherUnits — user preference override', () => {
  it('user "C" preference beats US country default', () => {
    setUserTemperatureUnitPreference('C');
    const out = resolveTemperatureUnit({
      userPreference: getUserTemperatureUnitPreference(),
      countryCode:    'US',
      session:        false,
    });
    expect(out.unit).toBe('C');
    expect(out.source).toBe('user');
  });

  it('user "F" preference beats Ghana country default', () => {
    setUserTemperatureUnitPreference('F');
    const out = resolveTemperatureUnit({
      userPreference: getUserTemperatureUnitPreference(),
      countryCode:    'GH',
      session:        false,
    });
    expect(out.unit).toBe('F');
    expect(out.source).toBe('user');
  });

  it('"Auto" preference returns null → falls through to country', () => {
    setUserTemperatureUnitPreference('Auto');
    expect(getUserTemperatureUnitPreference()).toBeNull();
  });
});

// ─── 4. ImmersiveHomeHero wiring (source inspection) ─────────

describe('ImmersiveHomeHero wiring — uses formatTemperature', () => {
  const src = read('src/components/home/ImmersiveHomeHero.jsx');

  it('imports the useTemperatureUnit hook', () => {
    expect(src).toMatch(/useTemperatureUnit/);
  });

  it('calls tempUnit.format on the headline temp (no raw {temp}°)', () => {
    expect(src).toMatch(/tempUnit\.format\(temp\)/);
  });

  it('calls tempUnit.format on feelsLike too', () => {
    expect(src).toMatch(/tempUnit\.format\(feelsLike\)/);
  });

  it('does NOT render a bare {temp}° fragment anymore', () => {
    // The legacy "{temp}<span" pattern is gone.
    expect(src).not.toMatch(/\{temp\}<span style=\{S\.tempDeg\}/);
  });
});

// ─── 5. useTemperatureUnit module loads ──────────────────────

describe('useTemperatureUnit hook module', () => {
  it('module exports a default function', async () => {
    const mod = await import('../../../src/hooks/useTemperatureUnit.js');
    expect(typeof mod.default).toBe('function');
  });
});

// ─── 6. End-to-end conversion contract ───────────────────────

describe('Acceptance — Maryland 13°C renders as 55°F for a US user', () => {
  it('with no user preference + country=US, format(13) returns "55°F"', () => {
    const resolved = resolveTemperatureUnit({
      userPreference: null,
      countryCode:    'US',
      session:        false,
    });
    expect(resolved.unit).toBe('F');
    expect(formatTemperature(13, 'C', resolved.unit)).toBe('55°F');
  });

  it('with no user preference + country=GH, format(13) stays "13°C"', () => {
    const resolved = resolveTemperatureUnit({
      userPreference: null,
      countryCode:    'GH',
      session:        false,
    });
    expect(resolved.unit).toBe('C');
    expect(formatTemperature(13, 'C', resolved.unit)).toBe('13°C');
  });

  it('with user preference "C" + country=US, format(13) is "13°C"', () => {
    setUserTemperatureUnitPreference('C');
    const resolved = resolveTemperatureUnit({
      userPreference: getUserTemperatureUnitPreference(),
      countryCode:    'US',
      session:        false,
    });
    expect(formatTemperature(13, 'C', resolved.unit)).toBe('13°C');
  });
});
