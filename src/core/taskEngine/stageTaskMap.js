/**
 * stageTaskMap.js — base task catalog per crop stage.
 *
 * Each entry is a TEMPLATE. The generator clones and enriches
 * with localized payload metadata. No strings, only task codes
 * + i18n keys + behavioral flags.
 */

/** Canonical stage ids used throughout the task engine. */
export const STAGE = Object.freeze({
  LAND_PREP:    'land_prep',
  PLANTING:     'planting',
  EARLY_GROWTH: 'early_growth',
  MAINTAIN:     'maintain',
  HARVEST:      'harvest',
  POST_HARVEST: 'post_harvest',
});

/**
 * Task action types — high-level intent buckets used by the
 * confidence layer and (later) analytics rollups.
 */
export const ACTION_TYPE = Object.freeze({
  PREP:     'prep',
  PLANT:    'plant',
  INSPECT:  'inspect',
  TREAT:    'treat',
  HARVEST:  'harvest',
  STORE:    'store',
  PROTECT:  'protect',
  SOURCE:   'source',
  MONITOR:  'monitor',
});

/** Behavioural flags — read by the priority scorer. */
export const FLAG = Object.freeze({
  BLOCKING:         'blocking',         // blocks later-stage tasks
  WEATHER_SENSITIVE:'weather_sensitive',// priority changes with weather
  STAGE_GATE:       'stage_gate',       // completion marks stage ready
  PROTECTIVE:       'protective',       // rain/heat protection class
});

/**
 * Base map. Each task:
 *   code          — stable machine id (i18n key = `task.${code}`)
 *   titleKey      — explicit override (defaults to `task.${code}`)
 *   whyKey        — default why; context rules can override
 *   actionType    — ACTION_TYPE
 *   flags         — set of FLAG values
 *   priority      — base priority 0..100 before context scoring
 *   stageGate     — true when this task must be done to exit stage
 */
