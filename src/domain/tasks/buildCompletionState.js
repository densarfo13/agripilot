/**
 * buildCompletionState — produces a structured completion state
 * after a farmer completes a task.
 *
 * Consumed by CompletionCard and loop hooks.
 * All display text is translation keys, never raw strings.
 */
import { getSuccessTextKey, getNextTextKey } from '../../engine/autopilot/textKeys.js';
import { getOutcomeKey } from './outcomeKeys.js';
import { getFollowUpQuestion, COMPLETION_STATUS } from './completionFeedback.js';
import { assertCompletionState } from './devAssertions.js';

/**
 * @param {Object} params
 * @param {Object} completedTask - The task that was just completed
 * @param {Object|null} taskViewModel - VM of the completed task (has autopilot data)
 * @param {Object|null} nextTask - Server-returned next task, if any
 * @param {number} completedCount - Total completed today (after this one)
 * @param {number} remainingCount - Remaining tasks
 * @param {boolean} savedOffline - Was completion queued offline?
 * @param {string|null} nextTaskTitle - Localized title of next task
 * @returns {Object} CompletionState
 */
export function buildCompletionState({
  completedTask,
  taskViewModel,
  nextTask,
  completedCount,
  remainingCount,
  savedOffline,
  nextTaskTitle,
}) {
  const ruleId = taskViewModel?.autopilotRuleId || null;
  const taskType = completedTask?.actionType || completedTask?.type || '';
  const taskTitle = completedTask?.title || '';

  // 1. Success title key — always 'completion.done'
  const successTitleKey = 'completion.done';

  // 2. Outcome key — task-specific value line
  //    Priority: autopilot success key > outcome key by task type > generic
  const autopilotSuccessKey = getSuccessTextKey(ruleId);
  const outcomeKey = getOutcomeKey(taskType, taskTitle);
  const successOutcomeKey = autopilotSuccessKey !== 'success.general'
    ? autopilotSuccessKey
    : outcomeKey || 'success.general';

  // 3. Next task info
  const hasNext = !!nextTask;
  const nextTaskType = nextTask?.actionType || nextTask?.type || null;
  const nextTaskTitleKey = null; // title comes pre-localized via nextTaskTitle param

  // 4. Progress signal
  const isDoneForNow = !hasNext && remainingCount <= 0;
  const progressSignalKey = isDoneForNow
    ? (completedCount > 1 ? 'completion.greatProgressToday' : 'completion.doneForNow')
    : (remainingCount === 1 ? 'completion.oneLeft' : 'completion.tasksLeft');

  // 5. Return-habit cue (when no next task)
  const returnCueKey = isDoneForNow
    ? 'completion.returnTomorrow'
    : null;

  // Determine follow-up question (spec §4)
  const followUp = getFollowUpQuestion({
    taskViewModel,
    completedToday: completedCount,
    urgency: taskViewModel?.urgency || null,
  });

  const result = {
    // Identity
    completedTaskId: completedTask?.id || null,
    completedTaskType: taskType,
    completionStatus: COMPLETION_STATUS.DONE, // Default; updated by follow-up response

    // Display keys
    successTitleKey,
    successOutcomeKey,

    // Next step
    hasNext,
    nextTask,
    nextTaskType,
    nextTaskTitle: nextTaskTitle || null,

    // Progress
    completedCount,
    remainingCount,
    progressSignalKey,
    isDoneForNow,

    // Return habit
    returnCueKey,

    // Follow-up (spec §4 — lightweight learning loop)
    followUp,

    // Offline
    savedOffline: !!savedOffline,
  };

  assertCompletionState(result);
  return result;
}
