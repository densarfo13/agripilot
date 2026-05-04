/**
 * getTodayTask({ crop, weather, location }) — pure helper that
 * returns a safe today's-task object regardless of what data is
 * missing.
 *
 *   import { getTodayTask } from '../lib/getTodayTask.js';
 *
 *   const task = getTodayTask({ crop, weather, location });
 *   // task is ALWAYS:
 *   //   { title: string, description: string,
 *   //     reason?: string, cta: string }
 *
 * Why this exists
 * ───────────────
 * Pilot users were hitting render crashes when the richer task
 * engine touched `weather.temp` / `crop.name` / `location.country`
 * without optional chaining. This helper is the safe baseline
 * every Home / Today surface can call. It NEVER reaches into a
 * sub-property without a falsy check; it NEVER throws.
 *
 * Decision tree
 *   1. Missing crop OR location → "Set up your farm"
 *      The user can't get a useful task without at least one of
 *      these, so we surface a setup prompt (NOT a redirect).
 *   2. Missing weather (but crop + location present) → static
 *      "Check soil moisture" task that's safe regardless of
 *      what's actually growing.
 *   3. Everything present → context-aware task with the crop
 *      name interpolated into the title. (The richer engine
 *      can replace this branch later; for the pilot we ship the
 *      same low-risk soil-moisture task.)
 *
 * Strict-rule audit
 *   • Pure function — no I/O, no React, no localStorage reads.
 *   • Synchronous; never throws.
 *   • Every output field is a non-empty string. Callers can
 *     render `task.title` / `task.description` / `task.cta`
 *     unconditionally.
 *   • Inputs are optional. `getTodayTask()` (no args) returns
 *     the setup-prompt task — same contract as missing-data.
 */

const SETUP_TASK = Object.freeze({
  title:       'Set up your farm',
  description: 'Add crop and location to unlock smart tasks',
  reason:      'A crop and location let us tailor watering, '
             + 'planting and harvest tips to your conditions.',
  cta:         'Continue setup',
});

const NO_WEATHER_TASK = Object.freeze({
  title:       'Check soil moisture',
  description: 'Water only if soil feels dry',
  reason:      'A quick finger-deep check beats a fixed schedule '
             + 'when forecast data is missing.',
  cta:         'Mark as done',
});

function _trimOrNull(s) {
  if (typeof s !== 'string') return null;
  const v = s.trim();
  return v.length > 0 ? v : null;
}

function _resolveCropName(crop) {
  if (!crop) return null;
  if (typeof crop === 'string') return _trimOrNull(crop);
  if (typeof crop === 'object') {
    return _trimOrNull(crop.name)
        || _trimOrNull(crop.cropName)
        || _trimOrNull(crop.label)
        || _trimOrNull(crop.cropType)
        || null;
  }
  return null;
}

function _resolveLocationLabel(location) {
  if (!location) return null;
  if (typeof location === 'string') return _trimOrNull(location);
  if (typeof location === 'object') {
    return _trimOrNull(location.locationName)
        || _trimOrNull(location.location)
        || _trimOrNull(location.region)
        || _trimOrNull(location.country)
        || null;
  }
  return null;
}

function _hasWeather(weather) {
  if (!weather) return false;
  if (typeof weather !== 'object') return false;
  // Defensive optional-chained reads — never throws even if a
  // caller passes a Proxy with a getter that explodes.
  try {
    const condition = _trimOrNull(weather && weather.condition)
                   || _trimOrNull(weather && weather.summary)
                   || _trimOrNull(weather && weather.description);
    const temp = (weather && typeof weather.temp === 'number') ? weather.temp
              : (weather && typeof weather.temperature === 'number') ? weather.temperature
              : null;
    return !!condition || temp != null;
  } catch { return false; }
}

/**
 * @param {object} [params]
 * @param {*} [params.crop]      crop name string or object with .name
 * @param {*} [params.weather]   weather object with .condition / .temp
 * @param {*} [params.location]  location string or object with .country
 * @returns {{title:string, description:string, reason?:string, cta:string}}
 */
export function getTodayTask(params) {
  let crop, weather, location;
  try {
    if (params && typeof params === 'object') {
      crop     = params.crop;
      weather  = params.weather;
      location = params.location;
    }
  } catch { /* params was a non-object proxy — fall through */ }

  const cropName     = _resolveCropName(crop);
  const locationName = _resolveLocationLabel(location);

  // Spec: "if (!crop || !location) → Set up your farm"
  if (!cropName || !locationName) {
    return { ...SETUP_TASK };
  }

  // Spec: "if (!weather) → Check soil moisture"
  if (!_hasWeather(weather)) {
    return { ...NO_WEATHER_TASK };
  }

  // Both crop + location + weather present — context-aware task.
  // Pilot scope: we still ship the soil-moisture task (lowest
  // risk advice). Engine refinement happens once the missing-
  // data crash class is closed.
  return {
    title:       'Check soil moisture around your ' + cropName,
    description: 'Water only if soil feels dry',
    reason:      'Conditions in ' + locationName
               + ' can change quickly — a finger-deep check beats '
               + 'a fixed schedule.',
    cta:         'Mark as done',
  };
}

// Test hooks.
export const _internal = Object.freeze({
  SETUP_TASK,
  NO_WEATHER_TASK,
  _resolveCropName,
  _resolveLocationLabel,
  _hasWeather,
});

export default getTodayTask;
