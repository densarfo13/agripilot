/**
 * marketplaceService.js — pure service layer over the Prisma
 * marketplace models. Every function accepts an injected
 * `prisma` so tests can stub it with an in-memory fake.
 *
 * Responsibilities:
 *   createListing, listListings, createRequest, listRequests,
 *   matchAll, recordPayment, marketplaceStats
 *
 * All inputs validated. All errors produce {ok:false, reason}
 * rather than throwing so the HTTP layer can translate uniformly.
 */

import { rankMatches } from '../../core/marketplaceMatch.js';

// ─── Validators ──────────────────────────────────────────────
function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}
function positiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0;
}

// ─── Listings ────────────────────────────────────────────────
export async function createListing(prisma, input = {}) {
  if (!prisma?.produceListing?.create) return { ok: false, reason: 'no_prisma' };
  const { farmId, crop, quantity, price, pricePerUnit, location, region } = input;
  if (!nonEmptyString(crop))     return { ok: false, reason: 'missing_crop' };
  if (!positiveInt(quantity))    return { ok: false, reason: 'invalid_quantity' };
  const priceValue = price ?? pricePerUnit;
  // price is optional; when present must be non-negative number
  if (priceValue != null && (typeof priceValue !== 'number' || priceValue < 0)) {
    return { ok: false, reason: 'invalid_price' };
  }
  try {
    const row = await prisma.produceListing.create({
      data: {
        farmId:      farmId || null,
        crop:        String(crop).trim().toUpperCase(),
        quantity:    Number(quantity),
        priceFdUnit: priceValue == null ? null : Number(priceValue),
        location:    location || null,
        region:      region   || null,
        status:      'available',
      },
    });
    return { ok: true, listing: row };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

export async function listListings(prisma, { status = 'available', limit = 100 } = {}) {
  if (!prisma?.produceListing?.findMany) return { ok: false, reason: 'no_prisma', data: [] };
  try {
    const rows = await prisma.produceListing.findMany({
      where:   status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take:    Math.min(500, Math.max(1, limit)),
    });
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown', data: [] };
  }
}

// ─── Buyer requests ──────────────────────────────────────────
export async function createRequest(prisma, input = {}) {
  if (!prisma?.buyerRequest?.create) return { ok: false, reason: 'no_prisma' };
  const { buyerName, buyerId, crop, quantity, location, region } = input;
  if (!nonEmptyString(crop))  return { ok: false, reason: 'missing_crop' };
  if (!positiveInt(quantity)) return { ok: false, reason: 'invalid_quantity' };
  try {
    const row = await prisma.buyerRequest.create({
      data: {
        buyerName: buyerName || null,
        buyerId:   buyerId   || null,
        crop:      String(crop).trim().toUpperCase(),
        quantity:  Number(quantity),
        location:  location || null,
        region:    region   || null,
        status:    'open',
      },
    });
    return { ok: true, request: row };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

export async function listRequests(prisma, { status = 'open', limit = 100 } = {}) {
  if (!prisma?.buyerRequest?.findMany) return { ok: false, reason: 'no_prisma', data: [] };
  try {
    const rows = await prisma.buyerRequest.findMany({
      where:   status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take:    Math.min(500, Math.max(1, limit)),
    });
    return { ok: true, data: rows };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown', data: [] };
  }
}

// ─── Matching ────────────────────────────────────────────────
/**
 * matchAll — pure join of listings × requests using the shared
 * marketplaceMatch/rankMatches helper. Returns per-request
 * ranked candidate listings.
 *
 * Result shape:
 *   [{ request: {...}, candidates: [listing, ...] }, ...]
 */
export function matchAll(listings = [], requests = []) {
  const safeListings = Array.isArray(listings) ? listings : [];
  const safeRequests = Array.isArray(requests) ? requests : [];
  return safeRequests.map((req) => ({
    request: req,
    candidates: rankMatches(
      // Only available listings can be matched.
      safeListings.filter((l) => l && l.status === 'available'),
      req,
    ),
  }));
}

/**
 * matchAllFlat — flattened spec-shape:
 *   [{ requestId, listingId, crop }, ...]
 */
export function matchAllFlat(listings = [], requests = []) {
  const grouped = matchAll(listings, requests);
  const out = [];
  for (const { request, candidates } of grouped) {
    for (const listing of candidates) {
      out.push({
        requestId: request?.id,
        listingId: listing?.id,
        crop:      listing?.crop,
      });
    }
  }
  return out;
}

// ─── Payments (v1 simulated) ─────────────────────────────────
/**
 * recordPayment — simulated success path. Creates a payment
 * row and marks the listing as sold. Uses a transaction so a
 * listing that's already sold can't be paid for twice.
 */
export async function recordPayment(prisma, input = {}) {
  if (!prisma?.marketplacePayment?.create || !prisma?.produceListing?.update) {
    return { ok: false, reason: 'no_prisma' };
  }
  const { buyerId, listingId, amount, currency } = input;
  if (!nonEmptyString(listingId)) return { ok: false, reason: 'missing_listing_id' };
  if (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)) {
    return { ok: false, reason: 'invalid_amount' };
  }
  try {
    // Fetch listing first to validate availability.
    const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
    if (!listing)                    return { ok: false, reason: 'listing_not_found' };
    if (listing.status !== 'available') return { ok: false, reason: 'not_available' };

    // Use $transaction when available so the two writes either both
    // happen or neither does. Fall back to sequential writes in
    // test environments where $transaction isn't mocked.
    const ops = [
      prisma.produceListing.update({
        where: { id: listingId },
        data:  { status: 'sold' },
      }),
      prisma.marketplacePayment.create({
        data: {
          buyerId:   buyerId || null,
          listingId, amount: Number(amount),
          currency:  currency || null,
          status:    'completed',
        },
      }),
    ];
    let payment;
    if (typeof prisma.$transaction === 'function') {
      const results = await prisma.$transaction(ops);
      payment = results?.[1];
    } else {
      await ops[0];
      payment = await ops[1];
    }
    return { ok: true, payment };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

// ─── Admin stats ─────────────────────────────────────────────
/**
 * marketplaceStats — totals for the admin dashboard section.
 */
export async function marketplaceStats(prisma) {
  if (!prisma?.produceListing?.count) return { ok: false, reason: 'no_prisma' };
  try {
    const [total, sold, requests] = await Promise.all([
      prisma.produceListing.count(),
      prisma.produceListing.count({ where: { status: 'sold' } }),
      prisma.buyerRequest.count(),
    ]);
    return Object.freeze({
      ok: true,
      totalListings: total,
      totalSold:     sold,
      totalRequests: requests,
    });
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}
