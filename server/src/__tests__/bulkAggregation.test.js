/**
 * bulkAggregation.test.js — locks the bulk-lot aggregator contract.
 *
 * Covers:
 *   • Pure helpers (pickupWeekStart, lotIdFor)
 *   • aggregateBulkLots grouping + minContributors gate + window filter
 *   • Deterministic frozen shape; contributors aggregated per farm
 *   • buildBulkLots DB wrapper + buildBulkLotById
 */

import { describe, it, expect } from 'vitest';

import {
  aggregateBulkLots, buildBulkLots, buildBulkLotById,
  pickupWeekStart, lotIdFor, classifyLotStatus, _internal,
} from '../modules/marketplace/bulkAggregation.js';

const NOW = Date.parse('2026-05-15T12:00:00Z');   // Friday
const day = (n) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

function listing(overrides = {}) {
  return {
    id:        `lst_${Math.random().toString(36).slice(2, 8)}`,
    farmId:    'farm-1',
    crop:      'MAIZE',
    quantity:  100,
    region:    'Ashanti',
    country:   'GH',
    location:  'Kumasi',
    status:    'available',
    createdAt: day(1),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════
describe('pickupWeekStart + lotIdFor', () => {
  it('snaps back to the Monday of the current calendar week', () => {
    // 2026-05-15 is a Friday → Monday 2026-05-11 (current week's Monday).
    const monday = pickupWeekStart(NOW);
    const d = new Date(monday);
    expect(d.getUTCDay()).toBe(1);
    expect(d.toISOString().slice(0, 10)).toBe('2026-05-11');
  });

  it('groups every day of the same week into the same bucket', () => {
    const mon = Date.UTC(2026, 4, 11);
    const fri = Date.UTC(2026, 4, 15);
    const sun = Date.UTC(2026, 4, 17);
    expect(pickupWeekStart(mon)).toBe(mon);
    expect(pickupWeekStart(fri)).toBe(mon);
    expect(pickupWeekStart(sun)).toBe(mon);
  });

  it('is idempotent: snap(snap(x)) === snap(x)', () => {
    const once = pickupWeekStart(NOW);
    const twice = pickupWeekStart(once);
    expect(twice).toBe(once);
  });

  it('lotIdFor is deterministic + URL-safe', () => {
    const id1 = lotIdFor({ crop: 'MAIZE', country: 'GH', region: 'Ashanti', weekStartMs: NOW });
    const id2 = lotIdFor({ crop: 'MAIZE', country: 'GH', region: 'Ashanti', weekStartMs: NOW });
    expect(id1).toBe(id2);
    expect(id1.startsWith('bulk:maize:gh:ashanti:')).toBe(true);
    // No spaces or special chars.
    expect(/^[A-Za-z0-9:_-]+$/.test(id1)).toBe(true);
  });

  it('null region collapses to "any"', () => {
    const id = lotIdFor({ crop: 'MAIZE', country: 'GH', region: null, weekStartMs: NOW });
    expect(id.split(':')[3]).toBe('any');
  });
});

// ═══════════════════════════════════════════════════════════════
// aggregateBulkLots
// ═══════════════════════════════════════════════════════════════
describe('aggregateBulkLots', () => {
  it('returns empty list on empty input', () => {
    expect(aggregateBulkLots([], { now: NOW })).toEqual([]);
    expect(aggregateBulkLots(null, { now: NOW })).toEqual([]);
  });

  it('requires at least 2 unique contributors per lot', () => {
    // 3 listings, all from the same farm → no lot.
    const listings = [
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f1', createdAt: day(2) }),
      listing({ farmId: 'f1', createdAt: day(3) }),
    ];
    const lots = aggregateBulkLots(listings, { now: NOW });
    expect(lots).toEqual([]);
  });

  it('aggregates 2+ contributors into one lot', () => {
    const listings = [
      listing({ farmId: 'f1', quantity: 120, createdAt: day(2) }),
      listing({ farmId: 'f2', quantity:  80, createdAt: day(3) }),
      listing({ farmId: 'f3', quantity: 150, createdAt: day(4) }),
    ];
    const lots = aggregateBulkLots(listings, { now: NOW });
    expect(lots.length).toBe(1);
    const lot = lots[0];
    expect(lot.crop).toBe('MAIZE');
    expect(lot.totalQuantity).toBe(350);
    expect(lot.contributors.length).toBe(3);
    // Sorted by quantity desc.
    expect(lot.contributors[0].farmId).toBe('f3');
    expect(lot.contributors[2].farmId).toBe('f2');
  });

  it('combines multiple listings from the same farm into one contributor entry', () => {
    const listings = [
      listing({ farmId: 'f1', quantity: 50, createdAt: day(2) }),
      listing({ farmId: 'f1', quantity: 70, createdAt: day(3) }),
      listing({ farmId: 'f2', quantity: 100, createdAt: day(4) }),
    ];
    const [lot] = aggregateBulkLots(listings, { now: NOW });
    const f1 = lot.contributors.find((c) => c.farmId === 'f1');
    expect(f1.quantity).toBe(120);
    expect(f1.listingIds.length).toBe(2);
  });

  it('groups distinctly by (crop, country, region, week)', () => {
    const listings = [
      // Ashanti maize
      listing({ farmId: 'f1', region: 'Ashanti', createdAt: day(1) }),
      listing({ farmId: 'f2', region: 'Ashanti', createdAt: day(2) }),
      // Lagos maize (different region → different lot)
      listing({ farmId: 'f3', region: 'Lagos', country: 'NG', createdAt: day(1) }),
      listing({ farmId: 'f4', region: 'Lagos', country: 'NG', createdAt: day(2) }),
      // Ashanti rice (different crop → different lot)
      listing({ farmId: 'f1', crop: 'RICE', region: 'Ashanti', createdAt: day(1) }),
      listing({ farmId: 'f5', crop: 'RICE', region: 'Ashanti', createdAt: day(2) }),
    ];
    const lots = aggregateBulkLots(listings, { now: NOW });
    expect(lots.length).toBe(3);
    const crops = new Set(lots.map((l) => `${l.crop}|${l.region}`));
    expect(crops.has('MAIZE|Ashanti')).toBe(true);
    expect(crops.has('MAIZE|Lagos')).toBe(true);
    expect(crops.has('RICE|Ashanti')).toBe(true);
  });

  it('drops listings outside the window', () => {
    const listings = [
      listing({ farmId: 'f1', createdAt: day(30) }), // outside 14d
      listing({ farmId: 'f2', createdAt: day(2) }),
      listing({ farmId: 'f3', createdAt: day(3) }),
    ];
    const lots = aggregateBulkLots(listings, { now: NOW, windowDays: 14 });
    expect(lots.length).toBe(1);
    expect(lots[0].contributors.length).toBe(2);
  });

  it('drops listings whose status is not available', () => {
    const listings = [
      listing({ farmId: 'f1', status: 'available', createdAt: day(1) }),
      listing({ farmId: 'f2', status: 'sold',      createdAt: day(2) }),
      listing({ farmId: 'f3', status: 'reserved',  createdAt: day(3) }),
    ];
    const lots = aggregateBulkLots(listings, { now: NOW });
    expect(lots.length).toBe(0); // only 1 available contributor
  });

  it('lot has frozen pickupWindow with ISO start + end', () => {
    const listings = [
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f2', createdAt: day(2) }),
    ];
    const [lot] = aggregateBulkLots(listings, { now: NOW });
    expect(Object.isFrozen(lot.pickupWindow)).toBe(true);
    expect(typeof lot.pickupWindow.start).toBe('string');
    expect(Date.parse(lot.pickupWindow.start)).toBeLessThan(Date.parse(lot.pickupWindow.end));
  });

  it('lotId is stable for the same inputs', () => {
    const listings = [
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f2', createdAt: day(2) }),
    ];
    const a = aggregateBulkLots(listings, { now: NOW })[0].lotId;
    const b = aggregateBulkLots(listings, { now: NOW })[0].lotId;
    expect(a).toBe(b);
  });

  it('respects custom minContributors threshold', () => {
    const listings = [
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f2', createdAt: day(2) }),
    ];
    expect(aggregateBulkLots(listings, { now: NOW, minContributors: 2 }).length).toBe(1);
    expect(aggregateBulkLots(listings, { now: NOW, minContributors: 3 }).length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildBulkLots + buildBulkLotById
// ═══════════════════════════════════════════════════════════════
describe('buildBulkLots (DB wrapper)', () => {
  function makePrisma(listings) {
    return {
      produceListing: {
        async findMany({ where = {} } = {}) {
          return listings.filter((l) => {
            if (where.status && l.status !== where.status) return false;
            if (where.crop && l.crop !== where.crop) return false;
            if (where.region && typeof where.region === 'object') {
              const target = String(where.region.equals || '').toLowerCase();
              if (String(l.region || '').toLowerCase() !== target) return false;
            }
            if (where.createdAt && where.createdAt.gte
                && new Date(l.createdAt) < where.createdAt.gte) return false;
            return true;
          });
        },
      },
    };
  }

  it('returns [] when prisma is missing', async () => {
    expect(await buildBulkLots(null, {})).toEqual([]);
  });

  it('aggregates DB rows end-to-end', async () => {
    const prisma = makePrisma([
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f2', createdAt: day(2) }),
    ]);
    const lots = await buildBulkLots(prisma, { now: NOW });
    expect(lots.length).toBe(1);
    expect(lots[0].contributors.length).toBe(2);
  });

  it('findMany sees the crop filter when supplied', async () => {
    const prisma = makePrisma([
      listing({ farmId: 'f1', crop: 'MAIZE', createdAt: day(1) }),
      listing({ farmId: 'f2', crop: 'MAIZE', createdAt: day(2) }),
      listing({ farmId: 'f3', crop: 'RICE',  createdAt: day(2) }),
      listing({ farmId: 'f4', crop: 'RICE',  createdAt: day(3) }),
    ]);
    const maize = await buildBulkLots(prisma, { crop: 'maize', now: NOW });
    expect(maize.length).toBe(1);
    expect(maize[0].crop).toBe('MAIZE');
  });

  it('buildBulkLotById returns the lot with matching id or null', async () => {
    const prisma = makePrisma([
      listing({ farmId: 'f1', createdAt: day(1) }),
      listing({ farmId: 'f2', createdAt: day(2) }),
    ]);
    const [lot] = await buildBulkLots(prisma, { now: NOW });
    const found = await buildBulkLotById(prisma, lot.lotId, { now: NOW });
    expect(found).toBeTruthy();
    expect(found.lotId).toBe(lot.lotId);
    expect(await buildBulkLotById(prisma, 'bulk:bogus', { now: NOW })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// classifyLotStatus
// ═══════════════════════════════════════════════════════════════
describe('classifyLotStatus', () => {
  it('active when no requests reference the lot', () => {
    expect(classifyLotStatus({ lotId: 'x' }, [])).toBe('active');
  });
  it('requested when any matched / open request exists', () => {
    expect(classifyLotStatus({ lotId: 'x' }, [{ status: 'open' }])).toBe('requested');
    expect(classifyLotStatus({ lotId: 'x' }, [{ status: 'matched' }])).toBe('requested');
    expect(classifyLotStatus({ lotId: 'x' }, [{ status: 'cancelled' }])).toBe('active');
  });
});
