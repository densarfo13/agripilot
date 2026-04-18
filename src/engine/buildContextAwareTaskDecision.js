/**
 * Context-Aware Task Decision — the single function that produces the
 * one current task for Home, Tasks, notifications, and completion.
 *
 * Pipeline (spec §1):
 *   base crop definition (cropDefinitions.js, e.g. MAIZE)
 *   + region modifier (regionProfiles.taskHints)
 *   + weather modifier (passed through to autopilot enrichment later)
 *   + farmer experience modifier (presentation density)
 *   + completion/progression state (stage index, task index, repetitions)
 *   = one final current task with steps, tips, and an adaptive title
 *
 * This module is pure. It does NOT call the autopilot enrichment or
 * timing engine — those still run inside buildFarmerTaskViewModel so
 * live weather can reshape the output right before render. What this
 * does give callers is the *canonical task shape* with everything
 * localized via i18n keys.
 *
 * Returned shape:
 *   {
 *     type, titleKey, finishTitleKey?,
 *     whyKey, timingKey, riskKey, outcomeKey,
 *     urgency, priority, icon,
 *     stepsKey?, tipsKey?,
 *     nextTaskType?,
 *     stage, cropId, regionId?,
 *     regionHinted,  // true if region replaced the base titleKey
 *     isRepeated,    // true if progression state flagged incomplete
 *     attempts,      // how many times this task has been shown
 *   }
 */
import { getCropDefinition, getDefinedTasks, getNextStage } from './cropDefinitions.js';
import { getTasksForCropStage, resolveStage } from './cropTaskMap.js';
import { getRegionTaskHint, REGION_PROFILES, resolveRegionProfile } from './regionProfiles.js';
import { buildLocalizedTask } from '../core/localization/globalContext.js';

// ─── Helpers ───────────────────────────────────────────────

