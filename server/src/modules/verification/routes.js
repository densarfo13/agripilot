import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as verificationService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Run verification engine for an application
router.post('/:applicationId/run',
  validateParamUUID('applicationId'),
  authorize('super_admin', 'institutional_admin', 'reviewer'),
  asyncHandler(async (req, res) => {
    const result = await verificationService.runVerification(req.params.applicationId);
    writeAuditLog({
      applicationId: req.params.applicationId, userId: req.user.sub,
      action: 'verification_run', details: { score: result.verificationScore, confidence: result.confidence },
      ipAddress: req.ip,
    }).catch(() => {});
    res.json(result);
  }));

// Get verification result
router.get('/:applicationId',
  validateParamUUID('applicationId'),
  asyncHandler(async (req, res) => {
    const result = await verificationService.getVerificationResult(req.params.applicationId);
    if (!result) return res.status(404).json({ error: 'No verification result found' });
    res.json(result);
  }));

export default router;
