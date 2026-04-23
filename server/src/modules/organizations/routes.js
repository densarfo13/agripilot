import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { dedupGuard } from '../../middleware/dedup.js';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';
import { buildOrganizationDashboard, listOrganizationFarmers } from './dashboardService.js';
import { buildFarmersCsv, buildDashboardCsv, buildPilotMetricsCsv } from './exportService.js';
import { buildPilotMetrics } from './pilotMetricsService.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

const VALID_ORG_TYPES = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];

// List all organizations (super_admin sees all; institutional_admin sees own only)
router.get('/', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const where = {};
  // institutional_admin can only see their own org
  if (req.user.role !== 'super_admin' && req.organizationId) {
    where.id = req.organizationId;
  }

  const orgs = await prisma.organization.findMany({
    where,
    include: {
      _count: {
        select: { users: true, farmers: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Enrich with application counts
  const enriched = await Promise.all(orgs.map(async (org) => {
    const appCount = await prisma.application.count({
      where: { farmer: { organizationId: org.id } },
    });
    return {
      ...org,
      _count: { ...org._count, applications: appCount },
    };
  }));

  res.json(enriched);
}));

// Get single organization by ID
router.get('/:id',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    // institutional_admin can only view their own org
    if (req.user.role !== 'super_admin' && req.organizationId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, farmers: true } },
      },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const appCount = await prisma.application.count({
      where: { farmer: { organizationId: org.id } },
    });

    res.json({ ...org, _count: { ...org._count, applications: appCount } });
  }));

// ─── Organization dashboard ─────────────────────────────────────
// Aggregate metrics for an org: total farmers, active vs inactive,
// crop distribution, average Farroway Score, risk indicators,
// aggregate yield projection. Mobile-friendly single JSON payload.
function canViewOrg(req, orgId) {
  if (req.user.role === 'super_admin') return true;
  if (req.user.role === 'institutional_admin' && req.organizationId === orgId) return true;
  return false;
}

router.get('/:id/dashboard',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    if (!canViewOrg(req, req.params.id)) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }
    const windowDays = Math.min(180, Math.max(7, Number(req.query.windowDays) || 30));
    const out = await buildOrganizationDashboard(prisma, {
      organizationId: req.params.id, windowDays,
    });
    if (!out) return res.status(404).json({ error: 'Organization not found' });
    res.json(out);
  }));

// ─── Pilot metrics ──────────────────────────────────────────────
// Adoption + engagement + performance + outcomes + trends + top
// regions + at-risk farmers in one payload. Same role gate as the
// dashboard.
router.get('/:id/metrics',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    if (!canViewOrg(req, req.params.id)) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }
    const windowDays = Math.min(180, Math.max(7, Number(req.query.windowDays) || 30));
    const trendBuckets = Math.min(12, Math.max(3, Number(req.query.trendBuckets) || 6));
    const out = await buildPilotMetrics(prisma, {
      organizationId: req.params.id, windowDays, trendBuckets,
    });
    if (!out) return res.status(404).json({ error: 'Organization not found' });
    res.json(out);
  }));

// ─── Farmer list for the dashboard table ────────────────────────
// Paginated + filterable (region, crop, score range). Institutional
// admin is auto-scoped to their own org; super_admin can view any.
router.get('/:id/farmers',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    if (!canViewOrg(req, req.params.id)) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }
    const out = await listOrganizationFarmers(prisma, {
      organizationId: req.params.id,
      region:   req.query.region || null,
      crop:     req.query.crop || null,
      scoreMin: req.query.scoreMin != null ? Number(req.query.scoreMin) : null,
      scoreMax: req.query.scoreMax != null ? Number(req.query.scoreMax) : null,
      page:     Number(req.query.page)  || 1,
      limit:    Number(req.query.limit) || 50,
    });
    if (!out.ok) return res.status(500).json({ error: out.reason || 'failed' });
    res.json({ data: out.data, total: out.total, page: out.page, limit: out.limit });
  }));