function isDev() {
  try {
    if (typeof import.meta !== 'undefined') return !!import.meta.env?.DEV;
  } catch { /* ignore */ }
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

function resolveRegion(region) {
  if (!region) return REGION_PROFILES.default;
  if (typeof region === 'string') {
    return REGION_PROFILES[region] || resolveRegionProfile(region);
  }
  return region;
}

/**
 * Given a stage task list and completion state, pick the next task to
 * surface. Returns { task, index, allComplete }.
 */
function pickCurrentTask(stageTasks, completion) {
  if (!stageTasks || stageTasks.length === 0) {
    return { task: null, index: -1, allComplete: false };
  }
  const completedTypes = new Set((completion?.completedTypesInStage) || []);
  for (let i = 0; i < stageTasks.length; i++) {
    if (!completedTypes.has(stageTasks[i].type)) {
      return { task: stageTasks[i], index: i, allComplete: false };
    }
  }
  return { task: stageTasks[stageTasks.length - 1], index: stageTasks.length - 1, allComplete: true };
}

/**
 * Adaptive repetition (spec §6): if the same task has been shown more
 * than once without a fresh completion, swap the titleKey for the
 * `finishTitleKey` variant so the farmer sees "Finish clearing your
 * land" rather than the same "Clear your land" prompt.
 */
function applyRepetition(task, repetitions) {
  if (!task) return task;
  const attempts = repetitions?.[task.type] || 0;
  const isRepeated = attempts >= 1 && !!task.finishTitleKey;
  return {
    ...task,
    titleKey: isRepeated ? task.finishTitleKey : task.titleKey,
    isRepeated,
    attempts: attempts + 1,
  };
}

// ─── Public API ────────────────────────────────────────────

/**
 * Produce one current task for the given context.
 *
 * @param {Object} params
 * @param {string} params.crop                  crop code, e.g. 'MAIZE'
 * @param {string} params.cropStage             canonical stage (or alias)
 * @param {Object|string} [params.region]       region profile id or object
 * @param {string} [params.farmerExperience]    'none' | 'some' | 'experienced'
 * @param {Object} [params.completionState]     { completedTypesInStage: Set|Array, repetitions: {type: n} }
 * @returns {Object|null} decorated task shape or null
 */
export function buildContextAwareTaskDecision({
  crop,
  cropStage,
  region,
  farmerExperience,
  completionState,
  countryCode,   // spec §7: country + month drive the localization pipeline
  month,
} = {}) {
  if (!crop) return null;

  const stage = resolveStage(cropStage || 'land_preparation');
  const regionProfile = resolveRegion(region);

  // 1. Start from the canonical crop definition if we have one — that
  //    carries the richest shape (steps/tips/finish variants). Fall
  //    back to the generic STAGE_TASKS when the crop is not yet a
  //    first-class definition.
  const defined = getDefinedTasks(crop, stage);
  const fallback = defined ? null : getTasksForCropStage(crop, stage);
  const stageTasks = defined || fallback || [];

  // 2. Choose the current task based on completion state.
  const { task: base, index, allComplete } = pickCurrentTask(stageTasks, completionState);
  if (!base) return null;

  // 3. Layer region hint (never overrides an outcome/why — only the
  //    farmer-facing title when the region has a specific phrasing).
  const regionHint = getRegionTaskHint(regionProfile, base.type);
  const regionalised = regionHint
    ? { ...base, titleKey: regionHint, regionHinted: true }
    : { ...base, regionHinted: false };

  // 4. Adaptive repetition — if the same task has been shown before,
  //    swap to the finish variant.
  const withRepetition = applyRepetition(regionalised, completionState?.repetitions);

  // 5. Dev assertions — surface the cases the spec calls out (§16).
  if (isDev()) {
    if (defined && !withRepetition.stepsKey && withRepetition.priority !== 'low') {
      console.warn(`[taskDecision] MAIZE-grade task "${withRepetition.type}" has no stepsKey`);
    }
    const def = getCropDefinition(crop);
    if (def && !def.stages.includes(stage)) {
      console.warn(`[taskDecision] stage "${stage}" not in ${crop} stages list`);
    }
  }

  const decorated = {
    ...withRepetition,
    stage,
    cropId: crop,
    regionId: regionProfile?.id || null,
    farmerExperience: farmerExperience || null,
    stageIndex: index,
    stageAllComplete: allComplete,
  };

  // Spec §7: final pass — pipe through the globalContext localization
  // layer so country + calendar-aware stage + region overrides can
  // reshape the task. When countryCode isn't provided, the localizer
  // is a no-op that just carries the decorated task forward.
  if (countryCode) {
    return buildLocalizedTask({
      countryCode,
      cropId: crop,
      month,
      baseTask: decorated,
    });
  }
  return decorated;
}

/**
 * Advance the progression after a task completion. Returns the new
 * current task (pure — callers apply the state transition themselves).
 *
 * Behaviour:
 *  - appends task.type to completedTypesInStage
 *  - if all stage tasks are now complete, moves to the next stage and
 *    resets completedTypesInStage
 *  - otherwise, returns the next uncompleted task in the current stage
 */
export function advanceAfterCompletion({
  crop,
  cropStage,
  region,
  farmerExperience,
  completionState,
  completedType,
}) {
  const stage = resolveStage(cropStage);
  const state = completionState || { completedTypesInStage: [], repetitions: {} };
  const nextCompleted = Array.from(new Set([...(state.completedTypesInStage || []), completedType]));

  const stageTasks = getDefinedTasks(crop, stage) || getTasksForCropStage(crop, stage);
  const allDone = stageTasks.every(t => nextCompleted.includes(t.type));

  if (allDone) {
    const next = getNextStage(crop, stage);
    return {
      nextStage: next || stage,
      nextCompletionState: {
        completedTypesInStage: next ? [] : nextCompleted,
        repetitions: state.repetitions || {},
      },
      stageAdvanced: !!next,
    };
  }

  return {
    nextStage: stage,
    nextCompletionState: {
      completedTypesInStage: nextCompleted,
      repetitions: state.repetitions || {},
    },
    stageAdvanced: false,
  };
}

export const _internal = { pickCurrentTask, applyRepetition, resolveRegion };
