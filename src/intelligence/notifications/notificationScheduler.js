/**
 * notificationScheduler — pure helpers that decide WHEN a
 * notification should fire.
 *
 * SPEC §11
 *   • Avoid late-night pushes.
 *   • Morning recommendations (07–11), afternoon weather (12–17),
 *     evening progress (18–20).
 *   • Respect timezone, language, user activity.
 *
 * These helpers don't push anything themselves — the engine asks
 * the scheduler whether NOW is the right time, and the transport
 * layer (push / in-app feed / SMS) does the delivery.
 */

import { isQuietHours, classifyWindow, nextDeliveryAt, WINDOW } from './notificationTiming.js';
import { normalizePriority, priorityContract, PRIORITY } from './notificationPriority.js';

// Map every template kind to its preferred delivery window. The
// engine reads this when computing `scheduledAt`.
export const PREFERRED_WINDOW = Object.freeze({
  weather:        WINDOW.AFTERNOON,
  task:           WINDOW.MORNING,
  task_reminder:  WINDOW.MORNING,
  scan_followup:  WINDOW.MORNING,
  scan:           WINDOW.MORNING,
  buyer:          WINDOW.AFTERNOON,
  funding:        WINDOW.AFTERNOON,
  progress:       WINDOW.EVENING,
  default:        WINDOW.MORNING,
});

/**
 * Decide whether a candidate may deliver right now. When false,
 * `scheduledAt` reports the earliest allowed delivery time so the
 * engine can defer the candidate to an in-app queue.
 *
 * @param {object} candidate
 * @param {string} candidate.kind
 * @param {string} candidate.priority
 * @param {Date}   [now]
 * @returns {{ canDeliverNow: boolean, scheduledAt: Date, reason: string }}
 */
export function evaluateSchedule(candidate, now = new Date()) {
  const kind     = String(candidate && candidate.kind || '').toLowerCase();
  const priority = normalizePriority(candidate && candidate.priority);
  const contract = priorityContract(priority);

  const preferred = PREFERRED_WINDOW[kind] || PREFERRED_WINDOW.default;
  const window    = classifyWindow(now);
  const quiet     = isQuietHours(now);

  // Quiet hours — we never push at night, even for IMPORTANT.
  // The scheduler returns the next 07:00 local moment (matches
  // nextDeliveryAt's morning anchor).
  if (quiet && !contract.overrideQuiet) {
    return Object.freeze({
      canDeliverNow: false,
      scheduledAt:   nextDeliveryAt(now, WINDOW.MORNING),
      reason:        'quiet_hours',
    });
  }

  // IMPORTANT messages are time-sensitive — once we're outside
  // quiet hours we deliver immediately regardless of preferred
  // window.
  if (priority === PRIORITY.IMPORTANT) {
    return Object.freeze({
      canDeliverNow: true,
      scheduledAt:   now instanceof Date ? new Date(now.getTime()) : new Date(),
      reason:        'important_immediate',
    });
  }

  // NORMAL/LOW: deliver only inside the preferred window.
  if (window === preferred) {
    return Object.freeze({
      canDeliverNow: true,
      scheduledAt:   now instanceof Date ? new Date(now.getTime()) : new Date(),
      reason:        `in_window:${preferred}`,
    });
  }

  return Object.freeze({
    canDeliverNow: false,
    scheduledAt:   nextDeliveryAt(now, preferred),
    reason:        `defer_to:${preferred}`,
  });
}

const _module = { PREFERRED_WINDOW, evaluateSchedule };
export default _module;
