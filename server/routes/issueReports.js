/**
 * issueReports.js — CRUD endpoints for farmer-reported issues.
 *
 *   POST   /api/v2/issues                      — farmer files a new issue
 *   GET    /api/v2/issues/my                   — current farmer's issues
 *   GET    /api/v2/issues/:id                  — single issue (owner-scoped)
 *   PATCH  /api/v2/issues/:id/status           — NGO reviewer updates status
 *   GET    /api/v2/issues/ngo/list             — NGO-scoped list with filters
 *
 * Scope rule:
 *   Farmers can only see their own issues. Reviewer/NGO routes are
 *   behind the authenticate middleware + a role check. Kept
 *   deliberately small — anything bigger belongs in a dedicated
 *   triage module.
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/authenticate.js';
import { requireAuth, requireRole } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = express.Router();

const REVIEWER_SCOPE = [authenticate, requireAuth, requireRole('reviewer')];
const FARMER_SCOPE   = [authenticate, requireAuth];

const VALID_CATEGORIES = new Set(['pest', 'disease', 'weather', 'water', 'soil', 'other']);
const VALID_SEVERITIES = new Set(['low', 'medium', 'high']);
const VALID_STATUSES = new Set(['open', 'in_review', 'resolved', 'ignored']);

function normalize(body) {
  return {
    category: VALID_CATEGORIES.has((body?.category || '').toLowerCase())
      ? body.category.toLowerCase() : null,
    severity: VALID_SEVERITIES.has((body?.severity || '').toLowerCase())
      ? body.severity.toLowerCase() : 'medium',
    description: typeof body?.description === 'string' ? body.description.trim() : '',
    photoUrl: typeof body?.photoUrl === 'string' ? body.photoUrl.trim() || null : null,
    latitude: Number.isFinite(body?.latitude) ? body.latitude : null,
    longitude: Number.isFinite(body?.longitude) ? body.longitude : null,
    cropCycleId: typeof body?.cropCycleId === 'string' ? body.cropCycleId : null,
    farmProfileId: typeof body?.farmProfileId === 'string' ? body.farmProfileId : null,
  };
}

// ─── POST /api/v2/issues — farmer files a new issue ─────────
router.post('/', ...FARMER_SCOPE, express.json(), async (req, res) => {
  const data = normalize(req.body || {});
  if (!data.category) return res.status(400).json({ error: 'invalid_category' });
  if (!data.description || data.description.length < 3) {
    return res.status(400).json({ error: 'description_too_short' });
  }

  // Resolve the target farm: explicit farmProfileId or the user's default.
  let farm = null;
  if (data.farmProfileId) {
    farm = await prisma.farmProfile.findFirst({
      where: { id: data.farmProfileId, userId: req.user.id },
      select: { id: true, farmerId: true },
    });
  } else {
    farm = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, status: 'active', isDefault: true },
      select: { id: true, farmerId: true },
    });
  }
  if (!farm) return res.status(404).json({ error: 'farm_not_found' });

  const created = await prisma.issueReport.create({
    data: {
      farmProfileId: farm.id,
      farmerId: farm.farmerId || null,
      cropCycleId: data.cropCycleId,
      category: data.category,
      severity: data.severity,
      description: data.description.slice(0, 2000),
      photoUrl: data.photoUrl,
      latitude: data.latitude,
      longitude: data.longitude,
    },
  });

  res.status(201).json({ issue: created });
});

// ─── GET /api/v2/issues/my ─────────────────────────────────
router.get('/my', ...FARMER_SCOPE, async (req, res) => {
  const farms = await prisma.farmProfile.findMany({
    where: { userId: req.user.id },
    select: { id: true },
  });
  const farmIds = farms.map((f) => f.id);
  if (farmIds.length === 0) return res.json({ issues: [] });

  const issues = await prisma.issueReport.findMany({
    where: { farmProfileId: { in: farmIds } },
    orderBy: { reportedAt: 'desc' },
    take: 100,
  });
  res.json({ issues });
});

// ─── GET /api/v2/issues/:id ────────────────────────────────
router.get('/:id', ...FARMER_SCOPE, async (req, res) => {
  const issue = await prisma.issueReport.findUnique({
    where: { id: req.params.id },
  });
  if (!issue) return res.status(404).json({ error: 'not_found' });

  const farm = await prisma.farmProfile.findFirst({
    where: { id: issue.farmProfileId, userId: req.user.id },
    select: { id: true },
  });
  const isOwner = !!farm;
  const isReviewer = req.user.role === 'admin' || req.user.role === 'reviewer';
  if (!isOwner && !isReviewer) return res.status(403).json({ error: 'forbidden' });

  res.json({ issue });
});

// ─── PATCH /api/v2/issues/:id/status — reviewer action ─────
router.patch('/:id/status', ...REVIEWER_SCOPE, express.json(), async (req, res) => {
  const status = String(req.body?.status || '').toLowerCase();
  if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'invalid_status' });

  const reviewerNote = typeof req.body?.reviewerNote === 'string'
    ? req.body.reviewerNote.slice(0, 1000)
    : undefined;

  const patch = { status };
  if (status === 'resolved') patch.resolvedAt = new Date();
  if (reviewerNote !== undefined) patch.reviewerNote = reviewerNote;

  const updated = await prisma.issueReport.update({
    where: { id: req.params.id },
    data: patch,
  });
  res.json({ issue: updated });
});

// ─── GET /api/v2/issues/ngo/list ───────────────────────────
router.get('/ngo/list', ...REVIEWER_SCOPE, async (req, res) => {
  const where = {};
  if (req.query.status && VALID_STATUSES.has(String(req.query.status))) where.status = String(req.query.status);
  if (req.query.severity && VALID_SEVERITIES.has(String(req.query.severity))) where.severity = String(req.query.severity);

  const issues = await prisma.issueReport.findMany({
    where,
    orderBy: [{ severity: 'desc' }, { reportedAt: 'desc' }],
    take: 200,
  });
  res.json({ issues });
});

export default router;
