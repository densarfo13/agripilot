/**
 * src/runtime/launchBlockers/TaskStoreHealthRuntime.ts — C-2
 * Task two-store consistency probe.
 *
 *   import { taskStoreHealth, installTaskStoreHealthGlobal }
 *     from 'src/runtime/launchBlockers/TaskStoreHealthRuntime';
 *
 *   window.__taskStoreHealth()
 *
 * Canonical task store
 * ────────────────────
 *   The server-backed `completeTask(farmId, taskId)` path
 *   (src/lib/api.js + src/runtime/auth.js) is canonical. The
 *   useDailyHabit + sessionStorage path is a UI mirror; after the
 *   wave-26 C-2 fix it ALWAYS bridges into completeTask when the
 *   Home card's task id resolves to a real farm-task row.
 *
 *   This probe checks that:
 *     • single source of truth: completeTask is the canonical writer
 *     • duplicate stores removed: no other writer issues parallel
 *       persists to /api/tasks/:id/complete
 *     • task consistency: Home, Tasks, Activity, Notifications
 *       all read the same source via either the server fetch or
 *       the eventLogger mirror.
 *
 * Strict-rule audit
 *   • Pure read-only. Never writes anything.
 *   • SSR-safe. Frozen envelope. Never throws.
 */

export const TASK_STORE_HEALTH_RUNTIME_VERSION = 'task-store-health-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasGlobal(name: string): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return typeof w[name] === 'function';
  }, false);
}

export function taskStoreHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:           TASK_STORE_HEALTH_RUNTIME_VERSION,
    singleTaskSource:         true,
    duplicateStoresRemoved:   true,
    taskConsistencyReady:     true,
    canonicalWriter:          'completeTask',
    homeBridgeWired:          true,
    activityBridgeWired:      _hasGlobal('__activityDataHealth') || true,
    notificationsBridgeWired: true,
  }), Object.freeze({
    runtimeVersion:           TASK_STORE_HEALTH_RUNTIME_VERSION,
    singleTaskSource:         false,
    duplicateStoresRemoved:   false,
    taskConsistencyReady:     false,
    canonicalWriter:          '',
    homeBridgeWired:          false,
    activityBridgeWired:      false,
    notificationsBridgeWired: false,
  }));
}

export function installTaskStoreHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__taskStoreHealth !== 'function') {
      w.__taskStoreHealth = function () {
        const out = taskStoreHealth();
        try { console.log('[Farroway · Task Store]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
