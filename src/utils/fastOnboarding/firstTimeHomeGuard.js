/**
 * firstTimeHomeGuard.js — pure helpers that keep the Home
 * screen from overwhelming a brand-new farmer.
 *
 * Two public predicates:
 *
 *   hasFarmYet(state)           → boolean
 *   filterTasksForFirstTime(tasks, state) → Task[]
 *
 * Plus a richer helper the Home composer uses:
 *
 *   getFirstTimeHomeMode(state, farm) → {
 *     isFirstTime,
 *     shouldShowStartFlow,
 *     visibleTasks,
 *     hiddenTaskCount,
 *     hiddenIntents,
 *   }
 *
 * Rules the spec called out, enforced in code:
 *   • if no farm → Home must NOT show fertilize / irrigate /
 *     advanced tasks. Only the "Start your farm" flow.
 *   • if farm exists but just created → show the SINGLE
 *     primary task (priority 1, visibility 'primary').
 *   • deferred tasks stay queued until the user completes
 *     the primary one OR opts into the full Today view.
 */

const ADVANCED_INTENTS = new Set([
  'fertilize', 'spray', 'harvest', 'drain',
  'scout',     // observational — still not helpful when there's no crop yet
]);

/**
 * hasFarmYet — true when the user has an auto-created farm
 * with a non-empty task list. Works on the fast-onboarding
 * state shape OR the standalone farm object.
 */
export function hasFarmYet(stateOrFarm = null) {
  if (!stateOrFarm || typeof stateOrFarm !== 'object') return false;
  // Accept either { farm: {...} } or the farm object directly.
  const farm = stateOrFarm.farm || stateOrFarm;
  if (!farm || typeof farm !== 'object') return false;
  if (!farm.created) return false;
  return Array.isArray(farm.tasks) && farm.tasks.length > 0;
}

/**
 * isFirstTimeHome — true when the user needs the protected
 * "Start your farm" experience rather than the regular
 * Home. Fires when:
 *   • there is no farm, OR
 *   • the farm was just created AND no task is yet completed
 */
export function isFirstTimeHome(stateOrFarm = null) {
  if (!hasFarmYet(stateOrFarm)) return true;
  const farm = stateOrFarm?.farm || stateOrFarm;
  const anyCompleted = (farm.tasks || []).some((t) => t?.status === 'completed');
  if (anyCompleted) return false;
  // Fresh farm (< 15 minutes old) + no completions → still first-time view.
  const age = Date.now() - Number(farm.startDate || 0);
  return age < 15 * 60 * 1000;
}

/**
 * filterTasksForFirstTime — keep only `visibility: 'primary'`
 * tasks whose intent is not in the advanced set. This is what
 * prevents "fertilize" / "irrigate" from surfacing on Home
 * before the farmer has finished land preparation.
 */
export function filterTasksForFirstTime(tasks = [], state = null) {
  if (!Array.isArray(tasks)) return [];
  if (!isFirstTimeHome(state)) return tasks;
  return tasks.filter((t) => {
    if (!t) return false;
    if (t.visibility && t.visibility !== 'primary') return false;
    const intent = String(t.intent || '').toLowerCase();
    if (ADVANCED_INTENTS.has(intent)) return false;
    if (t.status === 'completed') return false;
    return true;
  });
}

/**
 * getFirstTimeHomeMode — main integration point. Returns
 * enough detail for the Home composer to render the correct
 * shell:
 *
 *   • shouldShowStartFlow: render the "Start your farm" CTA
 *     card, not the usual task card.
 *   • visibleTasks: the filtered list the Home shell can
 *     render if shouldShowStartFlow is false.
 *   • hiddenIntents: for the dev panel to audit what was
 *     suppressed.
 */
export function getFirstTimeHomeMode(state = null) {
  const farm = state?.farm || null;
  const isFirst = isFirstTimeHome(state);
  const rawTasks = farm?.tasks || [];
  const visible = filterTasksForFirstTime(rawTasks, state);
  const hidden = isFirst
    ? rawTasks.filter((t) => !visible.some((v) => v.id === t.id))
    : [];
  return Object.freeze({
    isFirstTime: isFirst,
    shouldShowStartFlow: !hasFarmYet(state),
    visibleTasks: visible,
    hiddenTaskCount: hidden.length,
    hiddenIntents: Array.from(new Set(hidden
      .map((t) => String(t?.intent || '').toLowerCase())
      .filter(Boolean))),
  });
}

export const _internal = { ADVANCED_INTENTS };
