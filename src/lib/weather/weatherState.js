/**
 * weatherState.js — normalised rainfall state layer.
 *
 * The rest of the intelligence stack speaks a five-value vocabulary:
 *   'dry' | 'light_rain' | 'moderate_rain' | 'heavy_rain' | 'unknown'
 *
 * This module is the single chokepoint for turning whatever weather
 * shape the app happens to have (OpenWeather payload, farm profile
 * field, manual override, offline cache) into that vocabulary. Every
 * consumer — recommendation engine, task engine, risk engine — calls
 * getWeatherState and branches on the result.
 *
 * Why not pass raw mm around? Because four different modules would
 * otherwise each invent their own threshold. One chokepoint = one
 * place to tune.
 *
 * Thresholds (3-day rainfall total unless the caller supplies a
 * different window):
 *   dry            : 0 mm ≤ rain <  2 mm
 *   light_rain     : 2 mm ≤ rain < 10 mm
 *   moderate_rain  : 10 mm ≤ rain < 35 mm
 *   heavy_rain     : 35 mm ≤ rain
 *
 * Thresholds are intentionally conservative and round — the engines
 * that consume this state only need three bands to make sensible
 * recommendations. Regional tuning can come later.
 */

const f = Object.freeze;

export const WEATHER_STATES = f([
  'dry', 'light_rain', 'moderate_rain', 'heavy_rain', 'unknown',
]);

const WEATHER_STATE_SET = new Set(WEATHER_STATES);

// ─── Pattern aliases — map legacy strings into the canonical set ──
// The v1 seasonal engine used richer labels (dry_conditions,
// heat_stress, cool_conditions) that mixed rainfall + temperature.
// Here we collapse those onto pure rainfall states — callers that
// care about temperature (e.g. heat-sensitive crops) should pass a
// separate `temp` field, not an encoded pattern.
const PATTERN_ALIASES = f({
  dry:               'dry',
  dry_conditions:    'dry',
  light:             'light_rain',
  light_rain:        'light_rain',
  moderate:          'moderate_rain',
  moderate_rain:     'moderate_rain',
  heavy:             'heavy_rain',
  heavy_rain:        'heavy_rain',
  high_rain:         'heavy_rain',
  flood:             'heavy_rain',
  heat_stress:       'dry',     // heat+no rain collapses to dry for rainfall purposes
  cool_conditions:   'unknown',  // pure temperature signal — no rainfall information
});

/**
 * getWeatherState(weatherData)
 *   Accepts any of:
 *     - null / undefined                       → 'unknown'
 *     - { state }       in canonical set       → passthrough
 *     - { pattern }     alias-mapped           → canonical
 *     - { rainMm } / { rain3d } / { precipitation }  → threshold bucket
 *     - { tempC, rain3d? }                     → heat_stress fallback
 *     - { forecast: [{ rainMm, ... }] }        → sums over forecast window
 *   Returns one of WEATHER_STATES. Never throws.
 *
 *   Options:
 *     { windowDays = 3 }  — scales thresholds linearly when a different
 *                           window is implied (e.g. daily totals).
 */
export function getWeatherState(weatherData, { windowDays = 3 } = {}) {
  if (weatherData == null) return 'unknown';
  if (typeof weatherData === 'string') {
    const aliased = PATTERN_ALIASES[weatherData.toLowerCase()];
    return aliased || (WEATHER_STATE_SET.has(weatherData) ? weatherData : 'unknown');
  }
  if (typeof weatherData !== 'object') return 'unknown';

  // Explicit canonical state.
  if (weatherData.state && WEATHER_STATE_SET.has(weatherData.state)) {
    return weatherData.state;
  }

  // Legacy `pattern` string.
  if (typeof weatherData.pattern === 'string') {
    const aliased = PATTERN_ALIASES[weatherData.pattern.toLowerCase()];
    if (aliased) return aliased;
    if (WEATHER_STATE_SET.has(weatherData.pattern)) return weatherData.pattern;
  }

  // Raw rainfall in mm. Sum a forecast array when supplied.
  let rain = null;
  if (Array.isArray(weatherData.forecast) && weatherData.forecast.length > 0) {
    rain = 0;
    for (const day of weatherData.forecast) {
      const r = Number(day && (day.rainMm || day.precipitation || day.rain || 0));
      if (Number.isFinite(r)) rain += r;
    }
  } else {
    const raw = weatherData.rain3d
             ?? weatherData.rainMm
             ?? weatherData.precipitation
             ?? weatherData.rain
             ?? null;
    if (raw != null) rain = Number(raw);
  }

  if (Number.isFinite(rain) && rain >= 0) {
    // Scale thresholds if caller provides a non-3d window.
    const scale = windowDays > 0 ? windowDays / 3 : 1;
    if (rain < 2  * scale) return 'dry';
    if (rain < 10 * scale) return 'light_rain';
    if (rain < 35 * scale) return 'moderate_rain';
    return 'heavy_rain';
  }

  return 'unknown';
}

/**
 * isRainfallState(value) — tests whether a string is one of the four
 * real rainfall states ('unknown' excluded).
 */
export function isRainfallState(value) {
  return value === 'dry' || value === 'light_rain'
      || value === 'moderate_rain' || value === 'heavy_rain';
}

/**
 * getRainfallSeverity(state) — {dry:1, light_rain:2, moderate_rain:3,
 *   heavy_rain:4, unknown:0}. Useful for engines that want an ordinal
 *   without a big switch.
 */
const SEVERITY = f({
  unknown: 0, dry: 1, light_rain: 2, moderate_rain: 3, heavy_rain: 4,
});
export function getRainfallSeverity(state) {
  return SEVERITY[state] != null ? SEVERITY[state] : 0;
}

export const _internal = f({ PATTERN_ALIASES, SEVERITY });
