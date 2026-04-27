import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { isValidEmail, validatePassword } from '../../middleware/validate.js';
import { validatePhone, normalizePhoneForStorage } from '../../utils/phoneUtils.js';
import { registrationLimiter, loginLimiter, mfaVerifyLimiter, passwordResetLimiter } from '../../middleware/rateLimiters.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import * as authService from './service.js';
import { farmerSelfRegister, getFarmerProfile } from './farmer-registration.js';
import { initiatePasswordReset, completePasswordReset, verifyResetToken } from './resetService.js';
import { writeAuditLog } from '../audit/service.js';
import { logAuthEvent } from '../../utils/opsLogger.js';
import * as federated from './federated.js';
import smsVerificationRoutes from './smsVerification/routes.js';
import prisma from '../../config/database.js';
import { config } from '../../config/index.js';

const router = Router();

// SMS-based verification (provider-agnostic OTP). Mounted at
// /api/auth/sms/{start-verification,check-verification}. Used for
// phone-based password reset, account recovery, and optional
// login verification. Email-based reset remains on /forgot-password
// + /reset-password — both paths coexist.
router.use('/sms', smsVerificationRoutes);

// Spec-compliant aliases (same service, same limits, same audit).
// Legacy /sms/start-verification and /sms/check-verification continue
// to work; these mirror the shorter paths the product spec calls for
// and the ones the Twilio-facing integration docs reference.
router.post('/send-otp',   passwordResetLimiter, (req, res, next) => { req.url = '/sms/start-verification'; smsVerificationRoutes.handle(req, res, next); });
router.post('/verify-otp', passwordResetLimiter, (req, res, next) => { req.url = '/sms/check-verification'; smsVerificationRoutes.handle(req, res, next); });

// ─── Local Auth ────────────────────────────────────────

// Staff registration — requires admin authentication.
// Farmers use /farmer-register (public). Staff accounts are created by admins.
router.post('/register', authenticate, authorize('super_admin', 'institutional_admin'), asyncHandler(async (req, res) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, and fullName are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const result = await authService.register({ email: email.toLowerCase().trim(), password, fullName: fullName.trim(), role, organizationId: req.user?.organizationId });
  writeAuditLog({ userId: req.user.sub, action: 'staff_registered', details: { newUserId: result.user.id, role: result.user.role } }).catch(() => {});
  res.status(201).json(result);
}));

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  let result;
  try {
    result = await authService.login({ email: normalizedEmail, password });
  } catch (err) {
    // Log all login failures for security monitoring (non-blocking, fire-and-forget)
    logAuthEvent('login_failed', { email: normalizedEmail, ip: req.ip, reason: err.message });
    throw err;
  }

  // Record login event for adoption tracking (non-blocking)
  writeAuditLog({
    userId: result.user.id,
    organizationId: result.user.organizationId,
    action: 'user_login',
    details: { method: 'local', role: result.user.role },
  }).catch(() => {});

  res.json(result);
}));

// Get own account info (authenticated user)
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true, email: true, fullName: true, role: true, active: true,
      preferredLanguage: true, organizationId: true, lastLoginAt: true, createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

// Self-service profile update — safe fields only (no role, no email, no org)
router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const { fullName, preferredLanguage } = req.body;
  if (fullName === undefined && preferredLanguage === undefined) {
    return res.status(400).json({ error: 'At least one field required: fullName, preferredLanguage' });
  }
  const result = await authService.updateSelfProfile({
    userId: req.user.sub,
    fullName,
    preferredLanguage,
  });
  res.json(result);
}));

// ─── Logout ────────────────────────────────────────────
// Bumps tokenVersion so all existing JWTs for this user become invalid.

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await authService.logout(req.user.sub);
  writeAuditLog({
    userId: req.user.sub,
    action: 'user_logout',
    details: { method: req.user.lastLoginMethod || 'unknown' },
  }).catch(() => {});
  res.json({ message: 'Logged out successfully.' });
}));

