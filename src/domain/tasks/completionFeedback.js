/**
 * Completion Feedback — lightweight follow-up after task completion (spec §4-5).
 *
 * After task completion, optionally ask ONE short follow-up question.
 * Adapt next task based on the answer.
 *
 * Rules:
 *   - At most one follow-up per completion
 *   - Only when it improves future guidance
 *   - Never friction on every task
 */

/**
 * Completion status values (spec §5).
 */
export const COMPLETION_STATUS = {
  DONE: 'done',
  PARTIAL: 'partial',
  BLOCKED: 'blocked',
};

/**
 * Follow-up question types.
 */
const FOLLOWUP_TYPE = {
  STATUS: 'status',     // Did you finish? [Yes] [Partly] [No]
  ISSUE: 'issue',       // Any issue? [No issue] [Need help] [Weather blocked] [No input/tools]
  BETA: 'beta',         // Is this guidance helpful? — beta crop quality signal
};

/**
 * Determine whether to show a follow-up question and which one.
 *
 * @param {Object} params
 * @param {Object} params.taskViewModel - The completed task's VM
 * @param {number} params.completedToday - Tasks completed today
 * @param {string|null} params.urgency - Task urgency level
 * @returns {Object|null} Follow-up config or null (no follow-up needed)
 */
export function getFollowUpQuestion({ taskViewModel, completedToday, urgency, isBetaCrop, betaTasksDone }) {
  if (!taskViewModel) return null;

  // Don't ask follow-up on every task — only on important ones
  // Skip if this is the 3rd+ task today (don't create fatigue)
  if (completedToday >= 3) return null;

  // Beta crops: after a few completed tasks, collect a quick quality
  // signal so we know where guidance needs work (spec §9). We only ask
  // once every ~3 completions to keep the prompt light.
  if (isBetaCrop && typeof betaTasksDone === 'number' && betaTasksDone > 0 && betaTasksDone % 3 === 0) {
    return {
      type: FOLLOWUP_TYPE.BETA,
      questionKey: 'beta.feedback.question',
      options: [
        { value: 'yes', labelKey: 'beta.feedback.yes', status: COMPLETION_STATUS.DONE },
        { value: 'partly', labelKey: 'beta.feedback.partly', status: COMPLETION_STATUS.PARTIAL },
        { value: 'no', labelKey: 'beta.feedback.no', status: COMPLETION_STATUS.PARTIAL },
      ],
    };
  }

  const isHighUrgency = urgency === 'critical' || urgency === 'today';
  const isWeatherSensitive = !!taskViewModel.isWeatherOverridden;
  const isPestTask = (taskViewModel.type || '').includes('pest') ||
    (taskViewModel.title || '').toLowerCase().includes('pest');

  // Weather-sensitive or pest tasks → ask about issues
  if (isWeatherSensitive || isPestTask) {
    return {
      type: FOLLOWUP_TYPE.ISSUE,
      questionKey: 'followup.anyIssue',
      options: [
        { value: 'none', labelKey: 'followup.noIssue', status: COMPLETION_STATUS.DONE },
        { value: 'help', labelKey: 'followup.needHelp', status: COMPLETION_STATUS.PARTIAL },
        { value: 'weather', labelKey: 'followup.weatherBlocked', status: COMPLETION_STATUS.BLOCKED },
        { value: 'no_tools', labelKey: 'followup.noTools', status: COMPLETION_STATUS.BLOCKED },
      ],
    };
  }

  // High-urgency tasks → ask completion status
  if (isHighUrgency) {
    return {
      type: FOLLOWUP_TYPE.STATUS,
      questionKey: 'followup.didYouFinish',
      options: [
        { value: 'yes', labelKey: 'followup.yes', status: COMPLETION_STATUS.DONE },
        { value: 'partly', labelKey: 'followup.partly', status: COMPLETION_STATUS.PARTIAL },
        { value: 'no', labelKey: 'followup.no', status: COMPLETION_STATUS.BLOCKED },
      ],
    };
  }

  // Non-critical tasks: no follow-up needed
  return null;
}

/**
 * Adapt the next task recommendation based on follow-up response.
 *
 * @param {Object} params
 * @param {string} params.completionStatus - COMPLETION_STATUS value
 * @param {string} params.followUpValue - The selected follow-up option value
 * @param {Object|null} params.originalNextTask - The originally planned next task
 * @param {Object} params.completedTaskVM - The completed task's VM
 * @returns {Object} Adaptation result
 */
export function adaptNextTask({ completionStatus, followUpValue, originalNextTask, completedTaskVM }) {
  // Weather blocked → suggest fallback or reschedule
  if (followUpValue === 'weather') {
    return {
      adaptedOutcomeKey: 'completionOutcome.weatherBlocked',
      shouldReschedule: true,
      nextTaskOverride: null, // Let engine pick a weather-safe alternative
      statusNote: 'completionStatus.rescheduled',
    };
  }

  // No tools/inputs → suggest alternative or flag
  if (followUpValue === 'no_tools') {
    return {
      adaptedOutcomeKey: 'completionOutcome.noTools',
      shouldReschedule: true,
      nextTaskOverride: null,
      statusNote: 'completionStatus.needsResources',
    };
  }

  // Partial completion → keep same task type in queue
  if (completionStatus === COMPLETION_STATUS.PARTIAL) {
    return {
      adaptedOutcomeKey: 'completionOutcome.partial',
      shouldReschedule: false,
      nextTaskOverride: null,
      statusNote: 'completionStatus.partial',
    };
  }

  // Blocked (said "no") → don't count as progress
  if (completionStatus === COMPLETION_STATUS.BLOCKED) {
    return {
      adaptedOutcomeKey: 'completionOutcome.blocked',
      shouldReschedule: true,
      nextTaskOverride: null,
      statusNote: 'completionStatus.blocked',
    };
  }

  // Done or need help → proceed normally
  return {
    adaptedOutcomeKey: null,
    shouldReschedule: false,
    nextTaskOverride: originalNextTask,
    statusNote: null,
  };
}

/**
 * Build the full completion outcome model (spec §5).
 *
 * @param {Object} params
 * @param {string} params.completedTaskType - actionType of completed task
 * @param {string} params.completionStatus - COMPLETION_STATUS value
 * @param {string} params.outcomeTextKey - Localized outcome key
 * @param {string|null} params.nextTaskType
 * @param {string|null} params.nextTaskTitleKey
 * @param {string|null} params.progressSignalKey
 * @param {string|null} params.returnCueKey
 * @returns {Object} CompletionOutcomeModel
 */
export function buildCompletionOutcome({
  completedTaskType,
  completionStatus,
  outcomeTextKey,
  nextTaskType,
  nextTaskTitleKey,
  progressSignalKey,
  returnCueKey,
}) {
  return {
    completedTaskType,
    completionStatus,
    outcomeTextKey,
    nextTaskType: nextTaskType || null,
    nextTaskTitleKey: nextTaskTitleKey || null,
    progressSignalKey: progressSignalKey || null,
    returnCueKey: returnCueKey || null,
  };
}
