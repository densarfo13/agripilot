import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as lifecycleService from './service.js';

const VALID_STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];

const router = Router();
router.use(authenticate);

// Get farmer lifecycle state
router.get('/farmers/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    const state = await lifecycleService.getLifecycleState(req.params.farmerId);
    res.json(state);
  }));

// Force recompute lifecycle from activities
router.post('/farmers/:farmerId/recompute',
  validateParamUUID('farmerId'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const result = await lifecycleService.recomputeLifecycle(req.params.farmerId);
    res.json(result);
  }));

// Generate stage-based reminders
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
