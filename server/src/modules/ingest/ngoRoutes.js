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

export default router;
