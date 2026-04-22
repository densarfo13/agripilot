/**
 * Marketplace routes — mounted behind role middleware.
 *
 *   POST /api/marketplace/list     (farmer)   — create produce listing
 *   GET  /api/marketplace/listings (any)      — browse listings
 *   POST /api/marketplace/request  (buyer)    — create purchase request
 *   GET  /api/marketplace/requests (admin|buyer) — list requests
 *   GET  /api/marketplace/matches  (admin)    — ranked listing×request matches
 *   POST /api/payments/initiate    (buyer)    — simulate payment + mark sold
 *   GET  /api/admin/marketplace-stats (admin) — totals for dashboard
 *
 * All handlers route via asyncHandler → standardResponse so the
 * wire contract is `{success, data | error}`.
 */

import express from 'express';
import {
  createListing, listListings,
  createRequest, listRequests,
  acceptRequest, declineRequest, updateListingStatus,
  listIncomingRequestsForFarmer,
  recordBulkResponse, computeBulkRollup,
  matchAllFlat, recordPayment, marketplaceStats,
} from './marketplaceService.js';
import { buildPriceInsight } from './priceInsights.js';
import { buildBulkLots, buildBulkLotById } from './bulkAggregation.js';
import mwPkg from '../../core/middleware.js';
import { requireFeature } from '../../core/featureGuard.js';
const { requireFields, requireRole, standardResponse, asyncHandler } = mwPkg;

