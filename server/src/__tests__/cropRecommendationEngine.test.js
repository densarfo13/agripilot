/**
 * cropRecommendationEngine.test.js — v1 rule-based recommender.
 *
 * Covers the spec §6 checklist:
 *   1. region-specific recommendations win over country defaults
 *   2. country fallback when region is missing / unknown
 *   3. unsupported country → global fallback with isGeneral: true
 *   4. new farmer vs existing farmer messaging hint propagates
 *   5. limit clamping (3..5)
 *   6. result is frozen + deterministic
 */

import { describe, it, expect } from 'vitest';

import {
  recommendCrops, recommendCropsForScreen, SUPPORTED_COUNTRIES, _internal,
} from '../../../src/lib/recommendations/cropRecommendationEngine.js';
import { RULES, GLOBAL_FALLBACK, FIT_WEIGHT } from '../../../src/config/cropRecommendationRules.js';

// ─── Supported countries + schema sanity ──────────────────────────
describe('rules config', () => {
  it('ships all v1 supported countries', () => {
    for (const c of ['US', 'GH', 'NG', 'KE', 'IN']) {
      expect(SUPPORTED_COUNTRIES).toContain(c);
      expect(RULES[c]).toBeTruthy();
      expect(Array.isArray(RULES[c].defaults)).toBe(true);
      expect(RULES[c].defaults.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('every rule has crop + fit + why + plantingWindow', () => {
    for (const c of SUPPORTED_COUNTRIES) {
      for (const r of RULES[c].defaults) {
        expect(typeof r.crop).toBe('string');
        expect(['high','medium','low']).toContain(r.fit);
        expect(typeof r.why).toBe('string');
        expect(typeof r.plantingWindow).toBe('string');
      }
    }
  });

  it('FIT_WEIGHT maps each bucket', () => {
    expect(FIT_WEIGHT.high).toBeGreaterThan(FIT_WEIGHT.medium);
    expect(FIT_WEIGHT.medium).toBeGreaterThan(FIT_WEIGHT.low);
  });

  it('GLOBAL_FALLBACK is non-empty', () => {
    expect(GLOBAL_FALLBACK.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── 1. Region-specific wins over country (spec §6.1) ─────────────
describe('recommendCrops — state-level match', () => {
  it('US + CA prefers the California rules over US defaults', () => {
    const r = recommendCrops({ country: 'US', state: 'CA' });
    expect(r.source).toBe('state');
    expect(r.isGeneral).toBe(false);
    // California's high-fit rule is tomato
    expect(r.items[0].crop).toBe('tomato');
    expect(r.items[0].confidence).toBe('high');
  });

  it('IN + PB prefers Punjab wheat rule', () => {
    const r = recommendCrops({ country: 'IN', state: 'PB' });
    expect(r.source).toBe('state');
    const top = r.items.slice(0, 2).map((i) => i.crop);
    expect(top).toContain('wheat');
    expect(top).toContain('rice');
  });

  it('GH + NP (Northern) surfaces drought-tolerant savanna crops', () => {
    const r = recommendCrops({ country: 'GH', state: 'NP' });
    expect(r.source).toBe('state');
    const ids = r.items.map((i) => i.crop);
    expect(ids).toContain('sorghum');
    expect(ids).toContain('millet');
  });

  it('state code is case-insensitive', () => {
    const a = recommendCrops({ country: 'us', state: 'ca' });
    const b = recommendCrops({ country: 'US', state: 'CA' });
    expect(a.items[0].crop).toBe(b.items[0].crop);
    expect(a.country).toBe('US');
    expect(a.state).toBe('CA');
  });
});

// ─── 2. Country fallback when state missing / unknown ─────────────
describe('recommendCrops — country fallback', () => {
  it('US without state uses country defaults', () => {
    const r = recommendCrops({ country: 'US' });
    expect(r.source).toBe('country');
    expect(r.isGeneral).toBe(false);
    expect(r.items[0].confidence).toBe('high');
  });

  it('KE with unknown state falls back to country defaults', () => {
    const r = recommendCrops({ country: 'KE', state: 'ZZZ' });
    expect(r.source).toBe('country');
    expect(r.items[0].crop).toBe('maize'); // KE defaults lead with maize
  });

  it('NG with empty state falls back to country defaults', () => {
    const r = recommendCrops({ country: 'NG', state: '' });
    expect(r.source).toBe('country');
  });
});

// ─── 3. Unsupported country → global fallback (spec §6.3) ─────────
describe('recommendCrops — unsupported country', () => {
  it('BR (not in v1) returns global fallback + isGeneral=true', () => {
    const r = recommendCrops({ country: 'BR' });
    expect(r.source).toBe('global');
    expect(r.isGeneral).toBe(true);
    expect(r.supported).toBe(false);
    expect(r.items.length).toBeGreaterThanOrEqual(3);
  });

  it('no country at all → global fallback', () => {
    const r = recommendCrops();
    expect(r.source).toBe('global');
    expect(r.isGeneral).toBe(true);
  });
});

// ─── 4. Farmer-type hint propagation (spec §6.4) ──────────────────
describe('recommendCrops — farmer type hint', () => {
  it('propagates farmerType onto each item', () => {
    const r = recommendCrops({ country: 'US', farmerType: 'new' });
    expect(r.farmerType).toBe('new');
    for (const i of r.items) expect(i.farmerTypeHint).toBe('new');
  });

  it('accepts existing / null gracefully', () => {
    expect(recommendCrops({ country: 'US', farmerType: 'existing' }).farmerType)
      .toBe('existing');
    expect(recommendCrops({ country: 'US', farmerType: 'weird' }).farmerType)
      .toBeNull();
  });

  it('does NOT affect ranking', () => {
    const a = recommendCrops({ country: 'US' });
    const b = recommendCrops({ country: 'US', farmerType: 'new' });
    expect(a.items.map((i) => i.crop)).toEqual(b.items.map((i) => i.crop));
  });
});

// ─── 5. Limit + freezing + determinism ────────────────────────────
describe('recommendCrops — contract', () => {
  it('returns 3..5 items; default is 5 when rules are long enough', () => {
    const r = recommendCrops({ country: 'US' });
    expect(r.items.length).toBe(5);
  });

  it('limit clamps to [3, 5]', () => {
    expect(recommendCrops({ country: 'US', limit: 1 }).items.length).toBe(3);
    expect(recommendCrops({ country: 'US', limit: 99 }).items.length).toBe(5);
  });

  it('orders by fit desc, then input order for ties', () => {
    const r = recommendCrops({ country: 'US' });
    for (let i = 1; i < r.items.length; i += 1) {
      expect(r.items[i - 1].fit).toBeGreaterThanOrEqual(r.items[i].fit);
    }
  });

  it('items + wrapper are frozen', () => {
    const r = recommendCrops({ country: 'US' });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.items)).toBe(true);
    expect(Object.isFrozen(r.items[0])).toBe(true);
  });

  it('deterministic for identical inputs', () => {
    const a = recommendCrops({ country: 'GH', state: 'AS' });
    const b = recommendCrops({ country: 'GH', state: 'AS' });
    expect(a).toEqual(b);
  });
});

// ─── 6. UI adapter ────────────────────────────────────────────────
describe('recommendCropsForScreen', () => {
  it('returns the array shape CropRecommendationScreen expects', () => {
    const list = recommendCropsForScreen({ country: 'KE', state: 'MUR' });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(3);
    for (const r of list) {
      expect(r).toHaveProperty('crop');
      expect(r).toHaveProperty('label');
      expect(r).toHaveProperty('reason');
      expect(r).toHaveProperty('confidence');
      expect(r).toHaveProperty('plantingWindow');
      expect(['high','medium','low']).toContain(r.confidence);
    }
  });

  it('unsupported country → isGeneral: true on every item', () => {
    const list = recommendCropsForScreen({ country: 'FR' });
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.every((r) => r.isGeneral === true)).toBe(true);
  });
});

// ─── Internals ────────────────────────────────────────────────────
describe('internals', () => {
  it('pickSourceRules fallback ladder', () => {
    expect(_internal.pickSourceRules({ country: 'US', state: 'CA' }).source).toBe('state');
    expect(_internal.pickSourceRules({ country: 'US' }).source).toBe('country');
    expect(_internal.pickSourceRules({ country: 'FR' }).source).toBe('global');
    expect(_internal.pickSourceRules({}).source).toBe('global');
  });
});