// ─── CSV exports ────────────────────────────────────────────────
// ?kind=farmers (default) → one row per farmer with score + crop
// ?kind=dashboard         → compact metric summary + crop/yield tables
router.get('/:id/export',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    if (!canViewOrg(req, req.params.id)) {
      return res.status(403).json({ error: 'Access denied — not your organization' });
    }
    const kind = String(req.query.kind || 'farmers').toLowerCase();
    const org  = await prisma.organization.findUnique({
      where: { id: req.params.id }, select: { id: true, name: true },
    });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    const safeName = String(org.name || 'org').replace(/[^A-Za-z0-9_-]+/g, '_').toLowerCase();

    if (kind === 'dashboard') {
      const dash = await buildOrganizationDashboard(prisma, {
        organizationId: req.params.id,
        windowDays: Math.min(180, Math.max(7, Number(req.query.windowDays) || 30)),
      });
      res.setHeader('Content-Disposition',
        `attachment; filename="farroway_${safeName}_dashboard.csv"`);
      return res.send(buildDashboardCsv(dash));
    }

    if (kind === 'metrics') {
      const metrics = await buildPilotMetrics(prisma, {
        organizationId: req.params.id,
        windowDays:   Math.min(180, Math.max(7, Number(req.query.windowDays) || 30)),
        trendBuckets: Math.min(12, Math.max(3, Number(req.query.trendBuckets) || 6)),
      });
      res.setHeader('Content-Disposition',
        `attachment; filename="farroway_${safeName}_metrics.csv"`);
      return res.send(buildPilotMetricsCsv(metrics));
    }

    // Default: farmers export (respects the same filters as the list).
    const out = await listOrganizationFarmers(prisma, {
      organizationId: req.params.id,
      region:   req.query.region || null,
      crop:     req.query.crop || null,
      scoreMin: req.query.scoreMin != null ? Number(req.query.scoreMin) : null,
      scoreMax: req.query.scoreMax != null ? Number(req.query.scoreMax) : null,
      page: 1,
      limit: Math.min(2000, Math.max(1, Number(req.query.limit) || 1000)),
    });
    if (!out.ok) return res.status(500).json({ error: out.reason || 'export_failed' });
    res.setHeader('Content-Disposition',
      `attachment; filename="farroway_${safeName}_farmers.csv"`);
    res.send(buildFarmersCsv(out.data, { org }));
  }));

// Create organization (super_admin only)
router.post('/',
  authorize('super_admin'),
  dedupGuard('org-create'),
  asyncHandler(async (req, res) => {
    const { name, type, countryCode, regionCode } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (type && !VALID_ORG_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_ORG_TYPES.join(', ')}` });
    }

    const org = await prisma.organization.create({
      data: {
        name: name.trim(),
        type: type || 'INTERNAL',
        countryCode: countryCode || null,
        regionCode: regionCode || null,
      },
    });

    writeAuditLog({ userId: req.user.sub, action: 'organization_created', details: { organizationId: org.id, name: org.name } }).catch(() => {});
    res.status(201).json(org);
  }));

// Update organization (super_admin only)
router.patch('/:id',
  validateParamUUID('id'),
  authorize('super_admin'),
  dedupGuard('org-update'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Organization not found' });

    const { name, type, countryCode, regionCode, isActive } = req.body;
    if (type && !VALID_ORG_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${VALID_ORG_TYPES.join(', ')}` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (countryCode !== undefined) updateData.countryCode = countryCode || null;
    if (regionCode !== undefined) updateData.regionCode = regionCode || null;
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const updated = await prisma.organization.update({
      where: { id: req.params.id },
      data: updateData,
    });

    writeAuditLog({ userId: req.user.sub, action: 'organization_updated', details: { organizationId: updated.id, changes: Object.keys(updateData) } }).catch(() => {});
    res.json(updated);
  }));

export default router;
