/**
 * marketService.js — Prisma-facing orchestration for the v1
 * marketplace. Every mutation routes through a status-machine
 * check, and every buyer→farmer event writes a Notification so
 * the farmer's in-app bell updates immediately.
 *
 * Public API:
 *   createListing(prisma, { user, data })
 *   createListingFromHarvest(prisma, { user, cycleId, overrides })
 *   listMyListings(prisma, { user })
 *   updateListing(prisma, { user, id, patch })
 *   markListingSold(prisma, { user, id })
 *   closeListing(prisma, { user, id })
 *   searchListings(prisma, criteria)
 *   getListingPublic(prisma, { id })
 *   expressInterest(prisma, { user, listingId, data })
 *   listMyInterests(prisma, { user })          // farmer side
 *   respondToInterest(prisma, { user, id, accept, note })
 *   listNotifications(prisma, { user })
 *   markNotificationRead(prisma, { user, id })
 *
 * Every path is defensive: missing models (pre-migration) or
 * missing rows return a clean error shape instead of crashing.
 */

import { PrismaClient } from '@prisma/client';
import {
  canTransitionListing, canTransitionInterest,
  getMatchingListings, getTrustBadges,
} from './listingMatcher.js';

const prismaFallback = new PrismaClient();

const ACTIVE_STATUSES = new Set(['active', 'reserved']);

function httpErr(status, code) {
  const e = new Error(code);
  e.status = status;
  e.code = code;
  return e;
}

function getPrisma(p) { return p || prismaFallback; }

// ─── notifications ───────────────────────────────────────
async function notify(prisma, { userId, type, title, message, metadata }) {
  if (!userId) return null;
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, metadata: metadata || undefined },
    });
  } catch {
    return null; // pre-migration or transient — don't fail the parent action
  }
}

export async function listNotifications(_prisma, { user, limit = 50 } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  try {
    const rows = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unread = rows.filter((r) => !r.isRead).length;
    return { notifications: rows, unread };
  } catch {
    return { notifications: [], unread: 0 };
  }
}

export async function markNotificationRead(_prisma, { user, id }) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  try {
    const row = await prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) throw httpErr(404, 'notification_not_found');
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return { ok: true };
  } catch (err) {
    if (err?.status) throw err;
    return { ok: false };
  }
}

// ─── listing CRUD ────────────────────────────────────────
function sanitizeListingInput(raw = {}, defaults = {}) {
  return {
    cropKey: String(raw.cropKey || raw.crop || defaults.cropKey || '').toLowerCase(),
    quantity: Number.isFinite(Number(raw.quantity)) ? Number(raw.quantity) : defaults.quantity,
    unit: String(raw.unit || defaults.unit || 'kg').toLowerCase(),
    quality: ['high', 'medium', 'low'].includes(String(raw.quality || '').toLowerCase())
      ? String(raw.quality).toLowerCase()
      : (defaults.quality || 'medium'),
    country: String(raw.country || defaults.country || '').toUpperCase(),
    stateCode: raw.stateCode || defaults.stateCode || null,
    city: raw.city || defaults.city || null,
    availableFrom: raw.availableFrom ? new Date(raw.availableFrom) : (defaults.availableFrom || null),
    price: Number.isFinite(Number(raw.price)) ? Number(raw.price) : (defaults.price ?? null),
    pricingMode: ['fixed', 'negotiable', 'ask_buyer'].includes(raw.pricingMode)
      ? raw.pricingMode : (defaults.pricingMode || 'negotiable'),
    deliveryMode: ['pickup', 'delivery', 'either'].includes(raw.deliveryMode)
      ? raw.deliveryMode : (defaults.deliveryMode || 'either'),
    notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 1000) : defaults.notes || null,
  };
}

export async function createListing(_prisma, { user, data } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const clean = sanitizeListingInput(data);
  if (!clean.cropKey || !clean.country || !Number.isFinite(clean.quantity) || clean.quantity <= 0) {
    throw httpErr(400, 'invalid_listing');
  }
  try {
    const row = await prisma.cropListing.create({
      data: {
        farmerId: user.id,
        farmProfileId: data?.farmProfileId || null,
        cropCycleId: data?.cropCycleId || null,
        ...clean,
        status: data?.status && ['draft', 'active'].includes(data.status) ? data.status : 'active',
      },
    });
    return { listing: row };
  } catch (err) {
    if (err?.code === 'P2002') throw httpErr(409, 'listing_already_exists');
    throw err;
  }
}

