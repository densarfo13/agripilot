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
  adminDisableUser,
  adminEnableUser,
  adminArchiveUser,
  adminUnarchiveUser,
} from './service.js';
import { sodGuard } from '../../middleware/sodGuard.js';
import { requireStepUp } from '../../middleware/requireStepUp.js';
import { requireMfa } from '../../middleware/requireMfa.js';
import { markExecuted } from '../security/service.js';
import { getPendingRegistrations, getAllSelfRegistered, approveRegistration, rejectRegistration } from './farmer-registration.js';

const router = Router();
router.use(authenticate);
router.use(requireMfa);
router.use(extractOrganization);

// ─── User Management (admin-only, org-scoped) ─────────

// List all users (scoped to organization)
// ?status=active|disabled|archived — defaults to excluding archived users
router.get('/', authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { status } = req.query;
  const base = orgWhereUser(req);

  let statusFilter = {};
  if (status === 'active') {
    statusFilter = { active: true, archivedAt: null };
  } else if (status === 'disabled') {
    statusFilter = { active: false, archivedAt: null };
  } else if (status === 'archived') {
    statusFilter = { archivedAt: { not: null } };
  } else {
    // Default: exclude archived users
    statusFilter = { archivedAt: null };
  }

  const page  = Math.max(1, parseInt(req.query.page  || '1',   10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10)));

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { ...base, ...statusFilter },
      select: {
        id: true, email: true, fullName: true, role: true, active: true, archivedAt: true, createdAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: { ...base, ...statusFilter } }),
  ]);
  res.json({ users, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

// Create user (super_admin only — assigns to org)
router.post('/', authorize('super_admin'), dedupGuard('admin-create-user'), asyncHandler(async (req, res) => {
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
        id: true, email: true, fullName: true, role: true, active: true, archivedAt: true,
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
  requireStepUp(),
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
  requireStepUp(),
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

// Toggle user active status — kept for backward compatibility; new code should use /disable and /enable
// Now extended to institutional_admin with org-scope enforcement
router.patch('/:id/toggle-active',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireStepUp(),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (targetId === req.user.sub) return res.status(403).json({ error: 'Cannot toggle your own account' });

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, fullName: true, role: true, active: true, archivedAt: true, organizationId: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.archivedAt) return res.status(409).json({ error: 'User is archived. Unarchive before toggling status' });

    if (req.user.role === 'institutional_admin') {
      if (user.role === 'super_admin') return res.status(403).json({ error: 'Institutional admins cannot modify super admin accounts' });
      if (user.organizationId !== req.organizationId) return res.status(403).json({ error: 'Cannot modify users outside your organization' });
    }

    const newActive = !user.active;
    const updated = await prisma.user.update({
      where: { id: targetId },
      data: { active: newActive },
      select: { id: true, email: true, fullName: true, role: true, active: true, archivedAt: true },
    });
    invalidateAuthCache(targetId);

    writeAuditLog({
      userId: req.user.sub,
      action: newActive ? 'user_enabled' : 'user_disabled',
      details: { targetUserId: user.id, previousActive: user.active, newActive },
      organizationId: req.organizationId,
    }).catch(() => {});
    res.json(updated);
  }));

// ─── Explicit Offboarding Routes ─────────────────────────────────────────────

// Disable a user — revoke login access, preserve all history
// super_admin: any non-self user | institutional_admin: own-org non-super_admin only
router.post('/:id/disable',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireStepUp(),
  asyncHandler(async (req, res) => {
    const { user, previousActive } = await adminDisableUser({
      targetUserId: req.params.id,
      actorId: req.user.sub,
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
    });
    invalidateAuthCache(req.params.id);
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_disabled',
      details: { targetUserId: req.params.id, previousActive, newActive: false },
      organizationId: req.organizationId,
      previousStatus: 'active',
      newStatus: 'disabled',
    }).catch(() => {});
    res.json(user);
  }));

// Re-enable a disabled user — restore login access
// super_admin: any user | institutional_admin: own-org non-super_admin only
router.post('/:id/enable',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  requireStepUp(),
  asyncHandler(async (req, res) => {
    const { user, previousActive } = await adminEnableUser({
      targetUserId: req.params.id,
      actorId: req.user.sub,
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
    });
    invalidateAuthCache(req.params.id);
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_enabled',
      details: { targetUserId: req.params.id, previousActive, newActive: true },
      organizationId: req.organizationId,
      previousStatus: 'disabled',
      newStatus: 'active',
    }).catch(() => {});
    res.json(user);
  }));

// Archive a user (soft delete — super_admin only)
// Sets active=false + archivedAt. Preserves all linked records. Reversible.
router.post('/:id/archive',
  validateParamUUID('id'),
  authorize('super_admin'),
  requireStepUp(),
  asyncHandler(async (req, res) => {
    const { user } = await adminArchiveUser({
      targetUserId: req.params.id,
      actorId: req.user.sub,
    });
    invalidateAuthCache(req.params.id);
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_archived',
      details: { targetUserId: req.params.id },
      organizationId: user.organizationId,
      previousStatus: 'active',
      newStatus: 'archived',
    }).catch(() => {});
    res.json(user);
  }));

// Unarchive a user (super_admin only)
// Removes archivedAt — does NOT re-enable; admin must explicitly call /enable after.
router.post('/:id/unarchive',
  validateParamUUID('id'),
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const { user } = await adminUnarchiveUser({ targetUserId: req.params.id });
    writeAuditLog({
      userId: req.user.sub,
      action: 'user_unarchived',
      details: { targetUserId: req.params.id },
      organizationId: user.organizationId,
      previousStatus: 'archived',
      newStatus: 'disabled',
    }).catch(() => {});
    res.json(user);
  }));

// Admin reset user password (super_admin only, rate limited)
// Force-resetting a privileged account (super_admin or institutional_admin) is SoD-protected.
router.patch('/:id/reset-password',
  validateParamUUID('id'),
  authorize('super_admin'),
  workflowLimiter,
  requireStepUp(),
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
