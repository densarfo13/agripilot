/**
 * taskGenerator.js — the main entry the UI calls to get
 * "what should I do now?" as a structured list.
 *
 *   generateFarmTasks({
 *     farm, weather, landProfile, farmerState,
 *     freshness, recentEvents, completedCodes?,
 *   }) → {
 *     primary:    EnrichedTask | null
 *     supporting: EnrichedTask[]   // 2..4 items
 *     all:        EnrichedTask[]   // full ranked list
 *     context:    the resolved context (for tests & dev tools)
 *   }
 *
 * Each EnrichedTask is a LocalizedPayload-ready object:
 *   {
 *     id, code, priority, score,
 *     titleKey, titleParams, whyKey, whyParams,
 *     actionType, stage, isPrimary,
 *     confidenceLevel, blocking, completed
 *   }
 *
 * No strings leave this module — the UI uses
 * renderLocalizedMessage(payload, t) per spec §13.
 */

import { STAGE, tasksForStage, stageGateCodes, FLAG } from './stageTaskMap.js';
import { scoreAll }  from './priorityScorer.js';

/** Build a stable id from farm + code — enough to dedupe across rerenders. */
function buildTaskId(farmId, code) {
  return `${farmId || 'f'}:${code}`;
}

/** Map flags into a boolean `blocking` hint the UI can check. */
function isBlocking(task) {
  return (task.flags || []).includes(FLAG.BLOCKING);
}

/**
 * Enrich a task template into a LocalizedPayload-ready object.
 */
function enrichTask(task, { farmId, completedSet }) {
  return Object.freeze({
    id:          buildTaskId(farmId, task.code),
    code:        task.code,
    priority:    task.priority,
    score:       task.score,
    stage:       task.stage,
    actionType:  task.actionType,
    isPrimary:   false,            // set later by selector
    blocking:    isBlocking(task),
    completed:   completedSet.has(task.code),
    confidenceLevel: task.confidenceLevel || 'medium',
    titleKey:    task.titleKey || `task.${task.code}`,
    titleParams: task.titleParams || {},
    whyKey:      task.whyKey || null,
    whyParams:   task.whyParams || {},
  });
}

/**
 * resolveStage — read stage from farm, fall back to land_prep.
 */
function resolveStage(farm) {
  const s = (farm && (farm.stage || farm.cropStage)) || STAGE.LAND_PREP;
  // Map legacy "land_preparation" to canonical "land_prep".
  if (s === 'land_preparation') return STAGE.LAND_PREP;
  return s;
}

/**
 * safeFallbackTasks — when we have almost no context, still
 * produce a non-empty list (§12). These are data-prompting
 * prompts, NOT generic tooling.
 */
function safeFallbackTasks(farm) {
  const farmId = farm?.id || null;
  return [
    Object.freeze({
      id: buildTaskId(farmId, 'add_location_for_guidance'),
      code: 'add_location_for_guidance',
      priority: 70, score: 70,
      stage: STAGE.LAND_PREP, actionType: 'prep',
      isPrimary: true, blocking: false, completed: false,
      confidenceLevel: 'low',
      titleKey: 'task.add_location_for_guidance',
      titleParams: {},
      whyKey: 'why.need_location_for_guidance',
      whyParams: {},
    }),
    Object.freeze({
      id: buildTaskId(farmId, 'review_crop_details'),
      code: 'review_crop_details',
      priority: 50, score: 50,
      stage: STAGE.LAND_PREP, actionType: 'inspect',
      isPrimary: false, blocking: false, completed: false,
      confidenceLevel: 'low',
      titleKey: 'task.review_crop_details',
      titleParams: {},
      whyKey: null, whyParams: {},
    }),
  ];
}

/**
 * selectPrimaryTask — §6. Highest score wins; blocking tasks
 * are allowed to be primary; completed tasks are never primary.
 */
export function selectPrimaryTask(tasks = []) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const eligible = tasks.filter((t) => !t.completed);
  if (eligible.length === 0) return null;
  let best = eligible[0];
  for (const t of eligible) {
    if ((t.score ?? 0) > (best.score ?? 0)) best = t;
  }
  return best;
}

/**
 * sortSupportingTasks — everything except the primary, sorted
 * by score desc, completed last.
 */
function sortSupportingTasks(all, primary) {
  const id = primary?.id;
  return [...all]
    .filter((t) => t.id !== id)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return (b.score ?? 0) - (a.score ?? 0);
    });
}

/**
 * generateFarmTasks — main public entry. Pure. Deterministic.
 */
