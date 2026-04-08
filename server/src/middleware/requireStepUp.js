/**
 * requireStepUp middleware
 *
 * Enforces step-up authentication for sensitive privileged actions.
 * Must be used AFTER authenticate() and requireMfa() middleware.
 *
 * Step-up requires that:
 *   1. User has MFA enabled, AND
 *   2. JWT contains mfaVerifiedAt, AND
 *   3. mfaVerifiedAt is within the configured step-up window (default: 30 min)
 *
 * If step-up is required but not satisfied, returns:
 *   401 { error: '...', code: 'STEP_UP_REQUIRED', expiresAt: <ISO> }
 *
 * The client should show a step-up MFA modal and call POST /api/auth/step-up,
 * which re-verifies MFA and issues a new JWT with refreshed mfaVerifiedAt.
 *
 * Roles that are MFA-exempt (farmers) CANNOT satisfy step-up —
 * sensitive actions should never be accessible to farmer role anyway.
 *
 * Use:
 *   router.delete('/user/:id', authenticate, requireMfa, requireStepUp(), asyncHandler(...))
 */

import { config } from '../config/index.js';
import { opsEvent } from '../utils/opsLogger.js';

/**
 * Factory function. Optionally override the step-up window for specific routes.
 * @param {number} [windowMinutes] - Override config.mfa.stepUpWindowMinutes
 */
export function requireStepUp(windowMinutes) {
  const window = windowMinutes ?? config.mfa.stepUpWindowMinutes;

  return function stepUpMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const mfaVerifiedAt = req.user.mfaVerifiedAt;

    if (!mfaVerifiedAt) {
      opsEvent('mfa', 'step_up_required_no_mfa', 'warn', {
        userId: req.user.sub,
        role: req.user.role,
        path: req.originalUrl,
      });
      return res.status(401).json({
        error: 'Step-up authentication required. Please verify your identity with MFA.',
        code: 'STEP_UP_REQUIRED',
      });
    }

    const verifiedAt = new Date(mfaVerifiedAt * 1000); // mfaVerifiedAt is a UNIX timestamp in JWT
    const windowMs = window * 60 * 1000;
    const expiresAt = new Date(verifiedAt.getTime() + windowMs);

    if (Date.now() > expiresAt.getTime()) {
      opsEvent('mfa', 'step_up_expired', 'warn', {
        userId: req.user.sub,
        role: req.user.role,
        path: req.originalUrl,
        verifiedAt: verifiedAt.toISOString(),
        windowMinutes: window,
      });
      return res.status(401).json({
        error: `Step-up authentication expired. Please re-verify your MFA (window: ${window} min).`,
        code: 'STEP_UP_EXPIRED',
        expiresAt: expiresAt.toISOString(),
      });
    }

    next();
  };
}
