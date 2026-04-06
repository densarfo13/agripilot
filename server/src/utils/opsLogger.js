/**
 * Operational Event Logger
 *
 * Centralized structured logging for key operational events.
 * Emits JSON in production, human-readable in development.
 *
 * Categories:
 *   - auth: login success/failure, token issues, account deactivation
 *   - upload: file upload success/failure, cleanup, orphan detection
 *   - permission: role-based denials, ownership failures
 *   - workflow: status transitions, transaction failures
 *   - system: startup, shutdown, health check failures
 *
 * Each event includes: category, event name, severity, timestamp,
 * requestId, userId, and arbitrary metadata.
 */

const SEVERITY_LEVELS = ['debug', 'info', 'warn', 'error', 'critical'];

/**
 * Emit a structured operational event.
 *
 * @param {string} category - Event category (auth, upload, permission, workflow, system)
 * @param {string} event - Event name (e.g., 'login_failed', 'upload_orphan_detected')
 * @param {string} severity - One of: debug, info, warn, error, critical
 * @param {object} meta - Additional context (userId, ip, requestId, details, etc.)
 */
export function opsEvent(category, event, severity, meta = {}) {
  const entry = {
    type: 'ops_event',
    category,
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON to appropriate stream
    if (severity === 'error' || severity === 'critical') {
      console.error(JSON.stringify(entry));
    } else if (severity === 'warn') {
      console.warn(JSON.stringify(entry));
    } else {
      console.log(JSON.stringify(entry));
    }
  } else if (process.env.NODE_ENV !== 'test') {
    // Human-readable in dev (skip in test to avoid noise)
    const severityColor = {
      debug: '\x1b[36m',    // cyan
      info: '\x1b[32m',     // green
      warn: '\x1b[33m',     // yellow
      error: '\x1b[31m',    // red
      critical: '\x1b[35m', // magenta
    }[severity] || '\x1b[0m';

    const details = Object.keys(meta).length > 0
      ? ` ${JSON.stringify(meta)}`
      : '';
    console.log(`[OPS] ${severityColor}${severity.toUpperCase()}\x1b[0m ${category}/${event}${details}`);
  }

  return entry; // Return for testing
}

// ─── Convenience helpers for common events ─────────────────

export function logAuthEvent(event, meta = {}) {
  const severity = ['login_failed', 'token_invalid', 'account_deactivated'].includes(event)
    ? 'warn'
    : 'info';
  return opsEvent('auth', event, severity, meta);
}

export function logUploadEvent(event, meta = {}) {
  const severity = ['upload_failed', 'orphan_detected', 'cleanup_failed'].includes(event)
    ? 'warn'
    : 'info';
  return opsEvent('upload', event, severity, meta);
}

export function logPermissionEvent(event, meta = {}) {
  return opsEvent('permission', event, 'warn', meta);
}

export function logWorkflowEvent(event, meta = {}) {
  const severity = ['transition_failed', 'transaction_failed'].includes(event)
    ? 'error'
    : 'info';
  return opsEvent('workflow', event, severity, meta);
}

export function logSystemEvent(event, severity = 'info', meta = {}) {
  return opsEvent('system', event, severity, meta);
}
