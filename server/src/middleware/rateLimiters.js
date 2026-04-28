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
 * 15 attempts per 5 minutes per IP — relaxed for pilot testing while
 * still blocking automated attacks. Resets on successful login via
 * skipSuccessfulRequests so legitimate users are never locked out.
 */
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (was 15)
  max: 15, // 15 login attempts per 5 minutes per IP (was 10)
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // successful login doesn't count toward limit
});

/**
 * ingestLimiter — per-IP cap on POST /api/ingest.
 *
 * 120 batches/min is generous: a farmer at the upper bound
 * (200 events/batch * 2 batches/s) ships ~24k events/min,
 * well above any organic device. The cap catches a
 * misconfigured client retrying on every render or a
 * compromised token replaying captured batches; legitimate
 * field officers uploading offline-collected events from
 * multiple devices stay under it.
 */
export const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      120,
  message:  { error: 'Ingest rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * readLimiter — per-IP cap on read-heavy NGO endpoints.
 *
 * 300 reads/min covers a busy operator refreshing the
 * dashboard every 0.2s without throttling. The cap exists
 * mainly to prevent a buggy client polling in a tight loop
 * from exhausting the Postgres connection pool.
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      300,
  message:  { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
