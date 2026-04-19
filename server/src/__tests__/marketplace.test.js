/**
 * marketplace.test.js — covers the pure market engine + the
 * Prisma-facing service via an in-memory stub.
 *
 *   1. scoreBuyerListingMatch / getMatchingListings
 *   2. canTransitionListing + canTransitionInterest (status machine)
 *   3. getTrustBadges honesty (only what the data supports)
 *   4. marketService contract-level behavior with a stub prisma
 *   5. Per-locale resolution for every marketplace i18n key
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  scoreBuyerListingMatch, getMatchingListings, getTrustBadges,
  canTransitionListing, canTransitionInterest,
} from '../services/market/listingMatcher.js';
import {
  createListing, searchListings, expressInterest, respondToInterest,
  markListingSold, closeListing, listMyListings,
  listNotifications,
} from '../services/market/marketService.js';
import { t } from '../../../src/i18n/index.js';

// ─── matching ────────────────────────────────────────────
describe('scoreBuyerListingMatch', () => {
  it('returns 0 when crop does not match', () => {
    const s = scoreBuyerListingMatch(
      { cropKey: 'tomato', status: 'active', country: 'US', stateCode: 'MD' },
      { crop: 'peanut' },
    );
    expect(s).toBe(0);
  });

  it('rewards country + state + quantity + quality fits', () => {
    const listing = {
      cropKey: 'tomato', country: 'US', stateCode: 'MD',
      quantity: 50, quality: 'high', deliveryMode: 'either', status: 'active',
    };
    const s = scoreBuyerListingMatch(listing, {
      crop: 'tomato', country: 'US', stateCode: 'MD', quantity: 20, minQuality: 'medium',
    });
    expect(s).toBeGreaterThanOrEqual(85);
  });

  it('penalizes incompatible delivery mode', () => {
    const listing = { cropKey: 'tomato', country: 'US', deliveryMode: 'pickup', quantity: 10, status: 'active' };
    const s = scoreBuyerListingMatch(listing, { crop: 'tomato', country: 'US', deliveryMode: 'delivery' });
    const baseline = scoreBuyerListingMatch(listing, { crop: 'tomato', country: 'US' });
    expect(s).toBeLessThan(baseline);
  });
});

describe('getMatchingListings', () => {
  it('filters out non-active listings', () => {
    const rows = [
      { id: '1', cropKey: 'tomato', status: 'active',    country: 'US' },
      { id: '2', cropKey: 'tomato', status: 'sold',      country: 'US' },
      { id: '3', cropKey: 'tomato', status: 'reserved',  country: 'US' },
    ];
    const out = getMatchingListings(rows, { crop: 'tomato' });
    expect(out.map(({ listing }) => listing.id)).toEqual(['1']);
  });

  it('sorts by match score then recency', () => {
    const now = Date.now();
    const rows = [
      { id: 'a', cropKey: 'tomato', status: 'active', country: 'US', stateCode: 'MD', createdAt: new Date(now - 10 * 86400000) },
      { id: 'b', cropKey: 'tomato', status: 'active', country: 'US', stateCode: 'TX', createdAt: new Date(now) },
    ];
    const out = getMatchingListings(rows, { crop: 'tomato', country: 'US', stateCode: 'MD' });
    expect(out[0].listing.id).toBe('a'); // state match wins over recency
  });
});

describe('status transitions', () => {
  it('listing transitions follow the machine', () => {
    expect(canTransitionListing('draft', 'active')).toBe(true);
    expect(canTransitionListing('active', 'reserved')).toBe(true);
    expect(canTransitionListing('sold', 'active')).toBe(false);
    expect(canTransitionListing('closed', 'active')).toBe(false);
  });

  it('interest transitions lock on response', () => {
    expect(canTransitionInterest('pending', 'accepted')).toBe(true);
    expect(canTransitionInterest('pending', 'declined')).toBe(true);
    expect(canTransitionInterest('declined', 'accepted')).toBe(false);
    expect(canTransitionInterest('accepted', 'pending')).toBe(false);
  });
});

describe('getTrustBadges honesty', () => {
  it('surfaces only badges the data supports', () => {
    const empty = getTrustBadges({});
    expect(empty).toEqual([]);
    const full = getTrustBadges({
      cropCycleId: 'c1',
      quality: 'high',
      stateCode: 'MD',
      supportConfidence: 'high',
      createdAt: new Date(),
    });
    expect(full).toContain('market.trust.verifiedHarvest');
    expect(full).toContain('market.trust.qualityReported');
    expect(full).toContain('market.trust.locationVerified');
    expect(full).toContain('market.trust.guidanceFull');
    expect(full).toContain('market.trust.recentActivity');
  });
});

// ─── service layer via stub prisma ───────────────────────
function makeStub() {
  const listings = new Map();
  const interests = new Map();
  const notifications = [];
  let listingSeq = 0;
  let interestSeq = 0;
  let notifSeq = 0;

  return {
    _state: { listings, interests, notifications },
    cropListing: {
      create: async ({ data }) => {
        const id = 'L' + (++listingSeq);
        const row = {
          id, status: 'draft', createdAt: new Date(), updatedAt: new Date(),
          interests: [], ...data,
        };
        listings.set(id, row);
        return row;
      },
      findUnique: async ({ where }) => listings.get(where.id) || null,
      findMany: async ({ where = {}, orderBy, take = 100, include } = {}) => {
        let rows = Array.from(listings.values());
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.cropKey) rows = rows.filter((r) => r.cropKey === where.cropKey);
        if (where.country) rows = rows.filter((r) => r.country === where.country);
        if (where.farmerId) rows = rows.filter((r) => r.farmerId === where.farmerId);
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        rows = rows.slice(0, take);
        if (include?.interests) {
          return rows.map((r) => ({
            ...r,
            interests: Array.from(interests.values())
              .filter((i) => i.listingId === r.id && (!include.interests.where || i.status === include.interests.where.status)),
          }));
        }
        return rows;
      },
      update: async ({ where, data }) => {
        const prev = listings.get(where.id);
        const next = { ...prev, ...data, updatedAt: new Date() };
        listings.set(where.id, next);
        return next;
      },
    },
    marketInterest: {
      create: async ({ data }) => {
        const id = 'I' + (++interestSeq);
        const row = { id, createdAt: new Date(), updatedAt: new Date(), status: 'pending', ...data };
        interests.set(id, row);
        return row;
      },
      findUnique: async ({ where, include }) => {
        const row = interests.get(where.id);
        if (!row) return null;
        if (include?.listing) return { ...row, listing: listings.get(row.listingId) };
        return row;
      },
      findMany: async ({ where = {}, include, take = 200, orderBy } = {}) => {
        let rows = Array.from(interests.values());
        if (where.listing?.farmerId) {
          rows = rows.filter((i) => listings.get(i.listingId)?.farmerId === where.listing.farmerId);
        }
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        rows = rows.slice(0, take);
        if (include?.listing) return rows.map((r) => ({ ...r, listing: listings.get(r.listingId) }));
        return rows;
      },
      update: async ({ where, data }) => {
        const prev = interests.get(where.id);
        const next = { ...prev, ...data, updatedAt: new Date() };
        interests.set(where.id, next);
        return next;
      },
    },
    notification: {
      create: async ({ data }) => {
        const row = { id: 'N' + (++notifSeq), isRead: false, createdAt: new Date(), ...data };
        notifications.push(row);
        return row;
      },
      findMany: async ({ where = {}, orderBy, take = 50 } = {}) => {
        let rows = notifications.filter((n) => n.userId === where.userId);
        rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return rows.slice(0, take);
      },
      findUnique: async ({ where }) => notifications.find((n) => n.id === where.id) || null,
      update: async ({ where, data }) => {
        const row = notifications.find((n) => n.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
  };
}

describe('marketService (stub prisma)', () => {
  let prisma;
  const farmer = { id: 'user-farmer' };
  const buyer = { id: 'user-buyer' };

  beforeEach(() => { prisma = makeStub(); });

  it('creates an active listing end-to-end', async () => {
    const out = await createListing(prisma, {
      user: farmer,
      data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US', stateCode: 'MD' },
    });
    expect(out.listing.status).toBe('active');
    expect(out.listing.farmerId).toBe(farmer.id);
  });

  it('search returns only active listings with match score + trust badges', async () => {
    await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US', stateCode: 'MD' } });
    const sold = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 10, quality: 'high', country: 'US', stateCode: 'MD' } });
    await markListingSold(prisma, { user: farmer, id: sold.listing.id });

    const out = await searchListings(prisma, { crop: 'tomato', country: 'US', stateCode: 'MD' });
    expect(out.listings).toHaveLength(1);
    expect(out.listings[0].matchScore).toBeGreaterThan(60);
    expect(Array.isArray(out.listings[0].trustBadges)).toBe(true);
  });

  it('express interest creates a notification for the farmer', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    await expressInterest(prisma, { user: buyer, listingId: l.listing.id, data: { quantityRequested: 10, note: 'need by Friday' } });
    const { notifications } = await listNotifications(prisma, { user: farmer });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('listing_interest');
    expect(notifications[0].metadata.cropKey).toBe('tomato');
  });

  it('refuses interest on the farmer’s own listing', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    await expect(expressInterest(prisma, { user: farmer, listingId: l.listing.id })).rejects.toThrow('cannot_interest_own_listing');
  });

  it('accept moves listing to reserved + notifies the buyer', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    const { interest } = await expressInterest(prisma, { user: buyer, listingId: l.listing.id, data: { quantityRequested: 10 } });
    await respondToInterest(prisma, { user: farmer, id: interest.id, accept: true });
    const { listings } = await listMyListings(prisma, { user: farmer });
    expect(listings[0].status).toBe('reserved');
    const { notifications } = await listNotifications(prisma, { user: buyer });
    expect(notifications[0].type).toBe('interest_accepted');
  });

  it('decline notifies the buyer and leaves the listing active', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    const { interest } = await expressInterest(prisma, { user: buyer, listingId: l.listing.id });
    await respondToInterest(prisma, { user: farmer, id: interest.id, accept: false });
    const { listings } = await listMyListings(prisma, { user: farmer });
    expect(listings[0].status).toBe('active');
    const { notifications } = await listNotifications(prisma, { user: buyer });
    expect(notifications[0].type).toBe('interest_declined');
  });

  it('mark sold removes the listing from buyer search results', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    await markListingSold(prisma, { user: farmer, id: l.listing.id });
    const { listings } = await searchListings(prisma, { crop: 'tomato', country: 'US' });
    expect(listings).toHaveLength(0);
  });

  it('close transitions from active / reserved to closed', async () => {
    const l = await createListing(prisma, { user: farmer, data: { cropKey: 'tomato', quantity: 25, quality: 'high', country: 'US' } });
    await closeListing(prisma, { user: farmer, id: l.listing.id });
    const row = prisma._state.listings.get(l.listing.id);
    expect(row.status).toBe('closed');
  });
});

// ─── i18n: every marketplace key lives in every locale ───
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const MARKET_KEYS = [
  'postHarvest.sellPrompt',
  'market.myListings.title', 'market.myListings.create',
  'market.myListings.empty', 'market.browse.title',
  'market.detail.contactNote', 'market.interest.title',
  'market.interest.sentTitle', 'market.action.interested',
  'market.action.accept', 'market.action.decline',
  'market.action.markSold', 'market.action.close',
  'market.pending.title',
  'market.status.draft', 'market.status.active', 'market.status.reserved',
  'market.status.sold', 'market.status.closed',
  'market.quality.high', 'market.quality.medium', 'market.quality.low',
  'market.pricingMode.fixed', 'market.pricingMode.negotiable', 'market.pricingMode.ask_buyer',
  'market.delivery.pickup', 'market.delivery.delivery', 'market.delivery.either',
  'market.trust.verifiedHarvest', 'market.trust.qualityReported',
  'market.trust.locationVerified', 'market.trust.recentActivity',
  'notifications.title', 'notification.interest.title',
  'notification.accepted.title', 'notification.declined.title',
];

// Words that legitimately share an identical spelling in some
// languages (Active / Notifications in French, etc.). Carve these
// out of the no-English-leak guard.
const SHARED_EN_KEYS = new Set([
  'fr:market.status.active', 'fr:notifications.title',
]);

describe('marketplace i18n: every key resolves', () => {
  it.each(MARKET_KEYS)('%s has a non-empty English string', (key) => {
    expect(t(key, 'en')).toBeTruthy();
  });
  it.each(
    NON_EN_LOCALES.flatMap((lang) => MARKET_KEYS.map((key) => [lang, key])),
  )('[%s] %s is localized', (lang, key) => {
    const en = t(key, 'en');
    const localized = t(key, lang);
    expect(localized).toBeTruthy();
    if (SHARED_EN_KEYS.has(`${lang}:${key}`)) return;
    expect(localized).not.toBe(en);
  });
});
