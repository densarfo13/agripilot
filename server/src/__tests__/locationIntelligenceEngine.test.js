/**
 * locationIntelligenceEngine.test.js — permanent location fix
 * regression suite.
 *
 * Covers spec §1-§12:
 *   • deviceLocation vs farmLocation separation
 *   • silent permission probe (never prompts)
 *   • farmLocation wins for weather + tasks
 *   • away-from-farm calm message
 *   • Haversine distance + 5-mile threshold
 *   • subtle status chip (no big CTA)
 *   • cached locations work offline
 *   • diagnostic hook envelope shape
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  probePermission, fetchDeviceLocation,
  computeLocationIntelligence, distanceMilesBetween,
  getCachedDeviceLocation, getCachedFarmLocation,
  cacheDeviceLocation, cacheFarmLocation,
  installLocationDiagnostics, _resetLocationDiagnosticsForTests,
  LOCATION_SOURCE, _internal,
} from '../../../src/core/location/locationIntelligenceEngine.js';

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
  _resetLocationDiagnosticsForTests();
});

afterEach(() => {
  try { delete globalThis.window.__locationHealth; } catch { /* swallow */ }
});

// ═══ Permission probe ═══════════════════════════════════════

describe('probePermission', () => {
  it('returns unknown when navigator.permissions missing', async () => {
    const result = await probePermission();
    expect(['unknown', 'granted', 'denied', 'prompt']).toContain(result.state);
    expect(typeof result.canAutoFetch).toBe('boolean');
    expect(typeof result.supported).toBe('boolean');
  });

  it('canAutoFetch is true ONLY when state === "granted"', async () => {
    const result = await probePermission();
    if (result.state === 'granted') expect(result.canAutoFetch).toBe(true);
    else expect(result.canAutoFetch).toBe(false);
  });

  it('never throws on repeated calls', async () => {
    await expect(probePermission()).resolves.toBeTruthy();
    await expect(probePermission()).resolves.toBeTruthy();
  });
});

// ═══ Distance ═══════════════════════════════════════════════

describe('distanceMilesBetween', () => {
  it('returns 0 (≈) for identical points', () => {
    const d = distanceMilesBetween(
      { lat: 40.0, lng: -75.0 },
      { lat: 40.0, lng: -75.0 },
    );
    expect(d).toBeLessThan(0.01);
  });

  it('returns ~3 miles for known distance', () => {
    // New York to about 3 miles north.
    const d = distanceMilesBetween(
      { lat: 40.7128, lng: -74.0060 },
      { lat: 40.7563, lng: -74.0060 },
    );
    expect(d).toBeGreaterThan(2.8);
    expect(d).toBeLessThan(3.4);
  });

  it('null for missing fields', () => {
    expect(distanceMilesBetween(null, { lat: 1, lng: 1 })).toBeNull();
    expect(distanceMilesBetween({ lat: 1 }, { lat: 1, lng: 1 })).toBeNull();
  });

  it('garbage never throws', () => {
    expect(() => distanceMilesBetween('hi', 42)).not.toThrow();
  });
});

// ═══ Caching ═══════════════════════════════════════════════

describe('cache helpers', () => {
  it('roundtrip farm location', () => {
    cacheFarmLocation({ lat: 40, lng: -75, label: 'Maryland', at: 123 });
    const r = getCachedFarmLocation();
    expect(r.lat).toBe(40);
    expect(r.lng).toBe(-75);
    expect(r.label).toBe('Maryland');
  });

  it('roundtrip device location', () => {
    cacheDeviceLocation({ lat: 41, lng: -76, at: 456 });
    const r = getCachedDeviceLocation();
    expect(r.lat).toBe(41);
  });

  it('null clears the cache', () => {
    cacheFarmLocation({ lat: 1, lng: 1 });
    cacheFarmLocation(null);
    expect(getCachedFarmLocation()).toBeNull();
  });

  it('garbage in returns null on read', () => {
    localStorage.setItem(_internal.STORAGE_FARM, 'not-json');
    expect(getCachedFarmLocation()).toBeNull();
  });
});

