import { getRegionTaskHint, REGION_PROFILES } from './regionProfiles.js';

/**
 * Crop-Task Mapping — deterministic stage-to-task mapping for beginner crops.
 *
 * Maps each crop stage to a prioritized list of tasks.
 * Used for:
 *   - seeding the first task immediately after "Start this crop"
 *   - offline fallback when backend hasn't generated tasks yet
 *   - task taxonomy that autopilot rules reference
 *
 * All text uses translation keys. No raw English.
 * Structure mirrors backend task generation so the two stay in sync.
 */

// ─── Stage → Tasks mapping ────────────────────────────────
// Each task: { type, titleKey, priority, icon }
// Priority: 'high' | 'medium' | 'low'

const STAGE_TASKS = {
  planning: [
    { type: 'gather_inputs', titleKey: 'cropTask.gatherInputs', priority: 'high', icon: '\uD83D\uDED2' },
    { type: 'prepare_land', titleKey: 'cropTask.prepareLand', priority: 'medium', icon: '\uD83D\uDE9C' },
  ],
  land_preparation: [
    { type: 'clear_field', titleKey: 'cropTask.clearField', priority: 'high', icon: '\uD83E\uDE93' },
    { type: 'prepare_land', titleKey: 'cropTask.prepareLand', priority: 'high', icon: '\uD83D\uDE9C' },
    { type: 'gather_inputs', titleKey: 'cropTask.gatherInputs', priority: 'medium', icon: '\uD83D\uDED2' },
  ],
  planting: [
    { type: 'plant_seeds', titleKey: 'cropTask.plantSeeds', priority: 'high', icon: '\uD83C\uDF31' },
    { type: 'water_after_planting', titleKey: 'cropTask.waterAfterPlanting', priority: 'high', icon: '\uD83D\uDCA7' },
    { type: 'confirm_spacing', titleKey: 'cropTask.confirmSpacing', priority: 'low', icon: '\uD83D\uDCCF' },
  ],
  germination: [
    { type: 'check_germination', titleKey: 'cropTask.checkGermination', priority: 'high', icon: '\uD83C\uDF3F' },
    { type: 'first_weeding', titleKey: 'cropTask.firstWeeding', priority: 'medium', icon: '\uD83C\uDF3E' },
    { type: 'monitor_water', titleKey: 'cropTask.monitorWater', priority: 'medium', icon: '\uD83D\uDCA7' },
  ],
  vegetative: [
    { type: 'apply_fertilizer', titleKey: 'cropTask.applyFertilizer', priority: 'high', icon: '\uD83E\uDDEA' },
    { type: 'weed_field', titleKey: 'cropTask.weedField', priority: 'medium', icon: '\uD83C\uDF3E' },
    { type: 'check_pests', titleKey: 'cropTask.checkPests', priority: 'medium', icon: '\uD83D\uDC1B' },
    { type: 'monitor_water', titleKey: 'cropTask.monitorWater', priority: 'medium', icon: '\uD83D\uDCA7' },
  ],
  flowering: [
    { type: 'check_pests', titleKey: 'cropTask.checkPests', priority: 'high', icon: '\uD83D\uDC1B' },
    { type: 'monitor_water', titleKey: 'cropTask.monitorWater', priority: 'high', icon: '\uD83D\uDCA7' },
    { type: 'apply_fertilizer', titleKey: 'cropTask.applyFertilizer', priority: 'medium', icon: '\uD83E\uDDEA' },
  ],
  fruiting: [
    { type: 'monitor_weather_risk', titleKey: 'cropTask.monitorWeatherRisk', priority: 'high', icon: '\u26C5' },
    { type: 'check_pests', titleKey: 'cropTask.checkPests', priority: 'medium', icon: '\uD83D\uDC1B' },
    { type: 'weed_field', titleKey: 'cropTask.weedField', priority: 'low', icon: '\uD83C\uDF3E' },
  ],
  harvest: [
    { type: 'harvest_crop', titleKey: 'cropTask.harvestCrop', priority: 'high', icon: '\uD83E\uDDFA' },
    { type: 'sort_harvest', titleKey: 'cropTask.sortHarvest', priority: 'medium', icon: '\uD83D\uDCE6' },
    { type: 'protect_harvest_from_rain', titleKey: 'cropTask.protectHarvestFromRain', priority: 'medium', icon: '\u2602\uFE0F' },
  ],
  post_harvest: [
    { type: 'dry_harvest', titleKey: 'cropTask.dryHarvest', priority: 'high', icon: '\u2600\uFE0F' },
    { type: 'store_harvest', titleKey: 'cropTask.storeHarvest', priority: 'high', icon: '\uD83D\uDCE6' },
    { type: 'log_harvest', titleKey: 'cropTask.logHarvest', priority: 'medium', icon: '\uD83D\uDCDD' },
    { type: 'prepare_for_sale', titleKey: 'cropTask.prepareForSale', priority: 'low', icon: '\uD83D\uDCB0' },
  ],
};

