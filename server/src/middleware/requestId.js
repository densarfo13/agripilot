import { randomUUID } from 'crypto';

/**
 * Request ID middleware.
 * Assigns a unique ID to every request for tracing through logs.
 * Uses incoming X-Request-Id header if present (for proxy chains), otherwise generates one.
 */
export function requestId(req, _res, next) {
  req.requestId = req.headers['x-request-id'] || randomUUID();
  next();
}
