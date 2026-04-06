import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List activities for a farmer (supports filters: type, cropType, from, to)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    const items = await svc.listActivities(req.params.farmerId, req.query);
    res.json(items);
  }));

// Activity summary for a farmer
router.get('/farmer/:farmerId/summary',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getActivitySummary(req.params.farmerId));
  }));

// Create activity
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    if (!req.body.activityType) return res.status(400).json({ error: 'activityType is required' });
    const item = await svc.createActivity(req.params.farmerId, req.body);
    res.status(201).json(item);
  }));

// Get single activity
router.get('/:id',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    const item = await svc.getActivity(req.params.id);
    if (!item) return res.status(404).json({ error: 'Activity not found' });
    res.json(item);
  }));

export default router;