// ─── Crop-specific task overrides ────────────────────────
// Some crops need different priority ordering or extra tasks.
// MAIZE is the V2 launch-standard crop — every stage has an override.
const CROP_OVERRIDES = {
  MAIZE: {
    land_preparation: [
      { type: 'clear_field', titleKey: 'cropTask.maize.clearField', priority: 'high', icon: '\uD83E\uDE93' },
      { type: 'prepare_land', titleKey: 'cropTask.maize.prepareLand', priority: 'high', icon: '\uD83D\uDE9C' },
      { type: 'mark_rows', titleKey: 'cropTask.maize.markRows', priority: 'medium', icon: '\uD83D\uDCCF' },
      { type: 'gather_inputs', titleKey: 'cropTask.maize.gatherInputs', priority: 'medium', icon: '\uD83D\uDED2' },
    ],
    planting: [
      { type: 'plant_seeds', titleKey: 'cropTask.maize.plantSeeds', priority: 'high', icon: '\uD83C\uDF31' },
      { type: 'water_after_planting', titleKey: 'cropTask.maize.waterAfterPlanting', priority: 'high', icon: '\uD83D\uDCA7' },
      { type: 'confirm_spacing', titleKey: 'cropTask.maize.confirmSpacing', priority: 'low', icon: '\uD83D\uDCCF' },
    ],
    germination: [
      { type: 'check_germination', titleKey: 'cropTask.maize.checkGermination', priority: 'high', icon: '\uD83C\uDF3F' },
      { type: 'first_weeding', titleKey: 'cropTask.maize.firstWeeding', priority: 'medium', icon: '\uD83C\uDF3E' },
      { type: 'monitor_water', titleKey: 'cropTask.maize.monitorWater', priority: 'medium', icon: '\uD83D\uDCA7' },
    ],
    vegetative: [
      { type: 'apply_fertilizer', titleKey: 'cropTask.maize.applyFertilizer', priority: 'high', icon: '\uD83E\uDDEA' },
      { type: 'weed_field', titleKey: 'cropTask.maize.weedField', priority: 'medium', icon: '\uD83C\uDF3E' },
      { type: 'check_pests', titleKey: 'cropTask.maize.checkPests', priority: 'medium', icon: '\uD83D\uDC1B' },
      { type: 'monitor_water', titleKey: 'cropTask.maize.monitorWater', priority: 'medium', icon: '\uD83D\uDCA7' },
    ],
    flowering: [
      { type: 'monitor_water', titleKey: 'cropTask.maize.monitorWaterFlower', priority: 'high', icon: '\uD83D\uDCA7' },
      { type: 'check_pests', titleKey: 'cropTask.maize.checkPests', priority: 'high', icon: '\uD83D\uDC1B' },
      { type: 'apply_fertilizer', titleKey: 'cropTask.maize.topDress', priority: 'medium', icon: '\uD83E\uDDEA' },
    ],
    harvest: [
      { type: 'harvest_crop', titleKey: 'cropTask.maize.harvest', priority: 'high', icon: '\uD83E\uDDFA' },
      { type: 'sort_harvest', titleKey: 'cropTask.maize.sortHarvest', priority: 'medium', icon: '\uD83D\uDCE6' },
      { type: 'protect_harvest_from_rain', titleKey: 'cropTask.maize.protectFromRain', priority: 'medium', icon: '\u2602\uFE0F' },
    ],
    post_harvest: [
      { type: 'dry_harvest', titleKey: 'cropTask.maize.dryHarvest', priority: 'high', icon: '\u2600\uFE0F' },
      { type: 'store_harvest', titleKey: 'cropTask.maize.storeHarvest', priority: 'high', icon: '\uD83D\uDCE6' },
      { type: 'log_harvest', titleKey: 'cropTask.maize.logHarvest', priority: 'medium', icon: '\uD83D\uDCDD' },
      { type: 'prepare_for_sale', titleKey: 'cropTask.maize.prepareForSale', priority: 'low', icon: '\uD83D\uDCB0' },
    ],
  },
  TOMATO: {
    planting: [
      { type: 'plant_seeds', titleKey: 'cropTask.plantSeeds', priority: 'high', icon: '\uD83C\uDF31' },
      { type: 'water_after_planting', titleKey: 'cropTask.waterAfterPlanting', priority: 'high', icon: '\uD83D\uDCA7' },
      { type: 'set_up_stakes', titleKey: 'cropTask.setUpStakes', priority: 'medium', icon: '\uD83E\uDEB5' },
    ],
    vegetative: [
      { type: 'apply_fertilizer', titleKey: 'cropTask.applyFertilizer', priority: 'high', icon: '\uD83E\uDDEA' },
      { type: 'check_pests', titleKey: 'cropTask.checkPests', priority: 'high', icon: '\uD83D\uDC1B' },
      { type: 'spray_crop', titleKey: 'cropTask.sprayCrop', priority: 'medium', icon: '\uD83D\uDEE1\uFE0F' },
      { type: 'weed_field', titleKey: 'cropTask.weedField', priority: 'medium', icon: '\uD83C\uDF3E' },
      { type: 'monitor_water', titleKey: 'cropTask.monitorWater', priority: 'medium', icon: '\uD83D\uDCA7' },
    ],
  },
  RICE: {
    planting: [
      { type: 'plant_seeds', titleKey: 'cropTask.plantSeeds', priority: 'high', icon: '\uD83C\uDF31' },
      { type: 'flood_field', titleKey: 'cropTask.floodField', priority: 'high', icon: '\uD83D\uDCA7' },
    ],
  },
  CASSAVA: {
    planting: [
      { type: 'plant_cuttings', titleKey: 'cropTask.plantCuttings', priority: 'high', icon: '\uD83C\uDF31' },
      { type: 'water_after_planting', titleKey: 'cropTask.waterAfterPlanting', priority: 'medium', icon: '\uD83D\uDCA7' },
    ],
  },
  COFFEE: {
    planting: [
      { type: 'plant_seedlings', titleKey: 'cropTask.plantSeedlings', priority: 'high', icon: '\uD83C\uDF31' },
      { type: 'set_up_shade', titleKey: 'cropTask.setUpShade', priority: 'high', icon: '\uD83C\uDF33' },
      { type: 'water_after_planting', titleKey: 'cropTask.waterAfterPlanting', priority: 'medium', icon: '\uD83D\uDCA7' },
    ],
  },
};

