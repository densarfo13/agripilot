/**
 * applyWeatherAdjustments — thin rule layer on top of an already-built
 * task view model. Runs AFTER the localization pipeline and BEFORE
 * final render.
 *
 * Spec §1: three lightweight rules only, no heavy analytics.
 *   1. planting + rainExpected24h=true     → "Plant your crop now" / rain coming
 *   2. planting + rainExpected24h=false
 *       AND soilDryProxy=true              → "Wait before planting" / soil dry
 *   3. water task + tempHighC >= 32         → "Water your crop today" / heat high
 *
 * Pure function. Returns a new task; never mutates. Callers pipe the
 * result straight into the renderer.
 */

const HEAT_THRESHOLD_C = 32;

function isPlantingType(task) {
  if (!task) return false;
  const t = (task.type || '').toLowerCase();
  return t === 'plant_seeds' || t === 'plant' || t.startsWith('plant');
}

function isWaterType(task) {
  if (!task) return false;
  const t = (task.type || '').toLowerCase();
  return t === 'water_crop' || t === 'water' || t === 'water_plants' || t === 'monitor_water' || t === 'water_after_planting' || t.startsWith('water');
}

function isValidWeather(w) {
  return !!w && typeof w === 'object';
}

/**
 * @param {Object} task       view-model-shaped task (titleKey, whyKey, …)
 * @param {Object} weather    { rainExpected24h, tempHighC, soilDryProxy, fetchedAt }
 * @returns {Object}          new task with weatherAdjusted:true when a rule fires
 */
export function applyWeatherAdjustments(task, weather) {
  if (!task || !isValidWeather(weather)) return task;

  const { rainExpected24h, tempHighC, soilDryProxy } = weather;

  // Rule 1 & 2 — planting tasks
  if (isPlantingType(task)) {
    if (rainExpected24h === true) {
      return {
        ...task,
        titleKey: 'weatherAdj.plant.rainSoon.title',
        whyKey: 'weatherAdj.plant.rainSoon.why',
        urgency: 'today',
        weatherAdjusted: 'plant_rain_soon',
      };
    }
    if (rainExpected24h === false && soilDryProxy === true) {
      return {
        ...task,
        titleKey: 'weatherAdj.plant.waitDry.title',
        whyKey: 'weatherAdj.plant.waitDry.why',
        urgency: 'this_week',
        weatherAdjusted: 'plant_wait_dry',
      };
    }
  }

  // Rule 3 — watering tasks under heat stress
  if (isWaterType(task) && Number(tempHighC) >= HEAT_THRESHOLD_C) {
    return {
      ...task,
      titleKey: 'weatherAdj.water.heat.title',
      whyKey: 'weatherAdj.water.heat.why',
      urgency: 'today',
      weatherAdjusted: 'water_heat',
    };
  }

  return task;
}

export const _internal = { HEAT_THRESHOLD_C, isPlantingType, isWaterType };
