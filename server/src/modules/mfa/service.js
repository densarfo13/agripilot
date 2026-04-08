/**
 * MFA Service — TOTP (Time-based One-Time Password)
 *
 * Implements TOTP enrollment, verification, challenge, backup codes,
 * and admin reset using the otplib library (RFC 6238 compliant).
 *
 * Security rules:
 *   - TOTP secrets are AES-256-GCM encrypted at rest
 *   - Backup codes are bcrypt-hashed (cost 10), single-use
 *   - No raw secrets or codes ever logged or returned after enrollment
 *   - Admin MFA reset requires SoD approval for privileged targets
 *   - All MFA events are audit-logged
 *
 * MFA requirement policy (enforced in requireMfa middleware, not here):
 *   REQUIRED  — super_admin, institutional_admin, reviewer
 *   OPTIONAL  — field_officer, investor_viewer
 *   EXEMPT    — farmer
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';
import { writeAuditLog } from '../audit/service.js';
import { opsEvent } from '../../utils/opsLogger.js';

// ─── Roles that REQUIRE MFA ────────────────────────────────
export const MFA_REQUIRED_ROLES = new Set(['super_admin', 'institutional_admin', 'reviewer']);
export const MFA_EXEMPT_ROLES   = new Set(['farmer']);

export function isMfaRequired(role) { return MFA_REQUIRED_ROLES.has(role); }
export function isMfaExempt(role)   { return MFA_EXEMPT_ROLES.has(role); }

// ─── TOTP config ───────────────────────────────────────────
// otplib v13 class-based API. SHA-1, 30s window, 6-digit codes.
// window: 1 allows ±1 time step (30s) for clock skew tolerance.
const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
  window: 1,
});

// ─── Secret encryption (AES-256-GCM) ──────────────────────

const ALG = 'aes-256-gcm';
const IV_LEN = 12;   // 96-bit IV for GCM
const TAG_LEN = 16;  // 128-bit authentication tag

function getEncryptionKey() {
  const hexKey = config.mfa.secretEncryptionKey;
  if (!hexKey || hexKey.length < 64) {
    const err = new Error('MFA_SECRET_KEY is not configured or is too short (need 64-char hex)');
    err.statusCode = 503;
    throw err;
  }
  return Buffer.from(hexKey.slice(0, 64), 'hex');
}

function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) + tag(16) + ciphertext — all base64-encoded together
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptSecret(stored) {
  const key = getEncryptionKey();
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const encrypted = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ─── Backup codes ──────────────────────────────────────────

function generateRawBackupCodes(count = config.mfa.backupCodeCount) {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase() // 10-char hex code
  );
}

async function hashBackupCodes(codes) {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

async function verifyAndConsumeBackupCode(userId, rawCode) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaBackupCodes: true },
  });
  if (!user || !user.mfaBackupCodes?.length) return false;

  // Check each hashed code
  for (let i = 0; i < user.mfaBackupCodes.length; i++) {
    const match = await bcrypt.compare(rawCode.toUpperCase().replace(/\s/g, ''), user.mfaBackupCodes[i]);
    if (match) {
      // Consume: remove the used code
      const remaining = user.mfaBackupCodes.filter((_, idx) => idx !== i);
      await prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: remaining },
      });
      return true;
    }
  }
  return false;
}

// ─── Enrollment ────────────────────────────────────────────

/**
 * Initiate MFA enrollment.
 * Returns a pending secret + otpauth URI for QR code display.
 * The secret is NOT saved to DB yet — user must verify first.
 * Returns a temporary encrypted bundle the verify step will use.
 */
export async function initEnrollment(userId, email) {
  getEncryptionKey(); // validate config early

  const rawSecret = totp.generateSecret(); // synchronous in v13
  const otpauthUrl = await totp.generateURI({
    secret: rawSecret,
    label: email,
    issuer: config.mfa.issuer,
  });

  // Encrypt the pending secret so it can be passed back to verify without DB storage
  const encryptedPending = encryptSecret(`pending:${userId}:${rawSecret}`);

  return { otpauthUrl, pendingToken: encryptedPending };
}

/**
 * Complete MFA enrollment: verify the TOTP code against the pending secret,
 * then save encrypted secret to DB and generate backup codes.
 */
export async function completeEnrollment({ userId, pendingToken, totpCode }) {
  // Decrypt pending token
  let decrypted;
  try {
    decrypted = decryptSecret(pendingToken);
  } catch {
    const err = new Error('Invalid or expired enrollment token');
    err.statusCode = 400;
    throw err;
  }

  const parts = decrypted.split(':');
  if (parts.length < 3 || parts[0] !== 'pending' || parts[1] !== userId) {
    const err = new Error('Enrollment token mismatch');
    err.statusCode = 400;
    throw err;
  }
  const rawSecret = parts.slice(2).join(':'); // handle colons in secret

  // Check user doesn't already have MFA enabled
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, email: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  if (user.mfaEnabled) {
    const err = new Error('MFA is already enrolled. Disable it first to re-enroll.');
    err.statusCode = 409;
    throw err;
  }

  // Verify TOTP code — v13 API: verify(token, { secret })
  const valid = await totp.verify(totpCode, { secret: rawSecret });
  if (!valid) {
    opsEvent('mfa', 'enrollment_code_invalid', 'warn', { userId });
    const err = new Error('Invalid authenticator code. Please check your app and try again.');
    err.statusCode = 400;
    throw err;
  }

  // Generate backup codes
  const rawCodes = generateRawBackupCodes();
  const hashedCodes = await hashBackupCodes(rawCodes);

  // Save encrypted secret + hashed backup codes to DB
  const encryptedSecret = encryptSecret(rawSecret);
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
      mfaEnrolledAt: new Date(),
      mfaBackupCodes: hashedCodes,
      // Bump tokenVersion to invalidate any existing tokens (fresh start after MFA enroll)
      tokenVersion: { increment: 1 },
    },
  });

  writeAuditLog({
    userId,
    action: 'mfa_enrolled',
    details: { method: 'totp' },
  }).catch(() => {});
  opsEvent('mfa', 'enrolled', 'info', { userId });

  // Return raw backup codes — shown ONCE, never stored in plaintext
  return {
    message: 'MFA enabled successfully.',
    backupCodes: rawCodes,
    warning: 'Save these backup codes now. They will not be shown again.',
  };
}

