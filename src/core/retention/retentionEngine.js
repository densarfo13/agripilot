/**
 * retentionEngine.js — Phase 8 retention analytics.
 *
 *   import { RETENTION_EVENTS, trackRetention, computeRetentionMetrics }
 *     from 'src/core/retention/retentionEngine.js';
 *
 * What it is
 * ──────────
 *   A typed retention-event taxonomy + a never-throws tracker that
 *   DELEGATES to the existing analytics store (analyticsStore.js) —
 *   it does NOT create a duplicate analytics system (spec rule).
 *   Plus a read-only metrics VIEW computed over the event log.
 *
 * Safety
 *   • Analytics failure must never break the app — every call is
 *     wrapped; a failure is a silent no-op / empty metrics.
 *   • No secrets, no raw image data, no PII reach the log — the
 *     payload is scrubbed (banned keys dropped, strings capped,
 *     nested objects dropped) before it is forwarded.
 */

import { trackEvent, getEvents } from '../../analytics/analyticsStore.js';

// Spec §2 — the retention event taxonomy.
export const RETENTION_EVENTS = Object.freeze({
  APP_OPENED:            'app_opened',
  DAILY_BRIEFING_VIEWED: 'daily_briefing_viewed',
  SCAN_COMPLETED:        'scan_completed',
  SCAN_FAILED:           'scan_failed',
  TASK_COMPLETED:        'task_completed',
  JOURNAL_SAVED:         'journal_saved',
  NOTIFICATION_OPENED:   'notification_opened',
  PRODUCE_LISTED:        'produce_listed',
  FUNDING_SAVED:         'funding_saved',
  USER_INACTIVE_3D:      'user_inactive_3_days',
  USER_INACTIVE_7D:      'user_inactive_7_days',
});

// Keys that must NEVER reach the analytics log (PII / raw data).
const _BANNED_KEYS = new Set([
  'image', 'imageData', 'imageBase64', 'thumbnail', 'dataUrl', 'file',
  'token', 'password', 'secret', 'email', 'phone',
  'lat', 'lng', 'latitude', 'longitude', 'coordinates',
]);

/** Strip a payload to a tiny, PII-free, log-safe shape. */
function _scrub(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const out = {};
  try {
    for (const k of Object.keys(payload)) {
      if (_BANNED_KEYS.has(k)) continue;
      const v = payload[k];
      const t = typeof v;
      if (t === 'number' || t === 'boolean') out[k] = v;
      else if (t === 'string') out[k] = v.length > 64 ? v.slice(0, 64) : v;
      // objects / arrays are intentionally dropped — keep it tiny.
    }
  } catch { /* return what we have */ }
  return out;
}

/**
 * Record a retention event. Delegates to the analytics store.
 * Never throws — analytics failure is a silent no-op.
 *
 * @param {string} event   one of RETENTION_EVENTS (or any string)
 * @param {object} [payload]
 * @returns {boolean} whether the event was forwarded
 */
export function trackRetention(event, payload) {
  try {
    if (!event || typeof event !== 'string') return false;
    trackEvent(event, _scrub(payload));
    return true;
  } catch {
    return false; // analytics failure NEVER breaks the app
  }
}

function _events() {
  try {
    const e = getEvents();
    return Array.isArray(e) ? e : [];
  } catch {
    return [];
  }
}

const _day = (ts) => { try { return String(ts || '').slice(0, 10); } catch { return ''; } };

/**
 * Read-only retention metrics computed over the event log.
 * (DAU/WAU here are day-activity proxies — distinct active days —
 * since the local log is per-device, not a server cohort table.)
 *
 * @returns {object}
 */
export function computeRetentionMetrics() {
  try {
    const events = _events();
    const byEvent = {};
    const activeDays = new Set();
    const weekDays = new Set();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (const e of events) {
      if (!e || !e.name) continue;
      byEvent[e.name] = (byEvent[e.name] || 0) + 1;
      const d = _day(e.timestamp);
      if (d) activeDays.add(d);
      const t = Date.parse(e.timestamp || '');
      if (Number.isFinite(t) && t >= weekAgo && d) weekDays.add(d);
    }

    return {
      totalEvents:        events.length,
      activeDays:         activeDays.size,   // distinct active days (DAU proxy)
      weeklyActiveDays:   weekDays.size,     // last 7 days (WAU proxy)
      scanCompleted:      byEvent.scan_completed || 0,
      scanFailed:         byEvent.scan_failed || 0,
      taskCompleted:      byEvent.task_completed || 0,
      journalSaved:       byEvent.journal_saved || 0,
      notificationOpened: byEvent.notification_opened || 0,
      returnVisits:       byEvent.app_opened || 0,
      byEvent,
    };
  } catch {
    return {
      totalEvents: 0, activeDays: 0, weeklyActiveDays: 0,
      scanCompleted: 0, scanFailed: 0, taskCompleted: 0,
      journalSaved: 0, notificationOpened: 0, returnVisits: 0, byEvent: {},
    };
  }
}

/**
 * Scan trust metrics (spec §8) — derived from the event log.
 * @returns {object}
 */
export function computeScanTrustMetrics() {
  try {
    const m = computeRetentionMetrics();
    const total = m.scanCompleted + m.scanFailed;
    const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
    return {
      scanTotal:       total,
      scanCompleted:   m.scanCompleted,
      scanFailed:      m.scanFailed,
      failureRate:     pct(m.scanFailed, total),
      journalSaveRate: pct(m.journalSaved, m.scanCompleted),
    };
  } catch {
    return { scanTotal: 0, scanCompleted: 0, scanFailed: 0, failureRate: 0, journalSaveRate: 0 };
  }
}

export const _internal = Object.freeze({ _scrub, BANNED_KEYS: _BANNED_KEYS });

const _module = {
  RETENTION_EVENTS,
  trackRetention,
  computeRetentionMetrics,
  computeScanTrustMetrics,
};
export default _module;
