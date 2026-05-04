/**
 * weatherActionEngine.js — full weather → action envelope.
 *
 *   import { getWeatherAction } from './lib/weatherActionEngine.js';
 *
 *   const a = getWeatherAction({ rainChance: 70, temp: 27 });
 *   // → { type, icon, insight, action, taskTitle, reason,
 *   //     urgency, cta }
 *
 * Why this is distinct from the simpler src/lib/weatherAction.js
 *   The earlier file returns just { insight, action } — enough
 *   for a status pill. This engine returns the full task
 *   envelope (taskTitle / reason / urgency / cta / icon / type),
 *   so the new Home WeatherHeroCard + the smart task engine can
 *   both render off the SAME envelope without duplicating the
 *   weather-rule mapping.
 *
 * Spec mapping ladder (first match wins)
 *   1. rainChance ≥ 60 OR condition contains "rain" → rain
 *   2. temp ≥ 32                                     → heat
 *   3. wind ≥ 25 OR condition contains "wind"        → wind
 *   4. rainChance ≤ 20                               → dry
 *   5. otherwise                                     → normal
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Bad / null / non-object input falls through to the
 *     "normal" branch.
 *   • All output strings are user-friendly + low-literacy.
 */

const NORMAL = Object.freeze({
  type:      'normal',
  icon:      '\uD83C\uDF3F',  // 🌿
  insight:   'Good growing conditions',
  action:    'Follow today\u2019s crop task',
  taskTitle: 'Inspect your crop for early stress signs',
  reason:    'A quick daily check helps catch pests, dry soil, or yellow leaves early.',
  urgency:   'low',
  cta:       'Mark as done',
});

export function getWeatherAction(weather) {
  const w = (weather && typeof weather === 'object' && !Array.isArray(weather))
    ? weather : {};

  const temp       = Number(w.temp ?? NaN);
  const rainChance = Number(w.rainChance ?? NaN);
  const wind       = Number(w.windSpeed ?? w.wind ?? NaN);
  const condition  = String(w.condition || '').toLowerCase();

  if ((Number.isFinite(rainChance) && rainChance >= 60)
      || condition.includes('rain')) {
    return Object.freeze({
      type:      'rain',
      icon:      '\uD83C\uDF27\uFE0F',  // 🌧️
      insight:   'Rain expected later today',
      action:    'Check drainage and avoid watering',
      taskTitle: 'Check drainage around your crop',
      reason:    'Rain can cause water to sit around the roots. Good drainage helps protect your plants.',
      urgency:   'medium',
      cta:       'Mark as done',
    });
  }

  if (Number.isFinite(temp) && temp >= 32) {
    return Object.freeze({
      type:      'heat',
      icon:      '\u2600\uFE0F',  // ☀️
      insight:   'High heat today',
      action:    'Water early or late',
      taskTitle: 'Water only during cooler hours',
      reason:    'Hot weather can dry soil quickly. Avoid watering in the hottest part of the day.',
      urgency:   'high',
      cta:       'Mark as done',
    });
  }

  if ((Number.isFinite(wind) && wind >= 25)
      || condition.includes('wind')) {
    return Object.freeze({
      type:      'wind',
      icon:      '\uD83D\uDCA8',  // 💨
      insight:   'Strong wind expected',
      action:    'Support weak plants',
      taskTitle: 'Check if your plants need support',
      reason:    'Wind can bend young plants or damage weak stems.',
      urgency:   'medium',
      cta:       'Mark as done',
    });
  }

  if (Number.isFinite(rainChance) && rainChance <= 20) {
    return Object.freeze({
      type:      'dry',
      icon:      '\uD83C\uDF24\uFE0F',  // 🌤️
      insight:   'Dry conditions today',
      action:    'Check soil moisture',
      taskTitle: 'Check soil moisture around your crop',
      reason:    'Dry conditions can stress plants. Water only if the soil feels dry.',
      urgency:   'medium',
      cta:       'Mark as done',
    });
  }

  return NORMAL;
}

export const _internal = Object.freeze({ NORMAL });

export default getWeatherAction;
