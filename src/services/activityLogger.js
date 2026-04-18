/**
 * Activity Logger — unified event tracking for admin analytics.
 *
 * Records structured activity events with user_id, farm_id, event_type,
 * metadata, and created_at. Dual-write: localStorage (for offline/local
 * admin dashboard) + server (fire-and-forget to /api/v2/analytics/track).
 *
 * Event types:
 *   - user_registered       — new user signed up
 *   - onboarding_completed  — onboarding wizard finished
 *   - farm_created          — new farm profile created
 *   - crop_stage_updated    — farmer changed crop growth stage
 *   - pest_report_submitted — pest check submitted
 *   - action_completed      — daily task completed
 *   - season_started        — new growing season started
 *   - login                 — user logged in
 *
 * Usage:
 *   import { logActivity } from '../services/activityLogger.js';
 *   logActivity('farm_created', { farmName: 'My Farm' }, { userId, farmId });
 *
 * Design:
 *   - Never blocks UI — all writes are fire-and-forget
 *   - localStorage ring buffer (500 entries) for local aggregation
 *   - Server write via existing trackEvent endpoint
 *   - Timestamps always ISO 8601 UTC
 */

import { trackEvent } from '../lib/api.js';

// ─── Local storage config ───────────────────────────────────
const STORAGE_KEY = 'farroway:activity_log';
const MAX_ENTRIES = 500;

// ─── Known event types (for validation) ─────────────────────
const VALID_EVENTS = new Set([
  'user_registered',
  'onboarding_completed',
  'farm_created',
  'crop_stage_updated',
  'pest_report_submitted',
  'action_completed',
  'season_started',
  'login',
]);

/**
 * Log a structured activity event.
 *
 * @param {string} eventType  — one of the VALID_EVENTS
 * @param {Object} [metadata] — event-specific data (crop, stage, etc.)
 * @param {Object} [context]  — { userId, farmId } — caller provides these
 */
export function logActivity(eventType, metadata = {}, context = {}) {
  const entry = {
    event_type: eventType,
    user_id: context.userId || null,
    farm_id: context.farmId || null,
    metadata,
    created_at: new Date().toISOString(),
  };

  // 1. Write to localStorage (sync, never fails visibly)
  writeLocal(entry);

  // 2. Write to server (async, fire-and-forget)
  writeServer(entry);
}

// ─── Local write ────────────────────────────────────────────

function writeLocal(entry) {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    entries.push(entry);
    // Ring buffer — keep last MAX_ENTRIES
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — skip silently
  }
}

// ─── Server write ───────────────────────────────────────────

function writeServer(entry) {
  try {
    trackEvent(`activity.${entry.event_type}`, {
      user_id: entry.user_id,
      farm_id: entry.farm_id,
      ...entry.metadata,
      created_at: entry.created_at,
    }).catch(() => {});
  } catch {
    // Never block UI
  }
}

// ─── Read API (for aggregation) ─────────────────────────────

/**
 * Get all stored activity entries.
 * @returns {Array<Object>} — array of activity entries
 */
export function getActivityLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Get activity entries filtered by event type.
 * @param {string} eventType
 * @returns {Array<Object>}
 */
export function getActivitiesByType(eventType) {
  return getActivityLog().filter(e => e.event_type === eventType);
}

/**
 * Get activity entries from the last N hours.
 * @param {number} hours
 * @returns {Array<Object>}
 */
export function getRecentActivities(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return getActivityLog().filter(e => e.created_at >= cutoff);
}

/**
 * Get unique user IDs from activity log.
 * @returns {Set<string>}
 */
export function getUniqueUserIds() {
  const entries = getActivityLog();
  return new Set(entries.filter(e => e.user_id).map(e => e.user_id));
}

/**
 * Clear all activity logs. For testing or privacy.
 */
export function clearActivityLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