const TASKS = Object.freeze({
  clear_land: {
    code: 'clear_land', stage: STAGE.LAND_PREP, priority: 80,
    actionType: ACTION_TYPE.PREP, flags: [FLAG.BLOCKING, FLAG.STAGE_GATE],
    stageGate: true,
    whyKey: 'why.land_not_ready_yet',
  },
  remove_weeds: {
    code: 'remove_weeds', stage: STAGE.LAND_PREP, priority: 60,
    actionType: ACTION_TYPE.PREP, flags: [],
    whyKey: 'why.reduce_competition_for_crops',
  },
  prepare_ridges: {
    code: 'prepare_ridges', stage: STAGE.LAND_PREP, priority: 65,
    actionType: ACTION_TYPE.PREP, flags: [FLAG.STAGE_GATE],
    stageGate: true,
    whyKey: 'why.shape_soil_for_crop_rows',
  },
  check_drainage: {
    code: 'check_drainage', stage: STAGE.LAND_PREP, priority: 55,
    actionType: ACTION_TYPE.PREP, flags: [FLAG.WEATHER_SENSITIVE, FLAG.PROTECTIVE],
    whyKey: 'why.rain_expected_later_today',
  },
  source_planting_materials: {
    code: 'source_planting_materials', stage: STAGE.LAND_PREP, priority: 50,
    actionType: ACTION_TYPE.SOURCE, flags: [FLAG.STAGE_GATE],
    stageGate: true,
    whyKey: 'why.need_inputs_before_planting',
  },

  plant_crop: {
    code: 'plant_crop', stage: STAGE.PLANTING, priority: 85,
    actionType: ACTION_TYPE.PLANT, flags: [FLAG.WEATHER_SENSITIVE, FLAG.STAGE_GATE],
    stageGate: true,
    whyKey: 'why.good_time_for_planting',
  },
  verify_soil_ready: {
    code: 'verify_soil_ready', stage: STAGE.PLANTING, priority: 70,
    actionType: ACTION_TYPE.INSPECT, flags: [FLAG.WEATHER_SENSITIVE, FLAG.BLOCKING],
    whyKey: 'why.soil_may_be_too_wet',
  },
  mark_rows: {
    code: 'mark_rows', stage: STAGE.PLANTING, priority: 55,
    actionType: ACTION_TYPE.PREP, flags: [],
    whyKey: 'why.rows_improve_yield',
  },
  space_plants_correctly: {
    code: 'space_plants_correctly', stage: STAGE.PLANTING, priority: 50,
    actionType: ACTION_TYPE.PLANT, flags: [],
    whyKey: 'why.spacing_drives_yield',
  },

  inspect_new_growth: {
    code: 'inspect_new_growth', stage: STAGE.EARLY_GROWTH, priority: 70,
    actionType: ACTION_TYPE.INSPECT, flags: [],
    whyKey: 'why.catch_issues_early',
  },
  apply_fertilizer_if_due: {
    code: 'apply_fertilizer_if_due', stage: STAGE.EARLY_GROWTH, priority: 60,
    actionType: ACTION_TYPE.TREAT, flags: [FLAG.WEATHER_SENSITIVE],
    whyKey: 'why.fertilizer_window_now',
  },
  remove_early_weeds: {
    code: 'remove_early_weeds', stage: STAGE.EARLY_GROWTH, priority: 55,
    actionType: ACTION_TYPE.TREAT, flags: [],
    whyKey: 'why.reduce_competition_for_crops',
  },

  check_pests: {
    code: 'check_pests', stage: STAGE.MAINTAIN, priority: 65,
    actionType: ACTION_TYPE.INSPECT, flags: [],
    whyKey: 'why.pests_reduce_yield',
  },
  weed_control: {
    code: 'weed_control', stage: STAGE.MAINTAIN, priority: 55,
    actionType: ACTION_TYPE.TREAT, flags: [],
    whyKey: 'why.reduce_competition_for_crops',
  },
  monitor_moisture: {
    code: 'monitor_moisture', stage: STAGE.MAINTAIN, priority: 60,
    actionType: ACTION_TYPE.MONITOR, flags: [FLAG.WEATHER_SENSITIVE],
    whyKey: 'why.moisture_drives_growth',
  },

  harvest_crop: {
    code: 'harvest_crop', stage: STAGE.HARVEST, priority: 90,
    actionType: ACTION_TYPE.HARVEST, flags: [FLAG.STAGE_GATE, FLAG.WEATHER_SENSITIVE],
    stageGate: true,
    whyKey: 'why.harvest_window_now',
  },
  sort_yield: {
    code: 'sort_yield', stage: STAGE.HARVEST, priority: 55,
    actionType: ACTION_TYPE.HARVEST, flags: [],
    whyKey: 'why.sorting_keeps_quality',
  },
  protect_harvest_if_rain: {
    code: 'protect_harvest_if_rain', stage: STAGE.HARVEST, priority: 80,
    actionType: ACTION_TYPE.PROTECT, flags: [FLAG.WEATHER_SENSITIVE, FLAG.PROTECTIVE],
    whyKey: 'why.rain_threatens_harvest',
  },

  store_crop: {
    code: 'store_crop', stage: STAGE.POST_HARVEST, priority: 75,
    actionType: ACTION_TYPE.STORE, flags: [FLAG.STAGE_GATE],
    stageGate: true,
    whyKey: 'why.storage_prevents_loss',
  },
  clear_field_residue: {
    code: 'clear_field_residue', stage: STAGE.POST_HARVEST, priority: 55,
    actionType: ACTION_TYPE.PREP, flags: [],
    whyKey: 'why.clear_field_for_next_cycle',
  },
  plan_next_cycle: {
    code: 'plan_next_cycle', stage: STAGE.POST_HARVEST, priority: 50,
    actionType: ACTION_TYPE.SOURCE, flags: [],
    whyKey: 'why.plan_next_cycle',
  },
});

/** Get the tasks for a given stage, always as an array. */
export function tasksForStage(stage) {
  if (!stage || typeof stage !== 'string') return [];
  return Object.values(TASKS).filter((t) => t.stage === stage);
}

/** Lookup by code. Returns a shallow clone so callers can enrich. */
export function taskByCode(code) {
  const t = TASKS[code];
  return t ? { ...t, flags: [...(t.flags || [])] } : null;
}

/** Stage-gate tasks (completion of all of them → stage can progress). */
export function stageGateCodes(stage) {
  return tasksForStage(stage)
    .filter((t) => t.stageGate)
    .map((t) => t.code);
}

/** Public frozen map for tests that need exhaustive iteration. */
export const TASK_CATALOG = TASKS;
