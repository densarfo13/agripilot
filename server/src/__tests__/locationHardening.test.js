/**
 * locationHardening.test.js — production-hardening pass tests.
 *
 * Covers:
 *   • coordsPrivacy: 3-decimal default rounding, bad-input safety
 *   • locationCache: roundtrip, 24h TTL, storage-unavailable safety
 *   • reverseGeocodeProviders: primary success; primary fail → secondary
 *     success; both fail → null
 *   • productionDetectFn: cache-hit short-circuit; miss → round +
 *     write; reverse-geocode fail keeps coords; raw precision never
 *     leaves the function
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  roundCoord, roundCoords, DEFAULT_COORD_PRECISION,
} from '../../../src/lib/location/coordsPrivacy.js';

import {
  readCache, writeCache, clearCache, _internal as cacheInternals,
} from '../../../src/lib/location/locationCache.js';

import {
  bigdatacloudProvider, nominatimProvider, tryProviders, DEFAULT_PROVIDERS,
} from '../../../src/lib/location/reverseGeocodeProviders.js';

import {
  productionDetectFn, detectAgain,
} from '../../../src/lib/location/productionDetectFn.js';
import { BrowserLocationError } from '../../../src/lib/location/browserLocation.js';
import {
  setDefaultProviders, resetDefaultProviders, getDefaultProviders,
  bigdatacloudProvider, nominatimProvider, tryProviders as tryProvidersFn,
} from '../../../src/lib/location/reverseGeocodeProviders.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
}

// ─── 1. coordsPrivacy ─────────────────────────────────────────────
describe('coordsPrivacy.roundCoord / roundCoords', () => {
  it('default precision is 3 decimals', () => {
    expect(DEFAULT_COORD_PRECISION).toBe(3);
    expect(roundCoord(37.77492899)).toBe(37.775);
    expect(roundCoord(-122.4194155)).toBe(-122.419);
  });

  it('honours caller-supplied precision', () => {
    expect(roundCoord(37.77492899, 4)).toBe(37.7749);
    expect(roundCoord(37.77492899, 0)).toBe(38);
  });

  it('non-finite inputs → null (no throw)', () => {
    expect(roundCoord(NaN)).toBeNull();
    expect(roundCoord(null)).toBeNull();
    expect(roundCoord(undefined)).toBeNull();
    expect(roundCoord('x')).toBeNull();
  });

  it('roundCoords returns a full pair', () => {
    const out = roundCoords({ latitude: 5.553333, longitude: -0.201111 });
    expect(out.latitude).toBe(5.553);
    expect(out.longitude).toBe(-0.201);
  });
});

// ─── 2. locationCache ─────────────────────────────────────────────
describe('locationCache', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('roundtrips a write → read', () => {
    const written = writeCache({
      latitude: 37.77492, longitude: -122.41941,
      country: 'US', stateCode: 'CA', city: 'San Francisco',
      source: 'network', now: 1_000_000_000_000,
    });
    expect(written.latitude).toBe(37.775);   // re-rounded on write
    expect(written.longitude).toBe(-122.419);

    const cached = readCache({ now: 1_000_000_000_000 });
    expect(cached.country).toBe('US');
    expect(cached.stateCode).toBe('CA');
    expect(cached.timestamp).toBe(1_000_000_000_000);
  });

  it('expires after the TTL (24h default)', () => {
    writeCache({
      latitude: 1, longitude: 1, country: 'US', now: 0,
    });
    // 23h59m — still fresh
    expect(readCache({ now: 23 * 3600 * 1000 + 59 * 60 * 1000 })).toBeTruthy();
    // 24h01m — expired
    expect(readCache({ now: 24 * 3600 * 1000 + 60 * 1000 })).toBeNull();
  });

  it('bad / missing coords → no write', () => {
    expect(writeCache({ latitude: NaN, longitude: NaN })).toBeNull();
    expect(writeCache({})).toBeNull();
  });

  it('degrades safely without localStorage', () => {
    delete globalThis.window;
    expect(writeCache({ latitude: 1, longitude: 2, country: 'US' })).toBeNull();
    expect(readCache()).toBeNull();
    // no throws
  });

  it('clearCache wipes the entry', () => {
    writeCache({ latitude: 1, longitude: 2, country: 'US' });
    clearCache();
    expect(readCache()).toBeNull();
  });

  it('storage key stays under the farroway.* namespace', () => {
    expect(cacheInternals.STORAGE_KEY.startsWith('farroway.')).toBe(true);
  });
});

// ─── 3. reverseGeocodeProviders ───────────────────────────────────
describe('reverseGeocodeProviders', () => {
  it('DEFAULT_PROVIDERS is bigdatacloud then nominatim', () => {
    expect(DEFAULT_PROVIDERS[0]).toBe(bigdatacloudProvider);
    expect(DEFAULT_PROVIDERS[1]).toBe(nominatimProvider);
  });

  it('bigdatacloudProvider maps response shape', async () => {
    const fetchJson = async () => ({
      countryCode: 'us', countryName: 'United States',
      principalSubdivision: 'California', city: 'San Francisco',
    });
    const r = await bigdatacloudProvider(37.77, -122.42, { fetchJson });
    expect(r.country).toBe('US');
    expect(r.countryLabel).toBe('United States');
    expect(r.principalSubdivision).toBe('California');
    expect(r.city).toBe('San Francisco');
  });

  it('bigdatacloudProvider returns null when response has no country', async () => {
    const fetchJson = async () => ({ city: 'Somewhere' });
    expect(await bigdatacloudProvider(0, 0, { fetchJson })).toBeNull();
  });

  it('nominatimProvider reads address.country_code + state + city', async () => {
    const fetchJson = async () => ({
      address: {
        country_code: 'ng', country: 'Nigeria',
        state: 'Lagos', city: 'Ikeja',
      },
    });
    const r = await nominatimProvider(6.5, 3.4, { fetchJson });
    expect(r.country).toBe('NG');
    expect(r.countryLabel).toBe('Nigeria');
    expect(r.principalSubdivision).toBe('Lagos');
    expect(r.city).toBe('Ikeja');
  });

  it('nominatimProvider returns null when address is missing', async () => {
    expect(await nominatimProvider(0, 0, { fetchJson: async () => ({}) })).toBeNull();
  });

  // ─── Fallback chain ───────────────────────────────────────
  it('tryProviders: primary null → secondary wins', async () => {
    const primary = async () => null;
    const secondary = async () => ({
      country: 'KE', countryLabel: 'Kenya',
      principalSubdivision: 'Nairobi', city: 'Nairobi', raw: {},
    });
    const r = await tryProviders(1, 1, { providers: [primary, secondary] });
    expect(r.country).toBe('KE');
  });

  it('tryProviders: primary throws → secondary still tried', async () => {
    const primary = async () => { throw new Error('rate limit'); };
    const secondary = async () => ({
      country: 'GH', countryLabel: 'Ghana',
      principalSubdivision: null, city: null, raw: {},
    });
    const r = await tryProviders(1, 1, { providers: [primary, secondary] });
    expect(r.country).toBe('GH');
  });

  it('tryProviders: all null → null', async () => {
    const r = await tryProviders(1, 1, {
      providers: [async () => null, async () => null],
    });
    expect(r).toBeNull();
  });
});

// ─── 4. productionDetectFn ────────────────────────────────────────
describe('productionDetectFn', () => {
  it('cache hit when rounded coords match → skips geocode', async () => {
    const cached = {
      latitude: 37.775, longitude: -122.419,
      country: 'US', stateCode: 'CA', city: 'SF',
      source: 'network', timestamp: Date.now(),
    };
    let geocodeCalled = false;
    const r = await productionDetectFn({
      readCacheFn: () => cached,
      // Raw GPS value that rounds to the SAME 3-decimal pair as the
      // cached entry — the cache is reusable.
      coords: async () => ({ latitude: 37.77492, longitude: -122.41913, accuracy: 8 }),
      geocode: () => { geocodeCalled = true; return null; },
    });
    expect(geocodeCalled).toBe(false); // network skipped
    expect(r.cached).toBe(true);
    expect(r.latitude).toBe(37.775);
    expect(r.country).toBe('US');
  });

  // ─── Cache invalidation on coord drift (new) ──────────────────
  it('cache miss when rounded coords differ → refreshes via geocoder', async () => {
    const cached = {
      latitude: 37.775, longitude: -122.419,
      country: 'US', stateCode: 'CA', city: 'SF',
      source: 'network', timestamp: Date.now(),
    };
    let wrote = null;
    let geocodeCalled = false;
    const r = await productionDetectFn({
      readCacheFn: () => cached,
      // New coords round to Nairobi — a different bucket. Cache
      // must NOT be reused.
      coords: async () => ({ latitude: -1.292, longitude: 36.821, accuracy: 10 }),
      geocode: async (/* lat, lng */) => {
        geocodeCalled = true;
        return { country: 'KE', stateCode: null, city: 'Nairobi', source: 'network' };
      },
      writeCacheFn: (p) => { wrote = p; return p; },
    });
    expect(geocodeCalled).toBe(true);
    expect(r.cached).toBe(false);
    expect(r.country).toBe('KE');
    expect(wrote.country).toBe('KE');
    expect(wrote.latitude).toBe(-1.292);
    expect(wrote.longitude).toBe(36.821);
  });

  it('bypassCache:true ignores the cache even on coord match', async () => {
    const cached = {
      latitude: 1.234, longitude: 5.678, country: 'US',
      source: 'network', timestamp: Date.now(),
    };
    let geocodeCalled = false;
    await productionDetectFn({
      bypassCache: true,
      readCacheFn: () => cached,
      coords: async () => ({ latitude: 1.234, longitude: 5.678, accuracy: 1 }),
      geocode: async () => { geocodeCalled = true; return { country: 'GH', source: 'network' }; },
    });
    expect(geocodeCalled).toBe(true);
  });

  it('miss → calls coords + geocode, rounds, writes cache', async () => {
    let wrote = null;
    const r = await productionDetectFn({
      readCacheFn: () => null,
      coords: async () => ({ latitude: 37.77492899, longitude: -122.4194155, accuracy: 10 }),
      geocode: async () => ({ country: 'US', stateCode: 'CA', city: 'SF',
                              source: 'network' }),
      writeCacheFn: (p) => { wrote = p; return p; },
    });
    expect(r.latitude).toBe(37.775);
    expect(r.longitude).toBe(-122.419);
    expect(r.country).toBe('US');
    expect(r.cached).toBe(false);
    expect(wrote).toBeTruthy();
    expect(wrote.country).toBe('US');
    expect(wrote.latitude).toBe(37.775);   // rounded when cached
  });

  it('reverse-geocode null → still returns rounded coords, no cache write', async () => {
    let wrote = null;
    const r = await productionDetectFn({
      readCacheFn: () => null,
      coords: async () => ({ latitude: 60.17, longitude: 24.94, accuracy: 5 }),
      geocode: async () => null, // both providers failed
      writeCacheFn: (p) => { wrote = p; return p; },
    });
    expect(r.country).toBeNull();
    expect(r.latitude).toBe(60.17);
    expect(r.longitude).toBe(24.94);
    expect(wrote).toBeNull();
  });

  it('coords throw is propagated (UI needs the error code)', async () => {
    await expect(productionDetectFn({
      readCacheFn: () => null,
      coords: async () => { throw new BrowserLocationError('permission_denied'); },
    })).rejects.toMatchObject({ code: 'permission_denied' });
  });

  it('raw precision never leaks — output is always coarse', async () => {
    const r = await productionDetectFn({
      readCacheFn: () => null,
      coords: async () => ({ latitude: 51.500729, longitude: -0.124625, accuracy: 3 }),
      geocode: async () => ({ country: 'GB', stateCode: null, city: 'London',
                              source: 'network' }),
      writeCacheFn: () => ({}),
    });
    // 3-decimal rounding in, 3-decimal rounding out.
    expect(r.latitude).toBe(51.501);
    expect(r.longitude).toBe(-0.125);
  });

  it('cache-write failure does not bubble up to the caller', async () => {
    const r = await productionDetectFn({
      readCacheFn: () => null,
      coords: async () => ({ latitude: 1, longitude: 2, accuracy: 1 }),
      geocode: async () => ({ country: 'US', stateCode: null, city: null,
                              source: 'network' }),
      writeCacheFn: () => { throw new Error('storage full'); },
    });
    expect(r.country).toBe('US'); // caller still gets a result
  });

  // ─── detectAgain — clears cache + bypasses on the next call ───
  it('detectAgain forces a fresh read', async () => {
    installLocalStorage();
    // Seed the cache with SF so a cache-hit would normally short-
    // circuit. detectAgain must ignore it.
    const { writeCache: seed } = await import(
      '../../../src/lib/location/locationCache.js'
    );
    seed({ latitude: 37.775, longitude: -122.419, country: 'US' });

    let geocodeCalled = false;
    const r = await detectAgain({
      coords: async () => ({ latitude: 37.77492, longitude: -122.41913, accuracy: 5 }),
      geocode: async () => { geocodeCalled = true; return { country: 'US', source: 'network' }; },
    });
    expect(geocodeCalled).toBe(true); // bypass worked
    expect(r.cached).toBe(false);
    delete globalThis.window;
  });
});

