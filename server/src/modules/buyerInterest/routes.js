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

// Crop demand summary (aggregated) — must be before /:id routes
router.get('/demand/summary',
  authorize(...STAFF_ROLES, 'farmer'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getCropDemandSummary(req.query.cropType, req.query.country));
  }));

// List interests for a farmer (supports filters: status, cropType)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.listInterests(req.params.farmerId, req.query));
  }));

// Express interest (create — farmer for own data or staff)
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  dedupGuard('buyer-interest'),
  asyncHandler(async (req, res) => {
    if (!req.body.cropType) {
      return res.status(400).json({ error: 'cropType is required' });
    }
    const interest = await svc.expressInterest(req.params.farmerId, req.body);
    writeAuditLog({ userId: req.user.sub, action: 'buyer_interest_created', details: { farmerId: req.params.farmerId, cropType: req.body.cropType } }).catch(() => {});
    res.status(201).json(interest);
  }));

// Get single interest (staff only)
router.get('/:id',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    res.json(await svc.getInterest(req.params.id));
  }));

// Update interest status (staff only)
router.patch('/:id/status',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  dedupGuard('interest-status'),
  asyncHandler(async (req, res) => {
    const VALID_INTEREST_STATUSES = ['interested', 'contacted', 'negotiating', 'agreed', 'completed', 'withdrawn', 'expired'];
    if (!req.body.status) {
      return res.status(400).json({ error: 'status is required' });
    }
    if (!VALID_INTEREST_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_INTEREST_STATUSES.join(', ')}` });
    }
    const result = await svc.updateInterestStatus(req.params.id, req.body.status);
    writeAuditLog({ userId: req.user.sub, action: 'buyer_interest_status_changed', details: { interestId: req.params.id, status: req.body.status } }).catch(() => {});
    res.json(result);
  }));

// Withdraw interest (farmer for own data or staff)
router.patch('/:id/withdraw',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES, 'farmer'),
  asyncHandler(async (req, res) => {
    res.json(await svc.withdrawInterest(req.params.id));
  }));

export default router;
