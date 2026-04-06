import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID, parsePositiveInt } from '../../middleware/validate.js';
import * as farmersService from './service.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// Create farmer
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const { fullName, phone, region } = req.body;
  if (!fullName || !phone || !region) {
    return res.status(400).json({ error: 'fullName, phone, and region are required' });
  }
  const farmer = await farmersService.createFarmer(req.body, req.user.sub);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_created', details: { farmerId: farmer.id } }).catch(() => {});
  res.status(201).json(farmer);
}));

// List farmers
router.get('/', asyncHandler(async (req, res) => {
  const { search, region } = req.query;
  const result = await farmersService.listFarmers({
    page: parsePositiveInt(req.query.page, 1, 1000),
    limit: parsePositiveInt(req.query.limit, 20, 100),
    search,
    region,
  });
  res.json(result);
}));

// Get farmer by ID
router.get('/:id', validateParamUUID('id'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.getFarmerById(req.params.id);
  res.json(farmer);
}));

// Update farmer
router.put('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.updateFarmer(req.params.id, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_updated', details: { farmerId: farmer.id } }).catch(() => {});
  res.json(farmer);
}));

// Delete farmer
router.delete('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  await farmersService.deleteFarmer(req.params.id);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_deleted', details: { farmerId: req.params.id } }).catch(() => {});
  res.json({ message: 'Farmer deleted' });
}));

export default router;