/**
 * createListingFromHarvest — the post-harvest shortcut: pre-fills a
 * listing from the just-persisted HarvestOutcome + cycle + farm.
 */
export async function createListingFromHarvest(_prisma, { user, cycleId, overrides = {} } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  if (!cycleId) throw httpErr(400, 'missing_cycle');

  const cycle = await prisma.v2CropCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw httpErr(404, 'cycle_not_found');
  const farm = await prisma.farmProfile.findFirst({
    where: { id: cycle.profileId, userId: user.id },
    select: { id: true, country: true, stateCode: true, locationName: true },
  });
  if (!farm) throw httpErr(403, 'forbidden');

  let harvest = null;
  try {
    harvest = await prisma.harvestOutcome.findUnique({ where: { cropCycleId: cycleId } });
  } catch { /* pre-migration */ }

  const qualityMap = { excellent: 'high', good: 'high', fair: 'medium', poor: 'low' };
  const defaults = {
    cropKey: cycle.cropType,
    quantity: harvest?.actualYieldKg || 0,
    unit: harvest?.yieldUnit || 'kg',
    quality: qualityMap[String(harvest?.qualityBand || '').toLowerCase()] || 'medium',
    country: farm.country || 'US',
    stateCode: farm.stateCode || null,
    availableFrom: harvest?.harvestedAt || new Date(),
  };
  const clean = sanitizeListingInput(overrides, defaults);
  const row = await prisma.cropListing.create({
    data: {
      farmerId: user.id,
      farmProfileId: farm.id,
      cropCycleId: cycle.id,
      ...clean,
      status: overrides.status && ['draft', 'active'].includes(overrides.status) ? overrides.status : 'draft',
    },
  });
  return { listing: row };
}

export async function listMyListings(_prisma, { user } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  try {
    const rows = await prisma.cropListing.findMany({
      where: { farmerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        interests: {
          where: { status: 'pending' },
          select: { id: true },
        },
      },
    });
    return {
      listings: rows.map((l) => ({
        ...l,
        pendingInterestsCount: (l.interests || []).length,
      })),
    };
  } catch {
    return { listings: [] };
  }
}

async function requireOwnedListing(prisma, { user, id }) {
  const row = await prisma.cropListing.findUnique({ where: { id } });
  if (!row) throw httpErr(404, 'listing_not_found');
  if (row.farmerId !== user.id && user.role !== 'admin') throw httpErr(403, 'forbidden');
  return row;
}

export async function updateListing(_prisma, { user, id, patch }) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await requireOwnedListing(prisma, { user, id });
  const clean = sanitizeListingInput(patch, row);
  // Status transitions only through mark-sold / close or explicit
  // activate/draft flip.
  let status = row.status;
  if (patch?.status && patch.status !== row.status) {
    if (!canTransitionListing(row.status, patch.status)) throw httpErr(409, 'invalid_status');
    status = patch.status;
  }
  const updated = await prisma.cropListing.update({
    where: { id }, data: { ...clean, status },
  });
  return { listing: updated };
}

export async function markListingSold(_prisma, { user, id }) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await requireOwnedListing(prisma, { user, id });
  if (!canTransitionListing(row.status, 'sold')) throw httpErr(409, 'invalid_status');
  const updated = await prisma.cropListing.update({
    where: { id }, data: { status: 'sold' },
  });
  return { listing: updated };
}

export async function closeListing(_prisma, { user, id }) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await requireOwnedListing(prisma, { user, id });
  if (!canTransitionListing(row.status, 'closed')) throw httpErr(409, 'invalid_status');
  const updated = await prisma.cropListing.update({
    where: { id }, data: { status: 'closed' },
  });
  return { listing: updated };
}

