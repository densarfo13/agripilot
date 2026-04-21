import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { sendEmail } from '../lib/mailer.js';
import { sha256 } from '../lib/hash.js';
import { env } from '../lib/env.js';
import { setAuthCookies, clearAuthCookies } from '../lib/cookies.js';
import { writeAuditLog } from '../lib/audit.js';
import { isDemoMode } from '../lib/demoMode.js';
import {
  buildResetUrl,
  buildPasswordResetEmail,
} from '../services/emailTemplates.js';
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
        return res.json({
          success: true,
          mfaChallengeRequired: true,
          mfaToken,
          user: { id: user.id, role: user.role, email: user.email },
        });
      }

      // MFA required but NOT enrolled → let them in but signal setup needed.
      // They'll be prompted on the Account page to set up MFA.
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
  // Phase tags make the log stream greppable end-to-end. Use the
  // existing per-request id when middleware set one; fall back to a
  // short random id so operators can still correlate phases.
  const reqId = req.id || Math.random().toString(36).slice(2, 10);
  const tag = `[forgot-password:${reqId}]`;
  try {
    const validation = validateForgotPasswordPayload(req.body || {});
    if (!validation.isValid) {
      console.warn(`${tag} validation_failed`, { fieldErrors: validation.errors });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    // Log the requested email at INFO so ops can confirm the request
    // reached the server. We never log the reset token itself.
    console.log(`${tag} requested email=${validation.data.email} ip=${req.ip || 'unknown'}`);

    // Validate env we strictly need. Missing APP_BASE_URL means the
    // link inside the email would be relative (e.g. "/reset-password
    // ?token=…"), which is unusable. We still return the generic
    // success response to the caller — the problem is logged
    // server-side for ops to fix.
    if (!env.APP_BASE_URL) {
      console.error(`${tag} config_error: APP_BASE_URL is not set; reset links cannot be built`);
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
      select: { id: true, email: true, active: true },
    });

    // Explicit user_found trace — lets ops grep the log for
    // "user_found=true" when debugging "I never got an email".
    // This line is INTERNAL; the HTTP response stays anti-enumeration.
    const userFound = !!(user && user.active !== false);
    console.log(`${tag} user_found=${userFound}`);

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
      console.log(`${tag} token_created userId=${user.id} expiresIn=${Math.round(RESET_TOKEN_EXPIRY_MS / 60000)}m`);

      // Build the reset URL via the pure helper so the same validation
      // + trailing-slash trim is applied everywhere (route + tests).
      // ABORT the send when the URL can't be built — the previous code
      // path would happily dispatch a relative "/reset-password?token=…"
      // href, which Outlook / some mobile mail clients render as a
      // non-clickable span. That's the "link is missing or not
      // visible" class of report. Anti-enumeration response shape is
      // preserved at the end of the handler.
      const expiryMinutes = Math.round(RESET_TOKEN_EXPIRY_MS / 60000);
      const urlResult = buildResetUrl({
        appBaseUrl: env.APP_BASE_URL,
        token:      rawToken,
      });
      let result;
      if (!urlResult.ok) {
        console.error(`${tag} reset_url_build_failed error=${urlResult.error} appBaseUrl=${env.APP_BASE_URL || '(unset)'}`);
        result = { success: false, provider: 'none', error: `reset_url_build_failed: ${urlResult.error}` };
      } else {
        const resetUrl = urlResult.url;
        console.log(`${tag} reset_url_generated host=${new URL(resetUrl).host}`);

        // In non-production environments OR when DEMO_MODE is
        // explicitly enabled, echo the reset URL to the server log so
        // the operator can copy it directly during pilot / demo runs.
        // Gated via isDemoMode() (single source of truth); this never
        // writes the link into an HTTP response body.
        if (isDemoMode()) {
          console.log(`${tag} dev_reset_link ${resetUrl}`);
        }

        // Fire the email. `sendEmail` never throws; we inspect the
        // structured result so we can log success vs failure crisply.
        // The body is built by the pure emailTemplates module so the
        // button and the plain-text fallback always share the same
        // absolute href — no empty hrefs, no relative paths.
        const { subject, text, html } = buildPasswordResetEmail({ resetUrl, expiryMinutes });
        console.log(`${tag} email_send_start to=${user.email}`);
        result = await sendEmail({
          to: user.email,
          subject,
          text,
          html,
          requestId: reqId,
        });
      }

      if (result.success) {
        console.log(`${tag} email_sent provider=${result.provider}${result.skipped ? ' (console-only)' : ''}`);
      } else {
        // Full failure details to the server log only — the caller
        // still gets the anti-enumeration generic success.
        console.error(`${tag} email_failed provider=${result.provider} error=${result.error}`);
      }

      // Audit trail — recovery request is a security event even on
      // success. We deliberately don't log the raw token.
      try {
        await writeAuditLog(req, {
          userId: user.id,
          action: 'auth.forgot_password_requested',
          entityType: 'User',
          entityId: user.id,
          metadata: {
            emailProvider: result.provider,
            emailSent:     !!result.success,
            emailSkipped:  !!result.skipped,
          },
        });
      } catch { /* non-fatal */ }
    } else {
      console.log(`${tag} no_active_user (anti-enumeration success)`);
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(`${tag} unexpected_failure`, error);
    // Still return a generic 200 so attackers can't use errors to probe.
    return res.json({ success: true });
  }
});

// ─── Recovery methods (public) ─────────────────────────────
/**
 * GET /api/v2/auth/recovery-methods
 *
 * Tells the unauthenticated forgot-password UI which recovery paths
 * are actually usable in this environment, so the UI can hide the
 * "Use SMS instead" link when SMS is not wired yet. Returns only
 * *availability* flags — no user data, no enumeration surface.
 *
 *   200 { email: boolean, sms: boolean }
 */
router.get('/recovery-methods', (_req, res) => {
  const email = !!process.env.SENDGRID_API_KEY;
  // SMS reset requires a verify-service on whichever provider is
  // active. Twilio Verify is the default — without the service SID
  // every POST to /api/auth/sms/* returns 503.
  const smsProvider = (process.env.SMS_VERIFY_PROVIDER || 'twilio-verify').toLowerCase();
  let sms = false;
  if (smsProvider === 'twilio-verify') {
    sms = !!(process.env.TWILIO_ACCOUNT_SID
          && process.env.TWILIO_AUTH_TOKEN
          && process.env.TWILIO_VERIFY_SERVICE_SID);
  } else if (smsProvider === 'plivo-verify') {
    sms = !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN && process.env.PLIVO_VERIFY_APP_UUID);
  } else if (smsProvider === 'infobip-verify') {
    sms = !!(process.env.INFOBIP_API_KEY && process.env.INFOBIP_2FA_APPLICATION_ID);
  }
  return res.json({ email, sms });
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
