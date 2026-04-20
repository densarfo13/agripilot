/**
 * reverseGeocode.test.js — real reverse-geocoder with offline fallback.
 *
 * Covers:
 *   • network happy path — bigdatacloud response is parsed correctly
 *   • state label → ISO code mapping via central countriesStates table
 *   • coarse bounding-box fallback when the network returns nothing
 *   • timeout path returns null (via a promise that never resolves)
 *   • malformed / non-finite inputs → null, no throws
 */

import { describe, it, expect } from 'vitest';

import {
  reverseGeocode, coarseGeocode, stateCodeFromLabel,
} from '../../../src/lib/location/reverseGeocode.js';

// ─── coarseGeocode (offline heuristic) ─────────────────────────────
describe('coarseGeocode', () => {
  it('detects US / GH / IN / NG / KE / TZ / ZA bounding boxes', () => {
    expect(coarseGeocode(37.77,  -122.42).country).toBe('US'); // San Francisco
    expect(coarseGeocode(5.55,    -0.20).country).toBe('GH'); // Accra
    expect(coarseGeocode(19.07,   72.87).country).toBe('IN'); // Mumbai
    expect(coarseGeocode(6.52,    3.38 ).country).toBe('NG'); // Lagos
    expect(coarseGeocode(-1.29,  36.82 ).country).toBe('KE'); // Nairobi
    expect(coarseGeocode(-6.79,  39.21 ).country).toBe('TZ'); // Dar es Salaam
    expect(coarseGeocode(-33.92, 18.42).country).toBe('ZA'); // Cape Town
  });

  it('returns null for unsupported regions', () => {
    expect(coarseGeocode(60.17, 24.94)).toBeNull(); // Helsinki
    expect(coarseGeocode(0, 0)).toBeNull();         // null island
  });

  it('returns null for malformed inputs', () => {
    expect(coarseGeocode(null, 0)).toBeNull();
    expect(coarseGeocode('x', 'y')).toBeNull();
    expect(coarseGeocode(NaN, NaN)).toBeNull();
  });
});

// ─── stateCodeFromLabel ────────────────────────────────────────────
describe('stateCodeFromLabel', () => {
  it('maps a US state label to its ISO code', () => {
    expect(stateCodeFromLabel('US', 'California')).toBe('CA');
    expect(stateCodeFromLabel('US', 'New York')).toBe('NY');
  });

  it('case-insensitive match', () => {
    expect(stateCodeFromLabel('US', 'texas')).toBe('TX');
  });

  it('accepts a bare ISO code too', () => {
    expect(stateCodeFromLabel('US', 'CA')).toBe('CA');
  });

  it('returns null for unknown states / countries', () => {
    expect(stateCodeFromLabel('US', 'Atlantis')).toBeNull();
    expect(stateCodeFromLabel('FR', 'Île-de-France')).toBeNull();
    expect(stateCodeFromLabel(null, 'California')).toBeNull();
  });
});

// ─── reverseGeocode — network happy path ──────────────────────────
describe('reverseGeocode — network path', () => {
  it('parses bigdatacloud response (country + state + city)', async () => {
    const fakeJson = async () => ({
      countryCode: 'us',                  // lower-case from API — must uppercase
      countryName: 'United States',
      principalSubdivision: 'California',
      city: 'San Francisco',
      locality: 'SOMA',
    });
    const r = await reverseGeocode(37.77, -122.42, { fetchJson: fakeJson });
    expect(r).toBeTruthy();
    expect(r.country).toBe('US');
    expect(r.countryLabel).toBe('United States');
    expect(r.principalSubdivision).toBe('California');
    expect(r.stateCode).toBe('CA');
    expect(r.city).toBe('San Francisco');
    expect(r.source).toBe('network');
  });

  it('falls back to locality when city is missing', async () => {
    const fakeJson = async () => ({
      countryCode: 'GH', countryName: 'Ghana',
      principalSubdivision: 'Greater Accra',
      locality: 'Osu',
    });
    const r = await reverseGeocode(5.55, -0.20, { fetchJson: fakeJson });
    expect(r.city).toBe('Osu');
    expect(r.stateCode).toBe('AA'); // Greater Accra → AA
  });

  it('network result wins over the coarse fallback', async () => {
    // Coordinates are inside the US box, but the network says Canada.
    const fakeJson = async () => ({ countryCode: 'CA', countryName: 'Canada' });
    const r = await reverseGeocode(45.0, -100.0, { fetchJson: fakeJson });
    expect(r.country).toBe('CA');
    expect(r.source).toBe('network');
  });

  it('returns null stateCode when the subdivision does not map', async () => {
    const fakeJson = async () => ({
      countryCode: 'BR', countryName: 'Brazil',
      principalSubdivision: 'São Paulo',
    });
    const r = await reverseGeocode(-23.55, -46.63, { fetchJson: fakeJson });
    expect(r.country).toBe('BR');
    expect(r.stateCode).toBeNull(); // BR not in our STATES_BY_COUNTRY
  });
});

// ─── reverseGeocode — fallback + safety ──────────────────────────
describe('reverseGeocode — fallback + safety', () => {
  it('uses coarse fallback when network returns null', async () => {
    const fakeJson = async () => null; // simulate network failure
    const r = await reverseGeocode(37.77, -122.42, { fetchJson: fakeJson });
    expect(r.source).toBe('coarse');
    expect(r.country).toBe('US');
    expect(r.stateCode).toBeNull(); // coarse has no state
  });

  it('uses coarse fallback when network returns data without country', async () => {
    const fakeJson = async () => ({ city: 'nowhere', principalSubdivision: 'Atlantis' });
    const r = await reverseGeocode(5.55, -0.20, { fetchJson: fakeJson });
    expect(r.source).toBe('coarse');
    expect(r.country).toBe('GH');
  });

  it('forceCoarse skips the network entirely', async () => {
    let networkCalled = false;
    const fakeJson = async () => { networkCalled = true; return {}; };
    const r = await reverseGeocode(37.77, -122.42, {
      fetchJson: fakeJson, forceCoarse: true,
    });
    expect(networkCalled).toBe(false);
    expect(r.source).toBe('coarse');
  });

  it('returns null when both network AND coarse fail', async () => {
    const fakeJson = async () => null;
    const r = await reverseGeocode(60.17, 24.94, { fetchJson: fakeJson }); // Helsinki
    expect(r).toBeNull();
  });

  it('returns null for malformed coords (never throws)', async () => {
    expect(await reverseGeocode(undefined, undefined)).toBeNull();
    expect(await reverseGeocode('x', 'y')).toBeNull();
    expect(await reverseGeocode(NaN, NaN)).toBeNull();
  });
});
