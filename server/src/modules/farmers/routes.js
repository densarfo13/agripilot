import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID, parsePositiveInt, isValidEmail, validatePassword } from '../../middleware/validate.js';
import { validatePhone, normalizePhoneForStorage } from '../../utils/phoneUtils.js';
import { dedupGuard } from '../../middleware/dedup.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import { inviteLimiter } from '../../middleware/rateLimiters.js';
import { extractOrganization, orgWhereFarmer, verifyOrgAccess } from '../../middleware/orgScope.js';
import prisma from '../../config/database.js';
import * as farmersService from './service.js';
import { inviteFarmer } from '../auth/farmer-registration.js';
import { writeAuditLog } from '../audit/service.js';
import { createNotification } from '../notifications/service.js';
import { sodGuard } from '../../middleware/sodGuard.js';
import { markExecuted } from '../security/service.js';
import { getDeliveryStatusLabel } from '../notifications/deliveryService.js';

const INVITE_EXPIRY_DAYS = parseInt(process.env.INVITE_TOKEN_EXPIRY_DAYS || '7', 10);
function makeInviteExpiry() { const d = new Date(); d.setDate(d.getDate() + INVITE_EXPIRY_DAYS); return d; }

const router = Router();
router.use(authenticate);
router.use(extractOrganization);

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
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), dedupGuard('create-farmer'), idempotencyCheck, asyncHandler(async (req, res) => {
  const { fullName, phone, region } = req.body;
  if (!fullName || !phone || !region) {
    return res.status(400).json({ error: 'fullName, phone, and region are required' });
  }
  const normalizedPhone = normalizePhoneForStorage(phone);
  const phoneCheck = validatePhone(normalizedPhone);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: phoneCheck.message });
  }
  const farmer = await farmersService.createFarmer({ ...req.body, phone: normalizedPhone }, req.user.sub, req.organizationId);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_created', details: { farmerId: farmer.id }, organizationId: req.organizationId }).catch(() => {});
  res.status(201).json({
    farmer,
    credentialsCreated: !!farmer.userAccount,
    inviteToken: farmer._inviteToken || null,
    inviteExpiresAt: farmer._inviteExpiresAt || null,
    deliveryStatus: farmer._inviteToken ? 'manual_share_ready' : null,
    deliveryNote: farmer.userAccount
      ? 'Login account created. Share the credentials with the farmer securely.'
      : 'Farmer created. Copy and share the invite link with the farmer so they can activate their account.',
  });
}));

// Invite farmer (admin/field officer — creates pre-approved farmer record)
router.post('/invite', inviteLimiter, authorize('super_admin', 'institutional_admin', 'field_officer'), dedupGuard('invite-farmer'), idempotencyCheck, asyncHandler(async (req, res) => {
  if (req.body.phone) {
    const normalizedPhone = normalizePhoneForStorage(req.body.phone);
    const phoneCheck = validatePhone(normalizedPhone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.message });
    }
    req.body = { ...req.body, phone: normalizedPhone };
  }
  const farmer = await inviteFarmer({
    ...req.body,
    invitedById: req.user.sub,
    assignedOfficerId: req.body.assignedOfficerId || null,
    organizationId: req.organizationId,
  });

  // Send welcome notification to the farmer
  createNotification(farmer.id, {
    notificationType: 'system',
    title: 'Welcome to AgriPilot',
    message: `You have been invited to AgriPilot by your institution. Your account is active and ready to use.${farmer.userAccount ? ' Log in with the credentials provided by your administrator.' : ' Contact your field officer or administrator to set up your login credentials.'}`,
    metadata: { invitedById: req.user.sub },
  }).catch(() => {});

  writeAuditLog({
    userId: req.user.sub,
    action: 'farmer_invited',
    details: { farmerId: farmer.id, phone: farmer.phone, hasLoginAccount: !!farmer.userAccount },
  }).catch(() => {});

  // Return clear summary including whether credentials were created and invite token
  res.status(201).json({
    farmer,
    credentialsCreated: !!farmer.userAccount,
    inviteToken: farmer._inviteToken || null,
    inviteExpiresAt: farmer.inviteExpiresAt || null,
    deliveryStatus: farmer.inviteDeliveryStatus || null,
    deliveryNote: farmer.userAccount
      ? 'Login account created. Share the credentials with the farmer securely.'
      : 'Invite link generated. Copy and share it with the farmer manually (email/phone delivery not yet configured).',
  });
}));

