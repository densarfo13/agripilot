/**
 * generateInitialTasks.js — the seed task list a brand-new
 * farm starts with. Keep this SMALL: the fast-onboarding spec
 * says first-time users should see ONE task on Home — the
 * others are queued for when the farmer is ready.
 *
 *   generateInitialTasks(crop, stage='land_prep', opts?) → Task[]
 *
 * Task shape:
 *   {
 *     id, crop, stage, intent, status,
 *     title, titleKey, titleFallback,
 *     why, whyKey, whyFallback,
 *     confidence: { level: 'medium', score: 55 },
 *     createdAt,
 *   }
 *
 * For stage='land_prep' the primary task is ALWAYS "Prepare
 * your land". Everything else (fertilize, water, scout) is
 * queued but NOT shown on first Home — FirstTimeHomeGuard
 * filters them.
 */

const LAND_PREP_TASKS = [
  {
    localId: 'prepare_land',
    intent: 'prep',
    title: 'Prepare your land',
    titleKey: 'fast_onboarding.task.prepare_land.title',
    why: 'Clear space for planting',
    whyKey: 'fast_onboarding.task.prepare_land.why',
    priority: 1,
    stage: 'land_prep',
  },
];

/**
 * Optional follow-up tasks queued at farm creation but hidden
 * from first-time Home by FirstTimeHomeGuard. They become
 * visible once the user completes the first task OR flips the
 * "I already have a farm" profile later.
 */
const DEFERRED_LAND_PREP_FOLLOWUPS = [
  {
    localId: 'mark_rows',
    intent: 'prep',
    title: 'Mark your planting rows',
    titleKey: 'fast_onboarding.task.mark_rows.title',
    why: 'Plan spacing before seed',
    whyKey: 'fast_onboarding.task.mark_rows.why',
    priority: 2,
    stage: 'land_prep',
    visibility: 'deferred',
  },
];

export function generateInitialTasks(crop, stage = 'land_prep', opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const safeCrop = String(crop || '').toLowerCase();

  // Only land_prep is seeded today — other stages are driven by
  // the full task engine once the farm is active.
  const seed = stage === 'land_prep'
    ? [...LAND_PREP_TASKS, ...DEFERRED_LAND_PREP_FOLLOWUPS]
    : [];

  return seed.map((t) => Object.freeze({
    id: `task_${safeCrop}_${t.localId}_${now.toString(36)}`,
    crop: safeCrop,
    stage: t.stage,
    intent: t.intent,
    status: 'pending',
    title: t.title,
    titleKey: t.titleKey,
    titleFallback: t.title,
    why: t.why,
    whyKey: t.whyKey,
    whyFallback: t.why,
    confidence: { level: 'medium', score: 55 },
    priority: t.priority,
    visibility: t.visibility || 'primary',
    createdAt: now,
  }));
}

export const _internal = { LAND_PREP_TASKS, DEFERRED_LAND_PREP_FOLLOWUPS };
