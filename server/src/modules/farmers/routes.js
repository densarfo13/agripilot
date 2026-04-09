import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validateParamUUID, parsePositiveInt, isValidEmail, validatePassword } from '../../middleware/validate.js';
import { validatePhone, normalizePhoneForStorage } from '../../utils/phoneUtils.js';
import { dedupGuard } from '../../middleware/dedup.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import { inviteLimiter, resendInviteLimiter, uploadLimiter } from '../../middleware/rateLimiters.js';
import { extractOrganization, orgWhereFarmer, verifyOrgAccess } from '../../middleware/orgScope.js';
import { uploadCleanup } from '../../middleware/uploadCleanup.js';
import { config } from '../../config/index.js';
import prisma from '../../config/database.js';
import * as farmersService from './service.js';
import { inviteFarmer } from '../auth/farmer-registration.js';
import { writeAuditLog } from '../audit/service.js';
import { opsEvent, logUploadEvent } from '../../utils/opsLogger.js';
import { createNotification } from '../notifications/service.js';
import { sodGuard } from '../../middleware/sodGuard.js';
import { markExecuted } from '../security/service.js';
import { getDeliveryStatusLabel, dispatchInvite } from '../notifications/deliveryService.js';

// ─── Profile photo upload (multer) ───────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.upload.dir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `profile-${uuidv4()}${ext}`);
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: (config.upload.maxFileSizeMB || 5) * 1024 * 1024 }, // Uses config (default 10 MB), aligned with client validation
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed. Accepted: JPEG, PNG, WebP'), false);
  },
});

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

// Check for duplicate farmers (staff-facing — returns warning, not block)
router.post('/check-duplicate',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const { phone, fullName, region } = req.body;
    const result = await farmersService.checkDuplicateFarmer({
      phone, fullName, region,
      organizationId: req.organizationId,
    });
    res.json(result);
  }));

