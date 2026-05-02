/**
 * dailyProgress.js — pure helper for the Home progress bar
 * (Retention Loop spec §2).
 *
 *   import { computeDailyProgress } from '../core/dailyProgress.js';
 *
 *   const { done, total, percent, allDone } = computeDailyProgress({
 *     actions:        plan.actions,
 *     completedIds:   getCompletedActionIdsToday(farmId),
 *   });
 *
 * Spec rule (§2):
 *   • completedTasks / totalTasks → "Today\u2019s progress: 2 of 3 complete"
 *   • Show a simple progress bar.
 *
 * Why a tiny pure module
 * ──────────────────────
 * Both the Home card AND any future "today" surface (the
 * existing /today page, the NGO admin "farmer activity" tile)
 * need to compute the same number. Putting the math in one
 * place means both surfaces agree even if one of them re-
 * orders / dedupes the action list before passing it through.
 *
 * Strict-rule audit
 *   • Pure function. No I/O.
 *   • Never throws. Bad input collapses to { done:0, total:0,
 *     percent:0, allDone:false }.
 *   • Idempotent across re-renders.
 */

/**
 * computeDailyProgress(input) → progress shape.
 *
 * @param {object} input
 * @param {Array}  [input.actions]        — the plan's action tiles.
 *                                          Each has `id`.
 * @param {Array<string>} [input.completedIds]
 *        — action ids the user already marked done today.
 *        Typically the output of
 *        dailyTaskCompletion.getCompletedActionIdsToday(farmId).
 *
 * @returns {{
 *   done:    number,    // 0 \u2264 done \u2264 total
 *   total:   number,    // total tile count (capped to actions.length)
 *   percent: number,    // 0..100, integer
 *   allDone: boolean,   // total > 0 && done === total
 *   pendingIds:  Array<string>,  // actions still open today
 *   completedIdsForPlan: Array<string>, // intersection of completedIds & action.ids
 * }}
 */
export function computeDailyProgress(input) {
  const actions = (input && Array.isArray(input.actions)) ? input.actions : [];
  const idsRaw  = (input && Array.isArray(input.completedIds)) ? input.completedIds : [];
  // Normalise + dedupe completed-ids so a duplicated entry
  // (legacy bug or storage merge race) doesn't claim more
  // completions than there are actions.
  const completedSet = new Set(
    idsRaw.filter((id) => typeof id === 'string' && id),
  );
  // Only count completions that match an action currently in
  // the plan. Yesterday's completions stored under last-day's
  // action ids would otherwise inflate today's done count.
  const planIds      = new Set();
  const pendingIds   = [];
  const completedIdsForPlan = [];
  for (const a of actions) {
    if (!a || typeof a.id !== 'string') continue;
    planIds.add(a.id);
    if (completedSet.has(a.id)) {
      completedIdsForPlan.push(a.id);
    } else {
      pendingIds.push(a.id);
    }
  }
  const total = planIds.size;
  const done  = completedIdsForPlan.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return {
    done,
    total,
    percent,
    allDone: total > 0 && done === total,
    pendingIds,
    completedIdsForPlan,
  };
}

export default computeDailyProgress;
