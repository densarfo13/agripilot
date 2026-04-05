import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as intelligenceService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Run intelligence engine (admin/reviewer only — this is secondary intelligence)
router.post('/:applicationId/run', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const result = await intelligenceService.runIntelligence(req.params.applicationId);
  await writeAuditLog({
    applicationId: req.params.applicationId, userId: req.user.sub,
    action: 'intelligence_run', details: { mlShadowScore: result.mlShadowScore }, ipAddress: req.ip,
  });
  res.json(result);
}));

// Get intelligence result (admin/reviewer only)
router.get('/:applicationId', authorize('super_admin', 'institutional_admin', 'reviewer'), asyncHandler(async (req, res) => {
  const result = await intelligenceService.getIntelligenceResult(req.params.applicationId);
  if (!result) return res.status(404).json({ error: 'No intelligence result found' });
  res.json(result);
}));

export default router;
