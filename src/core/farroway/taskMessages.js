/**
 * taskMessages.js — Farroway core task -> human message map.
 *
 * Extracted from spec section 7 so the same map serves both the
 * notification system and the TodayCard. Adding a new task message
 * is a single edit here; consumers stay untouched.
 *
 * NOTE on i18n: messages are English by design (spec uses raw
 * English). When we want translations later, the natural move is
 * to swap `getTaskMessage` to return an i18n key and let the UI
 * resolve it via tSafe. This stays a single-file change.
 */

export const TASK_MESSAGE_MAP = Object.freeze({
  weed_rows:        'Weed your farm today',
  scout_pests:      'Check for pests today',
  check_moisture:   'Check soil moisture today',
  prepare_harvest:  'Prepare for harvest',
  check_farm:       'Check your farm today',
});

/**
 * Returns the human-readable message for a task id. Falls back to
 * the generic "Check your farm today" rather than crashing on
 * unknown / missing input.
 */
export function getTaskMessage(task) {
  if (!task || typeof task !== 'string') return TASK_MESSAGE_MAP.check_farm;
  return TASK_MESSAGE_MAP[task] || TASK_MESSAGE_MAP.check_farm;
}
