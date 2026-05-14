/**
 * farmHealthCoordinateGuard.test.js — Farm Health API Stability
 * Fix.
 *
 * Root cause: useFarmHealth accepted lat=0,lng=0 because
 * Number.isFinite(0) is true. /v2/satellite/farm-health 500s on
 * null-island (Gulf of Guinea, no farms). Downstream intelligence
 * broke whenever an unset farm record carried the 0,0 sentinel.
 *
 * Coverage:
 *   1. isValidCoordinate rejects every spec-mandated bad shape
 *   2. inspectCoordinate returns the structured reason
 *   3. normaliseCoordinate returns null on invalid + {lat,lng}
 *      on valid
 *   4. useFarmHealth source-level: imports the guard + uses it
 *      to derive hasCoords (regression guard)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  isValidCoordinate,
  inspectCoordinate,
  normaliseCoordinate,
  COORDINATE_REJECT_REASONS,
} from '../../../src/lib/geo/coordinateGuard.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

// ─── 1. isValidCoordinate — soft validator ───────────────────

describe('isValidCoordinate — bad inputs collapse to false', () => {
  it.each([
    [null,      null,      'both null'],
    [undefined, undefined, 'both undefined'],
    [null,      10,        'lat missing'],
    [10,        null,      'lng missing'],
    [NaN,       10,        'lat NaN'],
    [10,        NaN,       'lng NaN'],
    [Infinity,  10,        'lat infinite'],
    ['hi',      10,        'lat string'],
    [10,        'lo',      'lng string'],
    [true,      10,        'lat boolean'],
  ])('rejects (%s, %s) — %s', (lat, lng) => {
    expect(isValidCoordinate(lat, lng)).toBe(false);
  });

  it('rejects the null-island (0, 0) sentinel', () => {
    // The exact bug repro — useFarmHealth used to accept this.
    expect(isValidCoordinate(0, 0)).toBe(false);
    expect(isValidCoordinate('0', '0')).toBe(false);
  });

  it('rejects out-of-range latitudes', () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
  });

  it('rejects out-of-range longitudes', () => {
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(0, -181)).toBe(false);
  });
});

describe('isValidCoordinate — valid coords pass', () => {
  it.each([
    [39.4143, -77.4105], // Maryland (the audit's test farm)
    [5.6037,  -0.187],   // Accra, Ghana
    [-1.2921, 36.8219],  // Nairobi, Kenya
    [0.0001,  0.0001],   // tiny but non-zero (not null-island)
    [-90,     0],        // south pole — extreme but valid
    [90,      180],      // edge case — top-right corner
  ])('accepts (%s, %s)', (lat, lng) => {
    expect(isValidCoordinate(lat, lng)).toBe(true);
  });

  it('accepts numeric strings that parse to valid numbers', () => {
    expect(isValidCoordinate('39.4143', '-77.4105')).toBe(true);
  });
});

// ─── 2. inspectCoordinate — structured reason ────────────────

describe('inspectCoordinate — surfaces the rejection reason', () => {
  it('null inputs → MISSING', () => {
    expect(inspectCoordinate(null, null).reason).toBe(COORDINATE_REJECT_REASONS.MISSING);
  });

  it('NaN inputs → NOT_FINITE', () => {
    expect(inspectCoordinate(NaN, 10).reason).toBe(COORDINATE_REJECT_REASONS.NOT_FINITE);
  });

  it('out-of-range → OUT_OF_RANGE', () => {
    expect(inspectCoordinate(91, 0).reason).toBe(COORDINATE_REJECT_REASONS.OUT_OF_RANGE);
  });

  it('null-island → NULL_ISLAND (the audit bug)', () => {
    expect(inspectCoordinate(0, 0).reason).toBe(COORDINATE_REJECT_REASONS.NULL_ISLAND);
  });

  it('valid → { valid:true, lat, lng } with coerced numbers', () => {
    const out = inspectCoordinate('39.4143', '-77.4105');
    expect(out.valid).toBe(true);
    expect(out.lat).toBeCloseTo(39.4143);
    expect(out.lng).toBeCloseTo(-77.4105);
  });
});

// ─── 3. normaliseCoordinate convenience ──────────────────────

describe('normaliseCoordinate', () => {
  it('returns null on invalid + { lat, lng } on valid', () => {
    expect(normaliseCoordinate(0, 0)).toBeNull();
    expect(normaliseCoordinate(null, null)).toBeNull();
    expect(normaliseCoordinate(39.4143, -77.4105)).toEqual({
      lat: 39.4143, lng: -77.4105,
    });
  });

  it('coerces numeric strings', () => {
    const ok = normaliseCoordinate('5.6037', '-0.187');
    expect(ok.lat).toBeCloseTo(5.6037);
    expect(ok.lng).toBeCloseTo(-0.187);
  });
});

// ─── 4. useFarmHealth source-level regression guard ─────────

describe('useFarmHealth source — imports + uses the guard', () => {
  const src = read('src/hooks/useFarmHealth.js');

  it('imports inspectCoordinate from the canonical guard module', () => {
    expect(src).toMatch(/from '\.\.\/lib\/geo\/coordinateGuard\.js'/);
    expect(src).toMatch(/inspectCoordinate/);
  });

  it('NO LONGER derives hasCoords from a bare Number.isFinite check', () => {
    // Pre-fix line was:
    //   const lat = (location && Number.isFinite(Number(location.lat)))
    //                 ? Number(location.lat) : null;
    // Post-fix uses inspectCoordinate(...).valid.
    const hasCoordsLine = src.split('\n').find((l) => /const hasCoords =/.test(l));
    expect(hasCoordsLine).toBeTruthy();
    expect(hasCoordsLine).toMatch(/check\.valid/);
    expect(hasCoordsLine).not.toMatch(/Number\.isFinite/);
  });

  it('emits a [FARM_HEALTH_LOCATION] dev trace line', () => {
    expect(src).toMatch(/\[FARM_HEALTH_LOCATION\]/);
  });
});

// ─── 5. End-to-end repro: the exact failing request ─────────

describe('Acceptance — the audit request would NOT fire post-fix', () => {
  it('lat=0 lng=0 location object collapses to no-coords', () => {
    // Simulate the shape a stale farm record would carry.
    const inspection = inspectCoordinate(0, 0);
    expect(inspection.valid).toBe(false);
    expect(inspection.reason).toBe(COORDINATE_REJECT_REASONS.NULL_ISLAND);
  });

  it('Maryland coords still fire the request', () => {
    const inspection = inspectCoordinate(39.4143, -77.4105);
    expect(inspection.valid).toBe(true);
  });
});