// ─── Stage alias map ─────────────────────────────────────
// cropProfiles.js uses farmer-friendly display names (land_prep,
// early_growth, maintenance) for the summary screen. The decision
// engine stores the storage-form names (land_preparation, vegetative).
// If a display-form slips in (legacy profiles, offline-queued writes),
// resolve it to the storage form so task lookup never dead-ends.
const STAGE_ALIASES = {
  land_prep: 'land_preparation',
  early_growth: 'germination',
  maintenance: 'vegetative',
  maintain: 'vegetative',
  grow: 'vegetative',
  plant: 'planting',
  prepare: 'land_preparation',
};

function canonicalStage(stage) {
  if (!stage) return 'planning';
  return STAGE_ALIASES[stage] || stage;
}

/**
 * Get the task list for a given crop + stage.
 *
 * Returns crop-specific tasks if available, otherwise falls back to
 * the generic stage tasks. Always returns a new array (safe to mutate).
 *
 * @param {string} cropCode - Crop code (e.g. 'MAIZE')
 * @param {string} stage - Crop stage (e.g. 'planting', 'land_prep', 'maintain')
 * @returns {Array<{type: string, titleKey: string, priority: string, icon: string}>}
 */
export function getTasksForCropStage(cropCode, stage) {
  const code = cropCode?.toUpperCase();
  const resolved = canonicalStage(stage);
  const overrides = CROP_OVERRIDES[code];

  // Use crop-specific override if it exists for this stage
  if (overrides && overrides[resolved]) {
    return [...overrides[resolved]];
  }

  // Generic stage tasks
  return [...(STAGE_TASKS[resolved] || STAGE_TASKS.planning)];
}

