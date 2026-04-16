/**
 * farmerLoopService — core daily loop logic.
 *
 * Pure functions that power the farmer's daily action loop:
 *   getCurrentFarmerTask  — fetch + resolve one main task (cached)
 *   completeFarmerTask    — complete task with offline fallback
 *   getProgressSignal     — lightweight progress for Home
 *   getNextTaskState      — what to show after completion
 *
 * Performance: uses dashboardService for stale-while-revalidate task cache.
 * First load serves cached data instantly, refreshes in background.
 *
 * No React. No side effects beyond API calls.
 * Consumed by useFarmerLoop hook.
 */
import { getDashboardTasks, invalidateDashboardCache } from './dashboardService.js';
import { completeTaskSafe } from './taskService.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { log } from '../lib/logger.js';

// ─── LOOP STATES ───────────────────────────────────────────
export const LOOP_STATE = {
  LOADING:     'loading',
  READY:       'ready',       // task visible, waiting for farmer
  IN_PROGRESS: 'in_progress', // farmer tapped CTA, completion in flight
  COMPLETED:   'completed',   // task just done, showing feedback
  NEXT_READY:  'next_ready',  // next task loaded after completion
  ALL_DONE:    'all_done',    // no more tasks
  COME_BACK:   'come_back',   // tasks will appear later
};

// ─── 1. GET CURRENT FARMER TASK ────────────────────────────
/**
 * Fetch the single highest-priority task for a farm.
 * Weather/task conflict is handled later by the decision engine.
 *
 * @param {Object} params
 * @param {string} params.farmId
 * @param {boolean} params.isOnline
 * @returns {Promise<{task, taskCount, completedCount, error}>}
 */
export async function getCurrentFarmerTask({ farmId, isOnline, onBackgroundUpdate }) {
  if (!farmId) {
    return { task: null, taskCount: 0, completedCount: 0, error: 'no_farm' };
  }

  if (!isOnline) {
    // Offline: try cached data first, then return null
    try {
      const cached = await getDashboardTasks(farmId);
      if (cached.fromCache && cached.tasks.length > 0) {
        const tasks = cached.tasks;
        const task = _pickPrimaryTask(tasks);
        log('farm', 'task_served_from_cache', { farmId, offline: true });
        return { task, tasks, taskCount: tasks.length, completedCount: cached.completedCount, error: null };
      }
    } catch { /* no cache available */ }
    return { task: null, taskCount: 0, completedCount: 0, error: 'offline' };
  }

  try {
    const data = await getDashboardTasks(farmId, {
      onBackgroundUpdate: onBackgroundUpdate
        ? (fresh) => {
            const task = _pickPrimaryTask(fresh.tasks);
            onBackgroundUpdate({ task, tasks: fresh.tasks, taskCount: fresh.tasks.length, completedCount: fresh.completedCount });
          }
        : undefined,
    });
    const tasks = data.tasks || [];
    const completedCount = data.completedCount || 0;
    const task = _pickPrimaryTask(tasks);

    safeTrackEvent('loop.task_fetched', {
      farmId,
      taskId: task?.id || null,
      taskCount: tasks.length,
      completedCount,
      fromCache: data.fromCache,
    });

    if (data.fromCache) {
      log('farm', 'task_served_from_cache', { farmId, stale: true });
    }

    return { task, tasks, taskCount: tasks.length, completedCount, error: null };
  } catch (err) {
    log('farm', 'task_fetch_failed', { farmId, error: err.message });
    return { task: null, tasks: [], taskCount: 0, completedCount: 0, error: err.message || 'fetch_failed' };
  }
}

/** Priority cascade: high → medium → low → first available */
function _pickPrimaryTask(tasks) {
  return tasks.find((t) => t.priority === 'high') ||
    tasks.find((t) => t.priority === 'medium') ||
    tasks.find((t) => t.priority === 'low') ||
    tasks[0] || null;
}

// ─── 2. COMPLETE FARMER TASK ───────────────────────────────
/**
 * Complete the current task. Wraps taskService with loop-aware tracking.
 *
 * @param {Object} params
 * @param {string} params.farmId
 * @param {Object} params.task
 * @param {boolean} params.isOnline
 * @returns {Promise<{success, offline, nextTask, error}>}
 */
export async function completeFarmerTask({ farmId, task, isOnline }) {
  safeTrackEvent('loop.task_started', { farmId, taskId: task?.id });

  const result = await completeTaskSafe(farmId, task, { isOnline });

  if (result.success) {
    // Invalidate cache so next fetch gets fresh data
    invalidateDashboardCache(farmId);
    log('farm', 'task_completed', { farmId, taskId: task?.id, offline: result.offline });

    safeTrackEvent('loop.task_completed', {
      farmId,
      taskId: task?.id,
      offline: result.offline,
      hasNext: !!result.nextTask,
    });
  }

  return result;
}

// ─── 3. PROGRESS SIGNAL ───────────────────────────────────
/**
 * Build a lightweight progress signal for the Home screen.
 * NOT a full report — just enough to reinforce the habit loop.
 *
 * @param {Object} params
 * @param {number} params.completedCount
 * @param {number} params.taskCount - remaining pending tasks
 * @returns {Object} { done, remaining, total, percent, label }
 */
export function getProgressSignal({ completedCount, taskCount }) {
  const done = completedCount || 0;
  const remaining = taskCount || 0;
  const total = done + remaining;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return {
    done,
    remaining,
    total,
    percent,
  };
}

// ─── 4. NEXT TASK STATE ───────────────────────────────────
/**
 * Determine what to show after task completion.
 *
 * @param {Object} params
 * @param {Object|null} params.nextTask - from completion response
 * @param {number} params.remainingCount - tasks left after completion
 * @param {boolean} params.offline - was completion offline?
 * @returns {Object} { loopState, message key }
 */
export function getNextTaskState({ nextTask, remainingCount, offline }) {
  if (nextTask) {
    return { loopState: LOOP_STATE.NEXT_READY };
  }

  if (remainingCount > 0) {
    // Server didn't return nextTask but there are more — refetch needed
    return { loopState: LOOP_STATE.NEXT_READY };
  }

  if (offline) {
    // Offline completion — we don't know server state, be optimistic
    return { loopState: LOOP_STATE.ALL_DONE };
  }

  return { loopState: LOOP_STATE.ALL_DONE };
}
