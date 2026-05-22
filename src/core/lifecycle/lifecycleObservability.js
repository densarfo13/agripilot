/**
 * lifecycleObservability.js — observability adapter for the
 * lifecycle flow.
 *
 *   import { recordLifecycleObservation, LIFECYCLE_OBS }
 *     from 'src/core/lifecycle/lifecycleObservability.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny in-memory counter for the six lifecycle events the
 *   pilot ops team needs to see:
 *
 *     lifecycle_created · stage_changed · harvest_window_viewed
 *     lifecycle_task_completed · harvest_logged
 *     lifecycle_notification_opened
 *
 *   It is NOT a duplicate of `observabilityTracker` — it bridges
 *   to it for the durable error / signal categories where one
 *   applies, and holds in-memory counters for the rest. No raw
 *   image data, no PII.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe. Observability is never load-bearing.
 */

import { recordObservation, OBSERVABILITY } from '../observability/observabilityTracker.js';

export const LIFECYCLE_OBS = Object.freeze({
  LIFECYCLE_CREATED:             'lifecycle_created',
  STAGE_CHANGED:                 'stage_changed',
  HARVEST_WINDOW_VIEWED:         'harvest_window_viewed',
  LIFECYCLE_TASK_COMPLETED:      'lifecycle_task_completed',
  HARVEST_LOGGED:                'harvest_logged',
  LIFECYCLE_NOTIFICATION_OPENED: 'lifecycle_notification_opened',
});

// Only error-class events forward to observabilityTracker. The
// rest are pure counters the admin dashboard reads alongside the
// existing flow signals.
const _BRIDGE = Object.freeze({
  // No lifecycle events are errors today — every entry is null.
  // Wiring a bridge here later (e.g. on a failed harvest log) is
  // a one-line change.
});

const _counts = {};

/**
 * Record one occurrence of a lifecycle event. Unknown events are
 * accepted but bucketed under 'other' so a typo never throws.
 *
 * @param {string} event one of LIFECYCLE_OBS
 * @returns {boolean}
 */
export function recordLifecycleObservation(event) {
  try {
    if (!event) return false;
    const key = Object.values(LIFECYCLE_OBS).includes(event) ? event : 'other';
    _counts[key] = (_counts[key] || 0) + 1;
    const bridge = _BRIDGE[event];
    if (bridge) {
      try { recordObservation(bridge); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
}

/** Read-only snapshot of in-memory lifecycle counters. */
export function getLifecycleObservationCounts() {
  return { ..._counts };
}

/** Reset the counters (test hook). */
export function resetLifecycleObservationCounts() {
  for (const k of Object.keys(_counts)) delete _counts[k];
}

/**
 * Convenience: emit the right event when a stage transitions.
 * Returns false (and emits nothing) when stages are the same —
 * no-op so callers can pipe before/after snapshots through this
 * without de-duping themselves.
 */
export function trackStageChange(prevStage, nextStage) {
  if (!nextStage || !prevStage || prevStage === nextStage) return false;
  return recordLifecycleObservation(LIFECYCLE_OBS.STAGE_CHANGED);
}

const _module = {
  LIFECYCLE_OBS,
  recordLifecycleObservation,
  getLifecycleObservationCounts,
  resetLifecycleObservationCounts,
  trackStageChange,
};
export default _module;

// Defensive re-export so callers that pull OBSERVABILITY directly
// from this module still find it (avoids a "is this the right
// module?" lookup at the call site).
export { OBSERVABILITY };
