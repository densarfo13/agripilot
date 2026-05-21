/**
 * feedbackStore.js — typed pilot-feedback facade.
 *
 *   import { saveScanFeedback, saveTaskFeedback,
 *            saveNotificationFeedback, getFeedbackSummary,
 *            FEEDBACK_CONTEXT }
 *     from 'src/core/feedback/feedbackStore.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A thin, typed wrapper around the existing
 *   `analyticsStore.saveFeedback` for the three pilot feedback
 *   contexts: scan (helpful / correct / retake / manual), task
 *   (useful / completed), notification (helpful / actioned).
 *
 *   It does NOT create a parallel feedback store — `analyticsStore`
 *   already persists feedback locally with cap, mirror-to-server,
 *   and a `summariseFeedback` view. This module gives the surfaces
 *   one place to call without each one re-inventing payload keys.
 *
 * Strict-rule audit
 *   • Never throws. SSR-safe (analyticsStore guards storage).
 */

import { saveFeedback, summariseFeedback } from '../../analytics/analyticsStore.js';

export const FEEDBACK_CONTEXT = Object.freeze({
  SCAN:         'scan',
  TASK:         'task',
  NOTIFICATION: 'notification',
});

/** Coerce a free value to either a non-empty string or null. */
function _str(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, 240) : null;
}

/**
 * Scan feedback. Capture WHAT was rated + the small set of
 * boolean signals the recommendation tuner uses.
 *
 * @param {object} args
 * @param {string} [args.scanId]
 * @param {boolean} [args.helpful]
 * @param {boolean} [args.correct]
 * @param {boolean} [args.didRetake]
 * @param {boolean} [args.didManualPick]
 * @param {string}  [args.note]
 * @returns {boolean} written?
 */
export function saveScanFeedback(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    saveFeedback({
      type:    'scan_feedback',
      context: FEEDBACK_CONTEXT.SCAN,
      scanId:  _str(a.scanId),
      value:   typeof a.helpful === 'boolean'
        ? (a.helpful ? 'yes' : 'no')
        : (typeof a.correct === 'boolean' ? (a.correct ? 'correct' : 'incorrect') : null),
      helpful:       typeof a.helpful === 'boolean' ? a.helpful : null,
      correct:       typeof a.correct === 'boolean' ? a.correct : null,
      didRetake:     a.didRetake === true,
      didManualPick: a.didManualPick === true,
      text:          _str(a.note),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Task feedback — was the task useful and did the farmer complete it?
 *
 * @param {object} args { taskId, useful, completed, note }
 */
export function saveTaskFeedback(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    saveFeedback({
      type:    'task_feedback',
      context: FEEDBACK_CONTEXT.TASK,
      taskId:  _str(a.taskId),
      value:   typeof a.useful === 'boolean' ? (a.useful ? 'yes' : 'no') : null,
      useful:    typeof a.useful === 'boolean' ? a.useful : null,
      completed: a.completed === true,
      text:      _str(a.note),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Notification feedback — was the reminder useful and did the
 * farmer act on it?
 *
 * @param {object} args { notificationId, helpful, actioned, note }
 */
export function saveNotificationFeedback(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    saveFeedback({
      type:           'notification_feedback',
      context:        FEEDBACK_CONTEXT.NOTIFICATION,
      notificationId: _str(a.notificationId),
      value:          typeof a.helpful === 'boolean' ? (a.helpful ? 'yes' : 'no') : null,
      helpful:  typeof a.helpful === 'boolean' ? a.helpful : null,
      actioned: a.actioned === true,
      text:     _str(a.note),
    });
    return true;
  } catch {
    return false;
  }
}

/** Read-only summary across all feedback contexts. */
export function getFeedbackSummary() {
  try {
    return summariseFeedback();
  } catch {
    return { total: 0, yesCount: 0, noCount: 0, reasonCount: 0,
             byValue: {}, byContext: {}, helpfulPct: null };
  }
}

const _module = {
  FEEDBACK_CONTEXT,
  saveScanFeedback,
  saveTaskFeedback,
  saveNotificationFeedback,
  getFeedbackSummary,
};
export default _module;
