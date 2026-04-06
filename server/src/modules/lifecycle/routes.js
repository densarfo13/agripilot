import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as lifecycleService from './service.js';

const router = Router();
router.use(authenticate);

// Get farmer lifecycle state
router.get('/farmers/:farmerId', async (req, res, next) => {
  try {
    const state = await lifecycleService.getLifecycleState(req.params.farmerId);
    res.json(state);
  } catch (e) { next(e); }
});

// Force recompute lifecycle from activities
router.post('/farmers/:farmerId/recompute', async (req, res, next) => {
  try {
    const result = await lifecycleService.recomputeLifecycle(req.params.farmerId);
    res.json(result);
  } catch (e) { next(e); }
});

// Generate stage-based reminders
router.post('/farmers/:farmerId/generate-reminders', async (req, res, next) => {
  try {
    const state = await lifecycleService.getLifecycleState(req.params.farmerId);
    const reminders = await lifecycleService.generateStageReminders(
      req.params.farmerId,
      state.currentStage,
      state.cropType
    );
    res.json({ stage: state.currentStage, generated: reminders.length, reminders });
  } catch (e) { next(e); }
});

// Get stage metadata/info
router.get('/stage-info/:stage', (req, res) => {
  const info = lifecycleService.getStageInfo(req.params.stage);
  res.json(info);
});

export default router;
