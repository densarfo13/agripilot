import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer, requireFarmerOwnership } from '../../middleware/auth.js';
import { validateParamUUID } from '../../middleware/validate.js';
import { DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import * as svc from './service.js';
import { writeAuditLog } from '../audit/service.js';

const STAFF_ROLES = ['super_admin', 'institutional_admin', 'field_officer', 'reviewer'];
const VALID_STORAGE_METHODS = ['sealed_bags', 'hermetic_bag', 'open_air', 'warehouse', 'silo', 'traditional', 'cold_storage', 'other'];
const VALID_STORAGE_CONDITIONS = ['good', 'fair', 'poor', 'deteriorating', 'unknown'];

const router = Router();
router.use(authenticate);
router.use(requireApprovedFarmer);

// ─── Storage Status ─────────────────────────────────────

// Get all storage statuses for a farmer
router.get('/storage/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.getStorageStatus(req.params.farmerId));
  }));

// Storage dashboard (summary + enriched items)
router.get('/storage/farmer/:farmerId/dashboard',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    res.json(await svc.getStorageDashboard(req.params.farmerId));
  }));

// Upsert storage status (create or update by crop — farmer for own data or staff)
router.post('/storage/farmer/:farmerId',
  validateParamUUID('farmerId'),
  authorize(...STAFF_ROLES, 'farmer'),
  requireFarmerOwnership,
  asyncHandler(async (req, res) => {
    // Validate required fields
    if (!req.body.cropType) {
      return res.status(400).json({ error: 'cropType is required' });
    }
    // Validate enum values if provided
    if (req.body.storageMethod && !VALID_STORAGE_METHODS.includes(req.body.storageMethod)) {
      return res.status(400).json({ error: `Invalid storageMethod. Must be one of: ${VALID_STORAGE_METHODS.join(', ')}` });
    }
    if (req.body.storageCondition && !VALID_STORAGE_CONDITIONS.includes(req.body.storageCondition)) {
      return res.status(400).json({ error: `Invalid storageCondition. Must be one of: ${VALID_STORAGE_CONDITIONS.join(', ')}` });
    }
    const result = await svc.upsertStorageStatus(req.params.farmerId, req.body);
    writeAuditLog({ userId: req.user.sub, action: 'storage_status_updated', details: { farmerId: req.params.farmerId, cropType: req.body.cropType } }).catch(() => {});
    res.json(result);
  }));

// Get single storage status (staff only)
router.get('/storage/:id',
  validateParamUUID('id'),
  authorize(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const item = await svc.getStorageStatusById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Storage status not found' });
    res.json(item);
  }));

// ─── Storage Guidance ───────────────────────────────────

// Get storage guidance for a crop (optional: ?country=TZ)
router.get('/guidance/:cropType', (req, res) => {
  const country = req.query.country || DEFAULT_COUNTRY_CODE;
  res.json(svc.getStorageGuidance(req.params.cropType, country));
});

export default router;