// List farmers (staff only — farmers cannot enumerate other farmers)
router.get('/', authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), asyncHandler(async (req, res) => {
  const { search, region, registrationStatus } = req.query;
  const result = await farmersService.listFarmers({
    page: parsePositiveInt(req.query.page, 1, 1000),
    limit: parsePositiveInt(req.query.limit, 20, 100),
    search,
    region,
    registrationStatus,
    orgScope: orgWhereFarmer(req),
  });
  res.json(result);
}));

// Pending registrations (convenience alias under /api/farmers)
router.get('/pending-registrations',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const { getPendingRegistrations } = await import('../auth/farmer-registration.js');
    const pending = await getPendingRegistrations(orgWhereFarmer(req));
    res.json(pending);
  }));

// Approve farmer registration (admin only — field officers cannot approve to prevent self-dealing)
router.post('/:id/approve-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-approve'),
  asyncHandler(async (req, res) => {
    const { approveRegistration } = await import('../auth/farmer-registration.js');
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
    }).catch(() => {});
    res.json(result);
  }));

// Reject farmer registration (admin only)
router.post('/:id/reject-registration',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-reject'),
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

// Get farmer by ID (staff only, org-scoped)
router.get('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.getFarmerById(req.params.id);
  if (!verifyOrgAccess(req, farmer.organizationId)) {
    return res.status(403).json({ error: 'Access denied — farmer belongs to another organization' });
  }
  res.json(farmer);
}));

// Update farmer access status (admin only)
// Disabling a farmer is SoD-protected — requires prior approved ApprovalRequest.
// Other status changes (approved, rejected, pending_approval) are not SoD-gated.
router.patch('/:id/access-status',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-access-status'),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const validStatuses = ['pending_approval', 'approved', 'rejected', 'disabled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // SoD gate for the 'disabled' transition only
    if (status === 'disabled') {
      return sodGuard({
        requestType: 'farmer_disable',
        getTargetId: r => r.params.id,
      })(req, res, async () => {
        const result = await farmersService.updateAccessStatus(req.params.id, status, req.user.sub);
        markExecuted(req.approvalRequest.id).catch(() => {});
        writeAuditLog({
          userId: req.user.sub,
          action: 'farmer_access_disabled',
          details: { farmerId: req.params.id, approvalRequestId: req.approvalRequest.id, approvedById: req.approvalRequest.approvedById },
        }).catch(() => {});
        res.json(result);
      });
    }

    // Non-SoD status changes proceed normally
    const result = await farmersService.updateAccessStatus(req.params.id, status, req.user.sub);
    writeAuditLog({
      userId: req.user.sub,
      action: `farmer_access_${status}`,
      details: { farmerId: req.params.id, newStatus: status },
    }).catch(() => {});
    res.json(result);
  }));

// Assign/reassign field officer to farmer (admin only)
router.post('/:id/assign-officer',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('farmer-assign-officer'),
  asyncHandler(async (req, res) => {
    const { officerId } = req.body;
    const result = await farmersService.assignOfficerToFarmer(req.params.id, officerId, req.user.sub);
    writeAuditLog({
      userId: req.user.sub,
      action: officerId ? 'farmer_officer_assigned' : 'farmer_officer_unassigned',
      details: { farmerId: req.params.id, officerId },
    }).catch(() => {});
    res.json(result);
  }));

// Resend invite (admin/field officer — re-invites a farmer)
router.post('/:id/resend-invite',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  dedupGuard('farmer-resend-invite'),
  asyncHandler(async (req, res) => {
    const farmer = await farmersService.getFarmerById(req.params.id);
    if (farmer.selfRegistered) {
      return res.status(400).json({ error: 'Cannot resend invite for self-registered farmers' });
    }
    // Regenerate invite token (only for farmers without a login account)
    const newToken = farmer.userAccount ? null : randomUUID();
    const newExpiry = newToken ? makeInviteExpiry() : null;
    // Update invitedAt, refresh invite token, and reset expiry
    const updated = await prisma.farmer.update({
      where: { id: req.params.id },
      data: {
        invitedAt: new Date(),
        ...(newToken ? {
          inviteToken: newToken,
          inviteExpiresAt: newExpiry,
          inviteDeliveryStatus: 'manual_share_ready',
          inviteChannel: 'link',
        } : {}),
      },
      include: { userAccount: { select: { id: true, email: true } } },
    });

    // Send reminder notification to the farmer
    createNotification(farmer.id, {
      notificationType: 'system',
      title: 'Invitation Reminder',
      message: `You have been re-invited to AgriPilot.${updated.userAccount ? ' Log in with the credentials provided by your administrator.' : ' Contact your field officer or administrator to set up your login credentials.'}`,
      metadata: { resentById: req.user.sub },
    }).catch(() => {});

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_invite_resent',
      details: { farmerId: req.params.id, hasLoginAccount: !!updated.userAccount /* no token logged */ },
    }).catch(() => {});

    res.json({
      message: 'Invite resent',
      farmer: updated,
      hasLoginAccount: !!updated.userAccount,
      inviteToken: newToken || null,
      inviteExpiresAt: newExpiry || null,
      deliveryStatus: newToken ? 'manual_share_ready' : null,
      deliveryNote: updated.userAccount
        ? 'Farmer already has a login account. A reminder notification has been sent.'
        : 'Invite link refreshed. Copy and share the new link with the farmer.',
    });
  }));

