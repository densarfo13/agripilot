/**
 * soilIntelligence.test.js — pins the invisible-soil contract.
 *
 *   1. Normalizer maps composition → calm soil-type label.
 *   2. Clay → high moisture risk after rain; Sandy → high in dry.
 *   3. pH bucketed qualitatively (never numeric).
 *   4. Raw fields (ph / sand / silt / clay / organicCarbon) NEVER
 *      surface in the public shape.
 *   5. fetchSoilForCoords never throws — returns null on any
 *      failure path.
 *   6. enrichWithSoilContext passes target through unchanged when
 *      soil is null (the fallback rule).
 *   7. hasActionableSoil reflects soil usefulness honestly.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  normalizeSoilData,
  fetchSoilForCoords,
  enrichWithSoilContext,
  hasActionableSoil,
} from '../../../src/lib/soilIntelligence.js';

// ─── normalizeSoilData — soil type ────────────────────────────

describe('normalizeSoilData — soil-type derivation', () => {
  it('classifies clay-heavy composition as Clay', () => {
    const r = normalizeSoilData({ sand: 20, silt: 30, clay: 50, ph: 6.8 });
    expect(r.soilType).toBe('Clay');
  });

  it('classifies sandy composition as Sandy', () => {
    const r = normalizeSoilData({ sand: 80, silt: 10, clay: 10, ph: 6.5 });
    expect(r.soilType).toBe('Sandy');
  });

  it('classifies balanced composition as Loam', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    expect(r.soilType).toBe('Loam');
  });

  it('classifies silt-heavy as Silt', () => {
    const r = normalizeSoilData({ sand: 20, silt: 60, clay: 20, ph: 7.0 });
    expect(r.soilType).toBe('Silt');
  });

  it('classifies loamy sand correctly', () => {
    const r = normalizeSoilData({ sand: 65, silt: 25, clay: 10, ph: 6.8 });
    expect(r.soilType).toBe('Loamy sand');
  });

  it('returns null on missing composition', () => {
    expect(normalizeSoilData({ ph: 6.5 })).toBeNull();
    expect(normalizeSoilData(null)).toBeNull();
    expect(normalizeSoilData({})).toBeNull();
  });

  it('returns null on non-numeric composition', () => {
    expect(normalizeSoilData({ sand: 'a lot', silt: 30, clay: 30 })).toBeNull();
  });
});

// ─── Moisture risk ────────────────────────────────────────────

describe('normalizeSoilData — moisture risk', () => {
  it('clay + recent rain → high moisture risk', () => {
    const r = normalizeSoilData(
      { sand: 20, silt: 30, clay: 50, ph: 6.5 },
      { recentRainfallMm: 30 }
    );
    expect(r.moistureRisk).toBe('high');
  });

  it('clay without rain → medium risk', () => {
    const r = normalizeSoilData({ sand: 20, silt: 30, clay: 50, ph: 6.5 });
    expect(r.moistureRisk).toBe('medium');
  });

  it('sandy + dry spell → high drought risk', () => {
    const r = normalizeSoilData(
      { sand: 80, silt: 10, clay: 10, ph: 6.5 },
      { recentRainfallMm: 0 }
    );
    expect(r.moistureRisk).toBe('high');
  });

  it('sandy without dry spell info → medium', () => {
    const r = normalizeSoilData({ sand: 80, silt: 10, clay: 10, ph: 6.5 });
    expect(r.moistureRisk).toBe('medium');
  });

  it('loam → low moisture risk regardless of weather', () => {
    expect(normalizeSoilData(
      { sand: 40, silt: 40, clay: 20, ph: 6.5 },
      { recentRainfallMm: 30 }
    ).moistureRisk).toBe('low');
    expect(normalizeSoilData(
      { sand: 40, silt: 40, clay: 20, ph: 6.5 }
    ).moistureRisk).toBe('low');
  });
});

// ─── Fertility hint — calm + non-numeric ──────────────────────

describe('normalizeSoilData — fertility hint', () => {
  it('acidic pH (< 6.0) produces a calm acidic hint', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 5.5 });
    expect(r.fertilityHint.toLowerCase()).toMatch(/acidic/);
    expect(r.fertilityHint.toLowerCase()).toMatch(/lime/);
  });

  it('alkaline pH (> 7.5) produces a calm alkaline hint', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 8.0 });
    expect(r.fertilityHint.toLowerCase()).toMatch(/alkaline/);
  });

  it('neutral pH produces a balanced hint', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    expect(r.fertilityHint.toLowerCase()).toMatch(/balanced/);
  });

  it('falls back to type-driven hint when pH missing', () => {
    const sandy = normalizeSoilData({ sand: 80, silt: 10, clay: 10 });
    expect(sandy.fertilityHint.toLowerCase()).toMatch(/sandy soils need/);

    const clay = normalizeSoilData({ sand: 20, silt: 30, clay: 50 });
    expect(clay.fertilityHint.toLowerCase()).toMatch(/holds nutrients/);
  });

  it('NEVER contains the raw pH number', () => {
    for (const ph of [4.5, 5.0, 6.0, 7.0, 8.0, 9.0]) {
      const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph });
      if (!r || !r.fertilityHint) continue;
      // Numeric pH must not leak.
      expect(r.fertilityHint).not.toMatch(/\d\.\d/);
    }
  });
});

// ─── Farming action ───────────────────────────────────────────

describe('normalizeSoilData — farming action', () => {
  it('clay + high moisture risk → "hold off on watering"', () => {
    const r = normalizeSoilData(
      { sand: 20, silt: 30, clay: 50, ph: 6.8 },
      { recentRainfallMm: 30 }
    );
    expect(r.farmingAction.toLowerCase()).toMatch(/hold off|wet from earlier rain/);
  });

  it('sandy + dry spell → "shorter, more frequent doses"', () => {
    const r = normalizeSoilData(
      { sand: 80, silt: 10, clay: 10, ph: 6.5 },
      { recentRainfallMm: 0 }
    );
    expect(r.farmingAction.toLowerCase()).toMatch(/short|frequent/);
  });

  it('loam → balanced "usual routine" action', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    expect(r.farmingAction.toLowerCase()).toMatch(/balanced|usual routine/);
  });
});

// ─── Raw data containment ─────────────────────────────────────

describe('raw soil data NEVER surfaces in the public shape', () => {
  it('output has only the 4 canonical fields', () => {
    const r = normalizeSoilData(
      { sand: 40, silt: 40, clay: 20, ph: 6.8, organicCarbon: 1.2, bulkDensity: 1.3 }
    );
    expect(Object.keys(r).sort()).toEqual([
      'farmingAction', 'fertilityHint', 'moistureRisk', 'soilType',
    ]);
    expect(r.sand).toBeUndefined();
    expect(r.silt).toBeUndefined();
    expect(r.clay).toBeUndefined();
    expect(r.ph).toBeUndefined();
    expect(r.organicCarbon).toBeUndefined();
  });

  it('output is frozen — UI cannot mutate', () => {
    const r = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('fertilityHint never contains a raw pH number or percentage', () => {
    const r = normalizeSoilData({ sand: 80, silt: 10, clay: 10, ph: 5.4 });
    expect(r.fertilityHint).not.toMatch(/\d+\s*%/);
    expect(r.fertilityHint).not.toMatch(/\bpH\b/i);
    expect(r.fertilityHint).not.toMatch(/\d\.\d/);
  });
});

// ─── fetchSoilForCoords — failure handling ────────────────────

describe('fetchSoilForCoords — never throws, never errors visible', () => {
  it('returns null when no fetcher is provided', async () => {
    expect(await fetchSoilForCoords(5.6, -0.18)).toBeNull();
  });

  it('returns null on bad coordinates', async () => {
    const fetcher = vi.fn(async () => ({ sand: 40, silt: 40, clay: 20, ph: 6.8 }));
    expect(await fetchSoilForCoords('not a number', -0.18, fetcher)).toBeNull();
    expect(await fetchSoilForCoords(NaN, -0.18, fetcher)).toBeNull();
    expect(await fetchSoilForCoords(5.6, undefined, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns null + does NOT throw when fetcher rejects', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('soil api down')));
    await expect(fetchSoilForCoords(5.6, -0.18, fetcher)).resolves.toBeNull();
  });

  it('returns null + does NOT throw when fetcher throws sync', async () => {
    const fetcher = vi.fn(() => { throw new Error('sync boom'); });
    await expect(fetchSoilForCoords(5.6, -0.18, fetcher)).resolves.toBeNull();
  });

  it('returns null when fetcher returns garbage', async () => {
    const fetcher = vi.fn(async () => 'not soil data');
    expect(await fetchSoilForCoords(5.6, -0.18, fetcher)).toBeNull();
  });

  it('normalises a real-shape response cleanly', async () => {
    const fetcher = vi.fn(async () => ({
      sand: 40, silt: 40, clay: 20, ph: 6.8,
    }));
    const r = await fetchSoilForCoords(5.6, -0.18, fetcher);
    expect(r).not.toBeNull();
    expect(r.soilType).toBe('Loam');
  });

  it('forwards options (recentRainfallMm) to the normaliser', async () => {
    const fetcher = vi.fn(async () => ({ sand: 20, silt: 30, clay: 50, ph: 6.5 }));
    const r = await fetchSoilForCoords(5.6, -0.18, fetcher, { recentRainfallMm: 30 });
    expect(r.moistureRisk).toBe('high');
  });
});

// ─── enrichWithSoilContext — additive + null-safe ─────────────

describe('enrichWithSoilContext — additive + null-safe', () => {
  it('passes the target through unchanged when soil is null', () => {
    const target = { title: 'task A', urgency: 'high' };
    const r = enrichWithSoilContext(target, null);
    expect(r).toEqual({ title: 'task A', urgency: 'high' });
    expect(r.soilContext).toBeUndefined();
  });

  it('passes the target through when soil is undefined / garbage', () => {
    const target = { x: 1 };
    expect(enrichWithSoilContext(target, undefined).x).toBe(1);
    expect(enrichWithSoilContext(target, 'string').x).toBe(1);
    expect(enrichWithSoilContext(target, undefined).soilContext).toBeUndefined();
  });

  it('attaches ONLY the 4 canonical fields under soilContext', () => {
    const soil = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    const r = enrichWithSoilContext({ title: 'task' }, soil);
    expect(Object.keys(r.soilContext).sort()).toEqual([
      'farmingAction', 'fertilityHint', 'moistureRisk', 'soilType',
    ]);
  });

  it('attaches FROZEN soilContext (UI cannot mutate)', () => {
    const soil = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    const r = enrichWithSoilContext({}, soil);
    expect(Object.isFrozen(r.soilContext)).toBe(true);
  });

  it('does not mutate the original target', () => {
    const original = { title: 'task' };
    const soil = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    enrichWithSoilContext(original, soil);
    expect(original.soilContext).toBeUndefined();
  });

  it('handles null/garbage target safely', () => {
    expect(enrichWithSoilContext(null, null)).toEqual({});
    expect(enrichWithSoilContext('not an object', null)).toEqual({});
  });
});

// ─── hasActionableSoil ───────────────────────────────────────

describe('hasActionableSoil', () => {
  it('returns false on null / undefined / empty', () => {
    expect(hasActionableSoil(null)).toBe(false);
    expect(hasActionableSoil(undefined)).toBe(false);
    expect(hasActionableSoil({})).toBe(false);
  });

  it('returns true when soil has type + actionable text', () => {
    const soil = normalizeSoilData({ sand: 40, silt: 40, clay: 20, ph: 6.8 });
    expect(hasActionableSoil(soil)).toBe(true);
  });

  it('returns false when soil has type but no fertility hint AND no action', () => {
    expect(hasActionableSoil({ soilType: 'Loam', moistureRisk: null, fertilityHint: null, farmingAction: null }))
      .toBe(false);
  });
});
