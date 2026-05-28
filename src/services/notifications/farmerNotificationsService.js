/**
 * farmerNotificationsService.js — SERVICE-layer wrapper for the
 * farmer-notifications endpoints.
 *
 *   import {
 *     fetchFarmerNotifications,
 *     markFarmerNotificationRead,
 *     markAllFarmerNotificationsRead,
 *   } from 'src/services/notifications/farmerNotificationsService.js';
 *
 * What this is
 * ────────────
 *   The runtime hook (`useFarmerNotificationsRuntime`) owns the
 *   lifecycle. This service owns the side-effect — the actual HTTP
 *   call shape, parameter encoding, and idempotent retry behavior
 *   for transient network failures.
 *
 *   The service does NOT own state. Every function returns a plain
 *   `{ ok, data, error }` envelope; the runtime layer decides what
 *   to render or stash.
 *
 * Retry contract
 *   • GET requests: ONE retry on a TIMEOUT or 5xx (1.2 s back-off).
 *   • PATCH/POST mutations: NO automatic retry — the caller may
 *     decide based on user intent (mark-read can be re-clicked).
 *   • All requests carry an idempotency key (axios interceptor
 *     attaches one for mutations — see src/api/client.js).
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws — failures become `{ ok: false }`.
 *   • SSR-safe (no window references).
 *   • No PII logged. No payload bodies recorded.
 *   • SERVICE → INFRASTRUCTURE via apiGateway (allowed).
 */

import api from './../api/apiGateway.js';

const SERVICE_VERSION = 'farmer-notifications-v1';
const GET_RETRY_DELAY_MS = 1200;

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _str  = (v) => (typeof v === 'string' ? v : '');

function _isTransient(err) {
  return _safe(() => {
    if (!err) return false;
    // No `err.response` and not aborted → network/timeout.
    if (!err.response && err.code !== 'ERR_CANCELED') return true;
    const status = err.response && err.response.status;
    return status >= 500 && status < 600;
  }, false);
}

function _sleep(ms) {
  return new Promise((res) => { setTimeout(res, ms); });
}

async function _getWithRetry(path, opts) {
  // ONE retry on a transient error. The axios instance already
  // sets a 10s timeout; this retry gives the user a second chance
  // before the runtime surfaces an error banner.
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await api.get(path, opts);
      return Object.freeze({ ok: true, data: res.data, attempts: attempt + 1 });
    } catch (err) {
      lastErr = err;
      if (!_isTransient(err) || attempt === 1) break;
      await _sleep(GET_RETRY_DELAY_MS);
    }
  }
  return Object.freeze({
    ok: false, data: null, error: lastErr, attempts: 2,
    serviceVersion: SERVICE_VERSION,
  });
}

/**
 * Fetch a farmer's notification feed with optional filter.
 *
 *   @param {string} farmerId
 *   @param {object} opts             — { filter: 'unread' | 'read' | '' }
 *   @returns {{ ok, data?, error?, attempts? }}
 */
export async function fetchFarmerNotifications(farmerId, opts) {
  if (!_str(farmerId)) {
    return Object.freeze({
      ok: false, data: [], error: null,
      reason: 'no_farmer_id', serviceVersion: SERVICE_VERSION,
    });
  }
  const params = { limit: 50 };
  const filter = opts && _str(opts.filter);
  if (filter === 'unread') params.read = 'false';
  else if (filter === 'read') params.read = 'true';
  const res = await _getWithRetry(
    '/notifications/farmer/' + encodeURIComponent(farmerId),
    { params },
  );
  return res;
}

/**
 * Mark a single notification as read. No retry — caller may retry
 * by user intent if needed.
 *
 *   @param {string} notificationId
 *   @returns {{ ok, error? }}
 */
export async function markFarmerNotificationRead(notificationId) {
  if (!_str(notificationId)) {
    return Object.freeze({
      ok: false, reason: 'no_notification_id',
      serviceVersion: SERVICE_VERSION,
    });
  }
  try {
    await api.patch('/notifications/' + encodeURIComponent(notificationId) + '/read');
    return Object.freeze({ ok: true, serviceVersion: SERVICE_VERSION });
  } catch (err) {
    return Object.freeze({
      ok: false, error: err, serviceVersion: SERVICE_VERSION,
    });
  }
}

/**
 * Mark every unread notification for a farmer as read.
 *
 *   @param {string} farmerId
 *   @returns {{ ok, error? }}
 */
export async function markAllFarmerNotificationsRead(farmerId) {
  if (!_str(farmerId)) {
    return Object.freeze({
      ok: false, reason: 'no_farmer_id',
      serviceVersion: SERVICE_VERSION,
    });
  }
  try {
    await api.post('/notifications/farmer/'
      + encodeURIComponent(farmerId) + '/mark-all-read');
    return Object.freeze({ ok: true, serviceVersion: SERVICE_VERSION });
  } catch (err) {
    return Object.freeze({
      ok: false, error: err, serviceVersion: SERVICE_VERSION,
    });
  }
}

export const _internal = Object.freeze({
  SERVICE_VERSION, GET_RETRY_DELAY_MS, _isTransient,
});

const _module = {
  fetchFarmerNotifications,
  markFarmerNotificationRead,
  markAllFarmerNotificationsRead,
  _internal,
};
export default _module;
