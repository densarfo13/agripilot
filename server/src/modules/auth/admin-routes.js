import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, invalidateAuthCache } from '../../middleware/auth.js';
import { extractOrganization, orgWhereUser, orgWhereFarmer } from '../../middleware/orgScope.js';
import { validateParamUUID, isValidEmail, validatePassword } from '../../middleware/validate.js';
import { workflowLimiter } from '../../middleware/rateLimiters.js';
import { dedupGuard } from '../../middleware/dedup.js';
import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '../audit/service.js';
import { adminResetPassword } from './service.js';
import { getPendingRegistrations, getAllSelfRegistered, approveRegistration, rejectRegistration } from './farmer-registration.js';

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

// ─── User Management (admin-only, org-scoped) ─────────

// List all users (scoped to organization)
router.get('/', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const where = orgWhereUser(req);
  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, email: true, fullName: true, role: true, active: true, createdAt: true,
      organizationId: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}));

// Create user (super_admin only — assigns to org)
router.post('/', authorize('super_admin'), asyncHandler(async (req, res) => {
  const { email, password, fullName, role, organizationId } = req.body;
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

  // Use provided organizationId or fall back to creator's org
  const targetOrgId = organizationId || req.organizationId || null;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName: fullName.trim(),
      role,
      organizationId: targetOrgId,
    },
    select: {
      id: true, email: true, fullName: true, role: true, active: true, createdAt: true,
      organizationId: true,
    },
  });

  writeAuditLog({ userId: req.user.sub, action: 'user_created', details: { newUserId: user.id, role }, organizationId: targetOrgId }).catch(() => {});
  res.status(201).json(user);
}));

// Toggle user active status (super_admin only)
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
    invalidateAuthCache(req.params.id);

    writeAuditLog({ userId: req.user.sub, action: user.active ? 'user_deactivated' : 'user_activated', details: { targetUserId: user.id } }).catch(() => {});
    res.json(updated);
  }));

// Admin reset user password (super_admin only, rate limited)
router.patch('/:id/reset-password',
  validateParamUUID('id'),
  authorize('super_admin'),
  workflowLimiter,
  dedupGuard('password-reset'),
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

// ─── Farmer Registration Management (org-scoped) ──────

// List pending farmer registrations (scoped to organization)
router.get('/pending-registrations',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const pending = await getPendingRegistrations(orgWhereFarmer(req));
    res.json(pending);
  }));

// List all self-registered farmers (any status, org-scoped)
router.get('/self-registered',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const all = await getAllSelfRegistered(orgWhereFarmer(req));
    res.json(all);
  }));

// Approve farmer registration (admin only — field officers cannot approve)
router.post('/:id/approve-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-approve'),
  asyncHandler(async (req, res) => {
    const { assignedOfficerId } = req.body;
    const result = await approveRegistration({
      farmerId: req.params.id,
      approvedById: req.user.sub,
      assignedOfficerId,
      organizationId: req.organizationId,
    });
    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_registration_approved',
      details: { farmerId: req.params.id, assignedOfficerId, organizationId: req.organizationId },
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(result);
  }));

// Reject farmer registration (admin only)
router.post('/:id/reject-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-reject'),
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
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(result);
  }));

export default router;
