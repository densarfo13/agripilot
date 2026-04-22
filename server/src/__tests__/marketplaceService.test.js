/**
 * marketplaceService.test.js — contract for the pure
 * marketplace service (server/src/modules/marketplace/).
 *
 * Prisma is faked with a minimal in-memory store so the
 * service's rules + error paths can be exercised without
 * touching the real database.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createListing, listListings,
  createRequest, listRequests,
  matchAll, matchAllFlat,
  recordPayment, marketplaceStats,
} from '../../../server/src/modules/marketplace/marketplaceService.js';

function makeFakePrisma() {
  const produceListings = new Map();
  const buyerRequests   = new Map();
  const payments        = new Map();
  let id = 0;
  const newId = () => `id_${++id}`;

  return {
    _tables: { produceListings, buyerRequests, payments },
    produceListing: {
      create: async ({ data }) => {
        const row = { id: newId(), createdAt: new Date(), ...data };
        produceListings.set(row.id, row);
        return row;
      },
      findMany: async ({ where = {}, take = 100, orderBy } = {}) => {
        let rows = Array.from(produceListings.values());
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => b.createdAt - a.createdAt);
        }
        return rows.slice(0, take);
      },
      findUnique: async ({ where: { id } }) => produceListings.get(id) || null,
      update: async ({ where: { id }, data }) => {
        const row = produceListings.get(id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
      count: async ({ where } = {}) => {
        if (!where) return produceListings.size;
        return Array.from(produceListings.values())
          .filter((r) => r.status === where.status).length;
      },
    },
    buyerRequest: {
      create: async ({ data }) => {
        const row = { id: newId(), createdAt: new Date(), ...data };
        buyerRequests.set(row.id, row);
        return row;
      },
      findMany: async ({ where = {}, take = 100 } = {}) => {
        let rows = Array.from(buyerRequests.values());
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        return rows.slice(0, take);
      },
      count: async () => buyerRequests.size,
    },
    marketplacePayment: {
      create: async ({ data }) => {
        const row = { id: newId(), createdAt: new Date(), ...data };
        payments.set(row.id, row);
        return row;
      },
    },
  };
}

let db;
beforeEach(() => { db = makeFakePrisma(); });

// ─── createListing ───────────────────────────────────────────
describe('createListing', () => {
  it('creates with defaults (status=active, price null ok)', async () => {
    const r = await createListing(db, {
      farmId: 'F1', crop: 'maize', quantity: 100, location: 'Kumasi',
    });
    expect(r.ok).toBe(true);
    expect(r.listing.crop).toBe('MAIZE');    // uppercased
    // Service now returns spec-mapped status ('active') and exposes
    // the raw DB value via statusDb for callers that care.
    expect(r.listing.status).toBe('active');
    expect(r.listing.statusDb).toBe('available');
    expect(r.listing.priceFdUnit).toBeNull();
  });

  it('coerces price alias (pricePerUnit)', async () => {
    const r = await createListing(db, {
      farmId: 'F1', crop: 'maize', quantity: 50, pricePerUnit: 3.5,
    });
    expect(r.listing.priceFdUnit).toBe(3.5);
  });

  it('rejects missing crop / invalid quantity / negative price', async () => {
    expect((await createListing(db, { crop: '', quantity: 10 })).reason).toBe('missing_crop');
    expect((await createListing(db, { crop: 'x', quantity: 0 })).reason).toBe('invalid_quantity');
    expect((await createListing(db, { crop: 'x', quantity: 10, price: -1 })).reason).toBe('invalid_price');
  });

  it('no prisma → no_prisma', async () => {
    const r = await createListing(null, { crop: 'x', quantity: 1 });
    expect(r.reason).toBe('no_prisma');
  });
});

// ─── listListings ────────────────────────────────────────────
describe('listListings', () => {
  it('defaults to status=available', async () => {
    await createListing(db, { crop: 'maize', quantity: 1 });
    await createListing(db, { crop: 'maize', quantity: 1 });
    const ids = [...db._tables.produceListings.values()].map((r) => r.id);
    db._tables.produceListings.get(ids[1]).status = 'sold';
    const r = await listListings(db);
    expect(r.data.length).toBe(1);
  });

  it('status=all returns everything', async () => {
    await createListing(db, { crop: 'a', quantity: 1 });
    await createListing(db, { crop: 'b', quantity: 2 });
    const r = await listListings(db, { status: 'all' });
    expect(r.data.length).toBe(2);
  });

  it('limit clamped to 500', async () => {
    const r = await listListings(db, { limit: 9999 });
    expect(r.ok).toBe(true);
  });
});

// ─── createRequest ───────────────────────────────────────────
describe('createRequest', () => {
  it('creates with defaults (status=pending)', async () => {
    const r = await createRequest(db, {
      buyerName: 'ACME', crop: 'maize', quantity: 500, location: 'Kumasi',
    });
    expect(r.ok).toBe(true);
    // Spec-mapped: DB 'open' → UI 'pending'
    expect(r.request.status).toBe('pending');
    expect(r.request.statusDb).toBe('open');
    expect(r.request.crop).toBe('MAIZE');
  });

  it('validation errors', async () => {
    expect((await createRequest(db, { crop: '', quantity: 1 })).reason).toBe('missing_crop');
    expect((await createRequest(db, { crop: 'x', quantity: 0 })).reason).toBe('invalid_quantity');
  });
});

// ─── matchAll / matchAllFlat ─────────────────────────────────
describe('matchAll + matchAllFlat', () => {
  const request = { id: 'R1', crop: 'MAIZE', quantity: 100, location: 'Kumasi', region: 'Ashanti' };
  const L1 = { id: 'L1', crop: 'maize', quantity: 200, location: 'kumasi', region: 'Ashanti', status: 'available' };
  const L2 = { id: 'L2', crop: 'MAIZE', quantity: 150, location: 'Tamale', region: 'ashanti', status: 'available' };
  const LBad = { id: 'LBad', crop: 'RICE', quantity: 500, location: 'Kumasi', region: 'Ashanti', status: 'available' };
  const LSold = { id: 'LSold', crop: 'MAIZE', quantity: 300, location: 'Kumasi', region: 'Ashanti', status: 'sold' };

  it('matchAll returns one group per request with ranked candidates', () => {
    const res = matchAll([L1, L2, LBad, LSold], [request]);
    expect(res.length).toBe(1);
    const [grp] = res;
    expect(grp.request).toBe(request);
    expect(grp.candidates.map((c) => c.id)).toEqual(['L1', 'L2']);
  });

  it('matchAllFlat emits {requestId, listingId, crop} per pair', () => {
    const flat = matchAllFlat([L1, L2], [request]);
    expect(flat.length).toBe(2);
    expect(flat[0]).toEqual({ requestId: 'R1', listingId: 'L1', crop: 'maize' });
  });

  it('safe on non-arrays', () => {
    expect(matchAll(null, null)).toEqual([]);
    expect(matchAllFlat(null, null)).toEqual([]);
  });
});

// ─── recordPayment ───────────────────────────────────────────
describe('recordPayment', () => {
  it('marks listing sold and records payment', async () => {
    const created = await createListing(db, { crop: 'maize', quantity: 100 });
    const r = await recordPayment(db, { buyerId: 'B1', listingId: created.listing.id, amount: 500 });
    expect(r.ok).toBe(true);
    const listing = await db.produceListing.findUnique({ where: { id: created.listing.id } });
    expect(listing.status).toBe('sold');
  });

  it('rejects invalid amount', async () => {
    const r = await recordPayment(db, { listingId: 'x', amount: -1 });
    expect(r.reason).toBe('invalid_amount');
  });

  it('rejects missing listingId', async () => {
    const r = await recordPayment(db, { amount: 100 });
    expect(r.reason).toBe('missing_listing_id');
  });

  it('404 when listing does not exist', async () => {
    const r = await recordPayment(db, { listingId: 'nope', amount: 10 });
    expect(r.reason).toBe('listing_not_found');
  });

  it('409 when listing already sold', async () => {
    const created = await createListing(db, { crop: 'maize', quantity: 50 });
    await recordPayment(db, { listingId: created.listing.id, amount: 200 });
    const again = await recordPayment(db, { listingId: created.listing.id, amount: 200 });
    expect(again.reason).toBe('not_available');
  });
});

// ─── marketplaceStats ────────────────────────────────────────
describe('marketplaceStats', () => {
  it('returns totals', async () => {
    await createListing(db, { crop: 'a', quantity: 1 });
    await createListing(db, { crop: 'b', quantity: 1 });
    const l = await createListing(db, { crop: 'c', quantity: 1 });
    await recordPayment(db, { listingId: l.listing.id, amount: 10 });
    await createRequest(db, { crop: 'a', quantity: 1 });

    const s = await marketplaceStats(db);
    expect(s.ok).toBe(true);
    expect(s.totalListings).toBe(3);
    expect(s.totalSold).toBe(1);
    expect(s.totalRequests).toBe(1);
  });

  it('handles missing prisma', async () => {
    const s = await marketplaceStats(null);
    expect(s.ok).toBe(false);
  });

  it('returns frozen result', async () => {
    const s = await marketplaceStats(db);
    expect(Object.isFrozen(s)).toBe(true);
  });
});
