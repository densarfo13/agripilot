/**
 * MFA Routes
 *
 * Enrollment, verification, status, admin reset.
 *
 * Routes:
 *   GET  /api/mfa/status           — own MFA status
 *   POST /api/mfa/enroll/init      — start enrollment (returns otpauthUrl)
 *   POST /api/mfa/enroll/verify    — complete enrollment (verify code → save)
 *   POST /api/mfa/disable          — disable own MFA (requires TOTP)
 *   POST /api/mfa/backup-codes/regenerate — regenerate backup codes (requires TOTP)
 *   POST /api/users/:id/reset-mfa  (admin) — admin reset (in admin-routes.js)
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { mfaEnrollLimiter, mfaVerifyLimiter } from '../../middleware/rateLimiters.js';
import { requireStepUp } from '../../middleware/requireStepUp.js';
import {
  initEnrollment,
  completeEnrollment,
  disableOwnMfa,
  regenerateBackupCodes,
  getMfaStatus,
  adminResetMfa,
} from './service.js';

const router = Router();
router.use(authenticate);

// ─── GET /api/mfa/status ───────────────────────────────────

router.get('/status', asyncHandler(async (req, res) => {
  const status = await getMfaStatus(req.user.sub);
  res.json(status);
}));

// ─── POST /api/mfa/enroll/init ─────────────────────────────
// Returns otpauthUrl (for QR code) + encrypted pendingToken.
// The pendingToken is short-lived and must be sent back to /verify.

router.post('/enroll/init', mfaEnrollLimiter, asyncHandler(async (req, res) => {
  const result = initEnrollment(req.user.sub, req.user.email);
  res.json(result);
}));

// ─── POST /api/mfa/enroll/verify ──────────────────────────
// Verifies the TOTP code against the pending secret, saves enrollment.

router.post('/enroll/verify', mfaEnrollLimiter, asyncHandler(async (req, res) => {
  const { pendingToken, code } = req.body;

  if (!pendingToken || !code) {
    return res.status(400).json({ error: 'pendingToken and code are required' });
  }

  const result = await completeEnrollment({
    userId: req.user.sub,
    pendingToken,
    totpCode: String(code).trim(),
  });

  res.json(result);
}));

// ─── POST /api/mfa/disable ────────────────────────────────
// User disables their own MFA. Requires current TOTP code.

router.post('/disable', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const result = await disableOwnMfa({
    userId: req.user.sub,
    totpCode: String(code).trim(),
  });
  res.json(result);
}));

// ─── POST /api/mfa/backup-codes/regenerate ────────────────
// Regenerate backup codes. Requires TOTP verification.

router.post('/backup-codes/regenerate', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  const result = await regenerateBackupCodes({
    userId: req.user.sub,
    totpCode: String(code).trim(),
  });
  res.json(result);
}));

// ─── POST /api/mfa/admin/reset/:userId ────────────────────
// Admin resets a user's MFA enrollment.
// institutional_admin: own-org non-admin users only.
// super_admin: any user.

router.post('/admin/reset/:userId',
  authorize('super_admin', 'institutional_admin'),
  requireStepUp(15),  // Removing MFA from an account: tighter 15-min window
  asyncHandler(async (req, res) => {
    const result = await adminResetMfa({
      targetUserId: req.params.userId,
      actorId: req.user.sub,
      actorRole: req.user.role,
      actorOrgId: req.organizationId,
    });
    res.json(result);
  }));

export default router;