// Create farmer (staff creates on behalf of farmer — auto-approved)
router.post('/', authorize('super_admin', 'institutional_admin', 'field_officer'), dedupGuard('create-farmer'), idempotencyCheck, asyncHandler(async (req, res) => {
  const { fullName, phone, region, channel, contactEmail } = req.body;
  if (!fullName || !phone || !region) {
    opsEvent('workflow', 'validation_failure', 'warn', { endpoint: 'POST /farmers', reason: 'missing_required_fields', userId: req.user?.sub, ip: req.ip });
    return res.status(400).json({ error: 'fullName, phone, and region are required' });
  }
  const normalizedPhone = normalizePhoneForStorage(phone);
  const phoneCheck = validatePhone(normalizedPhone);
  if (!phoneCheck.valid) {
    opsEvent('workflow', 'validation_failure', 'warn', { endpoint: 'POST /farmers', reason: 'invalid_phone', phone: normalizedPhone, userId: req.user?.sub, ip: req.ip });
    return res.status(400).json({ error: phoneCheck.message });
  }

  // Duplicate phone check — block exact phone match to prevent silent duplicates
  const dupCheck = await farmersService.checkDuplicateFarmer({
    phone: normalizedPhone, fullName, region,
    organizationId: req.organizationId,
  });
  const exactPhoneMatch = dupCheck.duplicates.find(d => d.phone === normalizedPhone);
  if (exactPhoneMatch && !req.body.confirmDuplicate) {
    return res.status(409).json({
      error: `A farmer with phone ${normalizedPhone} already exists (${exactPhoneMatch.fullName}, ${exactPhoneMatch.region}).`,
      duplicates: dupCheck.duplicates,
      requiresConfirmation: true,
    });
  }

  const farmer = await farmersService.createFarmer({ ...req.body, phone: normalizedPhone }, req.user.sub, req.organizationId);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_created', details: { farmerId: farmer.id }, organizationId: req.organizationId }).catch(() => {});

  // Attempt invite delivery if an invite token was generated and a channel was requested
  let deliveryResult = { delivered: false, channel: 'link', deliveryStatus: farmer._inviteToken ? 'manual_share_ready' : null };
  if (farmer._inviteToken && !farmer.userAccount && channel && channel !== 'link') {
    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendBase}/accept-invite?token=${farmer._inviteToken}`;
    deliveryResult = await dispatchInvite({
      channel,
      toEmail: contactEmail || null,
      toPhone: normalizedPhone,
      farmerName: fullName,
      inviteUrl,
      inviterName: req.user.fullName || null,
      expiresAt: farmer._inviteExpiresAt,
    });
    // Persist the actual delivery outcome
    if (deliveryResult.deliveryStatus) {
      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          inviteDeliveryStatus: deliveryResult.deliveryStatus,
          inviteChannel: deliveryResult.channel,
        },
      }).catch(() => {});
    }
  }

  res.status(201).json({
    farmer,
    credentialsCreated: !!farmer.userAccount,
    inviteToken: farmer._inviteToken || null,
    inviteExpiresAt: farmer._inviteExpiresAt || null,
    deliveryStatus: deliveryResult.deliveryStatus || null,
    deliveryChannel: deliveryResult.channel || null,
    deliveryNote: farmer.userAccount
      ? 'Login account created. Share the credentials with the farmer securely.'
      : deliveryResult.delivered
        ? `Invite ${deliveryResult.channel === 'email' ? 'email' : 'SMS'} sent to the farmer.`
        : deliveryResult.reason || 'Farmer created. Copy and share the invite link with the farmer so they can activate their account.',
  });
}));

// Invite farmer (admin/field officer — creates pre-approved farmer record)
router.post('/invite', inviteLimiter, authorize('super_admin', 'institutional_admin', 'field_officer'), dedupGuard('invite-farmer'), idempotencyCheck, asyncHandler(async (req, res) => {
  const { channel, contactEmail } = req.body;
  if (req.body.phone) {
    const normalizedPhone = normalizePhoneForStorage(req.body.phone);
    const phoneCheck = validatePhone(normalizedPhone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.message });
    }
    req.body = { ...req.body, phone: normalizedPhone };
  }
  // Duplicate phone check for invites
  if (req.body.phone) {
    const dupCheck = await farmersService.checkDuplicateFarmer({
      phone: req.body.phone, fullName: req.body.fullName, region: req.body.region,
      organizationId: req.organizationId,
    });
    const exactPhoneMatch = dupCheck.duplicates.find(d => d.phone === req.body.phone);
    if (exactPhoneMatch && !req.body.confirmDuplicate) {
      return res.status(409).json({
        error: `A farmer with this phone number already exists (${exactPhoneMatch.fullName}).`,
        duplicates: dupCheck.duplicates,
        requiresConfirmation: true,
      });
    }
  }

  const farmer = await inviteFarmer({
    ...req.body,
    invitedById: req.user.sub,
    assignedOfficerId: req.body.assignedOfficerId || null,
    organizationId: req.organizationId,
  });

  // Attempt invite delivery when channel is email or phone
  let deliveryResult = { delivered: false, channel: 'link', deliveryStatus: farmer._inviteToken ? 'manual_share_ready' : null };
  if (farmer._inviteToken && !farmer.userAccount && channel && channel !== 'link') {
    const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
    const inviteUrl = `${frontendBase}/accept-invite?token=${farmer._inviteToken}`;
    deliveryResult = await dispatchInvite({
      channel,
      toEmail: contactEmail || null,
      toPhone: farmer.phone || null,
      farmerName: farmer.fullName,
      inviteUrl,
      inviterName: req.user.fullName || null,
      expiresAt: farmer.inviteExpiresAt,
    });
    if (deliveryResult.deliveryStatus) {
      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          inviteDeliveryStatus: deliveryResult.deliveryStatus,
          inviteChannel: deliveryResult.channel,
        },
      }).catch(() => {});
    }
  }

  // Send welcome notification to the farmer
  createNotification(farmer.id, {
    notificationType: 'system',
    title: 'Welcome to Farroway',
    message: `You have been invited to Farroway by your institution. Your account is active and ready to use.${farmer.userAccount ? ' Log in with the credentials provided by your administrator.' : ' Contact your field officer or administrator to set up your login credentials.'}`,
    metadata: { invitedById: req.user.sub },
  }).catch(() => {});

  writeAuditLog({
    userId: req.user.sub,
    action: 'farmer_invited',
    details: { farmerId: farmer.id, phone: farmer.phone, hasLoginAccount: !!farmer.userAccount, channel: deliveryResult.channel },
  }).catch(() => {});

  res.status(201).json({
    farmer,
    credentialsCreated: !!farmer.userAccount,
    inviteToken: farmer._inviteToken || null,
    inviteExpiresAt: farmer.inviteExpiresAt || null,
    deliveryStatus: deliveryResult.deliveryStatus || (farmer.inviteDeliveryStatus || null),
    deliveryChannel: deliveryResult.channel || null,
    deliveryNote: farmer.userAccount
      ? 'Login account created. Share the credentials with the farmer securely.'
      : deliveryResult.delivered
        ? `Invite ${deliveryResult.channel === 'email' ? 'email' : 'SMS'} sent to the farmer.`
        : deliveryResult.reason || 'Invite link generated. Copy and share it with the farmer manually.',
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

// Expiring invites — farmers whose invite will expire within N days (default 2)
router.get('/expiring-invites',
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const withinDays = parseInt(req.query.days || '2', 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    const orgScope = orgWhereFarmer(req);
    const expiring = await prisma.farmer.findMany({
      where: {
        ...orgScope,
        userId: null,                      // no login yet
        inviteToken: { not: null },        // has active invite
        inviteExpiresAt: { lte: cutoff, gte: new Date() }, // expires within window
      },
      select: {
        id: true, fullName: true, phone: true, region: true,
        inviteExpiresAt: true, inviteChannel: true, inviteDeliveryStatus: true,
        assignedOfficerId: true,
      },
      orderBy: { inviteExpiresAt: 'asc' },
      take: 50,
    });
    res.json({ count: expiring.length, farmers: expiring, withinDays });
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
  resendInviteLimiter,
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  dedupGuard('farmer-resend-invite'),
  asyncHandler(async (req, res) => {
    const { channel, contactEmail } = req.body;
    const farmer = await farmersService.getFarmerById(req.params.id);
    if (farmer.selfRegistered) {
      return res.status(400).json({ error: 'Cannot resend invite for self-registered farmers' });
    }

    // ── Rate protection: max 5 resends per 24 hours ──
    const resendMeta = farmer.inviteResendMeta || {};
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    // Filter timestamps within the last 24 hours
    const recentResends = Array.isArray(resendMeta.timestamps)
      ? resendMeta.timestamps.filter(ts => now - ts < windowMs)
      : [];
    if (recentResends.length >= 5) {
      opsEvent('workflow', 'invite_resend_rate_limited', 'warn', {
        farmerId: req.params.id, resendCount: recentResends.length, userId: req.user?.sub,
      });
      return res.status(429).json({ error: 'Invite resend limit reached (max 5 per 24 hours). Please try again later.' });
    }

    // Regenerate invite token (only for farmers without a login account)
    const newToken = farmer.userAccount ? null : randomUUID();
    const newExpiry = newToken ? makeInviteExpiry() : null;

    // Attempt delivery before persisting so we know the actual channel
    let deliveryResult = { delivered: false, channel: 'link', deliveryStatus: newToken ? 'manual_share_ready' : null };
    if (newToken && channel && channel !== 'link') {
      const frontendBase = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
      const inviteUrl = `${frontendBase}/accept-invite?token=${newToken}`;
      deliveryResult = await dispatchInvite({
        channel,
        toEmail: contactEmail || null,
        toPhone: farmer.phone || null,
        farmerName: farmer.fullName,
        inviteUrl,
        inviterName: req.user.fullName || null,
        expiresAt: newExpiry,
      });
    }

    // Track resend count: append current timestamp and increment counter
    const updatedTimestamps = [...recentResends, now];
    const newResendCount = (resendMeta.totalCount || recentResends.length) + 1;

    // Update invitedAt, refresh invite token, and persist actual delivery outcome
    const updated = await prisma.farmer.update({
      where: { id: req.params.id },
      data: {
        invitedAt: new Date(),
        inviteResendMeta: {
          timestamps: updatedTimestamps,
          totalCount: newResendCount,
          lastResentBy: req.user.sub,
        },
        ...(newToken ? {
          inviteToken: newToken,
          inviteExpiresAt: newExpiry,
          inviteDeliveryStatus: deliveryResult.deliveryStatus || 'manual_share_ready',
          inviteChannel: deliveryResult.channel || 'link',
        } : {}),
      },
      include: { userAccount: { select: { id: true, email: true } } },
    });

    // Send reminder notification to the farmer
    createNotification(farmer.id, {
      notificationType: 'system',
      title: 'Invitation Reminder',
      message: `You have been re-invited to Farroway.${updated.userAccount ? ' Log in with the credentials provided by your administrator.' : ' Contact your field officer or administrator to set up your login credentials.'}`,
      metadata: { resentById: req.user.sub },
    }).catch(() => {});

    opsEvent('workflow', 'invite_resent', 'info', {
      farmerId: req.params.id, resendCount: newResendCount, channel: deliveryResult.channel, userId: req.user?.sub,
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_invite_resent',
      details: { farmerId: req.params.id, hasLoginAccount: !!updated.userAccount, channel: deliveryResult.channel, resendCount: newResendCount },
    }).catch(() => {});

    res.json({
      message: 'Invite resent',
      farmer: updated,
      hasLoginAccount: !!updated.userAccount,
      inviteToken: newToken || null,
      inviteExpiresAt: newExpiry || null,
      deliveryStatus: deliveryResult.deliveryStatus || null,
      deliveryChannel: deliveryResult.channel || null,
      deliveryNote: updated.userAccount
        ? 'Farmer already has a login account. A reminder notification has been sent.'
        : deliveryResult.delivered
          ? `Invite ${deliveryResult.channel === 'email' ? 'email' : 'SMS'} sent to the farmer.`
          : deliveryResult.reason || 'Invite link refreshed. Copy and share the new link with the farmer.',
    });
  }));

// Cancel invite (admin — revokes the invite token and resets status)
router.post('/:id/cancel-invite',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('cancel-invite'),
  asyncHandler(async (req, res) => {
    const farmer = await farmersService.getFarmerById(req.params.id);
    if (!verifyOrgAccess(req, farmer.organizationId)) {
      return res.status(403).json({ error: 'Access denied — farmer belongs to another organization' });
    }
    if (farmer.userId) {
      return res.status(400).json({ error: 'Cannot cancel invite — farmer already has a login account' });
    }
    if (!farmer.inviteToken) {
      return res.status(400).json({ error: 'No active invite to cancel' });
    }

    const updated = await prisma.farmer.update({
      where: { id: req.params.id },
      data: {
        inviteToken: null,
        inviteExpiresAt: null,
        inviteDeliveryStatus: 'cancelled',
        inviteChannel: null,
      },
    });

    opsEvent('workflow', 'invite_cancelled', 'info', {
      farmerId: req.params.id, userId: req.user?.sub,
    });
    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_invite_cancelled',
      details: { farmerId: req.params.id },
    }).catch(() => {});

    res.json({ message: 'Invite cancelled', farmer: updated });
  }));

// Batch resend invites (admin — resends invites for multiple stuck farmers)
router.post('/batch-resend-invites',
  authorize('super_admin', 'institutional_admin'),
  dedupGuard('batch-resend-invites'),
  asyncHandler(async (req, res) => {
    const { farmerIds } = req.body;
    if (!Array.isArray(farmerIds) || farmerIds.length === 0) {
      return res.status(400).json({ error: 'farmerIds array is required' });
    }
    if (farmerIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 farmers per batch' });
    }

    const orgScope = orgWhereFarmer(req);
    const farmers = await prisma.farmer.findMany({
      where: {
        id: { in: farmerIds },
        ...orgScope,
        userId: null,           // no login yet
        selfRegistered: false,  // only invited farmers
      },
      select: {
        id: true, fullName: true, phone: true,
        inviteToken: true, inviteResendMeta: true,
      },
    });

    let refreshed = 0;
    let skipped = 0;
    const results = [];

    for (const farmer of farmers) {
      // Rate check — skip if 5+ resends in 24h
      const meta = farmer.inviteResendMeta || {};
      const now = Date.now();
      const recentResends = Array.isArray(meta.timestamps)
        ? meta.timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000)
        : [];
      if (recentResends.length >= 5) {
        skipped++;
        results.push({ id: farmer.id, status: 'rate_limited' });
        continue;
      }

      const newToken = randomUUID();
      const newExpiry = makeInviteExpiry();

      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          invitedAt: new Date(),
          inviteToken: newToken,
          inviteExpiresAt: newExpiry,
          inviteDeliveryStatus: 'manual_share_ready',
          inviteChannel: 'link',
          inviteResendMeta: {
            timestamps: [...recentResends, now],
            totalCount: (meta.totalCount || recentResends.length) + 1,
            lastResentBy: req.user.sub,
          },
        },
      });
      refreshed++;
      results.push({ id: farmer.id, status: 'refreshed' });
    }

    opsEvent('workflow', 'batch_invite_resend', 'info', {
      requested: farmerIds.length, refreshed, skipped,
      userId: req.user?.sub,
    });
    writeAuditLog({
      userId: req.user.sub,
      action: 'batch_invite_resend',
      details: { requested: farmerIds.length, refreshed, skipped },
    }).catch(() => {});

    res.json({ refreshed, skipped, notFound: farmerIds.length - farmers.length, results });
  }));

// Update farmer (staff only)
router.put('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin', 'field_officer'), dedupGuard('farmer-update'), asyncHandler(async (req, res) => {
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
        organizationId: true,
        selfRegistered: true,
        registrationStatus: true,
        invitedAt: true,
        inviteExpiresAt: true,
        inviteToken: true,
        inviteChannel: true,
        inviteDeliveryStatus: true,
        inviteAcceptedAt: true,
        inviteResendMeta: true,
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

    const computedInviteStatus = farmersService.computeInviteStatus(farmer);
    res.json({
      farmerId: farmer.id,
      registrationStatus: farmer.registrationStatus,
      accessStatus: farmersService.computeAccessStatus(farmer),
      inviteStatus: computedInviteStatus,
      // Return token only when link is ready but not yet accepted — so admins can copy it
      inviteToken: computedInviteStatus === 'LINK_GENERATED' ? farmer.inviteToken : null,
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
      // Proactive rate limit info (Rule 8: show before user hits wall)
      resendCount24h: (() => {
        const meta = farmer.inviteResendMeta || {};
        const now = Date.now();
        const recent = Array.isArray(meta.timestamps) ? meta.timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000) : [];
        return recent.length;
      })(),
      resendLimit: 5,
    });
  }));

// ─── Profile Photo: farmer self-upload ─────────────────
router.post('/me/profile-photo',
  uploadLimiter,
  dedupGuard('self-profile-photo'),
  photoUpload.single('photo'),
  uploadCleanup,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ error: 'Only farmer accounts can access this endpoint' });
    }
    if (!req.file) {
      logUploadEvent('upload_failed', { endpoint: 'POST /farmers/me/profile-photo', reason: 'no_file', userId: req.user.sub });
      return res.status(400).json({ error: 'Photo file is required' });
    }

    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user.sub }, select: { id: true, profileImageUrl: true } });
    if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

    // Delete old file if exists
    farmersService.deleteOldProfileImage(farmer.profileImageUrl);

    const imageUrl = `/uploads/${req.file.filename}`;
    const updated = await prisma.farmer.update({
      where: { id: farmer.id },
      data: {
        profileImageUrl: imageUrl,
        profileImageUploadedAt: new Date(),
        profileImageUpdatedBy: req.user.sub,
      },
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_profile_photo_uploaded',
      details: { farmerId: farmer.id, selfUpload: true },
    }).catch(() => {});

    res.json({ profileImageUrl: updated.profileImageUrl });
  }));

// Farmer self-remove profile photo
router.delete('/me/profile-photo', asyncHandler(async (req, res) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ error: 'Only farmer accounts can access this endpoint' });
  }
  const farmer = await prisma.farmer.findUnique({ where: { userId: req.user.sub }, select: { id: true, profileImageUrl: true } });
  if (!farmer) return res.status(404).json({ error: 'Farmer profile not found' });

  farmersService.deleteOldProfileImage(farmer.profileImageUrl);

  await prisma.farmer.update({
    where: { id: farmer.id },
    data: { profileImageUrl: null, profileImageUploadedAt: null, profileImageUpdatedBy: null },
  });

  writeAuditLog({
    userId: req.user.sub,
    action: 'farmer_profile_photo_removed',
    details: { farmerId: farmer.id, selfRemove: true },
  }).catch(() => {});

  res.json({ message: 'Profile photo removed' });
}));

// ─── Profile Photo: staff upload for a farmer ──────────
router.post('/:id/profile-photo',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  uploadLimiter,
  dedupGuard('staff-profile-photo'),
  photoUpload.single('photo'),
  uploadCleanup,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      logUploadEvent('upload_failed', { endpoint: `POST /farmers/${req.params.id}/profile-photo`, reason: 'no_file', userId: req.user?.sub });
      return res.status(400).json({ error: 'Photo file is required' });
    }

    const farmer = await farmersService.getFarmerById(req.params.id);
    if (!verifyOrgAccess(req, farmer.organizationId)) {
      return res.status(403).json({ error: 'Access denied — farmer belongs to another organization' });
    }

    // Delete old file if exists
    farmersService.deleteOldProfileImage(farmer.profileImageUrl);

    const imageUrl = `/uploads/${req.file.filename}`;
    const updated = await prisma.farmer.update({
      where: { id: req.params.id },
      data: {
        profileImageUrl: imageUrl,
        profileImageUploadedAt: new Date(),
        profileImageUpdatedBy: req.user.sub,
      },
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_profile_photo_uploaded',
      details: { farmerId: req.params.id, uploadedBy: req.user.sub },
    }).catch(() => {});

    res.json({ profileImageUrl: updated.profileImageUrl });
  }));

// Staff remove profile photo for a farmer
router.delete('/:id/profile-photo',
  validateParamUUID('id'),
  authorize('super_admin', 'institutional_admin'),
  asyncHandler(async (req, res) => {
    const farmer = await farmersService.getFarmerById(req.params.id);
    if (!verifyOrgAccess(req, farmer.organizationId)) {
      return res.status(403).json({ error: 'Access denied — farmer belongs to another organization' });
    }

    farmersService.deleteOldProfileImage(farmer.profileImageUrl);

    await prisma.farmer.update({
      where: { id: req.params.id },
      data: { profileImageUrl: null, profileImageUploadedAt: null, profileImageUpdatedBy: null },
    });

    writeAuditLog({
      userId: req.user.sub,
      action: 'farmer_profile_photo_removed',
      details: { farmerId: req.params.id, removedBy: req.user.sub },
    }).catch(() => {});

    res.json({ message: 'Profile photo removed' });
  }));

// Delete farmer (admin only)
router.delete('/:id', validateParamUUID('id'), authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  await farmersService.deleteFarmer(req.params.id);
  writeAuditLog({ userId: req.user.sub, action: 'farmer_deleted', details: { farmerId: req.params.id } }).catch(() => {});
  res.json({ message: 'Farmer deleted' });
}));

export default router;
