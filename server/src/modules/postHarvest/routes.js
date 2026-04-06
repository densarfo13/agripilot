import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import * as svc from './service.js';

const VALID_STORAGE_METHODS = ['sealed_bags', 'hermetic_bag', 'open_air', 'warehouse', 'silo', 'traditional', 'cold_storage', 'other'];
const VALID_STORAGE_CONDITIONS = ['good', 'fair', 'poor', 'deteriorating', 'unknown'];

const router = Router();
router.use(authenticate);

// ─── Storage Status ─────────────────────────────────────

// Get all storage statuses for a farmer
router.get('/storage/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getStorageStatus(req.params.farmerId));
  }));

// Storage dashboard (summary + enriched items)
router.get('/storage/farmer/:farmerId/dashboard',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    res.json(await svc.getStorageDashboard(req.params.farmerId));
  }));

// Upsert storage status (create or update by crop)
router.post('/storage/farmer/:farmerId',
  validateParamUUID('farmerId'),
  asyncHandler(async (req, res) => {
    // Validate enum values if provided
    if (req.body.storageMethod && !VALID_STORAGE_METHODS.includes(req.body.storageMethod)) {
      return res.status(400).json({ error: `Invalid storageMethod. Must be one of: ${VALID_STORAGE_METHODS.join(', ')}` });
    }
    if (req.body.storageCondition && !VALID_STORAGE_CONDITIONS.includes(req.body.storageCondition)) {
      return res.status(400).json({ error: `Invalid storageCondition. Must be one of: ${VALID_STORAGE_CONDITIONS.join(', ')}` });
    }
    res.json(await svc.upsertStorageStatus(req.params.farmerId, req.body));
  }));

// Get single storage status
router.get('/storage/:id',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
    const item = await svc.getStorageStatusById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Storage status not found' });
    res.json(item);
  }));

// ─── Storage Guidance ───────────────────────────────────

// Get storage guidance for a crop (optional: ?country=TZ)
router.get('/guidance/:cropType', (req, res) => {
  const country = req.query.country || 'KE';
  res.json(svc.getStorageGuidance(req.params.cropType, country));
});

export default router;
