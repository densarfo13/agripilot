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
} from '../lib/tokens.js';
import {
  validateRegisterPayload,
  validateLoginPayload,
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
} from '../lib/validation.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

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
        emailVerifiedAt: true,
        passwordHash: true,
        active: true,
      },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    const validPassword = await bcrypt.compare(validation.data.password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    await createSessionAndCookies(req, res, user);

    await writeAuditLog(req, {
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    console.error('POST /api/v2/auth/login failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to login' });
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
router.post('/forgot-password', async (req, res) => {
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
      select: { id: true, email: true },
    });

    // Anti-enumeration: always return success
    if (user) {
      const rawToken = generateOpaqueToken();
      const tokenHash = sha256(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${rawToken}`;

      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        text: `Reset your password using this link: ${resetUrl}`,
        html: `<p>Reset your password using this link:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('POST /api/v2/auth/forgot-password failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to process forgot password' });
  }
});

// ─── Reset Password ────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
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
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(validation.data.password, 12);

    await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
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
