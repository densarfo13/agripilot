/**
 * priceInsights.test.js — locks the Price Intelligence aggregator
 * + fallback ladder.
 *
 * Covers:
 *   • Pure percentile / median / mean helpers
 *   • aggregatePriceInsight window filtering + trend math
 *   • buildPriceInsight fallback ladder (local → country → global → fallback)
 *   • Confidence scoring thresholds
 *   • Deterministic shape contract (frozen, rounded, never null fields
 *     that should always be present)
 */

import { describe, it, expect } from 'vitest';

import {
  aggregatePriceInsight, buildPriceInsight,
  median, percentile, mean, confidenceFromCount,
  _internal,
} from '../modules/marketplace/priceInsights.js';

// ═══════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════
describe('median / percentile / mean', () => {
  it('median of empty array → null', () => {
    expect(median([])).toBeNull();
  });
  it('median of odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });
  it('median of even-length array averages the two middles', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it('percentile(25) of 4 values lands on the lower quartile', () => {
    expect(percentile([10, 20, 30, 40], 0.25)).toBeCloseTo(17.5, 5);
  });
  it('percentile(75)', () => {
    expect(percentile([10, 20, 30, 40], 0.75)).toBeCloseTo(32.5, 5);
  });
  it('mean of numbers', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// confidenceFromCount
// ═══════════════════════════════════════════════════════════════
describe('confidenceFromCount', () => {
  it('count ≥10 on local source → high', () => {
    expect(confidenceFromCount(10, 'local')).toBe('high');
    expect(confidenceFromCount(25, 'local')).toBe('high');
  });
  it('count 4-9 → medium', () => {
    expect(confidenceFromCount(4, 'local')).toBe('medium');
    expect(confidenceFromCount(9, 'country')).toBe('medium');
  });
  it('count 1-3 → low', () => {
    expect(confidenceFromCount(3, 'country')).toBe('low');
  });
  it('global / fallback source always caps at low', () => {
    expect(confidenceFromCount(100, 'global')).toBe('low');
    expect(confidenceFromCount(100, 'fallback')).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════════
// aggregatePriceInsight
// ═══════════════════════════════════════════════════════════════
describe('aggregatePriceInsight', () => {
  const NOW = Date.parse('2026-05-15T12:00:00Z');
  const day = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it('returns zero-count shape for empty list', () => {
    const out = aggregatePriceInsight([], { now: NOW });
    expect(out.count).toBe(0);
    expect(out.median).toBeNull();
    expect(out.trend).toBeNull();
  });

  it('ignores listings outside the window', () => {
    const listings = [
      { priceFdUnit: 0.25, createdAt: day(60) }, // outside 30d
      { priceFdUnit: 0.30, createdAt: day(5) },
      { priceFdUnit: 0.35, createdAt: day(1) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW, windowDays: 30 });
    expect(out.count).toBe(2);
  });

  it('ignores listings without price + rejects non-positive', () => {
    const listings = [
      { priceFdUnit: null,  createdAt: day(1) },
      { priceFdUnit: 0,     createdAt: day(1) },
      { priceFdUnit: -1,    createdAt: day(1) },
      { priceFdUnit: 0.50,  createdAt: day(1) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.count).toBe(1);
    expect(out.median).toBe(0.50);
  });

  it('coerces Prisma Decimal-like objects via toNumber()', () => {
    const listings = [
      { priceFdUnit: { toNumber: () => 0.42 }, createdAt: day(2) },
      { priceFdUnit: { toNumber: () => 0.38 }, createdAt: day(3) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.count).toBe(2);
    expect(out.median).toBeCloseTo(0.40, 2);
  });

  it('computes q1/q3 for sufficient sample + median/avg', () => {
    const listings = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80]
      .map((p, i) => ({ priceFdUnit: p, createdAt: day(i + 1) }));
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.count).toBe(8);
    expect(out.low).toBeCloseTo(0.275, 2);   // q1
    expect(out.high).toBeCloseTo(0.625, 2);  // q3
    expect(out.median).toBeCloseTo(0.45, 2);
    expect(out.avg).toBeCloseTo(0.45, 2);
  });

  it('falls back to min/max when sample < 4', () => {
    const listings = [
      { priceFdUnit: 0.20, createdAt: day(1) },
      { priceFdUnit: 0.40, createdAt: day(2) },
      { priceFdUnit: 0.60, createdAt: day(3) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.low).toBe(0.20);
    expect(out.high).toBe(0.60);
  });

  it('classifies trend up when current half median is ≥5% above previous', () => {
    // 30-day window, so midpoint = 15 days ago.
    const listings = [
      // Previous half (16-29 days ago): median 0.30
      { priceFdUnit: 0.28, createdAt: day(28) },
      { priceFdUnit: 0.30, createdAt: day(22) },
      { priceFdUnit: 0.32, createdAt: day(18) },
      // Current half (0-14 days ago): median 0.40
      { priceFdUnit: 0.38, createdAt: day(12) },
      { priceFdUnit: 0.40, createdAt: day(5) },
      { priceFdUnit: 0.42, createdAt: day(1) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW, windowDays: 30 });
    expect(out.trend).toBe('up');
    expect(out.trendPct).toBeGreaterThan(0.2); // ~33%
  });

  it('classifies trend down when current is ≥5% below previous', () => {
    const listings = [
      { priceFdUnit: 0.80, createdAt: day(26) },
      { priceFdUnit: 0.82, createdAt: day(22) },
      { priceFdUnit: 0.78, createdAt: day(18) },
      { priceFdUnit: 0.60, createdAt: day(12) },
      { priceFdUnit: 0.58, createdAt: day(5) },
      { priceFdUnit: 0.62, createdAt: day(1) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.trend).toBe('down');
  });

  it('stable when |change| < 5%', () => {
    const listings = [
      { priceFdUnit: 0.50, createdAt: day(26) },
      { priceFdUnit: 0.52, createdAt: day(22) },
      { priceFdUnit: 0.48, createdAt: day(18) },
      { priceFdUnit: 0.51, createdAt: day(10) },
      { priceFdUnit: 0.50, createdAt: day(5) },
      { priceFdUnit: 0.49, createdAt: day(1) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.trend).toBe('stable');
  });

  it('trend is null when either half has <2 points', () => {
    const listings = [
      { priceFdUnit: 0.30, createdAt: day(20) }, // 1 in previous half
      { priceFdUnit: 0.40, createdAt: day(5) },  // 1 in current half
      { priceFdUnit: 0.50, createdAt: day(2) },
    ];
    const out = aggregatePriceInsight(listings, { now: NOW });
    expect(out.trend).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// buildPriceInsight — fallback ladder
// ═══════════════════════════════════════════════════════════════
describe('buildPriceInsight fallback ladder', () => {
  function makePrisma(listings = []) {
    return {
      produceListing: {
        async findMany({ where = {} } = {}) {
          return listings.filter((l) => {
            if (where.crop && l.crop !== where.crop) return false;
            if (where.region && typeof where.region === 'object') {
              const target = String(where.region.equals || '').toLowerCase();
              if (String(l.region || '').toLowerCase() !== target) return false;
            }
            if (where.priceFdUnit && where.priceFdUnit.not === null && l.priceFdUnit == null) return false;
            if (where.createdAt && where.createdAt.gte && new Date(l.createdAt) < where.createdAt.gte) return false;
            return true;
          });
        },
      },
    };
  }

  const NOW = Date.parse('2026-05-15T12:00:00Z');
  const day = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

  it('LOCAL: (crop, country, region) with ≥3 points → source=local', async () => {
    const prisma = makePrisma([
      { crop: 'MAIZE', region: 'Ashanti', priceFdUnit: 0.22, createdAt: day(1) },
      { crop: 'MAIZE', region: 'Ashanti', priceFdUnit: 0.25, createdAt: day(3) },
      { crop: 'MAIZE', region: 'Ashanti', priceFdUnit: 0.28, createdAt: day(5) },
      { crop: 'MAIZE', region: 'Ashanti', priceFdUnit: 0.30, createdAt: day(8) },
    ]);
    const out = await buildPriceInsight(prisma, {
      crop: 'maize', country: 'GH', region: 'Ashanti', now: NOW, windowDays: 30,
    });
    expect(out.source).toBe('local');
    expect(out.sampleSize).toBe(4);
    expect(out.confidence).toBe('medium'); // 4 is medium
  });

  it('COUNTRY: region has <3 points, country has ≥3 → source=country', async () => {
    const prisma = makePrisma([
      { crop: 'MAIZE', region: 'Ashanti', priceFdUnit: 0.22, createdAt: day(1) },
      { crop: 'MAIZE', region: 'Lagos',   priceFdUnit: 0.30, createdAt: day(3) },
      { crop: 'MAIZE', region: 'Lagos',   priceFdUnit: 0.35, createdAt: day(5) },
      { crop: 'MAIZE', region: 'Kaduna',  priceFdUnit: 0.28, createdAt: day(8) },
    ]);
    const out = await buildPriceInsight(prisma, {
      crop: 'maize', country: 'NG', region: 'Ashanti', now: NOW, windowDays: 30,
    });
    expect(out.source).toBe('country');
    expect(out.sampleSize).toBe(4);
  });

  it('GLOBAL: no local data → source=global, confidence=low', async () => {
    const prisma = makePrisma([]);
    const out = await buildPriceInsight(prisma, {
      crop: 'maize', country: 'GH', region: 'Ashanti', now: NOW,
    });
    expect(out.source).toBe('global');
    expect(out.confidence).toBe('low');
    expect(out.currency).toBe('USD');
    expect(out.suggested.low).toBeGreaterThan(0);
    expect(out.suggested.high).toBeGreaterThan(out.suggested.low);
  });

  it('FALLBACK: unknown crop → generic USD band, source=fallback', async () => {
    const prisma = makePrisma([]);
    const out = await buildPriceInsight(prisma, {
      crop: 'unobtainium', country: 'GH', now: NOW,
    });
    expect(out.source).toBe('fallback');
    expect(out.suggested.low).toBeGreaterThan(0);
    expect(out.confidence).toBe('low');
  });

  it('always returns a frozen insight with required fields', async () => {
    const prisma = makePrisma([]);
    const out = await buildPriceInsight(prisma, {
      crop: 'maize', country: 'GH', now: NOW,
    });
    expect(Object.isFrozen(out)).toBe(true);
    expect(out.suggested).toBeTruthy();
    expect(out.window).toBeTruthy();
    expect(Object.isFrozen(out.window)).toBe(true);
    expect(Object.isFrozen(out.suggested)).toBe(true);
    expect(out.currency).toBeTruthy();
    expect(['low', 'medium', 'high']).toContain(out.confidence);
    expect(['local', 'country', 'global', 'fallback']).toContain(out.source);
  });

  it('prisma absent → returns global fallback without throwing', async () => {
    const out = await buildPriceInsight(null, {
      crop: 'maize', country: 'GH', now: NOW,
    });
    expect(out.source).toBe('global');
  });

  it('null crop → null', async () => {
    expect(await buildPriceInsight({}, { crop: null })).toBeNull();
    expect(await buildPriceInsight({}, {})).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// Internal constants sanity
// ═══════════════════════════════════════════════════════════════
describe('_internal', () => {
  it('has the expected fallback bands', () => {
    expect(_internal.GLOBAL_USD.maize.low).toBeGreaterThan(0);
    expect(_internal.GENERIC_USD.low).toBe(0.20);
  });
  it('thresholds', () => {
    expect(_internal.HIGH_CONF_N).toBeGreaterThan(_internal.MED_CONF_N);
    expect(_internal.TREND_EPS).toBeGreaterThan(0);
  });
});
