/**
 * adjustTasksForWeather — given a list of pending tasks + the
 * weather-risk payload, return a new task list where each task has
 * its priorityScore, priority (low/medium/high), and "why" detail
 * adjusted to reflect today's weather.
 *
 *   rain expected    → watering tasks deprioritized, harvest urgency
 *                      bumped, planting-out tasks paused
 *   hot + dry        → watering priority bumped, heat-stress tasks
 *                      surface
 *   high humidity    → pest scouting priority bumped
 *   high wind        → spraying + staking tasks flagged
 *
 * Always returns a new array — never mutates the input. Tasks it
 * can't classify pass through unchanged.
 */

const WATERING = /water|irrig|drip|soak/i;
const PLANTING = /plant|transplant|sow|seedling/i;
const HARVEST = /harvest|pick|gather|dig/i;
const PEST = /pest|scout|inspect|leaf|disease|blight/i;
const SPRAY = /spray|fungicide|herbicide/i;
const STAKE = /stake|tie|trellis|train/i;

const BOOST_HIGH = 25;
const BOOST_MED = 12;
const DAMPEN = 12;

function clonePriorityBump(task, delta, whyAppend) {
  const next = { ...task };
  if (Number.isFinite(task.priorityScore)) {
    next.priorityScore = Math.max(0, Math.min(100, task.priorityScore + delta));
  }
  // Nudge the priority band too so Today ranking picks the change up.
  const current = String(task.priority || 'medium').toLowerCase();
  if (delta >= BOOST_MED && current !== 'high') next.priority = 'high';
  if (delta <= -BOOST_MED && current === 'high') next.priority = 'medium';
  if (delta <= -BOOST_HIGH && current === 'medium') next.priority = 'low';
  if (whyAppend) {
    const detail = task.detail ? `${task.detail} ${whyAppend}` : whyAppend;
    next.detail = detail;
    next.weatherContext = whyAppend;
  }
  return next;
}

/**
 * @param {Array}  tasks   pending task rows (with title/priority/priorityScore)
 * @param {Object} risks   output of getWeatherRisk
 * @param {Object} [opts]  reserved for future (e.g. currentMonth)
 * @returns {Array}        new task list
 */
export function adjustTasksForWeather(tasks, risks, _opts = {}) {
  if (!Array.isArray(tasks) || !risks) return tasks || [];

  const heatHigh   = risks.heatRisk === 'high';
  const heatMed    = risks.heatRisk === 'medium';
  const rainHigh   = risks.rainRisk === 'high';
  const rainMed    = risks.rainRisk === 'medium';
  const frostHigh  = risks.frostRisk === 'high';
  const humidHigh  = risks.humidityPestRisk === 'high';
  const windHigh   = risks.windRisk === 'high';

  return tasks.map((task) => {
    const title = String(task.title || '');

    // Watering — deprioritized after rain, bumped in heat
    if (WATERING.test(title)) {
      if (rainHigh) return clonePriorityBump(task, -BOOST_HIGH, 'Skip — heavy rain expected today.');
      if (rainMed)  return clonePriorityBump(task, -DAMPEN,     'You can skip — rain is likely.');
      if (heatHigh) return clonePriorityBump(task,  BOOST_HIGH, 'Heat is high — deep-water early.');
      if (heatMed)  return clonePriorityBump(task,  BOOST_MED,  'Warm day — water earlier than usual.');
    }

    // Planting — delayed when heavy rain coming
    if (PLANTING.test(title)) {
      if (rainHigh) return clonePriorityBump(task, -BOOST_HIGH, 'Hold off — heavy rain could wash out new plantings.');
      if (frostHigh) return clonePriorityBump(task, -BOOST_HIGH, 'Cold snap expected — delay planting.');
    }

    // Harvest — accelerate before damaging rain
    if (HARVEST.test(title)) {
      if (rainHigh) return clonePriorityBump(task,  BOOST_HIGH, 'Pick before rain — keeps the crop safe.');
      if (rainMed)  return clonePriorityBump(task,  BOOST_MED,  'Rain coming — finish picking today.');
    }

    // Pest / disease — humidity bump
    if (PEST.test(title)) {
      if (humidHigh) return clonePriorityBump(task, BOOST_MED, 'Humidity is high — check for disease today.');
    }

    // Spraying + staking — wind
    if (SPRAY.test(title) && windHigh) {
      return clonePriorityBump(task, -BOOST_HIGH, 'Too windy to spray — try tomorrow.');
    }
    if (STAKE.test(title) && windHigh) {
      return clonePriorityBump(task, BOOST_MED, 'Wind is high — stake or tie tall plants.');
    }

    return task;
  });
}

export const _internal = {
  WATERING, PLANTING, HARVEST, PEST, SPRAY, STAKE,
  BOOST_HIGH, BOOST_MED, DAMPEN,
};
