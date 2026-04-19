/**
 * actionTypes.js — canonical action taxonomy for the farmer
 * feedback loop. A single place every other module reads so we
 * don't have three spellings of "task_skipped" floating around.
 *
 * Shape of an action log entry:
 *   {
 *     actionType,   // one of ACTION_TYPES
 *     subjectType,  // 'task' | 'issue' | 'harvest' | null
 *     subjectId,    // DB id of the subject, if any
 *     farmProfileId,
 *     cropCycleId,
 *     userId,
 *     details,      // actionType-specific payload
 *     occurredAt,   // ISO string or Date
 *   }
 */

export const ACTION_TYPES = Object.freeze({
  TASK_COMPLETED:  'task_completed',
  TASK_SKIPPED:    'task_skipped',
  ISSUE_REPORTED:  'issue_reported',
  HARVEST_REPORTED:'harvest_reported',
});

const VALID = new Set(Object.values(ACTION_TYPES));

export function isValidActionType(t) {
  return typeof t === 'string' && VALID.has(t);
}

/**
 * normalizeAction(raw) — sanitize a caller-supplied action record
 * into the canonical shape. Returns `null` if the action type is
 * unknown so service callers can reject early.
 */
export function normalizeAction(raw = {}) {
  if (!isValidActionType(raw.actionType)) return null;
  return {
    actionType: raw.actionType,
    subjectType: raw.subjectType || null,
    subjectId: raw.subjectId || null,
    farmProfileId: raw.farmProfileId || null,
    cropCycleId: raw.cropCycleId || null,
    userId: raw.userId || null,
    details: raw.details && typeof raw.details === 'object' ? raw.details : {},
    occurredAt: raw.occurredAt instanceof Date
      ? raw.occurredAt.toISOString()
      : (typeof raw.occurredAt === 'string' ? raw.occurredAt : new Date().toISOString()),
  };
}

/**
 * Derives a short farmer-facing summary string for an action,
 * which the Today engine / intervention feed can render as a
 * "you did this recently" chip. Deterministic.
 */
export function describeAction(action) {
  if (!action?.actionType) return '';
  switch (action.actionType) {
    case ACTION_TYPES.TASK_COMPLETED:
      return action.details?.taskTitle
        ? `Completed: ${action.details.taskTitle}`
        : 'Completed a task';
    case ACTION_TYPES.TASK_SKIPPED:
      return action.details?.taskTitle
        ? `Skipped: ${action.details.taskTitle}${action.details.reason ? ` (${action.details.reason})` : ''}`
        : 'Skipped a task';
    case ACTION_TYPES.ISSUE_REPORTED:
      return action.details?.category
        ? `Reported ${action.details.category} issue`
        : 'Reported an issue';
    case ACTION_TYPES.HARVEST_REPORTED:
      return action.details?.actualYieldKg
        ? `Harvested ${action.details.actualYieldKg} kg`
        : 'Reported a harvest';
    default:
      return '';
  }
}
