/**
 * farmerLoopService — core daily loop logic.
 *
 * Pure functions that power the farmer's daily action loop:
 *   getCurrentFarmerTask  — fetch + resolve one main task
 *   completeFarmerTask    — complete task with offline fallback
 *   getProgressSignal     — lightweight progress for Home
 *   getNextTaskState      — what to show after completion
 *
 * No React. No side effects beyond API calls.
 * Consumed by useFarmerLoop hook.
 */
import { getFarmTasks } from '../lib/api.js';
import { completeTaskSafe } from './taskService.js';
import { safeTrackEvent } from '../lib/analytics.js';

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
export async function getCurrentFarmerTask({ farmId, isOnline }) {
  if (!farmId) {
    return { task: null, taskCount: 0, completedCount: 0, error: 'no_farm' };
  }

  if (!isOnline) {
    // Offline: return null task, loop will show last known or all_done
    return { task: null, taskCount: 0, completedCount: 0, error: 'offline' };
  }

  try {
    const data = await getFarmTasks(farmId);
    const tasks = data.tasks || [];
    const completedCount = data.completedCount || 0;

    // Priority cascade: high → medium → low → first available
    const task =
      tasks.find((t) => t.priority === 'high') ||
      tasks.find((t) => t.priority === 'medium') ||
      tasks.find((t) => t.priority === 'low') ||
      tasks[0] || null;

    safeTrackEvent('loop.task_fetched', {
      farmId,
      taskId: task?.id || null,
      taskCount: tasks.length,
      completedCount,
    });

    return { task, tasks, taskCount: tasks.length, completedCount, error: null };
  } catch (err) {
    return { task: null, tasks: [], taskCount: 0, completedCount: 0, error: err.message || 'fetch_failed' };
  }
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
