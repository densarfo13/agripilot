import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { isValidEmail, validatePassword } from '../../middleware/validate.js';
import { registrationLimiter } from '../../middleware/rateLimiters.js';
import { idempotencyCheck } from '../../middleware/idempotency.js';
import * as authService from './service.js';
import { farmerSelfRegister, getFarmerProfile } from './farmer-registration.js';
import { writeAuditLog } from '../audit/service.js';
import * as federated from './federated.js';
import prisma from '../../config/database.js';

const router = Router();

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

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const result = await authService.login({ email: email.toLowerCase().trim(), password });

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

// Change own password (authenticated user)
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

  const result = await farmerSelfRegister({
    fullName: fullName.trim(),
    phone: phone.trim(),
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

// Get own farmer profile (authenticated farmer)
router.get('/farmer-profile', authenticate, asyncHandler(async (req, res) => {
  if (req.user.role !== 'farmer') {
    return res.status(403).json({ error: 'Only farmer accounts can access this' });
  }
  const profile = await getFarmerProfile(req.user.sub);
  if (!profile) {
    return res.status(404).json({ error: 'Farmer profile not found' });
  }
  res.json(profile);
}));

// ─── Federated Auth Discovery ──────────────────────────

// Returns which providers are configured (no secrets exposed)
router.get('/providers', (req, res) => {
  res.json({
    google: federated.isGoogleEnabled(),
    microsoft: federated.isMicrosoftEnabled(),
  });
});

// ─── Google OAuth2 ─────────────────────────────────────

router.get('/google', (req, res) => {
  if (!federated.isGoogleEnabled()) {
    return res.status(501).json({ error: 'Google authentication is not configured' });
  }
  const state = req.query.mode || 'login'; // 'login' or 'link'
  res.redirect(federated.getGoogleAuthUrl(state));
});

router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, error: providerError, state } = req.query;

  if (providerError || !code) {
    return res.send(federated.generateCallbackHtml({
      error: providerError || 'Authentication cancelled',
    }));
  }

  try {
    const providerUser = await federated.getGoogleUserInfo(code);
    const result = await federated.federatedLogin(providerUser);
    res.send(federated.generateCallbackHtml(result));
  } catch (err) {
    res.send(federated.generateCallbackHtml({
      error: err.message || 'Google authentication failed',
    }));
  }
}));

// ─── Microsoft OAuth2 ──────────────────────────────────

router.get('/microsoft', (req, res) => {
  if (!federated.isMicrosoftEnabled()) {
    return res.status(501).json({ error: 'Microsoft authentication is not configured' });
  }
  const state = req.query.mode || 'login';
  res.redirect(federated.getMicrosoftAuthUrl(state));
});

router.get('/microsoft/callback', asyncHandler(async (req, res) => {
  const { code, error: providerError, state } = req.query;

  if (providerError || !code) {
    return res.send(federated.generateCallbackHtml({
      error: providerError || 'Authentication cancelled',
    }));
  }

  try {
    const providerUser = await federated.getMicrosoftUserInfo(code);
    const result = await federated.federatedLogin(providerUser);
    res.send(federated.generateCallbackHtml(result));
  } catch (err) {
    res.send(federated.generateCallbackHtml({
      error: err.message || 'Microsoft authentication failed',
    }));
  }
}));

// ─── Provider Link / Unlink (authenticated) ────────────

// Link a provider to current user's account (via popup flow)
router.get('/link/google', authenticate, (req, res) => {
  if (!federated.isGoogleEnabled()) {
    return res.status(501).json({ error: 'Google authentication is not configured' });
  }
  res.redirect(federated.getGoogleAuthUrl('link'));
});

router.get('/link/microsoft', authenticate, (req, res) => {
  if (!federated.isMicrosoftEnabled()) {
    return res.status(501).json({ error: 'Microsoft authentication is not configured' });
  }
  res.redirect(federated.getMicrosoftAuthUrl('link'));
});

// List linked providers
router.get('/linked-providers', authenticate, asyncHandler(async (req, res) => {
  const providers = await federated.listLinkedProviders(req.user.sub);
  res.json(providers);
}));

// Unlink a provider
router.delete('/unlink-provider/:provider', authenticate, asyncHandler(async (req, res) => {
  const provider = req.params.provider;
  if (!['google', 'microsoft'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider. Must be google or microsoft.' });
  }
  const result = await federated.unlinkProvider({
    userId: req.user.sub,
    provider,
  });
  res.json(result);
}));

export default router;