// ─── MFA Challenge (after password login) ──────────────
// Called when login returned { mfaChallengeRequired: true, mfaToken }.
// Accepts the mfaToken (in body) + TOTP code, returns full access JWT.

router.post('/mfa/verify', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) {
    return res.status(400).json({ error: 'mfaToken and code are required' });
  }

  let result;
  try {
    result = await authService.completeMfaChallenge({
      mfaToken,
      totpCode: String(code).trim(),
    });
  } catch (err) {
    logAuthEvent('mfa_challenge_failed', { ip: req.ip, reason: err.message });
    throw err;
  }

  writeAuditLog({
    userId: result.user.id,
    action: 'mfa_challenge_success',
    details: { method: 'totp' },
  }).catch(() => {});

  res.json(result);
}));

// ─── Step-up Auth ──────────────────────────────────────
// Re-verify MFA and get a new JWT with refreshed mfaVerifiedAt.
// Called when a sensitive route returns { code: 'STEP_UP_REQUIRED' }.

router.post('/step-up', authenticate, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  let result;
  try {
    result = await authService.stepUpAuth({
      userId: req.user.sub,
      totpCode: String(code).trim(),
    });
  } catch (err) {
    logAuthEvent('step_up_failed', { userId: req.user.sub, ip: req.ip, reason: err.message });
    throw err;
  }

  writeAuditLog({
    userId: req.user.sub,
    action: 'step_up_verified',
    details: {},
  }).catch(() => {});

  res.json(result);
}));

// ─── Forgot Password ───────────────────────────────────
// Self-service reset initiation. Always returns 200 (anti-enumeration).

router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });

  const result = await initiatePasswordReset({ email });
  res.json(result);
}));

// ─── Verify Reset Token (pre-flight, no side effects) ─
// The ResetPassword page calls this on mount so a dead link
// surfaces the recovery CTA before the farmer enters a new
// password. Returns ONLY { valid: boolean } — never the reason,
// never the user id, never the email. Same rate limiter as the
// other reset paths so token guessing pays the same cost.

router.post('/verify-reset-token', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  // Empty / missing token → uniformly invalid (no error code so the
  // endpoint can't be used to distinguish "not sent" from "wrong").
  const result = await verifyResetToken({ rawToken: token });
  res.json(result);
}));

// ─── Reset Password (with token) ──────────────────────
// Validates the reset token and sets a new password.

router.post('/reset-password', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required' });
  }

  const result = await completePasswordReset({ rawToken: token, newPassword });
  res.json(result);
}));

// ─── Change own password (authenticated user) ──────────
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  const pwCheck = validatePassword(newPassword);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }

  const result = await authService.changePassword({
    userId: req.user.sub,
    currentPassword,
    newPassword,
  });
  res.json(result);
}));

// Public: look up invite token to pre-fill the registration form
// Kept for backwards compatibility — /api/invites/:token/validate is the canonical endpoint.
// Returns only non-sensitive fields — no credentials, no IDs
router.get('/invite-info/:token', asyncHandler(async (req, res) => {
  const farmer = await prisma.farmer.findUnique({
    where: { inviteToken: req.params.token },
    select: {
      fullName: true, phone: true, region: true, district: true, village: true,
      countryCode: true, preferredLanguage: true, primaryCrop: true,
      userId: true, inviteExpiresAt: true,
    },
  });
  if (!farmer) return res.status(404).json({ error: 'Invalid or expired invite link. This link may have already been used.' });
  if (farmer.userId) return res.status(400).json({ error: 'This invite has already been accepted. Use the login page to sign in.' });

  const isExpired = farmer.inviteExpiresAt && new Date() > new Date(farmer.inviteExpiresAt);
  if (isExpired) {
    return res.status(410).json({ error: 'This invite link has expired. Please ask your administrator to resend the invite.', expired: true });
  }

  // Return only the pre-fill data — no IDs or tokens exposed
  const { userId, inviteExpiresAt, ...prefill } = farmer;
  res.json({ ...prefill, expiresAt: inviteExpiresAt, valid: true });
}));

