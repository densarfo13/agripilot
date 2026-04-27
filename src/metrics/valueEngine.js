/**
 * valueEngine.js — translate farmer activity into NGO-ready
 * "value" metrics.
 *
 * Reads the local progress mirror (farroway_progress) the new
 * Farroway core writes to. That mirror updates synchronously
 * inside markTaskDone, so this function is safe to call from any
 * render path without awaiting.
 *
 * Output shape (stable - charts + cards key on these names):
 *   {
 *     farmId,
 *     tasksCompleted:        number,
 *     engagementScore:       0..100,
 *     estimatedYieldImpact:  number   // % uplift estimate
 *     riskLevel:             'HIGH' | 'LOW',
 *   }
 *
 * Strict rules respected:
 *   * never crashes on missing localStorage / corrupt JSON
 *   * never alters the underlying data
 *   * pure read - safe to call once per render
 */

const PROGRESS_KEY = 'farroway_progress';

// Tunables - all in one place so demos / NGO sales can adjust the
// "story" without hunting through code.
export const VALUE_TUNING = Object.freeze({
  ENGAGEMENT_PER_TASK:  10,    // % per completed task, capped at 100
  YIELD_PCT_PER_TASK:    2,    // % yield uplift per completed task
  HIGH_RISK_BELOW:       3,    // < this many done tasks => HIGH risk
});

function _safeReadProgress() {
  try {
    if (typeof localStorage === 'undefined') return { done: [] };
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return { done: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.done)) return { done: [] };
    return parsed;
  } catch {
    return { done: [] };
  }
}

/**
 * computeFarmValue(farmId)
 *
 * `farmId` is accepted for API stability + future per-farm
 * progress logs; the current store is single-farm so it's
 * informational only.
 */
export function computeFarmValue(farmId = null) {
  const progress = _safeReadProgress();
  const completed = Array.isArray(progress.done) ? progress.done.length : 0;

  const engagementScore = Math.min(
    100,
    Math.max(0, completed * VALUE_TUNING.ENGAGEMENT_PER_TASK),
  );
  const estimatedYieldImpact = Math.max(
    0,
    completed * VALUE_TUNING.YIELD_PCT_PER_TASK,
  );
  const riskLevel = completed < VALUE_TUNING.HIGH_RISK_BELOW ? 'HIGH' : 'LOW';

  return Object.freeze({
    farmId: farmId == null ? null : String(farmId),
    tasksCompleted: completed,
    engagementScore,
    estimatedYieldImpact,
    riskLevel,
  });
}
