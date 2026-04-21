import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { sendEmail } from '../lib/mailer.js';
import { sha256 } from '../lib/hash.js';
import { env } from '../lib/env.js';
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js';
import { writeAuditLog } from '../lib/audit.js';
import {
  generateOpaqueToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signMfaChallengeToken,
  verifyMfaChallengeToken,
} from '../lib/tokens.js';
import {
  validateRegisterPayload,
  validateLoginPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} from '../lib/validation.js';
import { authenticate } from '../middleware/authenticate.js';
import { passwordResetLimiter } from '../src/middleware/rateLimiters.js';

const router = express.Router();

// Password-reset config — tight defaults aligned with spec.
//   • 30-min token expiry
//   • Single active token per user (prior tokens invalidated on new issue)
//   • All outstanding tokens cleaned up after successful reset
const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000;

async function createSessionAndCookies(req, res, user) {
  const refreshTokenId = generateOpaqueToken();

  await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenId,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken({
    sub: user.id,
    sid: refreshTokenId,
  });

  setAuthCookies(res, { accessToken, refreshToken });
}

// ─── Register ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const validation = validateRegisterPayload(req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: validation.data.email },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists',
        fieldErrors: { email: 'Email already exists' },
      });
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validation.data.email,
        passwordHash,
        fullName: validation.data.fullName || validation.data.email.split('@')[0],
        role: 'farmer',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        emailVerifiedAt: true,
      },
    });

    const rawToken = generateOpaqueToken();
    const tokenHash = sha256(rawToken);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${env.APP_BASE_URL}/verify-email?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify your email',
      text: `Verify your email using this link: ${verifyUrl}`,
      html: `<p>Verify your email using this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    await createSessionAndCookies(req, res, user);

    await writeAuditLog(req, {
      userId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
    });

    // Fire onboarding start event (non-blocking)
    import('../src/modules/onboarding/service.js')
      .then(({ startOnboarding }) => startOnboarding(user.id, { source: 'self_register' }))
      .catch(err => console.error('[onboarding] Failed to start onboarding for new user:', err.message));

    return res.status(201).json({
      success: true,
      user,
      requiresEmailVerification: !user.emailVerifiedAt,
    });
  } catch (error) {
    console.error('POST /api/v2/auth/register failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to register user' });
  }
});

// ─── Login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const validation = validateLoginPayload(req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerifiedAt: true,
        passwordHash: true,
        active: true,
      },
    });

    console.log('[LOGIN]', validation.data.email, '→ found:', !!user, user ? `role=${user.role} active=${user.active} hasHash=${!!user.passwordHash}` : '');

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    const validPassword = await bcrypt.compare(validation.data.password, user.passwordHash);
    console.log('[LOGIN]', validation.data.email, '→ password valid:', validPassword);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // ─── MFA gate ──────────────────────────────────────────
    // If user has MFA enabled, don't issue session cookies yet.
    // Return a short-lived challenge token instead.
    const { isMfaRequired } = await import('../src/modules/mfa/service.js');

    if (isMfaRequired(user.role)) {
      // Check if user has MFA enrolled
      const mfaUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mfaEnabled: true },
      });

      if (mfaUser?.mfaEnabled) {
        // MFA enrolled → require TOTP code
        const mfaToken = signMfaChallengeToken(user);
        console.log('[LOGIN]', validation.data.email, '→ MFA challenge required');
        return res.json({
          success: true,
          mfaChallengeRequired: true,
          mfaToken,
          user: { id: user.id, role: user.role, email: user.email },
        });
      }

      // MFA required but NOT enrolled → let them in but signal setup needed
      // They'll be prompted on the Account page to set up MFA
      console.log('[LOGIN]', validation.data.email, '→ MFA setup required (not enrolled yet)');
    }

    // No MFA required or MFA not enrolled → issue session directly
    await createSessionAndCookies(req, res, user);

    await writeAuditLog(req, {
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
    });

    return res.json({
      success: true,
      mfaSetupRequired: isMfaRequired(user.role) ? true : undefined,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    console.error('POST /api/v2/auth/login failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

// ─── MFA Verify (step 2 of login) ─────────────────────────
router.post('/mfa/verify', async (req, res) => {
  try {
    const { mfaToken, code } = req.body || {};

    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, error: 'MFA token and code are required' });
    }

    // Verify the challenge token
    let payload;
    try {
      payload = verifyMfaChallengeToken(mfaToken);
    } catch {
      return res.status(401).json({ success: false, error: 'MFA session expired. Please log in again.' });
    }

    // Verify the TOTP code
    const { verifyMfaCode } = await import('../src/modules/mfa/service.js');
    const valid = await verifyMfaCode(payload.sub, code);

    if (!valid) {
      console.log('[MFA]', payload.email, '→ invalid code');
      return res.status(401).json({ success: false, error: 'Invalid code. Try again.' });
    }

    // MFA passed — issue full session cookies
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        emailVerifiedAt: true,
        active: true,
      },
    });

    if (!user || !user.active) {
      return res.status(401).json({ success: false, error: 'Account not found or disabled' });
    }

    await createSessionAndCookies(req, res, user);

    await writeAuditLog(req, {
      userId: user.id,
      action: 'auth.login.mfa_verified',
      entityType: 'User',
      entityId: user.id,
    });

    console.log('[MFA]', user.email, '→ verified, session created');

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    console.error('POST /api/v2/auth/mfa/verify failed:', error);
    return res.status(500).json({ success: false, error: 'MFA verification failed' });
  }
});

// ─── Refresh ───────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Missing refresh token' });
    }

    const payload = verifyRefreshToken(refreshToken);

    const session = await prisma.userSession.findUnique({
      where: { refreshTokenId: payload.sid },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    const newRefreshTokenId = generateOpaqueToken();

    await prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenId: newRefreshTokenId,
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken(session.user);
    const nextRefreshToken = signRefreshToken({
      sub: session.user.id,
      sid: newRefreshTokenId,
    });

    setAuthCookies(res, { accessToken, refreshToken: nextRefreshToken });

    return res.json({ success: true });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, error: 'Unable to refresh session' });
  }
});

// ─── Logout ────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await prisma.userSession.updateMany({
          where: {
            refreshTokenId: payload.sid,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      } catch { /* best-effort session revocation */ }
    }

    clearAuthCookies(res);
    return res.json({ success: true });
  } catch (error) {
    clearAuthCookies(res);
    return res.json({ success: true });
  }
});

// ─── Current User ──────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      emailVerifiedAt: true,
    },
  });

  return res.json({ success: true, user });
});

// ─── Verify Email ──────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
  try {
    const rawToken = String(req.body?.token || '').trim();
    if (!rawToken) {
      return res.status(400).json({ success: false, error: 'Verification token is required' });
    }

    const tokenHash = sha256(rawToken);

    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification token' });
    }

    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);

    await writeAuditLog(req, {
      userId: record.userId,
      action: 'auth.verify_email',
      entityType: 'User',
      entityId: record.userId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/auth/verify-email failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});

// ─── Resend Verification ───────────────────────────────────
router.post('/resend-verification', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.emailVerifiedAt) {
      return res.json({ success: true, message: 'Email already verified' });
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = sha256(rawToken);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const verifyUrl = `${env.APP_BASE_URL}/verify-email?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: 'Verify your email',
      text: `Verify your email using this link: ${verifyUrl}`,
      html: `<p>Verify your email using this link:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/auth/resend-verification failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
});

// ─── Forgot Password ───────────────────────────────────────
// Rate-limited (5 / 15 min / IP) + anti-enumeration. Always returns
// { success: true } regardless of whether the email exists so the
// caller cannot tell accounts apart from timing or status code.
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const validation = validateForgotPasswordPayload(req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
      select: { id: true, email: true, active: true },
    });

    // Anti-enumeration: always return success.
    if (user && user.active !== false) {
      // Single active token per user — invalidate any outstanding
      // unused tokens before issuing a new one. Prevents a spam
      // loop from leaving a pile of live tokens behind.
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const rawToken = generateOpaqueToken();
      const tokenHash = sha256(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
      });

      const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;

      // Fire the email but never leak the send outcome to the caller —
      // network failures shouldn't reveal account existence either.
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your Farroway password',
          text: [
            'You requested a password reset for your Farroway account.',
            `Click the link below to reset your password (valid for 30 minutes):`,
            resetUrl,
            'If you did not request this, you can safely ignore this email.',
          ].join('\n\n'),
          html: `
            <p>You requested a password reset for your Farroway account.</p>
            <p>Click the link below to reset your password. This link is valid for <strong>30 minutes</strong>.</p>
            <p><a href="${resetUrl}" style="background:#22c55e;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p>
            <p>Or copy this link: <code>${resetUrl}</code></p>
            <p>If you did not request this, you can safely ignore this email.</p>
          `,
        });
      } catch (mailErr) {
        console.error('forgot-password email send failed:', mailErr?.message || mailErr);
      }

      // Audit trail — recovery request is a security event even on
      // success. We deliberately don't log the raw token.
      try {
        await writeAuditLog(req, {
          userId: user.id,
          action: 'auth.forgot_password_requested',
          entityType: 'User',
          entityId: user.id,
        });
      } catch { /* non-fatal */ }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/auth/forgot-password failed:', error);
    // Still return a generic 200 so attackers can't use errors to probe.
    return res.json({ success: true });
  }
});

// ─── Reset Password ────────────────────────────────────────
// Rate-limited same envelope as forgot-password so token guessing
// pays the same price as initiation. Single-use + explicit expiry
// + all-user-tokens wipe on success.
router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const validation = validateResetPasswordPayload(req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    const tokenHash = sha256(validation.data.token);

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, active: true } } },
    });

    // Uniform error — do not tell the caller whether the token exists,
    // was already used, or expired. "Invalid or expired" covers all three.
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }
    if (record.user && record.user.active === false) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12);

    // Atomic: mark this token used, set password, revoke all active
    // sessions for the user, and wipe any OTHER outstanding tokens so
    // a single leak can't be replayed from a second copy.
    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      }),
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    clearAuthCookies(res);

    await writeAuditLog(req, {
      userId: record.userId,
      action: 'auth.reset_password',
      entityType: 'User',
      entityId: record.userId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/auth/reset-password failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

export default router;