// ─── TOTP Verification ─────────────────────────────────────

/**
 * Verify a TOTP code for a user who has MFA enabled.
 * Also accepts backup codes (10-char hex).
 * Returns true/false — never throws on invalid code.
 */
export async function verifyMfaCode(userId, code) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodes: true },
  });

  if (!user?.mfaEnabled || !user.mfaSecret) return false;

  const normalizedCode = String(code || '').replace(/\s/g, '');

  // Backup code path: 10-char codes (A-F0-9)
  if (normalizedCode.length === 10) {
    return verifyAndConsumeBackupCode(userId, normalizedCode);
  }

  // TOTP path: 6-digit numeric — v13 API: verify(token, { secret })
  try {
    const rawSecret = decryptSecret(user.mfaSecret);
    return await totp.verify(normalizedCode, { secret: rawSecret });
  } catch {
    return false;
  }
}

// ─── MFA Disable ──────────────────────────────────────────

/**
 * User disables their own MFA (requires TOTP verification first).
 * Called from the security settings page.
 */
export async function disableOwnMfa({ userId, totpCode }) {
  const valid = await verifyMfaCode(userId, totpCode);
  if (!valid) {
    opsEvent('mfa', 'disable_code_invalid', 'warn', { userId });
    const err = new Error('Invalid authenticator code. Cannot disable MFA.');
    err.statusCode = 400;
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaEnrolledAt: null,
      mfaBackupCodes: [],
      tokenVersion: { increment: 1 },
    },
  });

  writeAuditLog({
    userId,
    action: 'mfa_disabled',
    details: { initiatedBy: 'self' },
  }).catch(() => {});
  opsEvent('mfa', 'disabled_self', 'info', { userId });

  return { message: 'MFA has been disabled.' };
}

/**
 * Admin resets another user's MFA enrollment.
 * - super_admin: can reset any user's MFA
 * - institutional_admin: can reset own-org non-admin users
 * - Resetting a privileged user's MFA requires SoD approval (checked in route)
 */
export async function adminResetMfa({ targetUserId, actorId, actorRole, actorOrgId }) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, organizationId: true, mfaEnabled: true },
  });
  if (!target) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  // Org scope enforcement for institutional_admin
  if (actorRole === 'institutional_admin') {
    if (target.organizationId !== actorOrgId) {
      const err = new Error('Cannot reset MFA for users outside your organization');
      err.statusCode = 403;
      throw err;
    }
    if (['super_admin', 'institutional_admin'].includes(target.role)) {
      const err = new Error('Cannot reset MFA for admin accounts. Contact super_admin.');
      err.statusCode = 403;
      throw err;
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaEnrolledAt: null,
      mfaBackupCodes: [],
      tokenVersion: { increment: 1 },
    },
  });

  writeAuditLog({
    userId: actorId,
    action: 'admin_mfa_reset',
    details: { targetUserId, actorRole },
  }).catch(() => {});
  opsEvent('mfa', 'admin_reset', 'warn', { actorId, targetUserId, actorRole });

  return { message: 'MFA enrollment reset. User must re-enroll on next login.' };
}

// ─── Backup code regeneration ──────────────────────────────

/**
 * Regenerate backup codes (requires fresh TOTP verification).
 */
export async function regenerateBackupCodes({ userId, totpCode }) {
  const valid = await verifyMfaCode(userId, totpCode);
  if (!valid) {
    const err = new Error('Invalid authenticator code.');
    err.statusCode = 400;
    throw err;
  }

  const rawCodes = generateRawBackupCodes();
  const hashedCodes = await hashBackupCodes(rawCodes);

  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: hashedCodes },
  });

  writeAuditLog({
    userId,
    action: 'mfa_backup_codes_regenerated',
    details: {},
  }).catch(() => {});

  return { backupCodes: rawCodes, warning: 'Old backup codes are now invalid. Save these now.' };
}

// ─── MFA status ────────────────────────────────────────────

export async function getMfaStatus(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaEnrolledAt: true, mfaBackupCodes: true, role: true },
  });
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    enabled: user.mfaEnabled,
    enrolledAt: user.mfaEnrolledAt,
    backupCodesRemaining: user.mfaBackupCodes?.length ?? 0,
    required: isMfaRequired(user.role),
    exempt: isMfaExempt(user.role),
  };
}
