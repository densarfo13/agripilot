/**
 * Structured request logger middleware.
 * In production: outputs JSON lines for log aggregation (ELK, CloudWatch, etc.).
 * In development: outputs human-readable single-line logs.
 *
 * Logs: method, path, status, duration, requestId, userId (if authenticated).
 * Skips health check to avoid log noise.
 *
 * Phase 4 enhancements:
 *   - Slow request detection (>2s threshold, configurable)
 *   - Response size tracking (Content-Length)
 *   - Repeated 403 tracking per IP (abuse detection)
 *   - Log level classification (info/warn/error)
 */

// ─── Slow request threshold (ms) ──────────────────────────
const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS || '2000', 10);

// ─── Repeated 403 tracking (per IP, sliding window) ───────
const FORBIDDEN_WINDOW_MS = 5 * 60 * 1000; // 5-minute window
const FORBIDDEN_ALERT_THRESHOLD = 10; // Alert after 10 403s in window
const forbiddenTracker = new Map(); // ip → [timestamps]

/**
 * Track a 403 response for an IP address. Returns the count in the current window.
 */
function track403(ip) {
  const now = Date.now();
  let timestamps = forbiddenTracker.get(ip);
  if (!timestamps) {
    timestamps = [];
    forbiddenTracker.set(ip, timestamps);
  }
  timestamps.push(now);
  // Evict old entries outside window
  const cutoff = now - FORBIDDEN_WINDOW_MS;
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  // Prevent unbounded growth — cap tracked IPs
  if (forbiddenTracker.size > 2000) {
    const firstKey = forbiddenTracker.keys().next().value;
    forbiddenTracker.delete(firstKey);
  }
  return timestamps.length;
}

/** Get 403 count for an IP in the current window (for testing). */
export function get403Count(ip) {
  const now = Date.now();
  const timestamps = forbiddenTracker.get(ip);
  if (!timestamps) return 0;
  const cutoff = now - FORBIDDEN_WINDOW_MS;
  return timestamps.filter(t => t >= cutoff).length;
}

/** Clear 403 tracker (for testing). */
export function clear403Tracker() {
  forbiddenTracker.clear();
}

/** Get the configured slow request threshold (for testing). */
export function getSlowRequestThreshold() {
  return SLOW_REQUEST_THRESHOLD_MS;
}

/**
 * Classify log entry to determine the appropriate log level.
 */
export function classifyLogLevel(status, durationMs) {
  if (status >= 500) return 'error';
  if (status === 429) return 'warn';  // rate limited
  if (durationMs > SLOW_REQUEST_THRESHOLD_MS) return 'warn';
  if (status >= 400) return 'warn';
  return 'info';
}

/**
 * Build structured log entry from request/response data.
 * Exported for testing — the middleware uses this internally.
 */
export function buildLogEntry(req, res, durationMs) {
  const status = res.statusCode;
  const level = classifyLogLevel(status, durationMs);
  const responseSize = parseInt(res.getHeader?.('content-length') || '0', 10) || null;

  const entry = {
    level,
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl || req.path,
    status,
    duration: durationMs,
    userId: req.user?.sub || null,
    ip: req.ip,
  };

  // Add response size if available
  if (responseSize) {
    entry.responseSize = responseSize;
  }

  // Flag slow requests
  if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
    entry.slow = true;
    entry.slowThreshold = SLOW_REQUEST_THRESHOLD_MS;
  }

  // Track and flag repeated 403s
  if (status === 403 && req.ip) {
    const count = track403(req.ip);
    if (count >= FORBIDDEN_ALERT_THRESHOLD) {
      entry.forbiddenAlert = true;
      entry.forbiddenCount = count;
      entry.forbiddenWindow = `${FORBIDDEN_WINDOW_MS / 1000}s`;
    }
  }

  return entry;
}

export function requestLogger(req, res, next) {
  if (req.path === '/api/health') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const entry = buildLogEntry(req, res, duration);

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON for log aggregation
      // Route to console.error for error-level entries (stderr)
      if (entry.level === 'error') {
        console.error(JSON.stringify(entry));
      } else if (entry.level === 'warn') {
        console.warn(JSON.stringify(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    } else {
      // Human-readable for dev
      const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
      let line =
        `[${entry.timestamp}] ${entry.method} ${entry.path} ${statusColor}${entry.status}\x1b[0m ${duration}ms` +
        (entry.userId ? ` user=${entry.userId.slice(0, 8)}` : '') +
        ` rid=${entry.requestId.slice(0, 8)}`;

      if (entry.slow) {
        line += ` \x1b[31m[SLOW>${SLOW_REQUEST_THRESHOLD_MS}ms]\x1b[0m`;
      }
      if (entry.forbiddenAlert) {
        line += ` \x1b[35m[403×${entry.forbiddenCount}]\x1b[0m`;
      }
      if (entry.responseSize) {
        line += ` ${entry.responseSize}B`;
      }

      console.log(line);
    }
  });

  next();
}
