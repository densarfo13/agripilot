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
  getDeliveryStats,
  getAlerts,
  getPilotReport,
  saveDailySnapshot,
  getSnapshotTrends,
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

// ─── GET /api/pilot/delivery-stats ────────────────────────
// Invite delivery outcomes, failed invites, resend recommendations
router.get('/delivery-stats',
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const stats = await getDeliveryStats({ organizationId: req.organizationId });
    res.json(stats);
  }));

// ─── GET /api/pilot/alerts ─────────────────────────────────
// Derived operational alerts from current platform state
router.get('/alerts',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const result = await getAlerts({ organizationId: req.organizationId });
    // field_officer sees only operational alerts, not invite/delivery alerts
    if (req.user.role === 'field_officer') {
      result.alerts = result.alerts.filter(a =>
        ['VALIDATION_BACKLOG', 'HARVEST_OVERDUE', 'INACTIVE_FARMERS'].includes(a.type)
      );
      result.alertCount = result.alerts.length;
    }
    res.json(result);
  }));

// ─── GET /api/pilot/report ─────────────────────────────────
// Comprehensive exportable report. ?format=json|csv
router.get('/report',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const result = await getPilotReport({ organizationId: req.organizationId, format });
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="pilot-report.csv"');
      return res.send(result.csv);
    }
    res.json(result.json);
  }));

// ─── POST /api/pilot/snapshot ──────────────────────────────
// Trigger a daily snapshot save (can be called by a cron or manually)
router.post('/snapshot',
  authorize('super_admin', 'institutional_admin'),
  workflowLimiter,
  asyncHandler(async (req, res) => {
    const snapshot = await saveDailySnapshot({ organizationId: req.organizationId });
    res.json({ message: 'Snapshot saved', snapshot });
  }));

// ─── GET /api/pilot/trends ─────────────────────────────────
// Snapshot trend for the last N days. ?days=30
router.get('/trends',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const trends = await getSnapshotTrends({ organizationId: req.organizationId, days });
    res.json(trends);
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
