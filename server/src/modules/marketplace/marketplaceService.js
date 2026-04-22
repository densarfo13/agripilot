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

/**
 * ─── Status mapping ──────────────────────────────────────────
 * Spec talks in human-friendly statuses (active/requested/completed
 * for listings; pending/accepted/declined for requests). The DB uses
 * the older codes (available/reserved/sold; open/matched/cancelled).
 * These maps are the only place we translate — one source of truth.
 */
export const LISTING_STATUS_SPEC_TO_DB = Object.freeze({
  active:    'available',
  requested: 'reserved',
  completed: 'sold',
  cancelled: 'cancelled',
});
export const LISTING_STATUS_DB_TO_SPEC = Object.freeze({
  available: 'active',
  reserved:  'requested',
  sold:      'completed',
  cancelled: 'cancelled',
});
export const REQUEST_STATUS_SPEC_TO_DB = Object.freeze({
  pending:  'open',
  accepted: 'matched',
  declined: 'cancelled',
});
export const REQUEST_STATUS_DB_TO_SPEC = Object.freeze({
  open:      'pending',
  matched:   'accepted',
  cancelled: 'declined',
  fulfilled: 'accepted',
});

export function mapListingToSpec(row) {
  if (!row) return row;
  const spec = LISTING_STATUS_DB_TO_SPEC[row.status] || row.status;
  return { ...row, status: spec, statusDb: row.status };
}
export function mapRequestToSpec(row) {
  if (!row) return row;
  const spec = REQUEST_STATUS_DB_TO_SPEC[row.status] || row.status;
  return { ...row, status: spec, statusDb: row.status };
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
    return { ok: true, listing: mapListingToSpec(row) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

export async function listListings(prisma, { status = 'available', crop = null, region = null, limit = 100 } = {}) {
  if (!prisma?.produceListing?.findMany) return { ok: false, reason: 'no_prisma', data: [] };
  // Translate spec status → DB status if the caller passed a spec term.
  const dbStatus = LISTING_STATUS_SPEC_TO_DB[status] || status;
  try {
    const where = dbStatus === 'all' ? {} : { status: dbStatus };
    if (crop && nonEmptyString(crop)) {
      where.crop = String(crop).trim().toUpperCase();
    }
    if (region && nonEmptyString(region)) {
      // Case-insensitive region match so buyers don't have to know
      // the exact storage format (e.g. "Ashanti" vs "ashanti").
      where.region = { equals: String(region).trim(), mode: 'insensitive' };
    }
    const rows = await prisma.produceListing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    Math.min(500, Math.max(1, limit)),
    });
    return { ok: true, data: rows.map(mapListingToSpec) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown', data: [] };
  }
}

// ─── Buyer requests ──────────────────────────────────────────
/**
 * createRequest — buyer expresses interest in a produce listing.
 *
 *   input:
 *     listingId?  — when provided, the request snapshots crop /
 *                   quantity / location / region from the listing
 *                   so UI + analytics can correlate, AND the
 *                   farmer who owns the listing is notified.
 *     buyerId?    — user id of the buyer (authenticated caller)
 *     buyerName?  — display name for the notification
 *     crop, quantity, location, region — all optional when
 *                   listingId is supplied.
 *
 *   Side effects when listingId resolves:
 *     1. FarmerNotification row created on the listing's farmer
 *        with metadata { listingId, requestId, buyerName, crop }.
 *        The notifications UI already handles 'market' type.
 *     2. No DB schema changes — the listing↔request link is carried
 *        through notification.metadata (JSON), which is the spec
 *        §4 "notify farmer (in-app)" requirement. Accept / decline
 *        transitions (below) flip the listing status so the
 *        correlation stays visible in both directions.
 */
export async function createRequest(prisma, input = {}) {
  if (!prisma?.buyerRequest?.create) return { ok: false, reason: 'no_prisma' };
  const { buyerName, buyerId, listingId } = input;
  let { crop, quantity, location, region } = input;

  // ── Listing snapshot: pull crop/quantity/region from the listing
  //    if caller supplied a listingId. Makes the request record
  //    self-contained even if the listing is later edited / closed.
  let listing = null;
  if (nonEmptyString(listingId)) {
    if (!prisma?.produceListing?.findUnique) return { ok: false, reason: 'no_prisma' };
    listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
    if (!listing) return { ok: false, reason: 'listing_not_found' };
    if (listing.status !== 'available') {
      return { ok: false, reason: 'not_available' };
    }
    crop     = crop     || listing.crop;
    quantity = quantity || listing.quantity;
    location = location || listing.location;
    region   = region   || listing.region;
  }

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

    // ── Notify the farmer (if we resolved a listing and can locate
    //    the owning farmer via the farm → farmer relation). Best-
    //    effort: notification failure doesn't fail the request.
    if (listing && listing.farmId
        && prisma?.farm?.findUnique
        && prisma?.farmerNotification?.create) {
      try {
        const farm = await prisma.farm.findUnique({
          where: { id: listing.farmId },
          select: { farmerId: true },
        });
        if (farm && farm.farmerId) {
          await prisma.farmerNotification.create({
            data: {
              farmerId:         farm.farmerId,
              notificationType: 'market',
              title:            'New buyer interest',
              message: `${buyerName || 'A buyer'} wants ${row.quantity} kg of ${row.crop}.`,
              metadata: {
                kind:       'marketplace.request.created',
                listingId:  listing.id,
                requestId:  row.id,
                buyerId:    buyerId || null,
                buyerName:  buyerName || null,
                crop:       row.crop,
                quantity:   row.quantity,
              },
            },
          });
        }
      } catch (_notifyErr) {
        // Non-fatal: request is recorded even if notification fails.
      }
    }

    return {
      ok: true,
      request: mapRequestToSpec(row),
      listingId: listing ? listing.id : null,
    };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

// ─── Status transitions (spec §4) ────────────────────────────
/**
 * acceptRequest — farmer accepts an incoming buyer request.
 *   • Request status: pending → accepted (DB: open → matched)
 *   • Linked listing (via most-recent marketplace.request.created
 *     notification's metadata): active → requested (DB: available
 *     → reserved).
 *
 * The two writes run in a $transaction when available so the states
 * stay consistent.
 */
export async function acceptRequest(prisma, { requestId, listingId } = {}) {
  if (!prisma?.buyerRequest?.update) return { ok: false, reason: 'no_prisma' };
  if (!nonEmptyString(requestId))     return { ok: false, reason: 'missing_request_id' };
  try {
    const existing = await prisma.buyerRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { ok: false, reason: 'request_not_found' };
    if (existing.status === 'matched' || existing.status === 'fulfilled') {
      return { ok: false, reason: 'already_accepted' };
    }
    if (existing.status === 'cancelled') {
      return { ok: false, reason: 'already_declined' };
    }

    const ops = [
      prisma.buyerRequest.update({
        where: { id: requestId },
        data:  { status: 'matched' },
      }),
    ];
    if (nonEmptyString(listingId) && prisma?.produceListing?.update) {
      ops.push(prisma.produceListing.update({
        where: { id: listingId },
        data:  { status: 'reserved' },
      }));
    }
    let updated;
    if (typeof prisma.$transaction === 'function') {
      const [r] = await prisma.$transaction(ops);
      updated = r;
    } else {
      updated = await ops[0];
      if (ops[1]) await ops[1];
    }
    return { ok: true, request: mapRequestToSpec(updated) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

/**
 * declineRequest — farmer declines a buyer request.
 *   • Request status: pending → declined (DB: open → cancelled)
 *   • Linked listing stays active (farmer may still accept other
 *     requests). No listing status change on decline.
 */
export async function declineRequest(prisma, { requestId } = {}) {
  if (!prisma?.buyerRequest?.update) return { ok: false, reason: 'no_prisma' };
  if (!nonEmptyString(requestId))     return { ok: false, reason: 'missing_request_id' };
  try {
    const existing = await prisma.buyerRequest.findUnique({ where: { id: requestId } });
    if (!existing) return { ok: false, reason: 'request_not_found' };
    if (existing.status === 'cancelled') {
      return { ok: false, reason: 'already_declined' };
    }
    const updated = await prisma.buyerRequest.update({
      where: { id: requestId },
      data:  { status: 'cancelled' },
    });
    return { ok: true, request: mapRequestToSpec(updated) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

/**
 * updateListingStatus — farmer transitions their listing.
 *   • active → requested  — when a request is accepted
 *   • requested → completed — when the sale closes
 *   • any → cancelled        — farmer withdraws the listing
 *
 * Accepts SPEC statuses (active/requested/completed/cancelled) and
 * translates to DB (available/reserved/sold/cancelled). Rejects
 * unknown transitions up front so bad inputs don't slip into the DB.
 */
const ALLOWED_LISTING_TRANSITIONS = Object.freeze({
  available: new Set(['reserved', 'cancelled']),
  reserved:  new Set(['available', 'sold', 'cancelled']),
  sold:      new Set([]),        // terminal
  cancelled: new Set([]),        // terminal
});
export async function updateListingStatus(prisma, { listingId, status } = {}) {
  if (!prisma?.produceListing?.update) return { ok: false, reason: 'no_prisma' };
  if (!nonEmptyString(listingId))      return { ok: false, reason: 'missing_listing_id' };
  const dbStatus = LISTING_STATUS_SPEC_TO_DB[status] || status;
  if (!['available', 'reserved', 'sold', 'cancelled'].includes(dbStatus)) {
    return { ok: false, reason: 'invalid_status' };
  }
  try {
    const listing = await prisma.produceListing.findUnique({ where: { id: listingId } });
    if (!listing) return { ok: false, reason: 'listing_not_found' };
    const allowed = ALLOWED_LISTING_TRANSITIONS[listing.status] || new Set();
    if (!allowed.has(dbStatus)) {
      return { ok: false, reason: 'invalid_transition' };
    }
    const updated = await prisma.produceListing.update({
      where: { id: listingId },
      data:  { status: dbStatus },
    });
    return { ok: true, listing: mapListingToSpec(updated) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

export async function listRequests(prisma, { status = 'open', buyerId = null, crop = null, limit = 100 } = {}) {
  if (!prisma?.buyerRequest?.findMany) return { ok: false, reason: 'no_prisma', data: [] };
  const dbStatus = REQUEST_STATUS_SPEC_TO_DB[status] || status;
  try {
    const where = dbStatus === 'all' ? {} : { status: dbStatus };
    if (nonEmptyString(buyerId)) where.buyerId = buyerId;
    if (nonEmptyString(crop))    where.crop    = String(crop).trim().toUpperCase();
    const rows = await prisma.buyerRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take:    Math.min(500, Math.max(1, limit)),
    });
    return { ok: true, data: rows.map(mapRequestToSpec) };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown', data: [] };
  }
}

// ─── Farmer inbox: incoming requests ─────────────────────────
/**
 * listIncomingRequestsForFarmer(prisma, { farmerId, status? })
 *
 * Returns the buyer requests routed to this farmer's listings
 * (via the marketplace.request.created FarmerNotification trail).
 * Without a listingId FK on BuyerRequest we derive the join from
 * notification metadata, so the view is always consistent with
 * the spec-defined linkage even while the schema stays migration-
 * free.
 *
 * Result shape:
 *   {
 *     ok: true,
 *     data: [
 *       {
 *         request:  BuyerRequest (spec-mapped status),
 *         listingId: id of the listing the request was placed
 *                     against (from notification metadata),
 *         notificationId: id of the farmer notification that
 *                         surfaced the request,
 *         buyerName, crop, quantity,
 *         createdAt:     when the notification was created
 *                        (mirrors when the request was placed),
 *       },
 *       ...
 *     ]
 *   }
 *
 * Filters:
 *   status? — 'pending' | 'accepted' | 'declined' | 'all'
 *             Filters on the request's spec-status. Default 'pending'.
 */
export async function listIncomingRequestsForFarmer(prisma, { farmerId, status = 'pending', limit = 100 } = {}) {
  if (!prisma?.farmerNotification?.findMany) return { ok: false, reason: 'no_prisma', data: [] };
  if (!nonEmptyString(farmerId)) return { ok: false, reason: 'missing_farmer_id', data: [] };

  const dbStatus = REQUEST_STATUS_SPEC_TO_DB[status] || status;
  try {
    // 1. Pull market notifications that signalled a buyer request.
    //    We over-fetch (limit × 2) so the post-filter by request
    //    status still returns a full page most of the time.
    const notifications = await prisma.farmerNotification.findMany({
      where: {
        farmerId,
        notificationType: 'market',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(500, Math.max(1, limit * 2)),
    });

    // 2. Extract requestIds from notifications that look like
    //    marketplace.request.created events. Tolerate stringified
    //    JSON metadata (some DBs roundtrip that way).
    const entries = notifications
      .map((n) => {
        let meta = n.metadata;
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta); } catch { meta = null; }
        }
        if (!meta || meta.kind !== 'marketplace.request.created') return null;
        return {
          notificationId: n.id,
          createdAt:      n.createdAt,
          requestId:      meta.requestId,
          listingId:      meta.listingId || null,
          buyerName:      meta.buyerName || null,
          crop:           meta.crop      || null,
          quantity:       meta.quantity  || null,
          // Bulk-lot fields (present when the request came via the
          // bulk-lot fan-out; null otherwise).
          isBulk:       meta.isBulk || false,
          lotId:        meta.lotId || null,
          lotTotal:     meta.lotTotal || null,
          contributors: meta.contributors || null,
          pickupWindow: meta.pickupWindow || null,
          pickupPoint:  meta.pickupPoint || null,
          // Per-farmer bulk response state: pending | accepted | declined
          myResponse:   meta.bulkResponse || (meta.isBulk ? 'pending' : null),
        };
      })
      .filter((e) => e && nonEmptyString(e.requestId));

    if (entries.length === 0) return { ok: true, data: [] };

    // 3. Fetch the BuyerRequest rows in one round-trip.
    const requestIds = Array.from(new Set(entries.map((e) => e.requestId)));
    const rows = prisma?.buyerRequest?.findMany
      ? await prisma.buyerRequest.findMany({ where: { id: { in: requestIds } } })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));

    // 4. Assemble result, apply status filter.
    //
    // Filter semantics:
    //   • Non-bulk rows filter on the parent BuyerRequest's status
    //     (legacy behaviour preserved).
    //   • Bulk rows filter on THIS farmer's own response state
    //     (myResponse). This is essential — a bulk parent stays
    //     'open' until every farmer responds, but an individual
    //     farmer who already accepted should not see their own
    //     accepted row under the 'pending' filter.
    const specStatus = status; // 'pending' | 'accepted' | 'declined' | 'all'
    const data = [];
    for (const e of entries) {
      const row = byId.get(e.requestId);
      if (!row) continue;
      if (specStatus !== 'all') {
        if (e.isBulk) {
          const my = e.myResponse || 'pending';
          if (my !== specStatus) continue;
        } else if (dbStatus !== row.status) {
          continue;
        }
      }
      data.push({
        request:        mapRequestToSpec(row),
        listingId:      e.listingId,
        notificationId: e.notificationId,
        buyerName:      e.buyerName || row.buyerName,
        crop:           row.crop,
        // For bulk requests `e.quantity` is the farmer's SHARE
        // (from notification metadata), not the full BuyerRequest
        // quantity. Surface the farmer share so the UI can display
        // "Your share: 50 kg of 250 kg".
        quantity:       e.quantity || row.quantity,
        createdAt:      e.createdAt,
        isBulk:       e.isBulk,
        lotId:        e.lotId,
        lotTotal:     e.lotTotal,
        contributors: e.contributors,
        pickupWindow: e.pickupWindow,
        pickupPoint:  e.pickupPoint,
        myResponse:   e.myResponse,
      });
      if (data.length >= limit) break;
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown', data: [] };
  }
}

// ─── Bulk request per-farmer responses ───────────────────────
/**
 * recordBulkResponse(prisma, { notificationId, farmerId, response })
 *
 *   One participating farmer's accept / decline of a bulk request.
 *   Response is stored on the farmer's own notification (so each
 *   farmer has an independent state). When the final farmer responds,
 *   the parent BuyerRequest is rolled forward:
 *     • all 'accepted' → request → 'matched'
 *     • any 'declined' (after all respond) → request → 'cancelled'
 *     • mixed → request stays 'open' (buyer can accept partial
 *       fulfillment off-platform; we don't auto-close)
 *
 *   Returns:
 *     { ok:true, response, lotStatus: {
 *         totalContributors, accepted, declined, pending,
 *         parentStatus: 'open'|'matched'|'cancelled'
 *       }
 *     }
 */
export async function recordBulkResponse(prisma, { notificationId, farmerId, response } = {}) {
  if (!prisma?.farmerNotification?.findUnique
      || !prisma?.farmerNotification?.update) return { ok: false, reason: 'no_prisma' };
  if (!nonEmptyString(notificationId)) return { ok: false, reason: 'missing_notification_id' };
  if (!nonEmptyString(farmerId))       return { ok: false, reason: 'missing_farmer_id' };
  const normalized = String(response || '').toLowerCase();
  if (!['accepted', 'declined'].includes(normalized)) {
    return { ok: false, reason: 'invalid_response' };
  }

  try {
    const notification = await prisma.farmerNotification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) return { ok: false, reason: 'notification_not_found' };
    if (notification.farmerId !== farmerId) {
      return { ok: false, reason: 'forbidden' };
    }

    let meta = notification.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (!meta || meta.kind !== 'marketplace.request.created' || !meta.isBulk) {
      return { ok: false, reason: 'not_a_bulk_request' };
    }
    if (meta.bulkResponse && meta.bulkResponse !== 'pending') {
      return { ok: false, reason: 'already_responded' };
    }

    const nextMeta = { ...meta, bulkResponse: normalized,
                        respondedAt: new Date().toISOString() };
    await prisma.farmerNotification.update({
      where: { id: notificationId },
      data:  { metadata: nextMeta, read: true },
    });

    // Roll-up across all farmer notifications for this request.
    const rollup = await computeBulkRollup(prisma, meta.requestId);

    // Parent request transition when every farmer has responded.
    if (rollup && rollup.pending === 0 && rollup.totalContributors > 0
        && prisma?.buyerRequest?.update) {
      try {
        const existing = await prisma.buyerRequest.findUnique({ where: { id: meta.requestId } });
        if (existing && existing.status === 'open') {
          const nextStatus = rollup.declined === 0 ? 'matched' : 'cancelled';
          await prisma.buyerRequest.update({
            where: { id: meta.requestId },
            data:  { status: nextStatus },
          });
          rollup.parentStatus = nextStatus;
        } else {
          rollup.parentStatus = existing ? existing.status : null;
        }
      } catch (_) { /* non-fatal */ }
    } else if (rollup) {
      rollup.parentStatus = 'open';
    }

    return { ok: true, response: normalized, lotStatus: rollup };
  } catch (err) {
    return { ok: false, reason: 'db_failed', message: err?.message || 'unknown' };
  }
}

/**
 * computeBulkRollup(prisma, requestId)
 *   Aggregates bulkResponse across every FarmerNotification tied to
 *   this request. Silent on missing prisma; returns null.
 */
export async function computeBulkRollup(prisma, requestId) {
  if (!prisma?.farmerNotification?.findMany || !nonEmptyString(requestId)) return null;
  const notifications = await prisma.farmerNotification.findMany({
    where: { notificationType: 'market' },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  let accepted = 0, declined = 0, pending = 0, total = 0;
  for (const n of notifications) {
    let meta = n.metadata;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (!meta || meta.kind !== 'marketplace.request.created'
        || !meta.isBulk || meta.requestId !== requestId) continue;
    total += 1;
    const r = meta.bulkResponse;
    if (r === 'accepted')      accepted += 1;
    else if (r === 'declined') declined += 1;
    else                        pending += 1;
  }
  return { totalContributors: total, accepted, declined, pending, parentStatus: null };
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