export function createMarketplaceRouter(opts = {}) {
  const { prisma, requireAuth, requireAdmin } = opts;
  const router = express.Router();
  // Feature-flag the ENTIRE marketplace surface. When
  // FEATURES.marketplace is false (the default), every request
  // under this router returns 404 — same as if it didn't exist.
  router.use(requireFeature('marketplace', { isEnabled: opts.isEnabled }));
  const auth  = typeof requireAuth  === 'function' ? requireAuth  : (_r, _s, n) => n();
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();

  const mapReasonToStatus = (reason) => {
    if (reason === 'missing_crop' || reason === 'invalid_quantity' ||
        reason === 'invalid_price' || reason === 'missing_listing_id' ||
        reason === 'missing_request_id' || reason === 'invalid_amount' ||
        reason === 'invalid_status' || reason === 'invalid_transition') return 400;
    if (reason === 'listing_not_found' || reason === 'request_not_found') return 404;
    if (reason === 'not_available' || reason === 'already_accepted'
        || reason === 'already_declined') return 409;
    return 500;
  };

  // ─── Listings (farmer side) ─────────────────────────────
  router.post('/list',
    auth,
    requireRole(['farmer', 'admin']),
    requireFields(['crop', 'quantity']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await createListing(prisma, req.body || {});
      if (!out.ok) return r.fail(out.reason, mapReasonToStatus(out.reason));
      return r.ok(out.listing);
    }),
  );

  router.get('/listings', asyncHandler(async (req, res) => {
    const r = standardResponse(res);
    // Accept spec statuses (active/requested/completed) OR legacy
    // DB statuses (available/reserved/sold); service maps either.
    const out = await listListings(prisma, {
      status: req.query.status || 'active',
      crop:   req.query.crop   || null,
      region: req.query.region || null,
      limit:  Number(req.query.limit) || 100,
    });
    if (!out.ok) return r.fail(out.reason);
    return r.ok(out.data);
  }));

  // PATCH /listings/:id/status — farmer transitions the listing.
  // Accepts spec statuses (active/requested/completed/cancelled).
  router.patch('/listings/:id/status',
    auth,
    requireRole(['farmer', 'admin']),
    requireFields(['status']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await updateListingStatus(prisma, {
        listingId: req.params.id,
        status:    req.body.status,
      });
      if (!out.ok) return r.fail(out.reason, mapReasonToStatus(out.reason));
      return r.ok(out.listing);
    }),
  );

  // ─── Requests (buyer side) ──────────────────────────────
  router.post('/request',
    auth,
    requireRole(['buyer', 'admin']),
    requireFields(['crop', 'quantity']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await createRequest(prisma, req.body || {});
      if (!out.ok) return r.fail(out.reason, mapReasonToStatus(out.reason));
      return r.ok(out.request);
    }),
  );

  router.get('/requests',
    auth, requireRole(['buyer', 'farmer', 'admin']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await listRequests(prisma, {
        status:  req.query.status  || 'pending',
        buyerId: req.query.buyerId || null,
        crop:    req.query.crop    || null,
        limit:   Number(req.query.limit) || 100,
      });
      if (!out.ok) return r.fail(out.reason);
      return r.ok(out.data);
    }),
  );

  // GET /requests/incoming — farmer inbox. Returns all requests
  // placed against listings owned by the authenticated farmer,
  // derived from the marketplace.request.created FarmerNotification
  // trail. Optional ?status=pending|accepted|declined filter.
  router.get('/requests/incoming',
    auth, requireRole(['farmer', 'admin']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      // Resolve farmerId from the authenticated user. req.user.sub is
      // the userId; farmerId lives on the Farmer row keyed by userId.
      let farmerId = req.query.farmerId || null;
      if (!farmerId && req.user && req.user.sub && prisma?.farmer?.findFirst) {
        const farmer = await prisma.farmer.findFirst({
          where:  { userId: req.user.sub },
          select: { id: true },
        });
        farmerId = farmer ? farmer.id : null;
      }
      if (!farmerId) return r.fail('missing_farmer_id', 400);

      const out = await listIncomingRequestsForFarmer(prisma, {
        farmerId,
        status: req.query.status || 'pending',
        limit:  Number(req.query.limit) || 100,
      });
      if (!out.ok) return r.fail(out.reason);
      return r.ok(out.data);
    }),
  );

  // PATCH /requests/:requestId/bulk-response — participating farmer
  // responds to a bulk request with accepted|declined. Unlike the
  // single-request status endpoint, this records the response on
  // THIS farmer's notification only; other farmers' state is
  // preserved. The parent BuyerRequest flips to matched/cancelled
  // only when every contributor has responded.
  // Body: { notificationId, response: 'accepted'|'declined' }
  router.patch('/requests/:requestId/bulk-response',
    auth,
    requireRole(['farmer', 'admin']),
    requireFields(['notificationId', 'response']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      // Resolve farmerId from authenticated user.
      let farmerId = null;
      if (req.user && req.user.sub && prisma?.farmer?.findFirst) {
        const farmer = await prisma.farmer.findFirst({
          where: { userId: req.user.sub }, select: { id: true },
        });
        farmerId = farmer ? farmer.id : null;
      }
      if (!farmerId) return r.fail('missing_farmer_id', 400);
      const out = await recordBulkResponse(prisma, {
        notificationId: req.body.notificationId,
        farmerId,
        response:       req.body.response,
      });
      if (!out.ok) {
        const status =
          out.reason === 'notification_not_found' ? 404
        : out.reason === 'forbidden'              ? 403
        : out.reason === 'not_a_bulk_request'     ? 400
        : out.reason === 'invalid_response'       ? 400
        : out.reason === 'already_responded'      ? 409
                                                    : 500;
        return r.fail(out.reason, status);
      }
      return r.ok(out);
    }),
  );

  // GET /requests/:requestId/bulk-status — public-ish rollup so the
  // buyer can see "2/3 farmers accepted" without trawling through
  // notification metadata client-side.
  router.get('/requests/:requestId/bulk-status',
    auth,
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const rollup = await computeBulkRollup(prisma, req.params.requestId);
      if (!rollup) return r.fail('no_prisma', 500);
      return r.ok(rollup);
    }),
  );

  // PATCH /requests/:id/status — farmer accepts or declines a request.
  // Body: { status: 'accepted' | 'declined', listingId? }
  // When status=accepted AND listingId is provided, the linked
  // listing flips to 'reserved' in the same transaction.
  router.patch('/requests/:id/status',
    auth,
    requireRole(['farmer', 'admin']),
    requireFields(['status']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const next = String(req.body.status || '').toLowerCase();
      let out;
      if (next === 'accepted') {
        out = await acceptRequest(prisma, {
          requestId: req.params.id,
          listingId: req.body.listingId || null,
        });
      } else if (next === 'declined') {
        out = await declineRequest(prisma, { requestId: req.params.id });
      } else {
        return r.fail('invalid_status', 400);
      }
      if (!out.ok) return r.fail(out.reason, mapReasonToStatus(out.reason));
      return r.ok(out.request);
    }),
  );

  // ─── Price insights ─────────────────────────────────────
  // GET /prices/insight?crop=maize&country=GH&region=AS&windowDays=30
  // Public (no auth) so buyers + farmers + prospective users all
  // see the same number. Accepts `windowDays` between 7 and 90.
  router.get('/prices/insight',
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const crop = String(req.query.crop || '').trim();
      if (!crop) return r.fail('missing_crop', 400);
      const days = Math.min(90, Math.max(7, Number(req.query.windowDays) || 30));
      const insight = await buildPriceInsight(prisma, {
        crop,
        country:    req.query.country || null,
        region:     req.query.region  || null,
        windowDays: days,
      });
      return r.ok(insight);
    }),
  );

  // ─── Bulk lots ──────────────────────────────────────────
  // GET /bulk-lots — derive bulk lots from available listings.
  // Public so buyers + prospective users can browse; no PII is
  // exposed (contributor farmId is opaque).
  router.get('/bulk-lots',
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const lots = await buildBulkLots(prisma, {
        crop:              req.query.crop   || null,
        country:           req.query.country || null,
        region:            req.query.region || null,
        windowDays:        Math.min(60, Math.max(3, Number(req.query.windowDays)  || 14)),
        pickupWindowDays:  Math.min(30, Math.max(1, Number(req.query.pickupDays)  || 7)),
        minContributors:   Math.min(10, Math.max(2, Number(req.query.minContrib) || 2)),
      });
      // Attach a per-lot price signal so the buyer UI can show a
      // range without a second round-trip per card.
      const enriched = [];
      for (const lot of lots) {
        let priceSignal = null;
        try {
          const ins = await buildPriceInsight(prisma, {
            crop: lot.crop, country: lot.country, region: lot.region,
            windowDays: 30,
          });
          if (ins && ins.suggested) {
            priceSignal = Object.freeze({
              currency: ins.currency,
              low:      ins.suggested.low,
              high:     ins.suggested.high,
              typical:  ins.suggested.typical,
              source:   ins.source,
            });
          }
        } catch (_) { priceSignal = null; }
        enriched.push({ ...lot, priceSignal });
      }
      return r.ok(enriched);
    }),
  );

  // POST /bulk-lots/:lotId/request — buyer requests an entire lot.
  // Creates ONE BuyerRequest (with metadata.kind='bulk_request' +
  // contributorListingIds) and fires one FarmerNotification per
  // participating farmer so they each see it in their inbox.
  router.post('/bulk-lots/:lotId/request',
    auth,
    requireRole(['buyer', 'admin']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const lot = await buildBulkLotById(prisma, req.params.lotId);
      if (!lot) return r.fail('lot_not_found', 404);

      const { buyerName, buyerId, message, pickupPoint } = req.body || {};
      if (!prisma?.buyerRequest?.create) return r.fail('no_prisma', 500);

      // Record the bulk request as a single BuyerRequest with the
      // lot's total quantity. Farmers see their share via the
      // per-farmer FarmerNotification below.
      // Buyer-supplied pickup point takes precedence over the lot's
      // default location. We store it on the request row so
      // buyer-side history shows "Pickup at X" without needing a
      // metadata lookup, and we also mirror it into the per-farmer
      // notifications below.
      const resolvedPickup = (typeof pickupPoint === 'string' && pickupPoint.trim())
        ? pickupPoint.trim()
        : (lot.location || null);

      const request = await prisma.buyerRequest.create({
        data: {
          buyerName: buyerName || null,
          buyerId:   buyerId   || null,
          crop:      lot.crop,
          quantity:  Math.max(1, Math.round(lot.totalQuantity)),
          location:  resolvedPickup,
          region:    lot.region   || null,
          status:    'open',
        },
      });

      // Notify every contributing farmer. Reuse the same metadata
      // kind the single-listing path uses so IncomingRequestsList
      // picks these up without modification; add a isBulk flag +
      // lotId so the UI can show "Bulk lot" when available.
      if (prisma?.farm?.findMany && prisma?.farmerNotification?.create) {
        const farmIds = Array.from(new Set(
          lot.contributors.map((c) => c.farmId),
        ));
        const farms = farmIds.length > 0
          ? await prisma.farm.findMany({
              where: { id: { in: farmIds } },
              select: { id: true, farmerId: true },
            })
          : [];
        const farmerIdByFarmId = new Map(farms.map((f) => [f.id, f.farmerId]));
        for (const c of lot.contributors) {
          const farmerId = farmerIdByFarmId.get(c.farmId);
          if (!farmerId) continue;
          try {
            await prisma.farmerNotification.create({
              data: {
                farmerId,
                notificationType: 'market',
                title:   'New bulk buyer interest',
                message: `${buyerName || 'A buyer'} wants a bulk lot of ${lot.totalQuantity} kg of ${lot.crop}. Your share: ${c.quantity} kg.`,
                metadata: {
                  kind:       'marketplace.request.created',
                  isBulk:     true,
                  lotId:      lot.lotId,
                  requestId:  request.id,
                  buyerId:    buyerId   || null,
                  buyerName:  buyerName || null,
                  crop:       lot.crop,
                  quantity:   c.quantity,
                  lotTotal:   lot.totalQuantity,
                  contributors: lot.contributors.length,
                  pickupWindow: lot.pickupWindow,
                  pickupPoint: resolvedPickup,
                  listingIds: c.listingIds,
                  message:    message || null,
                  // Per-farmer response state. Transitions to
                  // 'accepted' | 'declined' via bulk-response route.
                  bulkResponse: 'pending',
                },
              },
            });
          } catch (_) { /* non-fatal per-farmer failure */ }
        }
      }

      return r.ok({
        request,
        lotId:        lot.lotId,
        contributors: lot.contributors.length,
        totalQuantity: lot.totalQuantity,
      });
    }),
  );

  // ─── Matches (admin view) ───────────────────────────────
  router.get('/matches',
    auth, admin,
    asyncHandler(async (_req, res) => {
      const r = standardResponse(res);
      const [L, R] = await Promise.all([
        listListings(prisma, { status: 'available', limit: 500 }),
        listRequests(prisma, { status: 'open',      limit: 500 }),
      ]);
      if (!L.ok || !R.ok) return r.fail('matches_load_failed');
      return r.ok(matchAllFlat(L.data, R.data));
    }),
  );

  return router;
}

