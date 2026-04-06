/**
 * Structured request logger middleware.
 * In production: outputs JSON lines for log aggregation (ELK, CloudWatch, etc.).
 * In development: outputs human-readable single-line logs.
 *
 * Logs: method, path, status, duration, requestId, userId (if authenticated).
 * Skips health check to avoid log noise.
 */
export function requestLogger(req, res, next) {
  if (req.path === '/api/health') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const entry = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.path,
      status: res.statusCode,
      duration,
      userId: req.user?.sub || null,
      ip: req.ip,
    };

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON for log aggregation
      console.log(JSON.stringify(entry));
    } else {
      // Human-readable for dev
      const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(
        `[${entry.timestamp}] ${entry.method} ${entry.path} ${statusColor}${entry.status}\x1b[0m ${duration}ms` +
        (entry.userId ? ` user=${entry.userId.slice(0, 8)}` : '') +
        ` rid=${entry.requestId.slice(0, 8)}`
      );
    }
  });

  next();
}
