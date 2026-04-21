/**
 * requireMfa middleware
 *
 * Enforces MFA policy after authentication.
 * Must be used AFTER the authenticate() middleware.
 *
 * Policy:
 *   REQUIRED  — super_admin, institutional_admin, reviewer
 *   OPTIONAL  — field_officer, investor_viewer
 *   EXEMPT    — farmer (never required)
 *
 * Behaviour when MFA is required:
 *   - User enrolled + token has mfaVerifiedAt → PASS (full access)
 *   - User enrolled + token lacks mfaVerifiedAt → 401 mfaChallengeRequired
 *     (client must complete MFA challenge at POST /api/auth/mfa/verify)
 *   - User NOT enrolled → 401 mfaSetupRequired
 *     (client must complete MFA enrollment before accessing the app)
 *
 * The mfaVerifiedAt claim is added to the JWT only after successful MFA challenge.
 */

import prisma from '../config/database.js';
import { isMfaRequired, isMfaExempt } from '../modules/mfa/service.js';
import { opsEvent } from '../utils/opsLogger.js';
import { isDemoMode, isDemoAccount } from '../../lib/demoMode.js';

/**
 * Full MFA gate: blocks access if MFA is required but not satisfied.
 * Use on any route that should be inaccessible until MFA is verified.
 */
export function requireMfa(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const role = req.user.role;

  // Farmers are exempt
  if (isMfaExempt(role)) return next();

  // MFA is optional for this role
  if (!isMfaRequired(role)) return next();

  // Demo-mode bypass — only when BOTH flags agree:
  //   1. the server is in demo mode (DEMO_MODE=true OR non-prod), AND
  //   2. the email on the token is an explicitly allow-listed demo
  //      account (server/lib/demoMode.js DEMO_ALLOWED_EMAILS).
  // Real accounts never hit this branch, even when DEMO_MODE is on.
  if (isDemoMode() && isDemoAccount(req.user.email)) {
    opsEvent('mfa', 'demo_bypass', 'info', { userId: req.user.sub, role });
    return next();
  }

  // MFA is required — check JWT has mfaVerifiedAt
  if (!req.user.mfaVerifiedAt) {
    // We need to know whether user is enrolled to send the right hint
    return checkMfaEnrollment(req, res);
  }

  // mfaVerifiedAt is present — pass (freshness checked separately by requireStepUp)
  return next();
}

function checkMfaEnrollment(req, res) {
  prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { mfaEnabled: true },
  })
    .then(user => {
      if (!user) return res.status(401).json({ error: 'User not found' });

      if (!user.mfaEnabled) {
        opsEvent('mfa', 'setup_required', 'warn', { userId: req.user.sub, role: req.user.role });
        return res.status(401).json({
          error: 'MFA setup required. Your role requires two-factor authentication.',
          code: 'MFA_SETUP_REQUIRED',
        });
      }

      opsEvent('mfa', 'challenge_required', 'info', { userId: req.user.sub, role: req.user.role });
      return res.status(401).json({
        error: 'MFA verification required. Please complete the MFA challenge.',
        code: 'MFA_CHALLENGE_REQUIRED',
      });
    })
    .catch(() => res.status(500).json({ error: 'MFA check failed' }));
}
