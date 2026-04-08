/**
 * Performance & Benchmarking Routes
 *
 * Mounted at /api/performance
 *
 * GET /api/performance/farmers/:id/history
 *   → Season-by-season performance history for a farmer
 *   → Staff: full metrics + self-trend
 *   → Farmer: simple self-labels only (no org comparison)
 *
 * GET /api/performance/farmers/:id/benchmarks
 *   → Farmer vs org comparison with explainable outputs
 *   → Staff/admin only (farmer gets self-trend only)
 *
 * GET /api/performance/dashboard
 *   → Org-level benchmark summary for admin dashboard
 *   → admin/institutional_admin only
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization, verifyOrgAccess } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import prisma from '../../config/database.js';
import {
  getFarmerPerformanceHistory,
  getFarmerBenchmarks,
  getOrgBenchmarkSummary,
} from './service.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

const ALL_STAFF = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer', 'investor_viewer'];
const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

// ─── Shared: verify farmer belongs to caller's org ─────────

async function checkFarmerOrgAccess(req, res, next) {
  if (req.isCrossOrg) return next();
  if (!req.organizationId && req.user.role !== 'super_admin') return next();

  const farmer = await prisma.farmer.findUnique({
    where: { id: req.params.id },
    select: { organizationId: true, userId: true },
  });

  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });

  // Farmer-role users can only access their own data
  if (req.user.role === 'farmer') {
    if (farmer.userId !== req.user.sub) {
      return res.status(403).json({ error: 'Access denied — you can only view your own data' });
    }
    return next();
  }

  if (!verifyOrgAccess(req, farmer.organizationId)) {
    return res.status(403).json({ error: 'Access denied — farmer belongs to a different organization' });
  }

  next();
}

// ─── GET /api/performance/farmers/:id/history ─────────────

router.get('/farmers/:id/history',
  validateParamUUID('id'),
  authorize(...ALL_STAFF, 'farmer'),
  checkFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    const result = await getFarmerPerformanceHistory(
      req.params.id,
      req.organizationId,
      req.user.role,
    );
    res.json(result);
  }));

// ─── GET /api/performance/farmers/:id/benchmarks ──────────

router.get('/farmers/:id/benchmarks',
  validateParamUUID('id'),
  authorize(...ALL_STAFF),          // not exposed to farmer role directly
  checkFarmerOrgAccess,
  asyncHandler(async (req, res) => {
    // investor_viewer gets summary-level output; service applies same logic
    const result = await getFarmerBenchmarks(
      req.params.id,
      req.organizationId,
      req.user.role,
    );
    res.json(result);
  }));

// ─── GET /api/performance/dashboard ───────────────────────

router.get('/dashboard',
  authorize(...ADMIN_ROLES, 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const result = await getOrgBenchmarkSummary(req.organizationId);
    res.json(result);
  }));

export default router;
