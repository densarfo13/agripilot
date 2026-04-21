/**
 * Password Reset Service
 *
 * Self-service password reset via email token.
 * Requires SMTP to be configured (SMTP_HOST + SMTP_USER + SMTP_PASS).
 *
 * Flow:
 *   1. POST /api/auth/forgot-password  — generate token, send email
 *   2. POST /api/auth/reset-password   — validate token, set new password
 *
 * Security rules:
 *   - Token is 64 random bytes, SHA-256 hashed before storage
 *   - Token expires in PASSWORD_RESET_TOKEN_EXPIRY_MINUTES (default 60 min)
 *   - Single-use: usedAt is set on redemption
 *   - Always returns 200 on forgot-password (prevents email enumeration)
 *   - On successful reset: bumps tokenVersion to invalidate all existing JWTs
 *   - Rate limiting applied at route level (5 attempts / 15 min)
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';
import { validatePassword } from '../../middleware/validate.js';
import { writeAuditLog } from '../audit/service.js';
import { opsEvent } from '../../utils/opsLogger.js';
import { sendEmail as smtpSendEmail, isEmailConfigured } from '../../../lib/mailer.js';

const RESET_TOKEN_BYTES = 64;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// ─── Send Reset Email ──────────────────────────────────────

async function sendResetEmail({ toEmail, fullName, resetUrl, expiryMinutes }) {
  if (!isEmailConfigured()) {
    opsEvent('auth', 'reset_email_skipped', 'warn',
      { toEmail, reason: 'smtp_not_configured' });
    return false;
  }

  const expiryText = expiryMinutes >= 60
    ? `${Math.round(expiryMinutes / 60)} hour(s)`
    : `${expiryMinutes} minutes`;

  const result = await smtpSendEmail({
    to: toEmail,
    subject: 'Reset your Farroway password',
    text: [
      `Hello ${fullName},`,
      '',
      'You requested a password reset for your Farroway account.',
      `Click the link below to reset your password (valid for ${expiryText}):`,
      '',
      resetUrl,
      '',
      'If you did not request this, you can safely ignore this email.',
      'Your password will not change unless you click the link above.',
      '',
      '— The Farroway Team',
    ].join('\n'),
    html: `
      <p>Hello <strong>${fullName}</strong>,</p>
      <p>You requested a password reset for your Farroway account.</p>
      <p>Click the button below to reset your password. This link is valid for <strong>${expiryText}</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          Reset My Password
        </a>
      </p>
      <p>Or copy this link: <code>${resetUrl}</code></p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p>— The Farroway Team</p>
    `,
  });

  if (!result.success) {
    opsEvent('auth', 'reset_email_failed', 'error', { toEmail, error: result.error });
  }
  return !!result.success;
}

// ─── Initiate Reset ────────────────────────────────────────

/**
 * Generate a password reset token and send the email.
 * Always returns a success-like response to prevent email enumeration.
 */
export async function initiatePasswordReset({ email }) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, fullName: true, active: true, passwordHash: true },
  });

  // Anti-enumeration: always respond the same way regardless of whether user exists
  if (!user) {
    opsEvent('auth', 'reset_email_not_found', 'info', { email: normalizedEmail });
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // Federated-only accounts have no password — still allow setting one
  // Active check: disabled accounts cannot reset (consistent with login block)
  if (!user.active) {
    opsEvent('auth', 'reset_blocked_inactive', 'warn', { userId: user.id });
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  // Invalidate any existing reset tokens for this user (one active token at a time)
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

  // Generate token
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiryMinutes = config.passwordReset.tokenExpiryMinutes;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  // Build reset URL (frontend handles the UI)
  const resetUrl = `${config.auth.frontendBaseUrl}/reset-password?token=${rawToken}`;

  const sent = await sendResetEmail({
    toEmail: normalizedEmail,
    fullName: user.fullName,
    resetUrl,
    expiryMinutes,
  });

  writeAuditLog({
    userId: user.id,
    action: 'password_reset_requested',
    details: { emailSent: sent },
  }).catch(() => {});
  opsEvent('auth', 'reset_initiated', 'info', { userId: user.id, emailSent: sent });

  return { message: 'If that email exists, a reset link has been sent.' };
}

// ─── Complete Reset ────────────────────────────────────────

/**
 * Validate the reset token and set the new password.
 * On success: bumps tokenVersion to invalidate all active JWTs.
 */
export async function completePasswordReset({ rawToken, newPassword }) {
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    const err = new Error(pwCheck.message);
    err.statusCode = 400;
    throw err;
  }

  const tokenHash = hashToken(rawToken);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, active: true, fullName: true } } },
  });

  if (!resetToken) {
    const err = new Error('Invalid or expired reset link.');
    err.statusCode = 400;
    throw err;
  }
  if (resetToken.usedAt) {
    const err = new Error('This reset link has already been used.');
    err.statusCode = 400;
    throw err;
  }
  if (new Date() > resetToken.expiresAt) {
    await prisma.passwordResetToken.delete({ where: { tokenHash } });
    const err = new Error('This reset link has expired. Please request a new one.');
    err.statusCode = 400;
    throw err;
  }
  if (!resetToken.user.active) {
    const err = new Error('Account is deactivated. Contact your administrator.');
    err.statusCode = 403;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Atomically: update password, bump tokenVersion, mark token used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
  ]);

  writeAuditLog({
    userId: resetToken.userId,
    action: 'password_reset_completed',
    details: {},
  }).catch(() => {});
  opsEvent('auth', 'password_reset_completed', 'info', { userId: resetToken.userId });

  return { message: 'Password reset successfully. You can now log in with your new password.' };
}
