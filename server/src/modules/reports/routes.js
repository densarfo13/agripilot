import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as reportService from './service.js';

const router = Router();
router.use(authenticate);

// Full application report
router.get('/application/:applicationId', authorize('super_admin', 'institutional_admin', 'reviewer', 'investor_viewer'), asyncHandler(async (req, res) => {
  const report = await reportService.getApplicationReport(req.params.applicationId);
  res.json(report);
}));

// Portfolio-level report
router.get('/portfolio', authorize('super_admin', 'institutional_admin', 'investor_viewer'), asyncHandler(async (req, res) => {
  const report = await reportService.getPortfolioReport();
  res.json(report);
}));

export default router;
