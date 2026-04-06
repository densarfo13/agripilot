import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as decisionService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Run decision engine
router.post('/:applicationId/run',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const result = await decisionService.runDecisionEngine(req.params.applicationId);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'decision_engine_run',
      details: { decision: result.decision, riskLevel: result.riskLevel },
      newStatus: result.decision === 'approve' ? 'approved' : result.decision === 'reject' ? 'rejected' : null,
      ipAddress: req.ip,
    }).catch(() => {});
    res.json(result);
  }));

// Get decision result
router.get('/:applicationId',
  validateParamUUID('applicationId'),
  asyncHandler(async (req, res) => {
    const result = await decisionService.getDecisionResult(req.params.applicationId);
    if (!result) return res.status(404).json({ error: 'No decision result found' });
    res.json(result);
  }));

export default router;
