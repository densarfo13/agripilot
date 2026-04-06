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