// ─── buyer-facing search + detail ───────────────────────
export async function searchListings(_prisma, criteria = {}) {
  const prisma = getPrisma(_prisma);
  try {
    const rows = await prisma.cropListing.findMany({
      where: {
        status: 'active',
        ...(criteria.crop ? { cropKey: String(criteria.crop).toLowerCase() } : {}),
        ...(criteria.country ? { country: String(criteria.country).toUpperCase() } : {}),
        ...(criteria.stateCode ? { stateCode: String(criteria.stateCode).toUpperCase() } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const scored = getMatchingListings(rows, criteria);
    return {
      listings: scored.map(({ listing, score }) => ({
        ...listing,
        matchScore: score,
        trustBadges: getTrustBadges(listing),
      })),
    };
  } catch {
    return { listings: [] };
  }
}

export async function getListingPublic(_prisma, { id }) {
  const prisma = getPrisma(_prisma);
  try {
    const row = await prisma.cropListing.findUnique({ where: { id } });
    if (!row) throw httpErr(404, 'listing_not_found');
    // Public detail never exposes farmer contact — only ids.
    return {
      listing: {
        ...row,
        trustBadges: getTrustBadges(row),
      },
    };
  } catch (err) {
    if (err?.status) throw err;
    return { listing: null };
  }
}

// ─── buyer interest ──────────────────────────────────────
export async function expressInterest(_prisma, { user, listingId, data = {} } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const listing = await prisma.cropListing.findUnique({ where: { id: listingId } });
  if (!listing) throw httpErr(404, 'listing_not_found');
  if (!ACTIVE_STATUSES.has(listing.status)) throw httpErr(409, 'listing_not_available');
  if (listing.farmerId === user.id) throw httpErr(400, 'cannot_interest_own_listing');

  const row = await prisma.marketInterest.create({
    data: {
      listingId: listing.id,
      buyerId: user.id,
      quantityRequested: Number.isFinite(Number(data.quantityRequested)) ? Number(data.quantityRequested) : null,
      offeredPrice: Number.isFinite(Number(data.offeredPrice)) ? Number(data.offeredPrice) : null,
      note: typeof data.note === 'string' ? data.note.slice(0, 500) : null,
      status: 'pending',
    },
  });

  await notify(prisma, {
    userId: listing.farmerId,
    type: 'listing_interest',
    title: 'notification.interest.title',
    message: 'notification.interest.body',
    metadata: {
      listingId: listing.id,
      interestId: row.id,
      cropKey: listing.cropKey,
      quantity: row.quantityRequested,
      offeredPrice: row.offeredPrice,
    },
  });

  return { interest: row };
}

export async function listMyInterests(_prisma, { user } = {}) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  try {
    const rows = await prisma.marketInterest.findMany({
      where: { listing: { farmerId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { listing: true },
    });
    return { interests: rows };
  } catch {
    return { interests: [] };
  }
}

export async function respondToInterest(_prisma, { user, id, accept, note }) {
  const prisma = getPrisma(_prisma);
  if (!user?.id) throw httpErr(401, 'unauthenticated');
  const row = await prisma.marketInterest.findUnique({
    where: { id }, include: { listing: true },
  });
  if (!row) throw httpErr(404, 'interest_not_found');
  if (row.listing.farmerId !== user.id) throw httpErr(403, 'forbidden');

  const nextStatus = accept ? 'accepted' : 'declined';
  if (!canTransitionInterest(row.status, nextStatus)) throw httpErr(409, 'invalid_status');

  const updated = await prisma.marketInterest.update({
    where: { id },
    data: {
      status: nextStatus,
      farmerResponseNote: typeof note === 'string' ? note.slice(0, 500) : null,
      respondedAt: new Date(),
    },
  });

  // When accepted, we flip the listing to 'reserved' so other
  // buyers see the right state. Farmer can release it back to
  // 'active' if the sale falls through.
  if (accept && row.listing.status === 'active') {
    try {
      await prisma.cropListing.update({
        where: { id: row.listing.id }, data: { status: 'reserved' },
      });
    } catch { /* noop */ }
  }

  await notify(prisma, {
    userId: row.buyerId,
    type: accept ? 'interest_accepted' : 'interest_declined',
    title: accept ? 'notification.accepted.title' : 'notification.declined.title',
    message: accept ? 'notification.accepted.body' : 'notification.declined.body',
    metadata: {
      listingId: row.listingId,
      interestId: row.id,
      cropKey: row.listing.cropKey,
    },
  });

  return { interest: updated };
}

export { getTrustBadges } from './listingMatcher.js';
