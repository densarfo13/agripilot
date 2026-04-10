import { config } from '../config/index.js';
import { opsEvent } from '../utils/opsLogger.js';

/**
 * Global error handler middleware.
 * Never exposes stack traces in production.
 * Emits structured ops events for observability.
 */
export function errorHandler(err, req, res, _next) {
  // Log error server-side always — include requestId for tracing
  const rid = req.requestId || 'unknown';
  const statusCode = err.statusCode || 500;

  // Emit structured ops event for all handled errors
  opsEvent('system', 'unhandled_route_error', statusCode >= 500 ? 'error' : 'warn', {
    requestId: rid,
    method: req.method,
    path: req.originalUrl || req.path,
    error: err.message,
    statusCode,
    userId: req.user?.sub || null,
    ip: req.ip,
    ...(err.code ? { prismaCode: err.code } : {}),
  });

  if (config.isProduction) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      requestId: rid,
      method: req.method,
      path: req.originalUrl || req.path,
      error: err.message,
      statusCode,
      userId: req.user?.sub || null,
    }));
  } else {
    console.error(`[ERROR] ${req.method} ${req.path} rid=${rid}:`, err.message);
    console.error(err.stack);
  }

  // Prisma known-error handling — unique constraint violations
  if (err.code === 'P2002') {
    const target = err.meta?.target;
    const has = (key) => target && (target.includes(key) || (Array.isArray(target) && target.some(t => t.includes(key))));
    if (has('phone')) {
      return res.status(409).json({ error: 'A farmer with this phone number already exists in this organization.' });
    }
    if (has('nationalid') || has('national_id')) {
      return res.status(409).json({ error: 'A farmer with this national ID already exists in this organization.' });
    }
    if (has('referral') && has('code')) {
      return res.status(409).json({ error: 'This referral code is already in use.' });
    }
    if (has('review_assign') || (has('application') && has('reviewer'))) {
      return res.status(409).json({ error: 'This reviewer is already assigned to this application.' });
    }
    if (has('officer_validation')) {
      return res.status(409).json({ error: 'This officer has already submitted this validation type for this season.' });
    }
    if (has('rec_feedback')) {
      return res.status(409).json({ error: 'You have already submitted feedback for this recommendation.' });
    }
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ error: 'Related record not found (foreign key constraint)' });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum size is ${config.upload.maxFileSizeMB}MB` });
  }

  const message = statusCode === 500 && config.isProduction
    ? 'Internal server error'
    : err.message || 'Internal server error';

  // Never include stack traces in API responses — log them server-side only
  // Include requestId so users can reference it in support tickets
  const response = { error: message };
  if (statusCode >= 500) response.requestId = rid;
  res.status(statusCode).json(response);
}

/**
 * Async route wrapper — catches async errors and passes to error handler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
