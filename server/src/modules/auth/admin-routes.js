import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize, invalidateAuthCache } from '../../middleware/auth.js';
import { extractOrganization, orgWhereUser, orgWhereFarmer, invalidateOrgCache } from '../../middleware/orgScope.js';
import { validateParamUUID, isValidEmail, validatePassword } from '../../middleware/validate.js';
import { workflowLimiter } from '../../middleware/rateLimiters.js';
import { dedupGuard } from '../../middleware/dedup.js';
import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '../audit/service.js';
import {
  adminResetPassword,
  adminUpdateUserProfile,
  adminChangeUserRole,
  adminChangeUserOrg,
} from './service.js';
import { sodGuard } from '../../middleware/sodGuard.js';
import { markExecuted } from '../security/service.js';
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

// Get single user (super_admin or own-org institutional_admin)
router.get('/:id',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const where = { id: req.params.id, ...orgWhereUser(req) };
    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true, email: true, fullName: true, role: true, active: true,
        preferredLanguage: true, organizationId: true, createdAt: true, lastLoginAt: true,
        organization: { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  }));

// Update user profile — fullName, preferredLanguage, email (super_admin only for email)
router.patch('/:id',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const { fullName, preferredLanguage, email } = req.body;
    const { user, previous } = await adminUpdateUserProfile({
      targetUserId: req.params.id,
      actorId: req.user.sub,
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
      updates: { fullName, preferredLanguage, email },
    });
    // If email changed, flush auth cache so next token check picks up new email
    if (email && previous.email !== email) invalidateAuthCache(req.params.id);
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_profile_updated',
      details: { targetUserId: req.params.id, changes: { fullName, preferredLanguage, ...(email ? { email } : {}) } },
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(user);
  }));

// Change user role (cannot self-escalate; institutional_admin scope-limited)
// Escalation to super_admin or institutional_admin is SoD-protected.
const PRIVILEGED_ROLES = new Set(['super_admin', 'institutional_admin']);

router.patch('/:id/role',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  workflowLimiter,
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });

    // SoD gate for privileged role assignments
    if (PRIVILEGED_ROLES.has(role)) {
      return sodGuard({
        requestType: 'role_escalation',
        getTargetId: r => r.params.id,
      })(req, res, async () => {
        const { user, previousRole } = await adminChangeUserRole({
          targetUserId: req.params.id,
          newRole: role,
          actorId: req.user.sub,
          actorRole: req.user.role,
          actorOrgId: req.organizationId,
        });
        invalidateAuthCache(req.params.id);
        markExecuted(req.approvalRequest.id).catch(() => {});
        writeAuditLog({
          userId: req.user.sub,
          action: 'user_role_changed',
          details: { targetUserId: req.params.id, previousRole, newRole: role, approvalRequestId: req.approvalRequest.id },
          organizationId: req.organizationId,
        }).catch(() => {});
        res.json(user);
      });
    }

    // Non-privileged role changes proceed without SoD
    const { user, previousRole } = await adminChangeUserRole({
      targetUserId: req.params.id,
      newRole: role,
      actorId: req.user.sub,
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
    });
    invalidateAuthCache(req.params.id);
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_role_changed',
      details: { targetUserId: req.params.id, previousRole, newRole: role },
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(user);
  }));

// Change user organization (super_admin only — SoD-protected, cannot change own org)
router.patch('/:id/organization',
  validateParamUUID('id'),
  authorize('super_admin'),
  sodGuard({ requestType: 'user_org_transfer', getTargetId: req => req.params.id }),
  asyncHandler(async (req, res) => {
    const { organizationId } = req.body;
    const { user, previousOrgId } = await adminChangeUserOrg({
      targetUserId: req.params.id,
      newOrgId: organizationId || null,
      actorId: req.user.sub,
    });
    invalidateAuthCache(req.params.id);
    invalidateOrgCache(req.params.id);
    markExecuted(req.approvalRequest.id).catch(() => {});
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_org_changed',
      details: { targetUserId: req.params.id, previousOrgId, newOrgId: organizationId || null, approvalRequestId: req.approvalRequest.id },
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(user);
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
// Force-resetting a privileged account (super_admin or institutional_admin) is SoD-protected.
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

    // Check if target is a privileged account
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (PRIVILEGED_ROLES.has(targetUser.role)) {
      // SoD gate for privileged account password reset
      return sodGuard({
        requestType: 'privileged_reset',
        getTargetId: r => r.params.id,
      })(req, res, async () => {
        const result = await adminResetPassword({ targetUserId: req.params.id, newPassword });
        markExecuted(req.approvalRequest.id).catch(() => {});
        writeAuditLog({
          userId: req.user.sub, action: 'password_reset',
          details: { targetUserId: req.params.id, privileged: true, approvalRequestId: req.approvalRequest.id },
        }).catch(() => {});
        res.json(result);
      });
    }

    // Non-privileged reset proceeds without SoD
    const result = await adminResetPassword({ targetUserId: req.params.id, newPassword });
    writeAuditLog({ userId: req.user.sub, action: 'password_reset', details: { targetUserId: req.params.id } }).catch(() => {});
    res.json(result);
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
