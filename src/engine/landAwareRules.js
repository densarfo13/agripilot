/**
 * landAwareRules — pure function that turns a LandProfile plus
 * (cropStage, weather) into one recommended land-first task, or null.
 *
 * Rules are evaluated top-down, first match wins. Kept deliberately
 * small so the farmer sees one action; if none apply, the normal
 * crop task engine keeps the stage.
 *
 * Rules (spec §6):
 *   A. prepare + not cleared                        → clear_land
 *   B. prepare + weeds present                      → remove_weeds
 *   C. prepare + soil wet                           → wait_before_tilling
 *   D. prepare + drainage poor + rainExpected24h    → prepare_drainage
 *   E. plant stage + soil dry + no rain expected    → wait_before_planting
 *
 * Every output carries the full task-card shape so the UI can render
 * it through the existing TaskCard / CompletionCard pipeline.
 */

import { SOIL_MOISTURE, DRAINAGE } from '../services/landProfile.js';

const PREPARE_STAGES = new Set(['prepare', 'land_preparation']);
const PLANTING_STAGES = new Set(['plant', 'planting']);

function isStage(stage, bag) {
  return bag.has((stage || '').toLowerCase());
}

function fallback(type, { titleKey, whyKey, stepsKey, tipKey, priority = 'high', urgency = 'today', icon = '\uD83C\uDF31' }) {
  return { type, titleKey, whyKey, stepsKey, tipKey, priority, urgency, icon, source: 'land_check' };
}

/**
 * @param {Object} args
 * @param {Object} args.land      LandProfile (or null)
 * @param {string} args.cropStage canonical or short stage
 * @param {Object} [args.weather] { rainExpected24h }
 * @returns {Object|null}
 */
export function resolveLandTask({ land, cropStage, weather } = {}) {
  if (!land) return null;

  // A. Not cleared yet — clear takes priority over every other prepare-stage action.
  if (isStage(cropStage, PREPARE_STAGES) && land.cleared === false) {
    return fallback('clear_land', {
      titleKey: 'land.task.clearLand.title',
      whyKey: 'land.task.clearLand.why',
      stepsKey: 'land.task.clearLand.steps',
      tipKey: 'land.task.clearLand.tip',
      priority: 'high',
      urgency: 'this_week',
      icon: '\uD83E\uDE93',
    });
  }

  // B. Weeds present on an otherwise-cleared field.
  if (isStage(cropStage, PREPARE_STAGES) && land.weedsPresent === true && land.cleared !== false) {
    return fallback('remove_weeds', {
      titleKey: 'land.task.removeWeeds.title',
      whyKey: 'land.task.removeWeeds.why',
      stepsKey: 'land.task.removeWeeds.steps',
      tipKey: 'land.task.removeWeeds.tip',
      priority: 'high',
      urgency: 'today',
      icon: '\uD83C\uDF3E',
    });
  }

  // C. Wet soil — wait before working the field.
  if (isStage(cropStage, PREPARE_STAGES) && land.soilMoistureState === SOIL_MOISTURE.WET) {
    return fallback('wait_before_tilling', {
      titleKey: 'land.task.waitTilling.title',
      whyKey: 'land.task.waitTilling.why',
      stepsKey: 'land.task.waitTilling.steps',
      tipKey: 'land.task.waitTilling.tip',
      priority: 'medium',
      urgency: 'this_week',
      icon: '\uD83D\uDCA7',
    });
  }

  // D. Poor drainage + rain coming — prepare drainage first.
  if (isStage(cropStage, PREPARE_STAGES)
      && land.drainage === DRAINAGE.POOR
      && weather?.rainExpected24h === true) {
    return fallback('prepare_drainage', {
      titleKey: 'land.task.prepareDrainage.title',
      whyKey: 'land.task.prepareDrainage.why',
      stepsKey: 'land.task.prepareDrainage.steps',
      tipKey: 'land.task.prepareDrainage.tip',
      priority: 'high',
      urgency: 'today',
      icon: '\uD83C\uDF27\uFE0F',
    });
  }

  // E. Planting stage, dry soil, no rain coming — hold off.
  if (isStage(cropStage, PLANTING_STAGES)
      && land.soilMoistureState === SOIL_MOISTURE.DRY
      && weather?.rainExpected24h === false) {
    return fallback('wait_before_planting', {
      titleKey: 'land.task.waitPlanting.title',
      whyKey: 'land.task.waitPlanting.why',
      stepsKey: 'land.task.waitPlanting.steps',
      tipKey: 'land.task.waitPlanting.tip',
      priority: 'medium',
      urgency: 'this_week',
      icon: '\uD83C\uDF31',
    });
  }

  return null;
}

export const _internal = { PREPARE_STAGES, PLANTING_STAGES };
