/**
 * offlineLogger — thin wrapper over safeTrackEvent for reliability-plane events.
 *
 * Spec §10: we want a small, fixed set of offline-reliability events so we
 * can monitor how the offline path is actually used in the field. All events
 * share an `offline.*` namespace and are fire-and-forget — they must never
 * throw on the caller.
 */
import { safeTrackEvent } from '../lib/analytics.js';

const EVENTS = Object.freeze({
  OFFLINE_MODE_ENTERED: 'offline.mode_entered',
  CACHED_TASKS_USED: 'offline.cached_tasks_used',
  STALE_CACHE_USED: 'offline.stale_cache_used',
  FALLBACK_TASK_SHOWN: 'offline.fallback_task_shown',
  RETRY_CLICKED: 'offline.retry_clicked',
  RETRY_BLOCKED: 'offline.retry_blocked_offline',
  REACHABILITY_FAILED: 'offline.reachability_failed',
  FETCH_FAILED: 'offline.fetch_failed',
});

function emit(name, payload = {}) {
  try { safeTrackEvent(name, payload || {}); } catch { /* never throw */ }
}

export const offlineEvents = {
  modeEntered: (reason) => emit(EVENTS.OFFLINE_MODE_ENTERED, { reason }),
  cachedTasksUsed: (count) => emit(EVENTS.CACHED_TASKS_USED, { count }),
  staleCacheUsed: (ageMs) => emit(EVENTS.STALE_CACHE_USED, { ageMs }),
  fallbackTaskShown: (reason) => emit(EVENTS.FALLBACK_TASK_SHOWN, { reason }),
  retryClicked: (mode) => emit(EVENTS.RETRY_CLICKED, { mode }),
  retryBlocked: (reason) => emit(EVENTS.RETRY_BLOCKED, { reason }),
  reachabilityFailed: () => emit(EVENTS.REACHABILITY_FAILED, {}),
  fetchFailed: (reason) => emit(EVENTS.FETCH_FAILED, { reason }),
};

export const _EVENT_NAMES = EVENTS;