// ─── 5. Provider swap API (hardening §3) ──────────────────────────
describe('reverseGeocodeProviders — swap API', () => {
  afterEach(() => { resetDefaultProviders(); });

  it('setDefaultProviders overrides the active chain', () => {
    const fake = async () => ({ country: 'ZZ', raw: {} });
    setDefaultProviders([fake]);
    expect(getDefaultProviders()).toEqual([fake]);
  });

  it('tryProviders honours the swapped chain when no providers arg', async () => {
    const fake = async () => ({ country: 'ZZ', raw: {} });
    setDefaultProviders([fake]);
    const r = await tryProvidersFn(0, 0);
    expect(r.country).toBe('ZZ');
  });

  it('empty / invalid input is rejected (chain stays intact)', () => {
    const before = getDefaultProviders();
    expect(setDefaultProviders([])).toBe(false);
    expect(setDefaultProviders(null)).toBe(false);
    expect(setDefaultProviders(['not a fn'])).toBe(false);
    expect(getDefaultProviders()).toEqual(before);
  });

  it('resetDefaultProviders restores bigdatacloud → nominatim', () => {
    setDefaultProviders([async () => null]);
    resetDefaultProviders();
    const chain = getDefaultProviders();
    expect(chain[0]).toBe(bigdatacloudProvider);
    expect(chain[1]).toBe(nominatimProvider);
  });
});
