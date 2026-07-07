/**
 * adminBasic.js — minimal admin endpoints for Phase 6 restore.
 *
 *   GET  /api/v2/admin/overview              — 4 summary cards
 *   GET  /api/v2/admin/activity              — last 20 event-log entries
 *   PATCH /api/v2/admin/listings/:id/status  — pause or unpause a listing
 *   PATCH /api/v2/admin/requests/:id/review  — mark a buyer request reviewed
 *
 * All endpoints are role-gated: super_admin | institutional_admin | admin.
 * Non-admins receive 403. No org-scoping needed — admins see all orgs.
 *
 * Phase 6 spec §Security:
 *   • requireAuth (401 if no session)
 *   • requireRole('super_admin', 'institutional_admin', 'admin') (403 on fail)
 *   • No cross-user PII beyond userId in EventLog metadata
 *   • Moderation actions are logged to EventLog for auditability
 */
import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';

const router = express.Router();

// Role guard: only true admins may call these routes.
// 'admin' alias is normalised by rbac.js; super_admin + institutional_admin
// are the canonical server-side admin role names.
const ADMIN_SCOPE = [
  authenticate,
  requireAuth,
  requireRole('super_admin', 'institutional_admin', 'admin'),
];

// ─── GET /api/v2/admin/overview ────────────────────────────
// Returns the 4 overview card values for the admin dashboard.
// All counts are live queries — cheap enough for admin-scale calls.
router.get('/overview', ...ADMIN_SCOPE, async (_req, res) => {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);

  const [totalUsers, activeUsers24h, totalListings, openRequests] = await Promise.all([
    // All users ever created (including archived/inactive).
    prisma.user.count(),

    // Users who logged in within the last 24 h.
    prisma.user.count({
      where: { lastLoginAt: { gte: cutoff24h } },
    }),

    // Listings currently live or reserved (not drafts, not closed/sold).
    prisma.cropListing.count({
      where: { status: { in: ['active', 'reserved'] } },
    }).catch(() => 0),

    // Buyer requests awaiting farmer response.
    prisma.marketInterest.count({
      where: { status: 'pending' },
    }).catch(() => 0),
  ]);

  res.json({
    totalUsers,
    activeUsers24h,
    totalListings,
    openRequests,
    generatedAt: new Date().toISOString(),
  });
});

// ─── GET /api/v2/admin/activity ────────────────────────────
// Last 20 EventLog entries, newest first.
// Returned as-is — admin layer, no PII scrubbing needed here.
router.get('/activity', ...ADMIN_SCOPE, async (_req, res) => {
  const events = await prisma.eventLog.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 20,
  }).catch(() => []);

  res.json({ events, total: events.length });
});

// ─── PATCH /api/v2/admin/listings/:id/status ───────────────
// Body: { action: 'pause' | 'unpause' }
//   pause   → status = 'closed'
//   unpause → status = 'active'
// Logs the moderation action to EventLog for audit trail.
router.patch('/listings/:id/status', ...ADMIN_SCOPE, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};

  if (action !== 'pause' && action !== 'unpause') {
    return res.status(400).json({ error: 'action must be "pause" or "unpause"' });
  }

  const newStatus = action === 'pause' ? 'closed' : 'active';

  const listing = await prisma.cropListing.update({
    where: { id },
    data:  { status: newStatus },
    select: { id: true, status: true },
  }).catch((err) => {
    // P2025 = record not found (Prisma known error code).
    if (err && err.code === 'P2025') return null;
    throw err;
  });

  if (!listing) {
    return res.status(404).json({ error: 'listing_not_found' });
  }

  // Audit log — best-effort; never block the response.
  await prisma.eventLog.create({
    data: {
      userId:    req.user?.id ?? null,
      eventType: action === 'pause' ? 'admin_listing_paused' : 'admin_listing_unpaused',
      metadata:  { listingId: id, adminId: req.user?.id ?? null, newStatus },
    },
  }).catch(() => {});

  res.json({ ok: true, id: listing.id, status: listing.status });
});

// ─── PATCH /api/v2/admin/requests/:id/review ───────────────
// Marks a MarketInterest (buyer request) as reviewed.
// Does NOT change the request's status — that remains the farmer's
// decision. Creates an EventLog entry for the audit trail.
router.patch('/requests/:id/review', ...ADMIN_SCOPE, async (req, res) => {
  const { id } = req.params;

  // Verify the record exists before logging.
  const interest = await prisma.marketInterest.findUnique({
    where:  { id },
    select: { id: true, status: true },
  }).catch(() => null);

  if (!interest) {
    return res.status(404).json({ error: 'request_not_found' });
  }

  // Audit log — best-effort.
  await prisma.eventLog.create({
    data: {
      userId:    req.user?.id ?? null,
      eventType: 'admin_request_reviewed',
      metadata:  { requestId: id, adminId: req.user?.id ?? null },
    },
  }).catch(() => {});

  res.json({ ok: true, reviewed: true });
});

export default router;
