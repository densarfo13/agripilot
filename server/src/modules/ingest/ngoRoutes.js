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
import { authenticate } from '../../middleware/auth.js';
import prisma from '../../config/database.js';
import {
  buildSummary, buildRegionTable, buildClusters,
} from './ngoAggregates.js';

const router = Router();

router.use(authenticate);

router.get('/summary', asyncHandler(async (req, res) => {
  const region = typeof req.query.region === 'string' && req.query.region.trim()
    ? req.query.region.trim()
    : null;
  const data = await buildSummary({ prisma, region });
  res.json(data);
}));

router.get('/regions', asyncHandler(async (_req, res) => {
  const rows = await buildRegionTable({ prisma });
  res.json({ rows, serverTime: new Date().toISOString() });
}));

router.get('/clusters', asyncHandler(async (req, res) => {
  const region = typeof req.query.region === 'string' && req.query.region.trim()
    ? req.query.region.trim()
    : null;
  const clusters = await buildClusters({ prisma, region });
  res.json({ clusters, serverTime: new Date().toISOString() });
}));

export default router;
