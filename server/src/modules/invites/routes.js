/**
 * Invite acceptance routes — public endpoints for farmers to use invite links.
 *
 * These routes are intentionally public (no auth required) because:
 * - The farmer receiving the invite does not have an account yet
 * - The invite token is the authentication mechanism
 *
 * Security measures:
 * - Rate limited (inviteAcceptLimiter)
 * - Tokens expire after 7 days
 * - Tokens are single-use (cleared after acceptance)
 * - No raw tokens are logged
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { inviteAcceptLimiter } from '../../middleware/rateLimiters.js';
import { isValidEmail, validatePassword } from '../../middleware/validate.js';
import prisma from '../../config/database.js';
import { writeAuditLog } from '../audit/service.js';

const router = Router();

// Apply rate limiting to all invite routes
router.use(inviteAcceptLimiter);

// UUID v4 format check — reject obviously malformed tokens before DB lookup
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(val) { return typeof val === 'string' && UUID_RE.test(val); }

// ─── GET /api/invites/:token/validate ─────────────────────
// Public: validate an invite token and return farmer pre-fill data.
// Does NOT consume the token — safe to call multiple times (UI can call on page load).
router.get('/:token/validate', asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!isValidUUID(token)) {
    return res.status(400).json({ error: 'Invalid invite link format.' });
  }

  const farmer = await prisma.farmer.findUnique({
    where: { inviteToken: token },
    select: {
      fullName: true,
      phone: true,
      region: true,
      district: true,
      village: true,
      countryCode: true,
      preferredLanguage: true,
      primaryCrop: true,
      inviteExpiresAt: true,
      inviteDeliveryStatus: true,
      userId: true, // check if already has account
    },
  });

  if (!farmer) {
    return res.status(404).json({ error: 'Invalid invite link. This link may have already been used or does not exist.' });
  }

  // Check if already accepted (farmer linked to a user account)
  if (farmer.userId) {
    return res.status(400).json({ error: 'This invite has already been accepted. Use the login page to sign in.' });
  }

  // Check expiry
  const isExpired = farmer.inviteExpiresAt && new Date() > new Date(farmer.inviteExpiresAt);
  if (isExpired) {
    return res.status(410).json({
      error: 'This invite link has expired. Please ask your field officer or institution to resend the invite.',
      expired: true,
    });
  }

  // Return only non-sensitive pre-fill data
  const { userId, inviteExpiresAt, inviteDeliveryStatus, ...prefill } = farmer;
  res.json({
    ...prefill,
    expiresAt: inviteExpiresAt,
    valid: true,
  });
}));

// ─── POST /api/invites/:token/accept ─────────────────────
// Public: accept an invite by setting up a login account.
// Consumes the invite token — cannot be reused after acceptance.
router.post('/:token/accept', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { email, password } = req.body;

  // Token format validation
  if (!isValidUUID(token)) {
    return res.status(400).json({ error: 'Invalid invite link format.' });
  }

  // Input validation
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

  // Look up the invite token
  const farmer = await prisma.farmer.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      fullName: true,
      phone: true,
      organizationId: true,
      preferredLanguage: true,
      inviteExpiresAt: true,
      userId: true,
      registrationStatus: true,
      createdById: true,
    },
  });

  if (!farmer) {
    return res.status(404).json({ error: 'Invalid invite link. This link may have already been used.' });
  }

  // Already accepted
  if (farmer.userId) {
    return res.status(400).json({ error: 'This invite has already been accepted. Use the login page to sign in.' });
  }

  // Expired
  const isExpired = farmer.inviteExpiresAt && new Date() > new Date(farmer.inviteExpiresAt);
  if (isExpired) {
    return res.status(410).json({
      error: 'This invite link has expired. Please ask your field officer or institution to resend the invite.',
      expired: true,
    });
  }

  // Validate farmer is still in an acceptable state (admin may have disabled/rejected)
  if (farmer.registrationStatus === 'disabled') {
    return res.status(403).json({ error: 'This account has been disabled by an administrator. Contact your institution for help.' });
  }
  if (farmer.registrationStatus === 'rejected') {
    return res.status(403).json({ error: 'This registration was rejected. Contact your institution for help.' });
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existingUser) {
    return res.status(409).json({ error: 'This email address is already registered. Use a different email or sign in.' });
  }

  // Create User + link to Farmer atomically; consume the invite token
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
        inviteToken: null,       // consume the token — cannot be reused
        inviteAcceptedAt: new Date(),
        inviteDeliveryStatus: 'accepted',
      },
    });

    return { user: newUser, updatedFarmer: linked };
  });

  writeAuditLog({
    userId: user.id,
    action: 'invite_accepted',
    details: { farmerId: farmer.id, email: user.email /* no token logged */ },
  }).catch(() => {});

  // Notify the staff member who created/invited this farmer
  if (farmer.createdById) {
    prisma.staffNotification.create({
      data: {
        userId: farmer.createdById,
        type: 'invite_accepted',
        title: 'Invite Accepted',
        message: `${farmer.fullName} has accepted the invite and created their account (${user.email}).`,
        metadata: { farmerId: farmer.id, farmerName: farmer.fullName, email: user.email },
      },
    }).catch(() => {});
  }

  res.status(201).json({
    message: 'Account activated successfully. You can now log in.',
    email: user.email,
    farmerId: farmer.id,
  });
}));

export default router;
