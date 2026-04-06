import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID, isValidEmail, validatePassword } from '../../middleware/validate.js';
import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '../audit/service.js';
import { adminResetPassword } from './service.js';
import { getPendingRegistrations, getAllSelfRegistered, approveRegistration, rejectRegistration } from './farmer-registration.js';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin', 'institutional_admin'));

// List all users
router.get('/', asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

// Create user (admin-only registration)
router.post('/', authorize('super_admin'), asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const validRoles = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer', 'farmer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase().trim(), passwordHash, fullName: fullName.trim(), role },
    select: { id: true, email: true, fullName: true, role: true, active: true, createdAt: true },
  });

  writeAuditLog({ userId: req.user.sub, action: 'user_created', details: { newUserId: user.id, role } }).catch(() => {});
  res.status(201).json(user);
}));

// Toggle user active status
router.patch('/:id/toggle-active',
  validateParamUUID('id'),
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { active: !user.active },
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });

    writeAuditLog({ userId: req.user.sub, action: user.active ? 'user_deactivated' : 'user_activated', details: { targetUserId: user.id } }).catch(() => {});
    res.json(updated);
  }));

// Admin reset user password
router.patch('/:id/reset-password',
  validateParamUUID('id'),
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'newPassword is required' });
    }
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const result = await adminResetPassword({ targetUserId: req.params.id, newPassword });
    writeAuditLog({ userId: req.user.sub, action: 'password_reset', details: { targetUserId: req.params.id } }).catch(() => {});
    res.json(result);
  }));

// ─── Farmer Registration Management ────────────────────

// List pending farmer registrations
router.get('/pending-registrations', asyncHandler(async (req, res) => {
  const pending = await getPendingRegistrations();
  res.json(pending);
}));

// List all self-registered farmers (any status)
router.get('/self-registered', asyncHandler(async (req, res) => {
  const all = await getAllSelfRegistered();
  res.json(all);
}));

// Approve farmer registration
router.post('/:id/approve-registration',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
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

// Reject farmer registration
router.post('/:id/reject-registration',
  validateParamUUID('id'),
  asyncHandler(async (req, res) => {
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

export default router;
