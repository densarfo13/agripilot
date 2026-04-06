import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as lifecycleService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];
const VALID_STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// Get farmer lifecycle state (farmer can view own, staff can view any)
router.get('/farmers/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    const state = await lifecycleService.getLifecycleState(req.params.farmerId);
    res.json(state);
  }));

// Force recompute lifecycle from activities (staff only)
router.post('/farmers/:farmerId/recompute',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const result = await lifecycleService.recomputeLifecycle(req.params.farmerId);
    writeAuditLog({ userId: req.user.sub, action: 'lifecycle_recomputed', details: { farmerId: req.params.farmerId } }).catch(() => {});
    res.json(result);
  }));

// Generate stage-based reminders (staff only)
router.post('/farmers/:farmerId/generate-reminders',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const state = await lifecycleService.getLifecycleState(req.params.farmerId);
    const reminders = await lifecycleService.generateStageReminders(
      req.params.farmerId,
      state.currentStage,
      state.cropType
    );
    writeAuditLog({ userId: req.user.sub, action: 'lifecycle_reminders_generated', details: { farmerId: req.params.farmerId, stage: state.currentStage, count: reminders.length } }).catch(() => {});
    res.json({ stage: state.currentStage, generated: reminders.length, reminders });
  }));

// Get stage metadata/info
router.get('/stage-info/:stage', (req, res) => {
  const { stage } = req.params;
  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` });
  }
  const info = lifecycleService.getStageInfo(stage);
  res.json(info);
});

export default router;
