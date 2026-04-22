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
  matchAllFlat, recordPayment, marketplaceStats,
} from './marketplaceService.js';
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
