import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// List activities for a farmer (supports filters: type, cropType, from, to)
router.get('/farmer/:farmerId', async (req, res, next) => {
  try {
    const items = await svc.listActivities(req.params.farmerId, req.query);
    res.json(items);
  } catch (e) { next(e); }
});

// Activity summary for a farmer
router.get('/farmer/:farmerId/summary', async (req, res, next) => {
  try {
    res.json(await svc.getActivitySummary(req.params.farmerId));
  } catch (e) { next(e); }
});

// Create activity
router.post('/farmer/:farmerId', async (req, res, next) => {
  try {
    if (!req.body.activityType) return res.status(400).json({ error: 'activityType is required' });
    const item = await svc.createActivity(req.params.farmerId, req.body);
    res.status(201).json(item);
  } catch (e) { next(e); }
});

// Get single activity
router.get('/:id', async (req, res, next) => {
  try {
    const item = await svc.getActivity(req.params.id);
    if (!item) return res.status(404).json({ error: 'Activity not found' });
    res.json(item);
  } catch (e) { next(e); }
});

export default router;