/**
 * createPaymentsRouter — spec §10 simulated payment layer.
 *   POST /api/payments/initiate → marks listing sold + creates
 *   payment row. For now, always "succeeds" per spec. Behind
 *   auth so only buyers (or admin) can invoke.
 */
export function createPaymentsRouter(opts = {}) {
  const { prisma, requireAuth } = opts;
  const router = express.Router();
  // Payments only exist in the marketplace flow. Gate the same way
  // so disabling marketplace also disables all payment endpoints.
  router.use(requireFeature('marketplace', { isEnabled: opts.isEnabled }));
  const auth = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();

  router.post('/initiate',
    auth,
    requireRole(['buyer', 'admin']),
    requireFields(['listingId', 'amount']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await recordPayment(prisma, req.body || {});
      if (!out.ok) {
        const status =
          out.reason === 'listing_not_found' ? 404 :
          out.reason === 'not_available'      ? 409 :
          out.reason === 'invalid_amount'     ? 400 : 500;
        return res.status(status).json({ success: false, error: out.reason });
      }
      return r.ok(out.payment);
    }),
  );

  return router;
}

/**
 * createAdminMarketplaceStatsRouter — exposes /api/admin/marketplace-stats.
 * Kept separate so the admin app can mount it alongside other admin routes.
 */
export function createAdminMarketplaceStatsRouter(opts = {}) {
  const { prisma, requireAdmin } = opts;
  const router = express.Router();
  // Admin stats are a marketplace view — hide them entirely when
  // the feature is disabled. The AdminDashboard already tolerates
  // 404 on this endpoint and keeps the section hidden.
  router.use(requireFeature('marketplace', { isEnabled: opts.isEnabled }));
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();

  router.get('/marketplace-stats', admin, asyncHandler(async (_req, res) => {
    const r = standardResponse(res);
    const s = await marketplaceStats(prisma);
    if (!s.ok) return r.fail(s.reason);
    return r.ok(s);
  }));

  return router;
}

export default {
  createMarketplaceRouter,
  createPaymentsRouter,
  createAdminMarketplaceStatsRouter,
};
