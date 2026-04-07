/**
 * Pilot Metrics Routes
 *
 * Provides adoption tracking, needs-attention signals, completion funnel,
 * reviewer efficiency, pilot summary export, and pilot org setup.
 *
 * Permission matrix:
 *   super_admin          — all endpoints, cross-org or scoped via ?orgId
 *   institutional_admin  — own org only
 *   reviewer             — reviewer-efficiency only (own queue)
 *   field_officer        — needs-attention only (limited view)
 *   investor_viewer      — metrics, funnel, summary (read-only, own org)
 *   farmer               — BLOCKED from all pilot endpoints
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization } from '../../middleware/orgScope.js';
import { workflowLimiter } from '../../middleware/rateLimiters.js';
import {
  getPilotMetrics,
  getCompletionFunnel,
  getNeedsAttention,
  getReviewerEfficiency,
  getPilotSummary,
} from './service.js';
import { setupPilotOrganization } from './pilotSetup.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ─── GET /api/pilot/metrics ────────────────────────────────
// Org-scoped adoption and activity summary
router.get('/metrics',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const metrics = await getPilotMetrics({ organizationId: req.organizationId });
    res.json(metrics);
  }));

// ─── GET /api/pilot/funnel ─────────────────────────────────
// Completion funnel showing drop-off at each adoption step
router.get('/funnel',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const funnel = await getCompletionFunnel({ organizationId: req.organizationId });
    res.json(funnel);
  }));

// ─── GET /api/pilot/needs-attention ───────────────────────
// Items requiring operator action, grouped by category
router.get('/needs-attention',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    // field_officer gets a reduced view — only validation and stale seasons
    const result = await getNeedsAttention({
      organizationId: req.organizationId,
      role: req.user.role,
    });

    // field_officer sees only operational items, not admin-level items
    if (req.user.role === 'field_officer') {
      result.categories = result.categories.filter(c =>
        ['inactive_seasons', 'harvest_overdue', 'validation_overdue'].includes(c.type)
      );
      result.totalItems = result.categories.reduce((sum, c) => sum + c.count, 0);
    }

    res.json(result);
  }));

// ─── GET /api/pilot/reviewer-efficiency ───────────────────
// Queue timing, throughput, and aging for review operations
router.get('/reviewer-efficiency',
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    // reviewer sees their own org's queue; institutional_admin and super_admin see org-scoped
    const efficiency = await getReviewerEfficiency({ organizationId: req.organizationId });
    res.json(efficiency);
  }));

// ─── GET /api/pilot/summary ────────────────────────────────
// Combined exportable pilot summary
router.get('/summary',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const summary = await getPilotSummary({ organizationId: req.organizationId });
    res.json(summary);
  }));

// ─── POST /api/pilot/setup ────────────────────────────────
// Provision a pilot organization with initial staff (super_admin only)
router.post('/setup',
  authorize('super_admin'),
  workflowLimiter,
  asyncHandler(async (req, res) => {
    const {
      organizationName,
      organizationType,
      countryCode,
      admin,
      fieldOfficers,
      reviewer,
      investorViewer,
    } = req.body;

    if (!organizationName || !admin) {
      return res.status(400).json({ error: 'organizationName and admin are required' });
    }

    const result = await setupPilotOrganization({
      organizationName,
      organizationType,
      countryCode,
      admin,
      fieldOfficers: fieldOfficers || [],
      reviewer: reviewer || null,
      investorViewer: investorViewer || null,
      createdByUserId: req.user.sub,
    });

    res.status(201).json(result);
  }));

export default router;
