/**
 * Impact Dashboard Routes
 *
 * NGO-grade impact reporting endpoints.
 *
 * Permission matrix:
 *   super_admin          — all endpoints, cross-org or scoped via ?orgId
 *   institutional_admin  — own org only
 *   investor_viewer      — read-only, own org
 *   reviewer             — BLOCKED
 *   field_officer        — BLOCKED
 *   farmer               — BLOCKED
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import {
  getImpactDashboard,
  getImpactTrends,
  getImpactExportCSV,
  getImpactFilterOptions,
} from './service.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

const ALLOWED_ROLES = ['super_admin', 'institutional_admin', 'investor_viewer'];

// ─── GET /api/impact/dashboard ────────────────────────────
// Main impact aggregation with optional filters
router.get('/dashboard',
  authorize(...ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.gender) filters.gender = req.query.gender;
    if (req.query.region) filters.region = req.query.region;
    if (req.query.crop) filters.crop = req.query.crop;
    if (req.query.registrationStatus) filters.registrationStatus = req.query.registrationStatus;
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;
    if (req.query.ageGroup) filters.ageGroup = req.query.ageGroup;

    const dashboard = await getImpactDashboard({
      organizationId: req.organizationId,
      filters,
    });
    res.json(dashboard);
  }));

// ─── GET /api/impact/trends ──────────────────────────────
// Monthly trend data for impact metrics
router.get('/trends',
  authorize(...ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(parseInt(req.query.months || '6', 10), 1), 12);
    const trends = await getImpactTrends({
      organizationId: req.organizationId,
      months,
    });
    res.json(trends);
  }));

// ─── GET /api/impact/export ──────────────────────────────
// CSV export of impact summary
router.get('/export',
  authorize(...ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.gender) filters.gender = req.query.gender;
    if (req.query.region) filters.region = req.query.region;
    if (req.query.registrationStatus) filters.registrationStatus = req.query.registrationStatus;
    if (req.query.ageGroup) filters.ageGroup = req.query.ageGroup;
    if (req.query.crop) filters.crop = req.query.crop;
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;

    const csv = await getImpactExportCSV({
      organizationId: req.organizationId,
      filters,
    });

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="impact-report-${date}.csv"`);
    res.send(csv);
  }));

// ─── GET /api/impact/filters ─────────────────────────────
// Available filter options for the impact dashboard
router.get('/filters',
  authorize(...ALLOWED_ROLES),
  asyncHandler(async (req, res) => {
    const options = await getImpactFilterOptions({
      organizationId: req.organizationId,
    });
    res.json(options);
  }));

export default router;
