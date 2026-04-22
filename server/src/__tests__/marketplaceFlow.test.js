/**
 * marketplaceFlow.test.js — exercises the full farmer↔buyer flow
 * against the marketplaceService layer with an in-memory Prisma fake.
 *
 * Flow covered:
 *   farmer createListing
 *     → buyer listListings (filter by crop + region)
 *     → buyer createRequest(listingId)
 *         ↳ service snapshots crop/qty from listing
 *         ↳ service fires FarmerNotification on owning farmer
 *     → farmer acceptRequest → listing 'reserved'
 *     → farmer updateListingStatus('completed') → listing 'sold'
 *   + decline path + status mapping tests + filter edge cases
 *
 * The service is pure (no side-effects beyond prisma calls), so an
 * in-memory fake is sufficient — no test DB, no migrations.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  createListing, listListings,
  createRequest, listRequests,
  acceptRequest, declineRequest, updateListingStatus,
  listIncomingRequestsForFarmer,
  mapListingToSpec, mapRequestToSpec,
  LISTING_STATUS_SPEC_TO_DB, REQUEST_STATUS_SPEC_TO_DB,
} from '../modules/marketplace/marketplaceService.js';

// ─── In-memory Prisma fake ────────────────────────────────────
function makeFakePrisma() {
  const state = {
    produceListing:   new Map(),
    buyerRequest:     new Map(),
    farm:             new Map(),
    farmerNotification: [],
    _ids: 0,
  };
  const nextId = (prefix) => `${prefix}_${++state._ids}`;

  const withCrud = (key, prefix) => ({
    async create({ data }) {
      const id = data.id || nextId(prefix);
      const row = { id, createdAt: new Date(), updatedAt: new Date(), ...data };
      state[key].set(id, row);
      return row;
    },
    async update({ where, data }) {
      const row = state[key].get(where.id);
      if (!row) throw new Error('not_found');
      const updated = { ...row, ...data, updatedAt: new Date() };
      state[key].set(where.id, updated);
      return updated;
    },
    async findUnique({ where }) {
      return state[key].get(where.id) || null;
    },
    async findMany({ where = {}, orderBy, take } = {}) {
      let rows = Array.from(state[key].values());
      // `id: { in: [...] }` (used by listIncomingRequestsForFarmer).
      if (where.id && typeof where.id === 'object' && Array.isArray(where.id.in)) {
        const ids = new Set(where.id.in);
        rows = rows.filter((r) => ids.has(r.id));
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.crop)   rows = rows.filter((r) => r.crop === where.crop);
      if (where.region && typeof where.region === 'object') {
        const target = String(where.region.equals || '').toLowerCase();
        rows = rows.filter((r) => (r.region || '').toLowerCase() === target);
      } else if (where.region) {
        rows = rows.filter((r) => r.region === where.region);
      }
      if (where.buyerId) rows = rows.filter((r) => r.buyerId === where.buyerId);
      rows.sort((a, b) => (b.createdAt - a.createdAt));
      return typeof take === 'number' ? rows.slice(0, take) : rows;
    },
    async count({ where = {} } = {}) {
      const rows = await this.findMany({ where });
      return rows.length;
    },
  });

  const prisma = {
    produceListing:   withCrud('produceListing', 'lst'),
    buyerRequest:     withCrud('buyerRequest', 'req'),
    farm: {
      async findUnique({ where, select }) {
        const row = state.farm.get(where.id) || null;
        if (!row || !select) return row;
        const out = {};
        for (const k of Object.keys(select)) if (select[k]) out[k] = row[k];
        return out;
      },
    },
    farmerNotification: {
      async create({ data }) {
        const id = nextId('ntf');
        const row = { id, createdAt: new Date(), read: false, ...data };
        state.farmerNotification.push(row);
        return row;
      },
      async findMany({ where = {}, orderBy, take } = {}) {
        let rows = state.farmerNotification.slice();
        if (where.farmerId)         rows = rows.filter((r) => r.farmerId === where.farmerId);
        if (where.notificationType) rows = rows.filter((r) => r.notificationType === where.notificationType);
        if (orderBy && orderBy.createdAt === 'desc') {
          rows.sort((a, b) => (b.createdAt - a.createdAt));
        }
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      },
    },
    async $transaction(ops) { return Promise.all(ops); },
    _state: state,
  };
  return prisma;
}

// ═══════════════════════════════════════════════════════════════
// Status mapping
// ═══════════════════════════════════════════════════════════════
describe('status mapping', () => {
  it('listing: spec → DB', () => {
    expect(LISTING_STATUS_SPEC_TO_DB.active).toBe('available');
    expect(LISTING_STATUS_SPEC_TO_DB.requested).toBe('reserved');
    expect(LISTING_STATUS_SPEC_TO_DB.completed).toBe('sold');
  });

  it('request: spec → DB', () => {
    expect(REQUEST_STATUS_SPEC_TO_DB.pending).toBe('open');
    expect(REQUEST_STATUS_SPEC_TO_DB.accepted).toBe('matched');
    expect(REQUEST_STATUS_SPEC_TO_DB.declined).toBe('cancelled');
  });

  it('mappers translate DB rows to spec shape', () => {
    expect(mapListingToSpec({ status: 'available' }).status).toBe('active');
    expect(mapRequestToSpec({ status: 'matched' }).status).toBe('accepted');
  });
});

// ═══════════════════════════════════════════════════════════════
// Listing creation + filters
// ═══════════════════════════════════════════════════════════════
describe('createListing + listListings (filters)', () => {
  let prisma;
  beforeEach(() => { prisma = makeFakePrisma(); });

  it('creates a listing with default status=available', async () => {
    const out = await createListing(prisma, { crop: 'maize', quantity: 100 });
    expect(out.ok).toBe(true);
    expect(out.listing.crop).toBe('MAIZE');
    expect(out.listing.status).toBe('active');     // spec-mapped
    expect(out.listing.statusDb).toBe('available'); // DB value exposed
  });

  it('rejects missing crop + invalid quantity', async () => {
    expect((await createListing(prisma, { quantity: 10 })).reason).toBe('missing_crop');
    expect((await createListing(prisma, { crop: 'maize', quantity: 0 })).reason).toBe('invalid_quantity');
    expect((await createListing(prisma, { crop: 'maize', quantity: -1 })).reason).toBe('invalid_quantity');
  });

  it('rejects negative price but accepts null/undefined', async () => {
    expect((await createListing(prisma, { crop: 'maize', quantity: 10, price: -5 })).reason).toBe('invalid_price');
    expect((await createListing(prisma, { crop: 'maize', quantity: 10 })).ok).toBe(true);
    expect((await createListing(prisma, { crop: 'maize', quantity: 10, price: 2.5 })).ok).toBe(true);
  });

  it('listListings filters by crop', async () => {
    await createListing(prisma, { crop: 'maize', quantity: 100 });
    await createListing(prisma, { crop: 'rice',  quantity: 50 });
    const out = await listListings(prisma, { crop: 'maize' });
    expect(out.data.length).toBe(1);
    expect(out.data[0].crop).toBe('MAIZE');
  });

  it('listListings filters by region (case-insensitive)', async () => {
    await createListing(prisma, { crop: 'maize', quantity: 100, region: 'Ashanti' });
    await createListing(prisma, { crop: 'maize', quantity: 50,  region: 'Lagos' });
    const out = await listListings(prisma, { region: 'ashanti' });
    expect(out.data.length).toBe(1);
    expect(out.data[0].region).toBe('Ashanti');
  });

  it('listListings accepts spec status (active)', async () => {
    await createListing(prisma, { crop: 'maize', quantity: 100 });
    const out = await listListings(prisma, { status: 'active' });
    expect(out.data.length).toBe(1);
    expect(out.data[0].status).toBe('active');
  });
});

// ═══════════════════════════════════════════════════════════════
// Buyer request flow + notifications
// ═══════════════════════════════════════════════════════════════
describe('createRequest — listingId snapshot + notification', () => {
  let prisma;
  beforeEach(async () => {
    prisma = makeFakePrisma();
    // Seed a farm so the notification lookup has a farmerId.
    prisma._state.farm.set('farm-1', { id: 'farm-1', farmerId: 'farmer-1' });
  });

  it('standalone request (no listingId) still works', async () => {
    const out = await createRequest(prisma, {
      crop: 'maize', quantity: 50, buyerName: 'Buyer Bob',
    });
    expect(out.ok).toBe(true);
    expect(out.request.status).toBe('pending');
    expect(out.listingId).toBeNull();
    expect(prisma._state.farmerNotification.length).toBe(0);
  });

  it('request with listingId snapshots crop + quantity from the listing', async () => {
    const { listing } = await createListing(prisma,
      { crop: 'maize', quantity: 100, farmId: 'farm-1', region: 'Ashanti' });
    const out = await createRequest(prisma, {
      listingId: listing.id, buyerName: 'Buyer Bob', buyerId: 'buyer-1',
    });
    expect(out.ok).toBe(true);
    expect(out.listingId).toBe(listing.id);
    expect(out.request.crop).toBe('MAIZE');
    expect(out.request.quantity).toBe(100);
    expect(out.request.region).toBe('Ashanti');
  });

  it('notifies the farmer that owns the listing', async () => {
    const { listing } = await createListing(prisma,
      { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    await createRequest(prisma, {
      listingId: listing.id, buyerName: 'Buyer Bob', buyerId: 'buyer-1',
    });
    expect(prisma._state.farmerNotification.length).toBe(1);
    const n = prisma._state.farmerNotification[0];
    expect(n.farmerId).toBe('farmer-1');
    expect(n.notificationType).toBe('market');
    expect(n.metadata.kind).toBe('marketplace.request.created');
    expect(n.metadata.listingId).toBe(listing.id);
    expect(n.metadata.buyerName).toBe('Buyer Bob');
  });

  it('rejects request against unknown listing', async () => {
    const out = await createRequest(prisma, {
      listingId: 'nope', crop: 'maize', quantity: 50,
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('listing_not_found');
  });

  it('rejects request against a sold/reserved listing', async () => {
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    await updateListingStatus(prisma, { listingId: listing.id, status: 'cancelled' });
    const out = await createRequest(prisma, { listingId: listing.id, buyerName: 'B' });
    expect(out.reason).toBe('not_available');
  });

  it('survives notification failure without losing the request', async () => {
    // Break the notification create; the request should still succeed.
    prisma.farmerNotification.create = async () => { throw new Error('boom'); };
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 10, farmId: 'farm-1' });
    const out = await createRequest(prisma, { listingId: listing.id, buyerName: 'B' });
    expect(out.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Accept / decline transitions
// ═══════════════════════════════════════════════════════════════
describe('acceptRequest + declineRequest + updateListingStatus', () => {
  let prisma;
  beforeEach(async () => {
    prisma = makeFakePrisma();
    prisma._state.farm.set('farm-1', { id: 'farm-1', farmerId: 'farmer-1' });
  });

  it('accept flips request → accepted AND linked listing → requested', async () => {
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    const { request } = await createRequest(prisma, { listingId: listing.id, buyerName: 'Bob' });

    const out = await acceptRequest(prisma, { requestId: request.id, listingId: listing.id });
    expect(out.ok).toBe(true);
    expect(out.request.status).toBe('accepted');

    const post = await listListings(prisma, { status: 'requested' });
    expect(post.data.length).toBe(1);
    expect(post.data[0].id).toBe(listing.id);
  });

  it('decline flips request → declined; listing stays active', async () => {
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    const { request } = await createRequest(prisma, { listingId: listing.id });

    const out = await declineRequest(prisma, { requestId: request.id });
    expect(out.ok).toBe(true);
    expect(out.request.status).toBe('declined');

    const active = await listListings(prisma, { status: 'active' });
    expect(active.data.some((l) => l.id === listing.id)).toBe(true);
  });

  it('rejects double-accept + double-decline', async () => {
    const { request } = await createRequest(prisma, { crop: 'maize', quantity: 10 });
    await acceptRequest(prisma, { requestId: request.id });
    expect((await acceptRequest(prisma, { requestId: request.id })).reason).toBe('already_accepted');

    const { request: r2 } = await createRequest(prisma, { crop: 'rice', quantity: 10 });
    await declineRequest(prisma, { requestId: r2.id });
    expect((await declineRequest(prisma, { requestId: r2.id })).reason).toBe('already_declined');
  });

  it('updateListingStatus enforces transitions: active → requested → completed', async () => {
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    expect(listing.status).toBe('active');

    const toReq = await updateListingStatus(prisma, { listingId: listing.id, status: 'requested' });
    expect(toReq.ok).toBe(true);
    expect(toReq.listing.status).toBe('requested');

    const toDone = await updateListingStatus(prisma, { listingId: listing.id, status: 'completed' });
    expect(toDone.ok).toBe(true);
    expect(toDone.listing.status).toBe('completed');

    // Terminal → any transition rejected
    const fwd = await updateListingStatus(prisma, { listingId: listing.id, status: 'active' });
    expect(fwd.reason).toBe('invalid_transition');
  });

  it('updateListingStatus rejects unknown listing', async () => {
    const out = await updateListingStatus(prisma, { listingId: 'nope', status: 'completed' });
    expect(out.reason).toBe('listing_not_found');
  });

  it('updateListingStatus rejects invalid spec status', async () => {
    const { listing } = await createListing(prisma, { crop: 'maize', quantity: 10, farmId: 'farm-1' });
    const out = await updateListingStatus(prisma, { listingId: listing.id, status: 'weird' });
    expect(out.reason).toBe('invalid_status');
  });
});

// ═══════════════════════════════════════════════════════════════
// Farmer inbox: listIncomingRequestsForFarmer
// ═══════════════════════════════════════════════════════════════
describe('listIncomingRequestsForFarmer', () => {
  let prisma;
  beforeEach(() => {
    prisma = makeFakePrisma();
    prisma._state.farm.set('farm-1', { id: 'farm-1', farmerId: 'farmer-1' });
    prisma._state.farm.set('farm-2', { id: 'farm-2', farmerId: 'farmer-2' });
  });

  it('returns empty when farmer has no market notifications', async () => {
    const out = await listIncomingRequestsForFarmer(prisma, { farmerId: 'farmer-1' });
    expect(out.ok).toBe(true);
    expect(out.data).toEqual([]);
  });

  it('returns only requests routed to this farmer via notification metadata', async () => {
    const { listing: L1 } = await createListing(prisma,
      { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    const { listing: L2 } = await createListing(prisma,
      { crop: 'rice',  quantity: 50,  farmId: 'farm-2' });

    // Two buyers, one request to each farmer's listing.
    await createRequest(prisma, { listingId: L1.id, buyerName: 'Alice', buyerId: 'b1' });
    await createRequest(prisma, { listingId: L2.id, buyerName: 'Bob',   buyerId: 'b2' });

    const out = await listIncomingRequestsForFarmer(prisma, { farmerId: 'farmer-1' });
    expect(out.ok).toBe(true);
    expect(out.data.length).toBe(1);
    expect(out.data[0].buyerName).toBe('Alice');
    expect(out.data[0].crop).toBe('MAIZE');
    expect(out.data[0].listingId).toBe(L1.id);
    expect(out.data[0].request.status).toBe('pending'); // spec-mapped
  });

  it('ignores malformed / non-marketplace notifications gracefully', async () => {
    // Seed a market notification with the wrong metadata kind.
    await prisma.farmerNotification.create({
      data: {
        farmerId: 'farmer-1',
        notificationType: 'market',
        title: 'Random market info',
        message: 'Unrelated',
        metadata: { kind: 'something.else' },
      },
    });
    // And another with stringified JSON metadata.
    await prisma.farmerNotification.create({
      data: {
        farmerId: 'farmer-1',
        notificationType: 'market',
        title: 'Noise',
        message: 'Noise',
        metadata: 'not valid json',
      },
    });
    const out = await listIncomingRequestsForFarmer(prisma, { farmerId: 'farmer-1' });
    expect(out.ok).toBe(true);
    expect(out.data).toEqual([]);
  });

  it('filters by spec status (pending/accepted/declined)', async () => {
    const { listing } = await createListing(prisma,
      { crop: 'maize', quantity: 100, farmId: 'farm-1' });
    const { request: r1 } = await createRequest(prisma,
      { listingId: listing.id, buyerName: 'A', buyerId: 'b1' });
    const { listing: L2 } = await createListing(prisma,
      { crop: 'rice', quantity: 50, farmId: 'farm-1' });
    const { request: r2 } = await createRequest(prisma,
      { listingId: L2.id, buyerName: 'B', buyerId: 'b2' });

    await acceptRequest(prisma,  { requestId: r1.id, listingId: listing.id });
    await declineRequest(prisma, { requestId: r2.id });

    // Default 'pending' is empty now — both moved.
    expect((await listIncomingRequestsForFarmer(prisma,
      { farmerId: 'farmer-1' })).data.length).toBe(0);

    // 'accepted' → the maize one
    const accepted = await listIncomingRequestsForFarmer(prisma,
      { farmerId: 'farmer-1', status: 'accepted' });
    expect(accepted.data.length).toBe(1);
    expect(accepted.data[0].crop).toBe('MAIZE');

    // 'declined' → the rice one
    const declined = await listIncomingRequestsForFarmer(prisma,
      { farmerId: 'farmer-1', status: 'declined' });
    expect(declined.data.length).toBe(1);
    expect(declined.data[0].crop).toBe('RICE');

    // 'all' returns both, sorted by notification recency
    const all = await listIncomingRequestsForFarmer(prisma,
      { farmerId: 'farmer-1', status: 'all' });
    expect(all.data.length).toBe(2);
  });

  it('missing farmerId returns reason=missing_farmer_id', async () => {
    const out = await listIncomingRequestsForFarmer(prisma, {});
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_farmer_id');
  });

  it('caches the request lookup in a single findMany (no N+1)', async () => {
    // Seed several notifications referencing the same and different
    // requestIds; assert we only call buyerRequest.findMany once.
    const { listing } = await createListing(prisma,
      { crop: 'maize', quantity: 10, farmId: 'farm-1' });
    for (let i = 0; i < 3; i += 1) {
      await createRequest(prisma, { listingId: listing.id, buyerName: `B${i}` });
    }
    let calls = 0;
    const originalFindMany = prisma.buyerRequest.findMany.bind(prisma.buyerRequest);
    prisma.buyerRequest.findMany = async (...args) => {
      calls += 1;
      return originalFindMany(...args);
    };
    const out = await listIncomingRequestsForFarmer(prisma, { farmerId: 'farmer-1' });
    expect(out.ok).toBe(true);
    expect(out.data.length).toBe(3);
    expect(calls).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// Request listing with filters
// ═══════════════════════════════════════════════════════════════
describe('listRequests — filters', () => {
  let prisma;
  beforeEach(() => { prisma = makeFakePrisma(); });

  it('filters by spec status + crop + buyerId', async () => {
    await createRequest(prisma, { crop: 'maize', quantity: 10, buyerId: 'buyer-1' });
    await createRequest(prisma, { crop: 'rice',  quantity: 10, buyerId: 'buyer-2' });

    const maize = await listRequests(prisma, { crop: 'maize' });
    expect(maize.data.length).toBe(1);
    expect(maize.data[0].crop).toBe('MAIZE');

    const b1 = await listRequests(prisma, { buyerId: 'buyer-1' });
    expect(b1.data.length).toBe(1);
    expect(b1.data[0].buyerId).toBe('buyer-1');

    // Status translated from spec.
    const pending = await listRequests(prisma, { status: 'pending' });
    expect(pending.data.length).toBe(2);
    for (const r of pending.data) expect(r.status).toBe('pending');
  });
});
