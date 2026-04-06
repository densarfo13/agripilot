import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as fraudService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Run fraud analysis
router.post('/:applicationId/run',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const result = await fraudService.runFraudAnalysis(req.params.applicationId);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'fraud_analysis_run', details: { riskScore: result.fraudRiskScore, riskLevel: result.fraudRiskLevel },
      ipAddress: req.ip,
    }).catch(() => {});
    res.json(result);
  }));

// Get fraud result
router.get('/:applicationId',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const result = await fraudService.getFraudResult(req.params.applicationId);
    if (!result) return res.status(404).json({ error: 'No fraud result found' });
    res.json(result);
  }));

export default router;
