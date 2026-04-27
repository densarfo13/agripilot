/**
 * taskEngine.js — Farroway core task engine (spec section 3).
 *
 * Pure, local-first, deterministic.
 *
 *   generateDailyTask(farm) -> { stage, mainTask, allTasks } | null
 *
 * Returns null when the farm record can't be used to compute a
 * task (no crop or no plantingDate). Callers (TodayCard,
 * notification system, NGO alerts) all defend against null - the
 * UI shows an "add farm" cue rather than crashing.
 *
 * The TASK_RULES table starts with cassava (per spec). Adding a
 * crop is a single-key addition; no other module needs to change.
 */

const MS_PER_DAY = 86_400_000;

export const STAGES = Object.freeze([
  'germination',
  'establishment',
  'growth',
  'flowering',
  'harvest',
]);

/**
 * Days elapsed since the planting date. Returns 0 for invalid /
 * future dates so downstream code never receives NaN or a
 * negative number.
 */
export function getDaysSincePlanting(date) {
  if (!date) return 0;
  const ms = new Date(date).getTime();
  if (!Number.isFinite(ms)) return 0;
  const days = Math.floor((Date.now() - ms) / MS_PER_DAY);
  return days < 0 ? 0 : days;
}

/** Map elapsed days to a coarse stage. */
export function getStage(days) {
  const d = Number.isFinite(Number(days)) ? Number(days) : 0;
  if (d < 7)  return 'germination';
  if (d < 30) return 'establishment';
  if (d < 60) return 'growth';
  if (d < 90) return 'flowering';
  return 'harvest';
}

/**
 * Crop -> stage -> ordered list of task ids.
 *
 * Add new crops by adding a new top-level key. Every crop should
 * cover all five stages; missing stages fall back to 'check_farm'.
 */
export const TASK_RULES = Object.freeze({
  cassava: Object.freeze({
    germination:    ['check_moisture'],
    establishment:  ['weed_rows'],
    growth:         ['scout_pests'],
    flowering:      ['scout_pests'],
    harvest:        ['prepare_harvest'],
  }),
});

/**
 * Build the daily task summary for a farm.
 *
 *   generateDailyTask({ crop: 'cassava', plantingDate: '2025-...' })
 *     -> { stage: 'establishment',
 *          mainTask: 'weed_rows',
 *          allTasks: ['weed_rows'] }
 *
 * Returns null when the farm record can't drive a task. Always
 * returns an object with a non-empty mainTask when it returns at
 * all - the fallback list is `['check_farm']`.
 */
export function generateDailyTask(farm) {
  if (!farm || typeof farm !== 'object') return null;
  if (!farm.crop || !farm.plantingDate)  return null;

  const days = getDaysSincePlanting(farm.plantingDate);
  const stage = getStage(days);

  const cropRules = TASK_RULES[String(farm.crop).toLowerCase()] || null;
  const stageTasks = (cropRules && cropRules[stage]) || ['check_farm'];

  const allTasks = stageTasks.slice(0, 3);
  const mainTask = allTasks[0] || 'check_farm';

  return Object.freeze({
    stage,
    mainTask,
    allTasks: Object.freeze(allTasks),
  });
}
