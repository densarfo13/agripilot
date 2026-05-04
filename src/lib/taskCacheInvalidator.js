/**
 * taskCacheInvalidator.js — drop every task-related localStorage
 * key on each boot until the in-bundle TASK_VERSION matches the
 * stored value.
 *
 *   import { enforceTaskApiOnly } from './lib/taskCacheInvalidator.js';
 *   enforceTaskApiOnly();   // call once during boot
 *
 * Why this exists
 *   Some farmers were still seeing the legacy "Start logging
 *   farm costs to track profitability" task days after the v7
 *   deploy that removed it from the engine. Trace led to stale
 *   cached payloads in localStorage that consumers didn't
 *   realise were getting hydrated. The fix is brutal but
 *   correct: until every task surface is re-verified, treat the
 *   API as the ONLY source of truth for tasks. Any cached
 *   blob is wiped on every boot whose stored task_version
 *   doesn't match the bundle.
 *
 * What it removes
 *   Every key listed in TASK_CACHE_KEYS plus any whose name
 *   begins with `farroway_task` or `farroway_daily_plan`.
 *
 * What it preserves
 *   Auth + onboarding keys are NEVER touched (this module only
 *   removes task keys; storageSafe.AUTH_KEYS protection isn't
 *   relevant here because none of those names match the task
 *   prefix).
 *
 * Strict-rule audit
 *   • Synchronous; never throws.
 *   • Idempotent — once stored == bundle, the routine no-ops.
 *   • Logs "Task source = API ONLY" on every boot so the
 *     enforcement is visible in DevTools.
 */

// Bump TASK_VERSION whenever the task contract changes in a way
// that could leave a stale cache rendering legacy wording.
export const TASK_VERSION = 'v2';

const TASK_VERSION_KEY = 'task_version';

// Concrete cache keys to drop. Pattern sweep below catches
// future task_* keys we don't enumerate here.
const TASK_CACHE_KEYS = Object.freeze([
  'farroway_cached_tasks',
  'farroway_today_task',
  'farroway_task_queue',
  'farroway_progress_task',
  'farroway_daily_plan',
]);

/**
 * enforceTaskApiOnly()
 *
 * Returns a small report object useful for tests:
 *   { ranInvalidation: boolean, fromVersion: string|null,
 *     toVersion: string, droppedKeys: string[] }
 */
export function enforceTaskApiOnly() {
  // Always log so engineers can confirm the enforcement fired.
  try { console.log('Task source = API ONLY'); }                        // eslint-disable-line no-console
  catch { /* swallow */ }

  if (typeof localStorage === 'undefined') {
    return _result(false, null, []);
  }

  let stored = null;
  try { stored = localStorage.getItem(TASK_VERSION_KEY); } catch { stored = null; }

  if (stored === TASK_VERSION) {
    return _result(false, stored, []);
  }

  const droppedKeys = [];

  // Pass 1 — explicit list.
  for (const k of TASK_CACHE_KEYS) {
    try {
      if (localStorage.getItem(k) != null) {
        localStorage.removeItem(k);
        droppedKeys.push(k);
      }
    } catch { /* tolerate */ }
  }

  // Pass 2 — pattern sweep for any key we don't enumerate yet.
  // Matches `farroway_task*` and `farroway_daily_plan*` so future
  // task-cache shards are wiped automatically.
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (typeof k !== 'string') continue;
      if (k === TASK_VERSION_KEY) continue;
      if (k.startsWith('farroway_task')
       || k.startsWith('farroway_daily_plan')
       || k.startsWith('farroway_progress_task')) {
        drop.push(k);
      }
    }
    for (const k of drop) {
      try {
        localStorage.removeItem(k);
        if (!droppedKeys.includes(k)) droppedKeys.push(k);
      } catch { /* tolerate */ }
    }
  } catch { /* swallow */ }

  // Stamp the new version so the next boot no-ops.
  try { localStorage.setItem(TASK_VERSION_KEY, TASK_VERSION); }
  catch { /* tolerate — boot continues */ }

  return _result(true, stored, droppedKeys);
}

function _result(ranInvalidation, fromVersion, droppedKeys) {
  return {
    ranInvalidation,
    fromVersion,
    toVersion: TASK_VERSION,
    droppedKeys,
  };
}

export const _internal = Object.freeze({
  TASK_VERSION_KEY,
  TASK_CACHE_KEYS,
});

export default enforceTaskApiOnly;
