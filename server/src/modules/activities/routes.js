import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { dedupGuard } from '../../middleware/dedup.js';
import * as svc from './service.js';
import { writeAuditLog } from '../audit/service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// List activities for a farmer (supports filters: type, cropType, from, to)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    const items = await svc.listActivities(req.params.farmerId, req.query);
    res.json(items);
  }));

// Activity summary for a farmer
router.get('/farmer/:farmerId/summary',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.getActivitySummary(req.params.farmerId));
  }));

// Create activity (staff or farmer for own data)
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  dedupGuard('activity'),
  asyncHandler(async (req, res) => {
    if (!req.body.activityType) return res.status(400).json({ error: 'activityType is required' });
    const item = await svc.createActivity(req.params.farmerId, req.body);
    writeAuditLog({ userId: req.user.sub, action: 'activity_created', details: { farmerId: req.params.farmerId, activityType: req.body.activityType } }).catch(() => {});
    res.status(201).json(item);
  }));

// Get single activity (staff only — farmers use the /farmer/:farmerId list)
router.get('/:id',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const item = await svc.getActivity(req.params.id);
    if (!item) return res.status(404).json({ error: 'Activity not found' });
    res.json(item);
  }));

export default router;
