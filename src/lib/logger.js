/**
 * logger — structured observability for crashes, sync failures, and key actions.
 *
 * Ring buffer in localStorage (max 100 entries). Lightweight enough for mobile.
 * In production, entries can be flushed to server via flushLogs().
 *
 * Usage:
 *   import { log, logError, getLogs, flushLogs } from '../lib/logger.js';
 *   log('sync', 'queue_flushed', { count: 5 });
 *   logError('api', err, { endpoint: '/farm-tasks' });
 */

const STORAGE_KEY = 'farroway:logs';
const MAX_ENTRIES = 100;

/**
 * Log a structured event.
 *
 * @param {string} domain - Category: 'sync' | 'farm' | 'decision' | 'api' | 'image' | 'auth' | 'crash'
 * @param {string} action - What happened: 'queue_flushed' | 'profile_save_failed' | etc.
 * @param {Object} [meta] - Optional metadata
 */
export function log(domain, action, meta) {
  try {
    const entry = {
      d: domain,
      a: action,
      ts: Date.now(),
    };
    if (meta) entry.m = meta;
    _append(entry);
  } catch { /* never throw from logger */ }
}

/**
 * Log an error with stack trace.
 *
 * @param {string} domain
 * @param {Error|string} err
 * @param {Object} [meta]
 */
export function logError(domain, err, meta) {
  try {
    const entry = {
      d: domain,
      a: 'error',
      ts: Date.now(),
      err: typeof err === 'string' ? err : (err?.message || 'Unknown error'),
      stack: typeof err === 'object' ? (err?.stack || '').slice(0, 500) : undefined,
    };
    if (meta) entry.m = meta;
    _append(entry);
  } catch { /* never throw from logger */ }
}

/**
 * Read all stored logs.
 * @returns {Array<Object>}
 */
export function getLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Clear all stored logs.
 */
export function clearLogs() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Flush logs to server (fire-and-forget).
 * Called opportunistically — on app foreground, after sync success, etc.
 *
 * @param {Function} [postFn] - Optional custom POST function. Defaults to fetch.
 */
export async function flushLogs(postFn) {
  const logs = getLogs();
  if (logs.length === 0) return;

  try {
    const post = postFn || ((url, body) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
    );
    await post('/api/v2/analytics/logs', { logs });
    clearLogs();
  } catch {
    // Non-blocking — logs stay in buffer for next attempt
  }
}

// ─── Internal ───────────────────────────────────────────────
function _append(entry) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.push(entry);
    // Trim oldest entries if over limit
    if (logs.length > MAX_ENTRIES) {
      logs.splice(0, logs.length - MAX_ENTRIES);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // localStorage full or unavailable — drop silently
  }
}

// ─── Sync-specific helpers ─────────────────────────────────────────

/**
 * Log a sync event (shorthand for log('sync', ...)).
 * @param {string} action - e.g. 'queue_flushed', 'mutation_replayed', 'conflict_detected'
 * @param {Object} [meta] - e.g. { entityType, idempotencyKey, status }
 */
export function logSync(action, meta) {
  log('sync', action, meta);
}

/**
 * Log a sync failure with structured context.
 * @param {string} action - e.g. 'replay_failed', 'conflict_rejected'
 * @param {Error|string} err
 * @param {Object} [meta] - e.g. { entityType, url, retryCount }
 */
export function logSyncError(action, err, meta) {
  logError('sync', err, { action, ...meta });
}

/**
 * Get logs filtered by domain.
 * @param {string} domain
 * @returns {Array<Object>}
 */
export function getLogsByDomain(domain) {
  return getLogs().filter(e => e.d === domain);
}

/**
 * Get recent sync logs (last N entries).
 * @param {number} [count=20]
 * @returns {Array<Object>}
 */
export function getRecentSyncLogs(count = 20) {
  return getLogsByDomain('sync').slice(-count);
}

// ─── Global error handler (catches unhandled throws + rejections) ──
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logError('crash', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('crash', event.reason || 'Unhandled promise rejection');
  });
}
