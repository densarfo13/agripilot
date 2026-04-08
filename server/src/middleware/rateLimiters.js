import rateLimit from 'express-rate-limit';

/**
 * Stricter rate limiter for workflow mutation endpoints.
 * Approve, reject, disburse, scoring — these are high-value actions
 * that should have tighter limits than general API browsing.
 */
export const workflowLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 workflow actions per minute per IP
  message: { error: 'Too many workflow actions. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Tighter limiter for public registration endpoints.
 * Prevents registration spam without blocking legitimate users.
 */
export const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 registration attempts per 15 minutes per IP
  message: { error: 'Too many registration attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for file upload endpoints.
 * Prevents upload flooding.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 uploads per minute per IP
  message: { error: 'Too many uploads. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for progress/season submission endpoints.
 * Prevents rapid-fire data submissions.
 */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 submissions per minute per IP
  message: { error: 'Too many submissions. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for SoD/JIT security request endpoints.
 * These are low-volume, high-sensitivity actions.
 */
export const securityLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 security actions per minute per IP
  message: { error: 'Too many security requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for farmer invite creation endpoints.
 * Prevents invite-spam abuse — inviting is a relatively infrequent action.
 */
export const inviteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 invite actions per minute per IP
  message: { error: 'Too many invite requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Stricter limiter for invite resend.
 * Resending is a recovery action, not a bulk operation.
 */
export const resendInviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 resends per 15 min per IP
  message: { error: 'Too many resend attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for MFA enrollment initiation.
 * Prevents secret generation spam.
 */
export const mfaEnrollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 enrollment attempts per 15 minutes per IP
  message: { error: 'Too many MFA enrollment attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for MFA code verification (challenge, step-up, disable).
 * Tight limit to prevent TOTP brute-force (only 1M codes per 30s window anyway,
 * but belt-and-suspenders to prevent automated scanning).
 */
export const mfaVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 code attempts per 5 minutes per IP
  message: { error: 'Too many MFA verification attempts. Please try again in 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for password reset initiation (forgot-password).
 * Prevents email flooding / enumeration timing attacks.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for public invite acceptance and token validation endpoints.
 * Prevents token enumeration attacks.
 */
export const inviteAcceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 accept attempts per 15 minutes per IP
  message: { error: 'Too many invite attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limiter for the login endpoint.
 * Prevents brute-force credential stuffing attacks.
 * 10 attempts per 15 minutes per IP — strict enough to slow attackers,
 * permissive enough not to frustrate legitimate users who mistype.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes per IP
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