/**
 * Get the single highest-priority initial task for starting a crop.
 * Used by the start-plan handoff to seed the first task immediately.
 *
 * @param {string} cropCode
 * @param {string} stage - Starting stage (usually 'land_preparation')
 * @returns {{type: string, titleKey: string, priority: string, icon: string}}
 */
export function getInitialTask(cropCode, stage) {
  const tasks = getTasksForCropStage(cropCode, stage || 'land_preparation');
  return tasks[0] || STAGE_TASKS.planning[0];
}

/**
 * Canonicalize any crop-stage value (display form → storage form).
 * Exposed so other engines (notifications, autopilot) can normalise
 * stored/display stage names without duplicating the alias table.
 */
export function resolveStage(stage) {
  return canonicalStage(stage);
}

/**
 * Context-aware task list: crop override + region modifier + experience
 * presentation. Returns the same shape as getTasksForCropStage() with
 * region-flavoured titleKey substitutions applied.
 *
 * The base engine still owns priority, order, and icons. Region only
 * reaches in to swap the localized title when it has a specific hint —
 * otherwise the base title survives.
 *
 * @param {Object} params
 * @param {string} params.crop              Crop code (e.g. 'MAIZE')
 * @param {string} params.stage             Storage or display stage name
 * @param {Object|string} [params.region]   Region profile or id
 * @param {string} [params.experience]      'none'|'some'|'experienced'
 * @returns {Array} tasks
 */
export function getContextAwareTaskList({ crop, stage, region, experience }) {
  const base = getTasksForCropStage(crop, stage);

  // Region override — swap titleKey when the profile has a specific hint
  let regionHints = null;
  if (region) {
    const profile = typeof region === 'string' ? REGION_PROFILES[region] : region;
    if (profile) regionHints = (type) => getRegionTaskHint(profile, type);
  }

  const withRegion = base.map((task) => {
    if (!regionHints) return task;
    const hinted = regionHints(task.type);
    return hinted ? { ...task, titleKey: hinted, regionHinted: true } : task;
  });

  // Dev assertion: flag empty mapping so a missing crop stage never
  // silently falls through to the planning default.
  const isDev = typeof import.meta !== 'undefined' ? import.meta.env?.DEV
    : typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  if (isDev && crop && stage && withRegion.length === 0) {
    console.warn(`[cropTaskMap] No tasks mapped for crop="${crop}" stage="${stage}"`);
  }

  // Experience currently affects only UI presentation (handled by view
  // model / TaskCard variants); we pass it through so callers can
  // trim description length if needed.
  if (experience) {
    return withRegion.map(t => ({ ...t, experience }));
  }
  return withRegion;
}

/**
 * Context-aware first task after crop start — same precedence as
 * getInitialTask but consults the region profile so the phrasing
 * the farmer sees on Home matches where they farm.
 */
export function getContextAwareInitialTask({ crop, stage, region, experience }) {
  const list = getContextAwareTaskList({ crop, stage: stage || 'land_preparation', region, experience });
  return list[0] || STAGE_TASKS.planning[0];
}

/**
 * Get all stages and their task counts (for summary/preview).
 *
 * @param {string} cropCode
 * @returns {Array<{stage: string, taskCount: number}>}
 */
export function getStageSummary(cropCode) {
  const stages = Object.keys(STAGE_TASKS);
  return stages.map((stage) => ({
    stage,
    taskCount: getTasksForCropStage(cropCode, stage).length,
  }));
}