// Farmer self-registration (public — tighter rate limit + idempotency)
router.post('/farmer-register', registrationLimiter, idempotencyCheck, asyncHandler(async (req, res) => {
  const { fullName, phone, email, password, countryCode, region, district, village, preferredLanguage, primaryCrop, farmSizeAcres } = req.body;

  if (!fullName || !phone || !email || !password) {
    return res.status(400).json({ error: 'fullName, phone, email, and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.message });
  }
  const normalizedPhone = normalizePhoneForStorage(phone);
  const phoneCheck = validatePhone(normalizedPhone);
  if (!phoneCheck.valid) {
    return res.status(400).json({ error: phoneCheck.message });
  }

  const result = await farmerSelfRegister({
    fullName: fullName.trim(),
    phone: normalizedPhone,
    email: email.toLowerCase().trim(),
    password,
    countryCode,
    region,
    district,
    village,
    preferredLanguage,
    primaryCrop,
    farmSizeAcres,
  });
  writeAuditLog({ userId: result.user.id, action: 'farmer_self_registered', details: { farmerId: result.farmer.id } }).catch(() => {});
  res.status(201).json(result);
}));

// Get own farmer profile (authenticated farmer).
//
// Production hardening: a Prisma error inside getFarmerProfile used
// to bubble up to the global errorHandler as a bare 500 with no
// body context, which the dashboard then surfaced as a doomsday
// "Unable to load account" panel even when the underlying issue
// was transient (DB blip, connection-pool exhaustion, schema-vs-
// migration drift). We now:
//   1. Guard the userId — a missing sub claim means a malformed
//      token; return 401 so the client re-auths instead of
//      flashing a 500
//   2. Catch Prisma errors specifically, log enough context to
//      Railway logs to debug live, and return a 503 (transient)
//      with a code the client can branch on
//   3. Keep 404 reserved for the legitimate "no farmer record yet"
//      case so the client can route the user to onboarding rather
//      than an error screen
router.get('/farmer-profile', authenticate, asyncHandler(async (req, res) => {
  if (!req.user || !req.user.sub) {
    return res.status(401).json({ error: 'Session invalid', code: 'no_subject' });
  }
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ error: 'Only farmer accounts can access this', code: 'wrong_role' });
  }
  let profile;
  try {
    profile = await getFarmerProfile(req.user.sub);
  } catch (err) {
    // Log the real Prisma message so live debugging works. Don't
    // leak the message to the client (could include schema info).
    try {
      logAuthEvent('farmer_profile_query_failed', {
        userId: req.user.sub,
        message: err && err.message ? String(err.message).slice(0, 200) : 'unknown',
        code: err && err.code ? err.code : null,
      });
    } catch { /* never propagate from a logger */ }
    return res.status(503).json({
      error: 'Profile lookup temporarily unavailable. Please try again.',
      code: 'profile_lookup_failed',
    });
  }
  if (!profile) {
    return res.status(404).json({
      error: 'Farmer profile not found',
      code: 'no_farmer_profile',
    });
  }
  res.json(profile);
}));

// ─── Federated Auth Discovery ──────────────────────────

// Returns which providers are configured (no secrets exposed)
router.get('/providers', (req, res) => {
  res.json({
    google: federated.isGoogleEnabled(),
    microsoft: federated.isMicrosoftEnabled(),
    oidc: federated.isOidcEnabled() ? { displayName: config.oidc?.displayName || 'SSO' } : false,
  });
});

// ─── Google OAuth2 ─────────────────────────────────────

router.get('/google', (req, res) => {
  if (!federated.isGoogleEnabled()) {
    return res.status(501).json({ error: 'Google authentication is not configured' });
  }
  res.redirect(federated.getGoogleAuthUrl({ mode: 'login' }));
});

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, error: providerError, state } = req.query;

  if (providerError || !code) {
    return res.send(federated.generateCallbackHtml({ error: providerError || 'Authentication cancelled' }));
  }

  try {
    const statePayload = federated.verifyOAuthState(state);
    const providerUser = await federated.getGoogleUserInfo(code);
    const result = await federated.handleFederatedCallback({ providerUser, statePayload });
    res.send(federated.generateCallbackHtml(result));
  } catch (err) {
    res.send(federated.generateCallbackHtml({ error: err.message || 'Google authentication failed' }));
  }
}));

