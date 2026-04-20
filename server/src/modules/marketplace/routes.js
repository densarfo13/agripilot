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
  matchAllFlat, recordPayment, marketplaceStats,
} from './marketplaceService.js';
import mwPkg from '../../core/middleware.js';
const { requireFields, requireRole, standardResponse, asyncHandler } = mwPkg;

export function createMarketplaceRouter(opts = {}) {
  const { prisma, requireAuth, requireAdmin } = opts;
  const router = express.Router();
  const auth  = typeof requireAuth  === 'function' ? requireAuth  : (_r, _s, n) => n();
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();

  const mapReasonToStatus = (reason) => {
    if (reason === 'missing_crop' || reason === 'invalid_quantity' ||
        reason === 'invalid_price' || reason === 'missing_listing_id' ||
        reason === 'invalid_amount') return 400;
    if (reason === 'listing_not_found' || reason === 'not_available') return 409;
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
    const out = await listListings(prisma, {
      status: req.query.status || 'available',
      limit:  Number(req.query.limit) || 100,
    });
    if (!out.ok) return r.fail(out.reason);
    return r.ok(out.data);
  }));

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
    auth, requireRole(['buyer', 'admin']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      const out = await listRequests(prisma, {
        status: req.query.status || 'open',
        limit:  Number(req.query.limit) || 100,
      });
      if (!out.ok) return r.fail(out.reason);
      return r.ok(out.data);
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
