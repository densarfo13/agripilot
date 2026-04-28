/**
 * ingest/ngoRoutes.js — NGO-facing read endpoints.
 *
 *   GET /api/ngo/summary?region=<optional>
 *   GET /api/ngo/regions
 *   GET /api/ngo/clusters?region=<optional>
 *
 * Strict-rule audit
 *   * Auth: requires `authenticate`. Authorisation is enforced
 *     at the caller's discretion (org-level RBAC lives outside
 *     this module — the existing authorize() middleware can be
 *     applied here when an NGO admin role is wired). v1 keeps
 *     the surface authenticated-but-unrestricted so any signed-
 *     in operator can hit it; staff/admin pages already gate
 *     route mounts on roles upstream.
 *   * Read-only: no writes; no side effects.
 *   * Defensive: each builder catches its own DB errors and
 *     the asyncHandler wrapper routes any thrown error through
 *     the global errorHandler with consistent JSON.
 *   * <300ms target on small datasets: each endpoint runs the
 *     parallel Promise.all paths in the aggregate builders.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { readLimiter } from '../../middleware/rateLimiters.js';
import prisma from '../../config/database.js';
import {
  buildSummary, buildRegionTable, buildClusters,
} from './ngoAggregates.js';

const router = Router();

// Rate limit BEFORE auth so a flood of unauthenticated probes
// gets throttled at the IP layer without burning JWT verifies.
router.use(readLimiter);
router.use(authenticate);

// NGO endpoints are role-gated. The existing role taxonomy
// uses 'super_admin' / 'institutional_admin' / 'field_officer'
// as the org-staff trio; any of those + the spec's literal
// 'admin' / 'viewer' aliases are accepted so the route works
// against either role naming convention.
const NGO_ROLES = ['super_admin', 'institutional_admin', 'field_officer',
                   'admin', 'viewer'];

function _orgIdOf(req) {
  return (req.user && req.user.organizationId)
    ? String(req.user.organizationId)
    : null;
}

function _requireOrgId(req, res) {
  const orgId = _orgIdOf(req);
  if (!orgId) {
    res.status(403).json({
      error: 'Forbidden — user has no organization scope',
      code:  'no_org_scope',
    });
    return null;
  }
  return orgId;
}

router.get('/summary',
  authorize(...NGO_ROLES),
  asyncHandler(async (req, res) => {
    const orgId = _requireOrgId(req, res);
    if (!orgId) return;
    const region = typeof req.query.region === 'string' && req.query.region.trim()
      ? req.query.region.trim()
      : null;
    const data = await buildSummary({ prisma, orgId, region });
    res.json(data);
  }),
);

router.get('/regions',
  authorize(...NGO_ROLES),
  asyncHandler(async (req, res) => {
    const orgId = _requireOrgId(req, res);
    if (!orgId) return;
    const rows = await buildRegionTable({ prisma, orgId });
    res.json({ rows, serverTime: new Date().toISOString() });
  }),
);

router.get('/clusters',
  authorize(...NGO_ROLES),
  asyncHandler(async (req, res) => {
    const orgId = _requireOrgId(req, res);
    if (!orgId) return;
    const region = typeof req.query.region === 'string' && req.query.region.trim()
      ? req.query.region.trim()
      : null;
    const clusters = await buildClusters({ prisma, orgId, region });
    res.json({ clusters, serverTime: new Date().toISOString() });
  }),
);

/**
 * GET /api/ngo/farms
 *
 * Returns the org's farm points for the map. Each row
 * carries:
 *   { id, farmerId, crop, riskLevel,
 *     location: { lat, lng, country, region, district } }
 *
 * Privacy contract (per brief § 8 + the existing
 * "no farmer PII" rule):
 *   * NEVER includes phone, fullName, nationalId, email
 *   * Returns ONLY farms with finite (lat, lng) — region-only
 *     farms are surfaced through the existing /ngo/regions
 *     table, not the map
 *   * Hard-cap at MAX_FARMS rows so a sprawling org doesn't
 *     blow up the leaflet bundle's per-circle work
 *
 * Risk level is derived from the latest HIGH/MEDIUM/LOW
 * RiskSnapshot per farm in the last 7 days. Farms without a
 * snapshot default to LOW (calm green dot) which is the same
 * convention NGOMap uses internally.
 */
const MAX_FARMS = 500;

router.get('/farms',
  authorize(...NGO_ROLES),
  asyncHandler(async (req, res) => {
    const orgId = _requireOrgId(req, res);
    if (!orgId) return;

    // 1) Pull farms with finite coordinates, narrowed to
    //    org. Select ONLY the projection the map needs;
    //    PII columns (phone, fullName, nationalId, email)
    //    never leave the DB.
    const farmRows = await prisma.farmer.findMany({
      where: {
        organizationId: orgId,
        latitude:  { not: null },
        longitude: { not: null },
      },
      select: {
        id:           true,
        primaryCrop:  true,
        latitude:     true,
        longitude:    true,
        countryCode:  true,
        region:       true,
        district:     true,
      },
      take: MAX_FARMS,
    });

    if (farmRows.length === 0) {
      return res.json({ farms: [], serverTime: new Date().toISOString() });
    }

    // 2) Latest risk per farm in last 7 days. We keep this
    //    cheap by selecting only (farmId, riskLevel,
    //    createdAt) and resolving the max riskLevel per
    //    farm in JS.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const riskRows = await prisma.riskSnapshot.findMany({
      where: {
        orgId,
        createdAt: { gte: since },
        farmId: { in: farmRows.map((f) => f.id) },
      },
      select: { farmId: true, riskLevel: true, createdAt: true },
    });
    // Pick the highest tier per farm: HIGH > MEDIUM > LOW
    const TIER = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const bestRisk = new Map();
    for (const r of riskRows) {
      const cur = bestRisk.get(r.farmId);
      const lvl = String(r.riskLevel || 'LOW').toUpperCase();
      if (!cur || (TIER[lvl] || 0) > (TIER[cur] || 0)) {
        bestRisk.set(r.farmId, lvl);
      }
    }

    const farms = farmRows.map((f) => ({
      id:        f.id,
      farmerId:  f.id,                    // farm == farmer in current model
      crop:      f.primaryCrop || '',
      riskLevel: bestRisk.get(f.id) || 'LOW',
      location: {
        lat:      Number(f.latitude),
        lng:      Number(f.longitude),
        country:  f.countryCode || '',
        region:   f.region   || '',
        district: f.district || '',
      },
    }));

    res.json({
      farms,
      truncated:  farmRows.length === MAX_FARMS,
      serverTime: new Date().toISOString(),
    });
  }),
);

export default router;