// ─── Microsoft OAuth2 ──────────────────────────────────

router.get('/microsoft', (req, res) => {
  if (!federated.isMicrosoftEnabled()) {
    return res.status(501).json({ error: 'Microsoft authentication is not configured' });
  }
  res.redirect(federated.getMicrosoftAuthUrl({ mode: 'login' }));
});

router.get('/microsoft/callback', asyncHandler(async (req, res) => {
  const { code, error: providerError, state } = req.query;

  if (providerError || !code) {
    return res.send(federated.generateCallbackHtml({ error: providerError || 'Authentication cancelled' }));
  }

  try {
    const statePayload = federated.verifyOAuthState(state);
    const providerUser = await federated.getMicrosoftUserInfo(code);
    const result = await federated.handleFederatedCallback({ providerUser, statePayload });
    res.send(federated.generateCallbackHtml(result));
  } catch (err) {
    res.send(federated.generateCallbackHtml({ error: err.message || 'Microsoft authentication failed' }));
  }
}));

// ─── Generic OIDC ──────────────────────────────────────

router.get('/oidc', asyncHandler(async (req, res) => {
  if (!federated.isOidcEnabled()) {
    return res.status(501).json({ error: 'OIDC authentication is not configured' });
  }
  const url = await federated.getOidcAuthUrl({ mode: 'login' });
  res.redirect(url);
}));

router.get('/oidc/callback', asyncHandler(async (req, res) => {
  const { code, error: providerError, state } = req.query;

  if (providerError || !code) {
    return res.send(federated.generateCallbackHtml({ error: providerError || 'Authentication cancelled' }));
  }

  try {
    const statePayload = federated.verifyOAuthState(state);
    const providerUser = await federated.getOidcUserInfo(code);
    const result = await federated.handleFederatedCallback({ providerUser, statePayload });
    res.send(federated.generateCallbackHtml(result));
  } catch (err) {
    res.send(federated.generateCallbackHtml({ error: err.message || 'OIDC authentication failed' }));
  }
}));

// ─── Provider Link / Unlink (authenticated) ────────────

// Link a provider to current user's account (via popup flow).
// userId is encoded in signed state so the callback knows who is linking.
router.get('/link/google', authenticate, (req, res) => {
  if (!federated.isGoogleEnabled()) {
    return res.status(501).json({ error: 'Google authentication is not configured' });
  }
  res.redirect(federated.getGoogleAuthUrl({ mode: 'link', userId: req.user.sub }));
});

router.get('/link/microsoft', authenticate, (req, res) => {
  if (!federated.isMicrosoftEnabled()) {
    return res.status(501).json({ error: 'Microsoft authentication is not configured' });
  }
  res.redirect(federated.getMicrosoftAuthUrl({ mode: 'link', userId: req.user.sub }));
});

router.get('/link/oidc', authenticate, asyncHandler(async (req, res) => {
  if (!federated.isOidcEnabled()) {
    return res.status(501).json({ error: 'OIDC authentication is not configured' });
  }
  const url = await federated.getOidcAuthUrl({ mode: 'link', userId: req.user.sub });
  res.redirect(url);
}));

// List linked providers
router.get('/linked-providers', authenticate, asyncHandler(async (req, res) => {
  const providers = await federated.listLinkedProviders(req.user.sub);
  res.json(providers);
}));

// Unlink a provider
router.delete('/unlink-provider/:provider', authenticate, asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  if (!['google', 'microsoft', 'oidc'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider. Must be google, microsoft, or oidc.' });
  }
  const result = await federated.unlinkProvider({
    userId: req.user.sub,
    provider,
  });
  res.json(result);
}));

export default router;
