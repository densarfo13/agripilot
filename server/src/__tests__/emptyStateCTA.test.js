/**
 * emptyStateCTA.test.js — pins the §8 contract:
 *   1. Returns null when everything is set up.
 *   2. Returns null on null / garbage input.
 *   3. Priority order: no_farm > no_plant > no_location > no_scan > no_satellite.
 *   4. Each CTA returns the canonical 5-field shape.
 *   5. undefined-key means "caller doesn't care" (NOT "absent");
 *      only an explicit `false` triggers the CTA.
 *   6. hasCrop is an alias for hasPlant (farm + garden surfaces).
 *   7. getAllEmptyStateCTAs returns the full ordered list.
 *   8. Registry exposes every CTA kind.
 */

import { describe, it, expect } from 'vitest';
import {
  getEmptyStateCTA,
  getAllEmptyStateCTAs,
  getEmptyStateRegistry,
} from '../../../src/lib/emptyStateCTA.js';

describe('getEmptyStateCTA — contract', () => {
  it('returns null when every requested piece is present', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasPlant: true, hasLocation: true,
      hasScan: true, hasSatellite: true,
    });
    expect(r).toBeNull();
  });

  it('returns null on null / non-object input', () => {
    expect(getEmptyStateCTA(null)).toBeNull();
    expect(getEmptyStateCTA(undefined)).toBeNull();
    expect(getEmptyStateCTA('not an object')).toBeNull();
  });

  it('returns null when only undefined keys are provided (caller indifferent)', () => {
    expect(getEmptyStateCTA({ hasFarm: undefined })).toBeNull();
  });

  it('returns no_farm CTA when hasFarm: false', () => {
    const r = getEmptyStateCTA({ hasFarm: false });
    expect(r.kind).toBe('no_farm');
    expect(r.title).toBe('Add your first farm');
    expect(r.ctaLabel).toBeTruthy();
    expect(r.ctaRoute).toBeTruthy();
  });

  it('returns the canonical 5-field shape', () => {
    const r = getEmptyStateCTA({ hasScan: false });
    expect(Object.keys(r).sort()).toEqual(['body', 'ctaLabel', 'ctaRoute', 'kind', 'title']);
  });
});

describe('priority ordering', () => {
  it('no_farm outranks every other missing state', () => {
    const r = getEmptyStateCTA({
      hasFarm: false, hasPlant: false, hasLocation: false,
      hasScan: false, hasSatellite: false,
    });
    expect(r.kind).toBe('no_farm');
  });

  it('no_plant outranks no_location / no_scan / no_satellite', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasPlant: false, hasLocation: false,
      hasScan: false, hasSatellite: false,
    });
    expect(r.kind).toBe('no_plant');
  });

  it('no_location outranks no_scan / no_satellite', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasPlant: true, hasLocation: false,
      hasScan: false, hasSatellite: false,
    });
    expect(r.kind).toBe('no_location');
  });

  it('no_scan outranks no_satellite', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasPlant: true, hasLocation: true,
      hasScan: false, hasSatellite: false,
    });
    expect(r.kind).toBe('no_scan');
  });

  it('no_satellite surfaces when everything else is set up', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasPlant: true, hasLocation: true,
      hasScan: true, hasSatellite: false,
    });
    expect(r.kind).toBe('no_satellite');
  });
});

describe('aliases', () => {
  it('hasCrop is an alias for hasPlant (farm side)', () => {
    const r = getEmptyStateCTA({
      hasFarm: true, hasCrop: false, hasLocation: true,
      hasScan: true, hasSatellite: true,
    });
    expect(r.kind).toBe('no_plant');
  });
});

describe('getAllEmptyStateCTAs', () => {
  it('returns the full ordered list of unmet states', () => {
    const all = getAllEmptyStateCTAs({
      hasFarm: false, hasPlant: false, hasLocation: false,
      hasScan: false, hasSatellite: false,
    });
    expect(all.map((c) => c.kind)).toEqual([
      'no_farm', 'no_plant', 'no_location', 'no_scan', 'no_satellite',
    ]);
  });

  it('returns [] when nothing is unmet', () => {
    expect(getAllEmptyStateCTAs({
      hasFarm: true, hasPlant: true, hasLocation: true,
      hasScan: true, hasSatellite: true,
    })).toEqual([]);
  });

  it('returns [] on null', () => {
    expect(getAllEmptyStateCTAs(null)).toEqual([]);
  });
});

describe('getEmptyStateRegistry', () => {
  it('exposes every CTA kind', () => {
    const reg = getEmptyStateRegistry();
    const kinds = reg.map((c) => c.kind);
    expect(kinds).toEqual(['no_farm', 'no_plant', 'no_location', 'no_scan', 'no_satellite']);
    for (const c of reg) {
      expect(c.title).toBeTruthy();
      expect(c.ctaLabel).toBeTruthy();
      expect(c.ctaRoute).toBeTruthy();
    }
  });

  it('returns defensive copies', () => {
    const reg = getEmptyStateRegistry();
    reg[0].title = 'mutated';
    const reg2 = getEmptyStateRegistry();
    expect(reg2[0].title).toBe('Add your first farm');
  });
});
