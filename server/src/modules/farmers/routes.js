import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, requireApprovedFarmer } from '../../middleware/auth.js';
import { validateParamUUID, parsePositiveInt } from '../../middleware/validate.js';
import * as farmersService from './service.js';
import { inviteFarmer } from '../auth/farmer-registration.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();
router.use(authenticate);

// ─── Farmer's own profile (farmer-role users) ──────────

// GET /api/farmers/me — farmer views own profile (works for pending too)
router.get('/me', asyncHandler(async (req, res) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ error: 'Only farmer accounts can access this endpoint' });
  }
  const profile = await farmersService.getMyFarmerProfile(req.user.sub);
  if (!profile) {
    return res.status(404).json({ error: 'Farmer profile not found' });
  }
  res.json(profile);
}));

// ─── Staff-only routes ─────────────────────────────────

// Create farmer (staff creates on behalf of farmer — auto-approved)
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const { fullName, phone, region } = req.body;
  if (!fullName || !phone || !region) {
    return res.status(400).json({ error: 'fullName, phone, and region are required' });
  }
  const farmer = await farmersService.createFarmer(req.body, req.user.sub);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_created', details: { farmerId: farmer.id } }).catch(() => {});
  res.status(201).json(farmer);
}));

// Invite farmer (admin/field officer — creates pre-approved farmer record)
router.post('/invite', authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await inviteFarmer({
    ...req.body,
    invitedById: req.user.sub,
    assignedOfficerId: req.body.assignedOfficerId || null,
  });
  writeAuditLog({
    userId: req.user.sub,
    action: 'farmer_invited',
    details: { farmerId: farmer.id, phone: farmer.phone },
  }).catch(() => {});
  res.status(201).json(farmer);
}));

// List farmers (staff only — farmers cannot enumerate other farmers)
router.get('/', authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), asyncHandler(async (req, res) => {
  const { search, region } = req.query;
  const result = await farmersService.listFarmers({
    page: parsePositiveInt(req.query.page, 1, 1000),
    limit: parsePositiveInt(req.query.limit, 20, 100),
    search,
    region,
  });
  res.json(result);
}));

// Pending registrations (convenience alias under /api/farmers)
router.get('/pending-registrations',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const { getPendingRegistrations } = await import('../auth/farmer-registration.js');
    const pending = await getPendingRegistrations();
    res.json(pending);
  }));

// Approve farmer registration (admin only — field officers cannot approve to prevent self-dealing)
router.post('/:id/approve-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { approveRegistration } = await import('../auth/farmer-registration.js');
    const { assignedOfficerId } = req.body;
    const result = await approveRegistration({
      farmerId: req.params.id,
      approvedById: req.user.sub,
      assignedOfficerId,
    });
    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_registration_approved',
      details: { farmerId: req.params.id, assignedOfficerId },
    }).catch(() => {});
    res.json(result);
  }));

// Reject farmer registration (admin only)
router.post('/:id/reject-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { rejectRegistration } = await import('../auth/farmer-registration.js');
    const { rejectionReason } = req.body;
    const result = await rejectRegistration({
      farmerId: req.params.id,
      rejectedById: req.user.sub,
      rejectionReason,
    });
    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_registration_rejected',
      details: { farmerId: req.params.id, rejectionReason },
    }).catch(() => {});
    res.json(result);
  }));

// Get farmer by ID (staff only)
router.get('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.getFarmerById(req.params.id);
  res.json(farmer);
}));

// Update farmer (staff only)
router.put('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.updateFarmer(req.params.id, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_updated', details: { farmerId: farmer.id } }).catch(() => {});
  res.json(farmer);
}));

// Delete farmer (admin only)
router.delete('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  await farmersService.deleteFarmer(req.params.id);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_deleted', details: { farmerId: req.params.id } }).catch(() => {});
  res.json({ message: 'Farmer deleted' });
}));

export default router;
