/**
 * Task Service — centralized task operations with offline support.
 *
 * Wraps task completion with:
 *   - Optimistic UI update
 *   - Offline queue fallback
 *   - Analytics tracking
 *   - Normalized error handling
 *
 * Consumers: Dashboard handleCompleteTask, TaskActionModal.
 */
import { completeTask } from '../lib/api.js';
import { enqueue } from '../utils/offlineQueue.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { getIdempotencyKey, consumeIdempotencyKey } from '../lib/idempotency.js';

/**
 * Complete a task with local-first pattern.
 *
 * @param {string} farmId
 * @param {Object} task - The task to complete
 * @param {Object} options
 * @param {boolean} options.isOnline
 * @returns {Promise<{ success: boolean, offline: boolean, nextTask: Object|null, error: string|null }>}
 */
export async function completeTaskSafe(farmId, task, { isOnline }) {
  if (!task || !farmId) {
    return { success: false, offline: false, nextTask: null, error: 'Missing task or farm' };
  }

  safeTrackEvent('task.complete_attempt', { farmId, taskId: task.id, title: task.title });

  const idempotencyKey = getIdempotencyKey('task_completion', `${farmId}:${task.id}`);
  const body = {
    title: task.title,
    priority: task.priority,
    actionType: task.actionType || null,
  };

  try {
    const data = await completeTask(farmId, task.id, body);
    consumeIdempotencyKey('task_completion', `${farmId}:${task.id}`);
    safeTrackEvent('task.complete_success', { farmId, taskId: task.id });
    return { success: true, offline: false, nextTask: data.nextTask || null, error: null };
  } catch (err) {
    const isNetworkError = !isOnline || !err.status;

    if (isNetworkError) {
      try {
        await enqueue({
          method: 'POST',
          url: `/api/v2/farm-tasks/${farmId}/tasks/${encodeURIComponent(task.id)}/complete`,
          data: body,
          entityType: 'task',
          actionType: 'complete',
          idempotencyKey,
        });
        safeTrackEvent('task.complete_queued', { farmId, taskId: task.id });
        return { success: true, offline: true, nextTask: null, error: null };
      } catch {
        return { success: false, offline: true, nextTask: null, error: 'Failed to save locally' };
      }
    }

    safeTrackEvent('task.complete_failed', { farmId, taskId: task.id, error: err.message });
    return { success: false, offline: false, nextTask: null, error: err.message || 'Failed to complete' };
  }
}