// Update farmer (staff only)
router.put('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), asyncHandler(async (req, res) => {
  const farmer = await farmersService.updateFarmer(req.params.id, req.body);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_updated', details: { farmerId: farmer.id } }).catch(() => {});
  res.json(farmer);
}));

// Create login account for a farmer who doesn't have one yet (admin/field officer)
// This is separate from /invite — it's for creating credentials for an existing farmer record.
router.post('/:id/create-login',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  inviteLimiter,
  dedupGuard('farmer-create-login'),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.message });
    }

    const farmer = await farmersService.getFarmerById(req.params.id);
    if (!verifyOrgAccess(req, farmer.organizationId)) {
      return res.status(403).json({ error: 'Access denied — farmer belongs to another organization' });
    }
    if (farmer.userId) {
      return res.status(400).json({ error: 'This farmer already has a login account' });
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered to another account' });
    }

    // Create User + link to Farmer atomically; clear any pending invite token
    const { user, updatedFarmer } = await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          fullName: farmer.fullName,
          role: 'farmer',
          active: true,
          preferredLanguage: farmer.preferredLanguage || 'en',
          organizationId: farmer.organizationId || null,
        },
      });
      const linked = await tx.farmer.update({
        where: { id: farmer.id },
        data: {
          userId: newUser.id,
          inviteToken: null,       // consume any pending invite token
          inviteDeliveryStatus: null,
          inviteChannel: null,
          inviteExpiresAt: null,
        },
        include: { userAccount: { select: { id: true, email: true } } },
      });
      return { user: newUser, updatedFarmer: linked };
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_login_created',
      details: { farmerId: farmer.id, createdForEmail: user.email },
    }).catch(() => {});

    // In-app notification to farmer
    createNotification(farmer.id, {
      notificationType: 'system',
      title: 'Login Account Created',
      message: 'A login account has been created for you. Log in with the email and password provided by your administrator.',
      metadata: { createdById: req.user.sub },
    }).catch(() => {});

    res.status(201).json({
      message: 'Login account created successfully',
      email: user.email,
      farmer: updatedFarmer,
    });
  }));

// Get invite/access status for a farmer (admin/field officer)
router.get('/:id/invite-status',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin', 'reviewer', 'field_officer'),
  asyncHandler(async (req, res) => {
    const farmer = await prisma.farmer.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        registrationStatus: true,
        invitedAt: true,
        inviteExpiresAt: true,
        inviteChannel: true,
        inviteDeliveryStatus: true,
        inviteAcceptedAt: true,
        userId: true,
        userAccount: { select: { id: true, email: true, active: true } },
      },
    });
    if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
    if (!verifyOrgAccess(req, farmer.organizationId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isExpired = farmer.inviteExpiresAt && new Date() > new Date(farmer.inviteExpiresAt) && !farmer.userId;
    const deliveryLabel = getDeliveryStatusLabel(farmer.inviteDeliveryStatus, !!farmer.userId);

    res.json({
      farmerId: farmer.id,
      registrationStatus: farmer.registrationStatus,
      hasLoginAccount: !!farmer.userId,
      loginEmail: farmer.userAccount?.email || null,
      loginActive: farmer.userAccount?.active ?? null,
      invitedAt: farmer.invitedAt,
      inviteExpiresAt: farmer.inviteExpiresAt,
      inviteChannel: farmer.inviteChannel,
      inviteDeliveryStatus: isExpired ? 'expired' : (farmer.inviteDeliveryStatus || null),
      inviteAcceptedAt: farmer.inviteAcceptedAt,
      deliveryStatusLabel: isExpired ? 'Invite Expired' : deliveryLabel.label,
      deliveryStatusCls: isExpired ? 'badge-rejected' : deliveryLabel.cls,
    });
  }));

// Delete farmer (admin only)
router.delete('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  await farmersService.deleteFarmer(req.params.id);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_deleted', details: { farmerId: req.params.id } }).catch(() => {});
  res.json({ message: 'Farmer deleted' });
}));

export default router;
