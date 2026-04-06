import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const router = Router();
router.use(authenticate);

// Crop demand summary (aggregated) — must be before /:id routes
router.get('/demand/summary', asyncHandler(async (req, res) => {
  res.json(await svc.getCropDemandSummary(req.query.cropType, req.query.country));
}));

// List interests for a farmer (supports filters: status, cropType)
router.get('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.listInterests(req.params.farmerId, req.query));
  }));

// Express interest (create)
router.post('/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    if (!req.body.cropType) {
      return res.status(400).json({ error: 'cropType is required' });
    }
    res.status(201).json(await svc.expressInterest(req.params.farmerId, req.body));
  }));

// Get single interest
router.get('/:id',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getInterest(req.params.id));
  }));

// Update interest status
router.patch('/:id/status',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    if (!req.body.status) {
      return res.status(400).json({ error: 'status is required' });
    }
    res.json(await svc.updateInterestStatus(req.params.id, req.body.status));
  }));

// Withdraw interest (shortcut)
router.patch('/:id/withdraw',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    res.json(await svc.withdrawInterest(req.params.id));
  }));

export default router;
