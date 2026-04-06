import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { extractOrganization, orgWhereApplication, verifyOrgAccess } from '../../middleware/orgScope.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as reportService from './service.js';
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

export default router;