export function generateFarmTasks(input = {}) {
  const farm          = input.farm          || null;
  const weather       = input.weather       || null;
  const landProfile   = input.landProfile   || null;
  const farmerState   = input.farmerState   || null;
  const freshness     = input.freshness     || null;
  const recentEvents  = Array.isArray(input.recentEvents) ? input.recentEvents : [];
  const completedSet  = new Set(
    (input.completedCodes || recentEvents
      .filter((e) => e && e.type === 'task_completed' && e.code)
      .map((e) => e.code))
    || [],
  );
  const currentStage  = resolveStage(farm);

  // ─── Step 1: pick templates for the stage ───────────────────
  let stageTemplates = tasksForStage(currentStage);
  // Land blockers bring clear_land into stages past land_prep.
  if (landProfile && !landProfile.landCleared && currentStage !== STAGE.LAND_PREP) {
    const template = tasksForStage(STAGE.LAND_PREP).find((t) => t.code === 'clear_land');
    if (template) stageTemplates = [template, ...stageTemplates];
  }

  // ─── Safe fallback when we have nothing ─────────────────────
  const farmHasContext = !!(farm && (farm.cropType || farm.crop || farm.countryCode || farm.country));
  if (!farmHasContext && stageTemplates.length === 0) {
    const fallback = safeFallbackTasks(farm);
    return {
      primary:    fallback[0],
      supporting: fallback.slice(1),
      all:        fallback,
      context:    { currentStage, farmHasContext, completedCount: 0 },
    };
  }
  // Even with context, empty stage → fallback (degrades gracefully).
  if (stageTemplates.length === 0) {
    const fallback = safeFallbackTasks(farm);
    return {
      primary:    fallback[0],
      supporting: fallback.slice(1),
      all:        fallback,
      context:    { currentStage, farmHasContext, completedCount: 0 },
    };
  }

  // ─── Step 2: score ──────────────────────────────────────────
  const scored = scoreAll(stageTemplates, {
    weather, landProfile, currentStage, freshness, farmerState,
  });

  // ─── Step 3: enrich + primary selection ─────────────────────
  const farmId = farm?.id || null;
  const enriched = scored.map((t) => enrichTask(t, { farmId, completedSet }));
  const primary  = selectPrimaryTask(enriched);
  const final    = primary
    ? enriched.map((t) => t.id === primary.id ? { ...t, isPrimary: true } : t)
    : enriched;
  const primaryFinal = primary ? Object.freeze({ ...primary, isPrimary: true }) : null;

  // ─── Step 4: sort supporting ────────────────────────────────
  const supporting = sortSupportingTasks(final, primaryFinal).slice(0, 4);

  return {
    primary:    primaryFinal,
    supporting,
    all:        final,
    context:    {
      currentStage,
      farmHasContext,
      completedCount: completedSet.size,
      farmId,
    },
  };
}

/**
 * recomputeAfterCompletion — helper that updates the recent
 * events feed and regenerates tasks. Pure.
 */
export function recomputeAfterCompletion(input, completedCode, nowMs = Date.now()) {
  if (!completedCode) return generateFarmTasks(input || {});
  const prev = input || {};
  const prevEvents = Array.isArray(prev.recentEvents) ? prev.recentEvents : [];
  const events = [...prevEvents, {
    type: 'task_completed',
    code: completedCode,
    at: nowMs,
  }];
  return generateFarmTasks({ ...prev, recentEvents: events });
}

/**
 * shouldAdvanceStage — §9. Simple stage-progression. Returns
 * the suggested NEXT stage when every stage-gate task for the
 * current stage is completed; else null.
 *
 * Does NOT auto-advance — the UI asks the user to confirm.
 */
export function shouldAdvanceStage(input = {}) {
  const farm = input.farm || null;
  const currentStage = resolveStage(farm);
  const gates = stageGateCodes(currentStage);
  if (gates.length === 0) return null;
  const completed = new Set(
    (input.completedCodes || (input.recentEvents || [])
      .filter((e) => e && e.type === 'task_completed' && e.code)
      .map((e) => e.code))
    || [],
  );
  const allDone = gates.every((code) => completed.has(code));
  if (!allDone) return null;
  // Linear stage progression. Returning null for post_harvest
  // means "cycle complete — start a new cycle manually".
  const NEXT = {
    [STAGE.LAND_PREP]:    STAGE.PLANTING,
    [STAGE.PLANTING]:     STAGE.EARLY_GROWTH,
    [STAGE.EARLY_GROWTH]: STAGE.MAINTAIN,
    [STAGE.MAINTAIN]:     STAGE.HARVEST,
    [STAGE.HARVEST]:      STAGE.POST_HARVEST,
    [STAGE.POST_HARVEST]: null,
  };
  return NEXT[currentStage] ?? null;
}

export { STAGE };
