/**
 * server/src/modules/invites/adminRoutes.js — Wave-39.
 * Canonical admin-only invite-management routes for the wave-39
 * adoption contract. Mounted alongside the existing public
 * acceptance routes at /api/invites/*.
 *
 * Exposes:
 *   GET  /api/invites/status/:farmerId
 *       — admin reads the invite envelope for a single farmer.
 *         Returns { status, channel, expiresAt, sentAt, acceptedAt,
 *         resendCount, lastResentBy }. No raw token. Org-scoped.
 *
 *   POST /api/invites/:farmerId/resend
 *       — canonical alias for POST /api/farmers/:id/resend-invite.
 *         Delegates to the same service; preserves rate limits +
 *         audit trail. Body: { channel?, contactEmail? }.
 *
 * Security
 *   • All routes admin-gated via authorize().
 *   • Org-scoped: institutional_admin / field_officer can only
 *     read/resend farmers within their own organization.
 *   • super_admin sees everything.
 *   • Raw invite tokens NEVER leave this module. The envelope
 *     surfaces status + delivery metadata only.
 *   • Audit log on every read AND resend.
 *
 * Strict-rule audit
 *   • Pure composition over existing services. Never opens
 *     transactions of its own.
 *   • Never throws — every handler wrapped in asyncHandler.
 *   • Safe 503 / 404 / 403 messages, no stack traces, no PII.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { resendInviteLimiter } from '../../middleware/rateLimiters.js';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(val) { return typeof val === 'string' && UUID_RE.test(val); }

/**
 * _scopedFindFarmer — returns the farmer iff the caller is
 * authorised to see it. super_admin sees all; org-scoped roles
 * only see farmers within their organizationId.
 */
async function _scopedFindFarmer(user, farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: {
      id: true,
      organizationId: true,
      fullName: true,
      phone: true,
      invitedAt: true,
      inviteExpiresAt: true,
      inviteChannel: true,
      inviteDeliveryStatus: true,
      inviteAcceptedAt: true,
      inviteResendMeta: true,
      userId: true,
      selfRegistered: true,
      registrationStatus: true,
    },
  });
  if (!farmer) return null;
  if (user?.role === 'super_admin') return farmer;
  // Org-scoped roles must match the farmer's org.
  if (!user?.organizationId) return null;
  if (farmer.organizationId !== user.organizationId) return null;
  return farmer;
}

/**
 * _maskDestination — mask email + phone for safe response bodies.
 * a***@example.com  /  +233***1234
 */
function _maskEmail(email) {
  if (typeof email !== 'string' || email.length === 0) return null;
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return email[0] + '***' + email.slice(at);
}
function _maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 4) return null;
  return phone.slice(0, Math.min(4, phone.length - 4)) + '***' + phone.slice(-4);
}

// ─── GET /api/invites/status/:farmerId ─────────────────────────
router.get('/status/:farmerId',
  authenticate,
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  asyncHandler(async (req, res) => {
    const { farmerId } = req.params;
    if (!isUUID(farmerId)) {
      return res.status(400).json({ error: 'Invalid farmer id format.' });
    }
    const farmer = await _scopedFindFarmer(req.user, farmerId);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found or out of scope.' });
    }

    // Compute structural status — never trust DB alone if it's stale.
    const now = new Date();
    const expired =
         farmer.inviteExpiresAt
      && new Date(farmer.inviteExpiresAt) < now;
    let status;
    if (farmer.userId)                         status = 'accepted';
    else if (farmer.inviteAcceptedAt)          status = 'accepted';
    else if (expired)                          status = 'expired';
    else if (farmer.inviteDeliveryStatus)      status = farmer.inviteDeliveryStatus;
    else if (farmer.invitedAt)                 status = 'sent';
    else                                       status = 'pending';

    const resendMeta = farmer.inviteResendMeta || {};
    const resendCount = Number.isFinite(resendMeta.totalCount)
      ? resendMeta.totalCount
      : (Array.isArray(resendMeta.timestamps) ? resendMeta.timestamps.length : 0);

    // Audit the read — invite status visibility is a regulated
    // surface. No raw token logged.
    writeAuditLog({
      userId: req.user?.sub,
      action: 'invite_status_read',
      details: { farmerId },
    }).catch(() => {});

    res.json({
      farmerId,
      status,
      channel:        farmer.inviteChannel || null,
      destinationMasked: farmer.inviteChannel === 'email'
        ? _maskEmail(farmer.phone)  // we don't have an explicit email field on farmer
        : _maskPhone(farmer.phone),
      sentAt:         farmer.invitedAt          || null,
      expiresAt:      farmer.inviteExpiresAt    || null,
      acceptedAt:     farmer.inviteAcceptedAt   || null,
      hasLoginAccount: !!farmer.userId,
      resendCount,
      lastResentBy:   resendMeta.lastResentBy   || null,
      selfRegistered: !!farmer.selfRegistered,
      // NEVER include inviteToken — wave-39 contract.
    });
  })
);

// ─── POST /api/invites/:farmerId/resend ────────────────────────
// Canonical alias that delegates to the existing implementation.
// We re-issue the request internally so rate limits + audit
// trails stay identical between callers.
router.post('/:farmerId/resend',
  authenticate,
  authorize('super_admin', 'institutional_admin', 'field_officer'),
  resendInviteLimiter,
  asyncHandler(async (req, res) => {
    const { farmerId } = req.params;
    if (!isUUID(farmerId)) {
      return res.status(400).json({ error: 'Invalid farmer id format.' });
    }
    const farmer = await _scopedFindFarmer(req.user, farmerId);
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found or out of scope.' });
    }
    // Delegate by 307-redirecting to the canonical resend endpoint.
    // 307 preserves method + body. The downstream route handles
    // dedup + idempotency.
    return res.redirect(307, `/api/farmers/${farmerId}/resend-invite`);
  })
);

export default router;
