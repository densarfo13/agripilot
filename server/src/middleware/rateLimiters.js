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
