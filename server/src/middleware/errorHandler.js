import { config } from '../config/index.js';
import { opsEvent } from '../utils/opsLogger.js';

// ─── Sensitive-leak scrubber ──────────────────────────────
// Merged-blocker spec §5: API errors must never leak stack
// traces, Prisma internals, env vars, file paths, or tokens
// to the client. The errorHandler already replaces 5xx
// messages with "Internal server error" in production, but
// a controller can still throw `new Error("DATABASE_URL bad")`
// and the message would have flowed through unchanged. This
// regex scans every outgoing message and either replaces it
// with the neutral string OR strips the offending substring
// (depending on how the message was assembled).
const LEAK_PATTERNS = [
  /\bDATABASE_URL\b/gi,
  /\bAUTH_SECRET\b/gi,
  /\bJWT_SECRET\b/gi,
  /\bMFA_SECRET_KEY\b/gi,
  /\bSENDGRID_API_KEY\b/gi,
  /\bTWILIO_AUTH_TOKEN\b/gi,
  /\bnode_modules\b/gi,
  /\bat Object\./g,
  /\bat (?:\/|[A-Z]:\\)\S+/g,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /\bPrismaClient(?:Known|Validation|Initialization)RequestError\b/g,
];

function _isSensitive(msg) {
  if (typeof msg !== 'string' || !msg) return false;
  return LEAK_PATTERNS.some((re) => { re.lastIndex = 0; return re.test(msg); });
}

/**
 * Scrub a candidate user-facing error message. Returns:
 *   • the original message when it carries no sensitive token
 *   • the neutral fallback when it does
 *
 * In production we always fall back; in development we keep
 * the diagnostic so engineers can debug, but server-side logs
 * already get the full err.stack regardless of environment.
 */
function scrubMessage(msg, fallback = 'Something went wrong') {
  if (!config.isProduction) return msg || fallback;
  if (!msg || typeof msg !== 'string') return fallback;
  if (_isSensitive(msg)) return fallback;
  return msg;
}

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

  // Build the user-facing message with the leak scrubber.
  // 5xx in production always falls back to the neutral string;
  // 4xx still passes through for actionable errors (e.g.
  // "Invalid email") UNLESS the message carries a leak pattern,
  // in which case scrubMessage swaps it for "Something went
  // wrong" in production. Dev keeps the original message so
  // engineers can debug.
  let message;
  if (statusCode >= 500) {
    message = config.isProduction
      ? 'Internal server error'
      : scrubMessage(err.message, 'Internal server error');
  } else {
    message = scrubMessage(err.message, 'Something went wrong');
  }

  // Never include stack traces in API responses — log them server-side only.
  // Include requestId so users can reference it in support tickets.
  const response = { error: message };
  if (statusCode >= 500) response.requestId = rid;
  res.status(statusCode).json(response);
}

// Exported for the security test suite — it asserts the
// scrubber catches every spec leak pattern.
export { scrubMessage, LEAK_PATTERNS };

/**
 * Async route wrapper — catches async errors and passes to error handler.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
