/**
 * market.js — buyer/farmer matching endpoints.
 *
 * Farmer (authenticated):
 *   POST  /api/listings                                create
 *   POST  /api/listings/from-harvest                   create pre-filled from a cycle
 *   GET   /api/farmer/listings                         my listings
 *   PATCH /api/listings/:id                            edit
 *   POST  /api/listings/:id/mark-sold
 *   POST  /api/listings/:id/close
 *   GET   /api/farmer/interests                        interests on my listings
 *   POST  /api/interests/:id/accept
 *   POST  /api/interests/:id/decline
 *   GET   /api/notifications
 *   POST  /api/notifications/:id/read
 *
 * Buyer (authenticated — any role other than 'farmer' treated as buyer;
 * in v1 any logged-in user can both list and buy unless `blockRoles`
 * restricts them):
 *   GET   /api/listings/search
 *   GET   /api/listings/:id
 *   POST  /api/listings/:id/interested
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth } from '../middleware/rbac.js';
import {
  createListing, createListingFromHarvest, listMyListings,
  updateListing, markListingSold, closeListing,
  searchListings, getListingPublic,
  expressInterest, listMyInterests, respondToInterest,
  listNotifications, markNotificationRead,
} from '../src/services/market/marketService.js';

const prisma = new PrismaClient();
const AUTH = [authenticate, requireAuth];
const router = express.Router();

function handleErr(res, err) {
  const status = err?.status || 500;
  const code = err?.code || 'internal_error';
  if (status >= 500) console.error('[market]', err);
  res.status(status).json({ error: code });
}

// ─── Farmer-facing listing CRUD ──────────────────────────
router.post('/listings', ...AUTH, express.json(), async (req, res) => {
  try { res.status(201).json(await createListing(prisma, { user: req.user, data: req.body })); }
  catch (err) { handleErr(res, err); }
});

router.post('/listings/from-harvest', ...AUTH, express.json(), async (req, res) => {
  try {
    res.status(201).json(await createListingFromHarvest(prisma, {
      user: req.user,
      cycleId: req.body?.cycleId,
      overrides: req.body?.overrides || {},
    }));
  } catch (err) { handleErr(res, err); }
});

router.get('/farmer/listings', ...AUTH, async (req, res) => {
  try { res.json(await listMyListings(prisma, { user: req.user })); }
  catch (err) { handleErr(res, err); }
});

router.patch('/listings/:id', ...AUTH, express.json(), async (req, res) => {
  try {
    res.json(await updateListing(prisma, {
      user: req.user, id: req.params.id, patch: req.body || {},
    }));
  } catch (err) { handleErr(res, err); }
});

router.post('/listings/:id/mark-sold', ...AUTH, async (req, res) => {
  try { res.json(await markListingSold(prisma, { user: req.user, id: req.params.id })); }
  catch (err) { handleErr(res, err); }
});

router.post('/listings/:id/close', ...AUTH, async (req, res) => {
  try { res.json(await closeListing(prisma, { user: req.user, id: req.params.id })); }
  catch (err) { handleErr(res, err); }
});

// ─── Buyer-facing search + detail + interest ─────────────
router.get('/listings/search', ...AUTH, async (req, res) => {
  try {
    res.json(await searchListings(prisma, {
      crop: req.query.crop, country: req.query.country, stateCode: req.query.stateCode,
      city: req.query.city, quantity: Number(req.query.quantity) || undefined,
      minQuality: req.query.minQuality, deliveryMode: req.query.deliveryMode,
    }));
  } catch (err) { handleErr(res, err); }
});

router.get('/listings/:id', ...AUTH, async (req, res) => {
  try { res.json(await getListingPublic(prisma, { id: req.params.id })); }
  catch (err) { handleErr(res, err); }
});

router.post('/listings/:id/interested', ...AUTH, express.json(), async (req, res) => {
  try {
    res.status(201).json(await expressInterest(prisma, {
      user: req.user, listingId: req.params.id, data: req.body || {},
    }));
  } catch (err) { handleErr(res, err); }
});

// ─── Interest management (farmer side) ───────────────────
router.get('/farmer/interests', ...AUTH, async (req, res) => {
  try { res.json(await listMyInterests(prisma, { user: req.user })); }
  catch (err) { handleErr(res, err); }
});

router.post('/interests/:id/accept', ...AUTH, express.json(), async (req, res) => {
  try {
    res.json(await respondToInterest(prisma, {
      user: req.user, id: req.params.id, accept: true, note: req.body?.note,
    }));
  } catch (err) { handleErr(res, err); }
});

router.post('/interests/:id/decline', ...AUTH, express.json(), async (req, res) => {
  try {
    res.json(await respondToInterest(prisma, {
      user: req.user, id: req.params.id, accept: false, note: req.body?.note,
    }));
  } catch (err) { handleErr(res, err); }
});

// ─── Notifications ───────────────────────────────────────
router.get('/notifications', ...AUTH, async (req, res) => {
  try { res.json(await listNotifications(prisma, { user: req.user })); }
  catch (err) { handleErr(res, err); }
});

router.post('/notifications/:id/read', ...AUTH, async (req, res) => {
  try { res.json(await markNotificationRead(prisma, { user: req.user, id: req.params.id })); }
  catch (err) { handleErr(res, err); }
});

export default router;