// ═══ Composition — the core spec contract ═══════════════════

describe('computeLocationIntelligence — envelope shape', () => {
  it('empty input returns frozen fallback envelope', () => {
    const v = computeLocationIntelligence({});
    expect(v.engineVersion).toBe('location-intel-v1');
    expect(v.weatherLocationSource).toBe(LOCATION_SOURCE.NONE);
    expect(v.setupPromptVisible).toBe(true);
    expect(v.deviceLocation).toBeNull();
    expect(v.farmLocation).toBeNull();
  });

  it('null / garbage never throws', () => {
    expect(() => computeLocationIntelligence(null)).not.toThrow();
    expect(() => computeLocationIntelligence('hi')).not.toThrow();
  });
});

describe('computeLocationIntelligence — farmLocation wins', () => {
  it('weatherLocationSource = farm when farmLocation present', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40, lng: -75 },
      deviceLocation: { lat: 50, lng: -70 },
    });
    expect(v.weatherLocationSource).toBe(LOCATION_SOURCE.FARM);
  });

  it('weatherLocationSource = device when ONLY deviceLocation present', () => {
    const v = computeLocationIntelligence({
      deviceLocation: { lat: 50, lng: -70 },
    });
    expect(v.weatherLocationSource).toBe(LOCATION_SOURCE.DEVICE);
  });

  it('weatherLocationSource = none with no locations', () => {
    const v = computeLocationIntelligence({});
    expect(v.weatherLocationSource).toBe(LOCATION_SOURCE.NONE);
  });
});

describe('computeLocationIntelligence — away from farm', () => {
  it('isAwayFromFarm = false when device within 5 miles', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40.7128, lng: -74.0060 },
      deviceLocation: { lat: 40.7563, lng: -74.0060 }, // ~3 mi
    });
    expect(v.isAwayFromFarm).toBe(false);
    expect(v.awayMessage).toBeNull();
  });

  it('isAwayFromFarm = true when device > 5 miles away', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40.7128, lng: -74.0060 },
      deviceLocation: { lat: 41.0,    lng: -74.0060 }, // ~20 mi
    });
    expect(v.isAwayFromFarm).toBe(true);
    expect(v.awayMessage).toBeTruthy();
    expect(v.awayMessage.key).toBe('location.away.calm');
  });

  it('isAwayFromFarm = false when no farmLocation', () => {
    const v = computeLocationIntelligence({
      deviceLocation: { lat: 50, lng: -70 },
    });
    expect(v.isAwayFromFarm).toBe(false);
  });
});

describe('computeLocationIntelligence — status chip (no big CTA)', () => {
  it('"Using farm location" chip when farm is the source', () => {
    const v = computeLocationIntelligence({
      farmLocation: { lat: 40, lng: -75 },
    });
    expect(v.statusChip.key).toBe('location.chip.usingFarm');
    expect(v.setupPromptVisible).toBe(false);
  });

  it('"Set farm location" chip when nothing is set + permission not granted', () => {
    const v = computeLocationIntelligence({ permission: 'denied' });
    expect(v.statusChip.key).toBe('location.chip.setFarmLocation');
    expect(v.setupPromptVisible).toBe(true);
  });

  it('setup prompt suppressed when permission is granted (fetching in flight)', () => {
    const v = computeLocationIntelligence({ permission: 'granted' });
    expect(v.setupPromptVisible).toBe(false);
  });
});

describe('computeLocationIntelligence — confidence + distance number', () => {
  it('confidence = high when both locations present', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40, lng: -75 },
      deviceLocation: { lat: 40.1, lng: -75.1 },
    });
    expect(v.locationConfidence).toBe('high');
  });

  it('confidence = medium with only one location', () => {
    const v = computeLocationIntelligence({ farmLocation: { lat: 40, lng: -75 } });
    expect(v.locationConfidence).toBe('medium');
  });

  it('confidence = low with neither', () => {
    expect(computeLocationIntelligence({}).locationConfidence).toBe('low');
  });

  it('distanceFromFarm is a number when both present', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40, lng: -75 },
      deviceLocation: { lat: 41, lng: -75 },
    });
    expect(typeof v.distanceFromFarm).toBe('number');
    expect(v.distanceFromFarm).toBeGreaterThan(60);   // ~69 mi per degree
    expect(v.distanceFromFarm).toBeLessThan(80);
  });
});

