/**
 * Pilot Metrics Tracker
 *
 * Lightweight client-side event tracking for pilot success measurement.
 * Events are stored in localStorage ring buffer and can be retrieved
 * via getPilotMetrics() for export or dashboard display.
 *
 * Tracked events:
 *   - invite_opened          — farmer opened accept-invite page
 *   - onboarding_started     — farmer entered onboarding wizard
 *   - onboarding_completed   — farmer completed onboarding (profile created)
 *   - onboarding_abandoned   — farmer left onboarding mid-flow (via beforeunload)
 *   - first_update_submitted — farmer submitted first progress entry
 *   - update_submitted       — any progress update submitted
 *   - update_failed          — progress update failed
 *   - update_retried         — user tapped retry after failure
 *   - validation_failed      — form validation prevented submission
 *   - photo_uploaded         — photo successfully uploaded
 *   - photo_failed           — photo upload failed
 *   - season_created         — new season started
 *   - offline_queued         — mutation queued for offline sync
 *   - offline_synced         — offline mutation replayed successfully
 */

const STORAGE_KEY = 'farroway:pilot_metrics';
const MAX_ENTRIES = 200;

/**
 * Track a pilot event.
 * @param {string} event — event name (see list above)
 * @param {object} meta — optional metadata (farmerId, seasonId, etc.)
 */
export function trackPilotEvent(event, meta = {}) {
  try {
    const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    entries.push({
      event,
      ts: new Date().toISOString(),
      ...meta,
    });
    // Keep ring buffer bounded
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — skip silently
  }
}

/**
 * Get all pilot metrics entries (for export or dashboard).
 * @returns {Array} — array of { event, ts, ...meta }
 */
export function getPilotMetrics() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Get summary counts of pilot events.
 * @returns {object} — { event_name: count }
 */
export function getPilotSummary() {
  const entries = getPilotMetrics();
  const counts = {};
  for (const e of entries) {
    counts[e.event] = (counts[e.event] || 0) + 1;
  }
  return counts;
}

/**
 * Clear all pilot metrics (for testing or privacy).
 */
export function clearPilotMetrics() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
