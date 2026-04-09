import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization, orgWhereApplication, orgWhereFarmer, verifyOrgAccess } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as reportService from './service.js';
import { getPilotSummary } from '../pilotMetrics/service.js';
import { getPerformanceSummaryReport } from '../performance/service.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// Full application report (org-scoped: verify app belongs to user's org)
router.get('/application/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    // Verify the application belongs to the user's organization
    const app = await prisma.application.findUnique({
      where: { id: req.params.applicationId },
      select: { farmer: { select: { organizationId: true } } },
    });
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (!verifyOrgAccess(req, app.farmer?.organizationId)) {
      return res.status(403).json({ error: 'Access denied — application belongs to another organization' });
    }
    const report = await reportService.getApplicationReport(req.params.applicationId);
    res.json(report);
  }));

// Portfolio-level report (org-scoped)
router.get('/portfolio',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const report = await reportService.getPortfolioReport(orgWhereApplication(req));
    res.json(report);
  }));

// Pilot summary report (exportable — org-scoped)
router.get('/pilot-summary',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const summary = await getPilotSummary({ organizationId: req.organizationId });
    res.json(summary);
  }));

// Org-specific pilot summary (for super_admin cross-org inspection)
router.get('/organization/:organizationId/pilot-summary',
  validateParamUUID('organizationId'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    // institutional_admin can only view their own org
    if (req.user.role === 'institutional_admin' && req.organizationId !== req.params.organizationId) {
      return res.status(403).json({ error: 'Access denied — you can only view your own organization' });
    }
    const summary = await getPilotSummary({ organizationId: req.params.organizationId });
    res.json(summary);
  }));

// Pilot report CSV export (org-scoped) — downloadable farmer-level data
router.get('/pilot-report',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    const format = req.query.format || 'json';
    if (format === 'csv') {
      const csv = await reportService.getPilotReportCSV(orgWhereFarmer(req));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pilot-report-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }
    // JSON fallback — return portfolio + pilot summary
    const [portfolio, summary] = await Promise.all([
      reportService.getPortfolioReport(orgWhereApplication(req)),
      getPilotSummary({ organizationId: req.organizationId }),
    ]);
    res.json({ portfolio, summary });
  }));

// Performance & benchmarking summary report (org-scoped)
router.get('/performance-summary',
  authorize('super_admin', 'institutional_admin', 'investor_viewer'),
  asyncHandler(async (req, res) => {
    // institutional_admin scoped to own org; super_admin can inspect any
    const report = await getPerformanceSummaryReport(req.organizationId);
    res.json(report);
  }));

// Org-specific performance report (super_admin cross-org inspection)
router.get('/organization/:organizationId/performance-summary',
  validateParamUUID('organizationId'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'institutional_admin' && req.organizationId !== req.params.organizationId) {
      return res.status(403).json({ error: 'Access denied — you can only view your own organization' });
    }
    const report = await getPerformanceSummaryReport(req.params.organizationId);
    res.json(report);
  }));

export default router;
