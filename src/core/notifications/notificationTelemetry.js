/**
 * notificationTelemetry.js — outcome counters for notifications.
 *
 *   import { recordNotificationOutcome, getNotificationTelemetry,
 *            NOTIF_OUTCOME }
 *     from 'src/core/notifications/notificationTelemetry.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny in-memory counter for the six notification outcomes the
 *   pilot ops team cares about: generated / delivered / opened /
 *   action_taken / ignored / suppressed.
 *
 *   It is NOT the orchestrator (`notificationOrchestrator` decides
 *   delivery), NOT a logger (no persistence beyond per-session
 *   counts), and NOT a duplicate of `observabilityTracker`. It is
 *   the small "did the push actually help?" tally that surfaces the
 *   admin dashboard can read.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe. No I/O.
 */

export const NOTIF_OUTCOME = Object.freeze({
  GENERATED:    'generated',
  DELIVERED:    'delivered',
  OPENED:       'opened',
  ACTION_TAKEN: 'action_taken',
  IGNORED:      'ignored',
  SUPPRESSED:   'suppressed',
});

const _VALID = new Set(Object.values(NOTIF_OUTCOME));

// counts[outcome] = number
const _counts = {};

/**
 * Record one outcome for a single notification. Unknown outcomes
 * are accepted but bucketed under 'other' so a typo never throws.
 *
 * @param {string} outcome  one of NOTIF_OUTCOME
 * @returns {boolean}
 */
export function recordNotificationOutcome(outcome) {
  try {
    if (!outcome) return false;
    const key = _VALID.has(outcome) ? outcome : 'other';
    _counts[key] = (_counts[key] || 0) + 1;
    return true;
  } catch {
    return false;
  }
}

/**
 * Read-only snapshot of all counts plus a few derived ratios.
 *
 *   openRate     = opened / delivered            (or 0 when no delivered)
 *   actionRate   = action_taken / delivered
 *   ignoreRate   = ignored / delivered
 *   suppressRate = suppressed / generated        (proxy: how strict are we?)
 */
export function getNotificationTelemetry() {
  try {
    const c = { ..._counts };
    const generated = c.generated || 0;
    const delivered = c.delivered || 0;
    const opened    = c.opened || 0;
    const action    = c.action_taken || 0;
    const ignored   = c.ignored || 0;
    const supp      = c.suppressed || 0;

    const rate = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 1000 : 0);

    return {
      counts: c,
      openRate:     rate(opened, delivered),
      actionRate:   rate(action, delivered),
      ignoreRate:   rate(ignored, delivered),
      suppressRate: rate(supp, generated),
    };
  } catch {
    return {
      counts: {}, openRate: 0, actionRate: 0, ignoreRate: 0, suppressRate: 0,
    };
  }
}

/** Wipe the counters (test hook). */
export function resetNotificationTelemetry() {
  for (const k of Object.keys(_counts)) delete _counts[k];
}

const _module = {
  NOTIF_OUTCOME,
  recordNotificationOutcome,
  getNotificationTelemetry,
  resetNotificationTelemetry,
};
export default _module;
