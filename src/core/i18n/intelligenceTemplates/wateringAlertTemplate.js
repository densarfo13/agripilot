/**
 * wateringAlertTemplate.js — watering-alert envelope.
 */

function _slot(s) {
  const v = String(s || 'now').toLowerCase();
  return ['now', 'morning', 'evening', 'today', 'tomorrow'].includes(v) ? v : 'now';
}

export function wateringAlertTemplate(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const slot = _slot(c.bestTime);
    const crop = c.crop ? String(c.crop) : '';
    const FALLBACK = {
      now:      'Water your {crop} now — soil looks dry.',
      morning:  'Water your {crop} in the morning — cooler hours work best.',
      evening:  'Water your {crop} this evening to reduce evaporation.',
      today:    'Water your {crop} today.',
      tomorrow: 'Water your {crop} tomorrow if no rain.',
    };
    return {
      key: 'intelligence.watering.' + slot,
      fallback: FALLBACK[slot],
      params: { crop, bestTime: slot },
    };
  } catch {
    return {
      key: 'intelligence.watering.now',
      fallback: 'Water your crop today if soil is dry.',
      params: {},
    };
  }
}

const _module = { wateringAlertTemplate };
export default _module;
