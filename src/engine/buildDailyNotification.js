/**
 * buildDailyNotification — compact, action-first daily notification
 * payload derived from a view-model task.
 *
 * Spec §2 contract:
 *   - at most one main daily per day (caller enforces via history)
 *   - always "action + reason"; no generic "open app" wording
 *   - suppress when the task has been completed today
 *
 * Returned shape (ready to hand to notificationService):
 *   { shouldSend, titleKey, bodyKey, urgency, deeplinkTarget,
 *     dedupeKey, scheduledTime, titleVars, bodyVars, skipReason? }
 *
 * For the full priority / dedupe / cooldown pipeline, use the existing
 * notificationEngine.getDailyNotificationDecision. This wrapper is for
 * callers that only need the "today's one action + reason" payload.
 */

function todayDateStr(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function bucketFromUrgency(urgency) {
  if (urgency === 'critical' || urgency === 'today') return 'today';
  if (urgency === 'this_week') return 'week';
  return 'generic';
}

/**
 * @param {Object} task               view-model task (titleKey, whyKey, urgency, type)
 * @param {Object} [opts]
 * @param {boolean} [opts.completedToday]   suppress when true
 * @param {Date}   [opts.now]
 * @returns {Object} decision payload
 */
export function buildDailyNotification(task, { completedToday = false, now = new Date() } = {}) {
  if (!task || (!task.titleKey && !task.title)) {
    return { shouldSend: false, skipReason: 'no_task' };
  }
  if (completedToday) {
    return { shouldSend: false, skipReason: 'completed_today' };
  }
  // Action + reason is mandatory — no generic prompts.
  const hasReason = !!(task.whyKey || task.whyText);
  if (!hasReason) {
    return { shouldSend: false, skipReason: 'missing_reason' };
  }

  const bucket = bucketFromUrgency(task.urgency);
  const dateStr = todayDateStr(now);
  const actionKey = task.type || task.actionKey || 'daily_task';

  return {
    shouldSend: true,
    type: 'daily',
    titleKey: task.titleKey,
    bodyKey: task.whyKey,
    // Variables mirror how notificationService renders copy
    titleVars: { task: task.title || '' },
    bodyVars: { task: task.title || '' },
    urgency: task.urgency || 'this_week',
    deeplinkTarget: task.taskId ? `/dashboard?task=${task.taskId}` : '/dashboard',
    dedupeKey: ['daily', actionKey, dateStr, bucket].join('|'),
    scheduledTime: now.toISOString(),
    bucket,
  };
}