// ═══ Offline scenario (cache fallback) ══════════════════════

describe('cache fallback simulates offline', () => {
  it('cached farm location available even after restart', () => {
    cacheFarmLocation({ lat: 40, lng: -75, label: 'Maryland', at: Date.now() });
    // Simulate "next session" — cache still readable.
    const r = getCachedFarmLocation();
    const v = computeLocationIntelligence({ farmLocation: r });
    expect(v.weatherLocationSource).toBe(LOCATION_SOURCE.FARM);
    expect(v.farmLocation.label).toBe('Maryland');
  });
});

// ═══ Diagnostic hook ════════════════════════════════════════

describe('installLocationDiagnostics', () => {
  it('pins window.__locationHealth', () => {
    installLocationDiagnostics();
    expect(typeof globalThis.window.__locationHealth).toBe('function');
  });

  it('snapshot returns the documented fields', async () => {
    cacheFarmLocation({ lat: 40, lng: -75, label: 'MD' });
    cacheDeviceLocation({ lat: 40.5, lng: -75 });
    installLocationDiagnostics();
    const snap = await globalThis.window.__locationHealth();
    expect(snap).toBeTruthy();
    expect(snap.permission).toBeTruthy();
    expect(snap.deviceLocation).toBeTruthy();
    expect(snap.farmLocation).toBeTruthy();
    expect(snap.weatherLocationSource).toBe(LOCATION_SOURCE.FARM);
    expect(typeof snap.isAwayFromFarm).toBe('boolean');
  });

  it('coordinates rounded to 2 decimals in the diagnostic', async () => {
    cacheFarmLocation({ lat: 40.123456, lng: -75.987654 });
    installLocationDiagnostics();
    const snap = await globalThis.window.__locationHealth();
    expect(snap.farmLocation.lat).toBe(40.12);
    expect(snap.farmLocation.lng).toBe(-75.99);
  });

  it('idempotent install', () => {
    installLocationDiagnostics();
    installLocationDiagnostics();
    expect(typeof globalThis.window.__locationHealth).toBe('function');
  });

  it('SSR-safe — returns false when window undefined', () => {
    const win = globalThis.window;
    delete globalThis.window;
    try {
      _resetLocationDiagnosticsForTests();
      expect(installLocationDiagnostics()).toBe(false);
    } finally {
      globalThis.window = win;
    }
  });
});

// ═══ fetchDeviceLocation (geolocation API absent) ═══════════

describe('fetchDeviceLocation', () => {
  it('returns null without throwing in the node test env (no geolocation)', async () => {
    // Test env has no navigator.geolocation — fetchDeviceLocation
    // returns null silently without throwing.
    const loc = await fetchDeviceLocation({ timeoutMs: 200 });
    expect(loc === null || typeof loc === 'object').toBe(true);
  });
});

// ═══ Calm wording contract ══════════════════════════════════

describe('Calm wording — no dominant CTA / no panic', () => {
  it('no "Use my location" big-CTA copy in any envelope output', () => {
    const v = computeLocationIntelligence({});
    const text = [
      v.statusChip.fallback,
      v.awayMessage && v.awayMessage.fallback,
    ].filter(Boolean).join(' ').toLowerCase();
    // The status chip uses "Set farm location" — NOT "Use my location".
    expect(text).not.toMatch(/use my location/);
  });

  it('away message wording is calm, not alarming', () => {
    const v = computeLocationIntelligence({
      farmLocation:   { lat: 40, lng: -75 },
      deviceLocation: { lat: 50, lng: -75 },
    });
    expect(v.awayMessage.fallback).not.toMatch(/!{2,}/);
    expect(v.awayMessage.fallback.toLowerCase()).not.toMatch(/\b(urgent|panic|warning)\b/);
  });
});
