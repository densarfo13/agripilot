/**
 * weatherTaskEngine.js — translates a weather snapshot into a single
 * actionable Today Task object.
 *
 *   import { getWeatherTask } from './lib/weatherTaskEngine.js';
 *
 *   const task = getWeatherTask(weather);
 *   // → { title: string, reason: string, cta: string }
 *
 * Decision ladder (first match wins)
 *   1. weather missing or unavailable → soil moisture check (safe default)
 *   2. rainChance ≥ 60               → drainage check
 *   3. temp ≥ 32                     → water early/late
 *   4. windSpeed ≥ 25                → support weak plants
 *   5. rainChance ≤ 20               → soil moisture check
 *   6. mild / unknown                → general crop inspect
 *
 * Strict-rule audit
 *   • Pure function. No imports. Never throws.
 *   • Null / undefined / non-object input handled in branch 1.
 *   • All fields in the returned object are always present strings.
 *   • Safe to call before weather has loaded (returns branch 1).
 */

const FALLBACK_TASK = Object.freeze({
  title:  'Check soil moisture around your crop',
  reason: 'Water only if soil feels dry.',
  cta:    'Mark as done',
});

/**
 * getWeatherTask — derives one task from a weather snapshot.
 *
 * @param {object|null|undefined} weather
 *   Expected shape (all optional — missing fields fall through
 *   to safe defaults):
 *     condition  {string}           – e.g. 'Sunny', 'Weather unavailable'
 *     rainChance {number|null}      – 0–100 percent
 *     temp       {number|null}      – Celsius
 *     windSpeed  {number|null}      – km/h
 *
 * @returns {{ title: string, reason: string, cta: string }}
 *   Always fully-populated. Never null.
 */
export function getWeatherTask(weather) {
  // Branch 1 — no weather or explicitly unavailable
  if (!weather
      || typeof weather !== 'object'
      || Array.isArray(weather)
      || weather.condition === 'Weather unavailable') {
    return FALLBACK_TASK;
  }

  const rain = weather.rainChance ?? 0;
  const temp = weather.temp       ?? 25;
  const wind = weather.windSpeed  ?? 0;

  // Branch 2 — heavy rain expected
  if (rain >= 60) {
    return Object.freeze({
      title:  'Check drainage around your crop',
      reason: 'Heavy rain expected. Ensure water doesn\u2019t pool.',
      cta:    'Mark as done',
    });
  }

  // Branch 3 — high heat
  if (temp >= 32) {
    return Object.freeze({
      title:  'Water crops early morning or late evening',
      reason: 'High heat can stress plants during midday.',
      cta:    'Mark as done',
    });
  }

  // Branch 4 — strong wind
  if (wind >= 25) {
    return Object.freeze({
      title:  'Support weak plants',
      reason: 'Strong winds can damage crops.',
      cta:    'Mark as done',
    });
  }

  // Branch 5 — dry conditions
  if (rain <= 20) {
    return Object.freeze({
      title:  'Check soil moisture',
      reason: 'Dry conditions may require watering.',
      cta:    'Mark as done',
    });
  }

  // Branch 6 — mild / unknown
  return Object.freeze({
    title:  'Inspect your crops',
    reason: 'Regular checks help catch issues early.',
    cta:    'Mark as done',
  });
}

// ─── Test hook ───────────────────────────────────────────────────
export const _internal = Object.freeze({ FALLBACK_TASK });

export default getWeatherTask;
