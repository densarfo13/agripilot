/**
 * Autopilot text key resolution — maps rule outputs to translation keys.
 *
 * Keeps all key mapping in one place so components never guess.
 */

/**
 * Map nextTaskType from rules to a `next.*` translation key.
 */
const NEXT_TASK_KEYS = {
  sort_clean: 'next.sortClean',
  dry_when_safe: 'next.dryWhenSafe',
  dry_harvest: 'next.dryHarvest',
  check_crop: 'next.checkCrop',
  update_pest_status: 'next.updatePestStatus',
  water_crop: 'next.waterCrop',
  plant_crop: 'next.plantCrop',
  store_harvest: 'next.storeHarvest',
};

/**
 * Map rule ID prefix to a `success.*` translation key.
 */
const SUCCESS_KEYS = {
  post_harvest_drying: 'success.drying',
  rain_protect_harvest: 'success.rain',
  rain_blocks_drying: 'success.rain',
  dry_stress_watering: 'success.water',
  watering_general: 'success.water',
  pest_check_urgent: 'success.pest',
  pest_check_routine: 'success.pest',
  spraying_windy: 'success.spray',
  spraying_general: 'success.spray',
  weeding: 'success.weed',
  fertilizing: 'success.fertilize',
  harvest_rain_coming: 'success.harvest',
  harvest_general: 'success.harvest',
  planting: 'success.plant',
  land_prep: 'success.landPrep',
  sort_clean: 'success.sort',
  storage: 'success.store',
};

/**
 * Get the translation key for the "next step" line.
 * @param {string|null} nextTaskType - From rule result
 * @returns {string|null} Translation key or null
 */
export function getNextTextKey(nextTaskType) {
  if (!nextTaskType) return null;
  return NEXT_TASK_KEYS[nextTaskType] || null;
}

/**
 * Get the translation key for the success line after completion.
 * @param {string|null} ruleId - From autopilot enrichment
 * @returns {string} Translation key
 */
export function getSuccessTextKey(ruleId) {
  if (!ruleId) return 'success.general';
  return SUCCESS_KEYS[ruleId] || 'success.general';
}
