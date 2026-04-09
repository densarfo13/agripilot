/**
 * In-memory event store for operational monitoring.
 *
 * Stores the last MAX_EVENTS events in a circular buffer.
 * Also maintains per-type counters for the lifetime of the process.
 *
 * LIMITATION: This is intentionally lightweight — no DB dependency, no persistence.
 * It resets on server restart. For the pilot, this is sufficient because:
 *   1. All ops events are also emitted to console (JSON in production) which
 *      Railway's log drain captures and retains beyond process restarts.
 *   2. The /api/system/errors endpoint serves real-time monitoring only.
 *
 * To extend: pipe events to a persistent store (Redis, Prisma SystemSetting,
 * or external logging service) if post-restart audit replay is needed.
 */

const MAX_EVENTS = 500;

// Circular buffer of recent events
const _events = [];

// Lifetime counters by event type
const _counters = {};

// Process start time for uptime reporting
const _startedAt = new Date();

/**
 * Record an operational event.
 * @param {string} category - e.g. 'auth', 'permission', 'delivery', 'workflow'
 * @param {string} event    - e.g. 'login_failed', 'permission_denied'
 * @param {string} severity - 'debug' | 'info' | 'warn' | 'error' | 'critical'
 * @param {object} meta     - arbitrary context
 */
export function recordEvent(category, event, severity = 'info', meta = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category,
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Prepend (newest first) and cap buffer
  _events.unshift(entry);
  if (_events.length > MAX_EVENTS) _events.pop();

  // Increment counter
  const key = `${category}/${event}`;
  _counters[key] = (_counters[key] || 0) + 1;

  return entry;
}

/**
 * Get recent events, optionally filtered by category or severity.
 */
export function getRecentEvents({ limit = 100, category, severity, minSeverity } = {}) {
  const LEVELS = ['debug', 'info', 'warn', 'error', 'critical'];

  let result = _events;
  if (category) result = result.filter(e => e.category === category);
  if (severity) result = result.filter(e => e.severity === severity);
  if (minSeverity) {
    const minIdx = LEVELS.indexOf(minSeverity);
    result = result.filter(e => LEVELS.indexOf(e.severity) >= minIdx);
  }
  return result.slice(0, limit);
}

/**
 * Get all lifetime counters.
 */
export function getCounters() {
  return { ..._counters };
}

/**
 * Get summary stats for the monitoring dashboard.
 */
export function getMonitoringSummary() {
  const now = new Date();
  const uptimeMs = now - _startedAt;
  const uptimeHours = Math.round(uptimeMs / (1000 * 60 * 60) * 10) / 10;

  // Count events in last 1h and 24h
  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const recentErrors = _events.filter(
    e => (e.severity === 'error' || e.severity === 'critical') && e.timestamp >= oneHourAgo
  ).length;

  const recentWarns = _events.filter(
    e => e.severity === 'warn' && e.timestamp >= oneHourAgo
  ).length;

  const errorsLast24h = _events.filter(
    e => (e.severity === 'error' || e.severity === 'critical') && e.timestamp >= oneDayAgo
  ).length;

  // Error rate by category in last 24h
  const categoryCounts = {};
  for (const e of _events) {
    if (e.timestamp < oneDayAgo) continue;
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  }

  return {
    startedAt: _startedAt.toISOString(),
    uptimeHours,
    totalEventsRecorded: _events.length,
    bufferCapacity: MAX_EVENTS,
    lastHour: { errors: recentErrors, warnings: recentWarns },
    last24h: { errors: errorsLast24h },
    categoryCounts,
    lifetimeCounters: _counters,
  };
}

/**
 * Clear all events and counters (test utility only).
 */
export function _resetForTesting() {
  _events.length = 0;
  for (const k of Object.keys(_counters)) delete _counters[k];
}
