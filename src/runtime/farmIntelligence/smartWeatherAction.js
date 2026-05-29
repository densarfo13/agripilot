/**
 * smartWeatherAction.js — Phase 10 weather → action hints.
 *
 *   import { deriveSmartWeatherActions } from
 *     'src/runtime/farmIntelligence/smartWeatherAction.js';
 *
 * What this is
 * ────────────
 *   Maps weather forecast signals to short farmer-language action
 *   hints. Pure rule-based — no model call, no clock dependency
 *   beyond the caller-supplied forecast snapshot.
 *
 *   Action templates (each emits 0 or 1 entry per call):
 *
 *     heavy_rain_tomorrow      → "Delay spraying"
 *     heat_wave_coming         → "Irrigate today"
 *     high_humidity            → "Monitor for fungus"
 *     strong_winds             → "Postpone pesticide application"
 *     frost_risk               → "Cover sensitive seedlings"
 *     cold_snap                → "Delay transplanting"
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Returns frozen array of frozen action envelopes.
 *   • All copy via translation key + default — caller localizes.
 */

const RUNTIME_VERSION = 'smart-weather-action-v1';

const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _bool = (v) => v === true;

export const WEATHER_ACTION_KIND = Object.freeze({
  DELAY_SPRAYING:         'delay_spraying',
  IRRIGATE_TODAY:         'irrigate_today',
  MONITOR_FUNGUS:         'monitor_fungus',
  POSTPONE_PESTICIDE:     'postpone_pesticide',
  COVER_SEEDLINGS:        'cover_seedlings',
  DELAY_TRANSPLANTING:    'delay_transplanting',
});

const ACTION_COPY = Object.freeze({
  [WEATHER_ACTION_KIND.DELAY_SPRAYING]: Object.freeze({
    headlineKey: 'weather.action.delay_spraying.headline',
    headlineDefault: 'Heavy rain tomorrow',
    bodyKey: 'weather.action.delay_spraying.body',
    bodyDefault: 'Delay spraying so the treatment isn’t washed off.',
    priority: 'high',
  }),
  [WEATHER_ACTION_KIND.IRRIGATE_TODAY]: Object.freeze({
    headlineKey: 'weather.action.irrigate_today.headline',
    headlineDefault: 'Heat wave coming',
    bodyKey: 'weather.action.irrigate_today.body',
    bodyDefault: 'Irrigate today so plants survive the heat.',
    priority: 'high',
  }),
  [WEATHER_ACTION_KIND.MONITOR_FUNGUS]: Object.freeze({
    headlineKey: 'weather.action.monitor_fungus.headline',
    headlineDefault: 'High humidity today',
    bodyKey: 'weather.action.monitor_fungus.body',
    bodyDefault: 'Check leaves for fungal spots over the next few days.',
    priority: 'medium',
  }),
  [WEATHER_ACTION_KIND.POSTPONE_PESTICIDE]: Object.freeze({
    headlineKey: 'weather.action.postpone_pesticide.headline',
    headlineDefault: 'Strong winds today',
    bodyKey: 'weather.action.postpone_pesticide.body',
    bodyDefault: 'Postpone pesticide application until the wind eases.',
    priority: 'medium',
  }),
  [WEATHER_ACTION_KIND.COVER_SEEDLINGS]: Object.freeze({
    headlineKey: 'weather.action.cover_seedlings.headline',
    headlineDefault: 'Frost risk tonight',
    bodyKey: 'weather.action.cover_seedlings.body',
    bodyDefault: 'Cover sensitive seedlings before sundown.',
    priority: 'high',
  }),
  [WEATHER_ACTION_KIND.DELAY_TRANSPLANTING]: Object.freeze({
    headlineKey: 'weather.action.delay_transplanting.headline',
    headlineDefault: 'Cold snap this week',
    bodyKey: 'weather.action.delay_transplanting.body',
    bodyDefault: 'Delay transplanting until temperatures rise.',
    priority: 'medium',
  }),
});

/**
 * @param {{
 *   heavyRainExpected?: boolean,
 *   rainfallMmTomorrow?: number,
 *   expectedMaxTempC?: number,
 *   heatWaveActive?: boolean,
 *   humidityPercent?: number,
 *   windSpeedKph?: number,
 *   frostRiskTonight?: boolean,
 *   expectedMinTempC?: number,
 * }} forecast
 * @returns {Array} frozen array of frozen action envelopes
 */
export function deriveSmartWeatherActions(forecast) {
  const f = forecast && typeof forecast === 'object' ? forecast : {};
  const actions = [];

  const heavyRain = _bool(f.heavyRainExpected)
    || (_isNum(f.rainfallMmTomorrow) && f.rainfallMmTomorrow >= 15);
  if (heavyRain) {
    actions.push(_action(WEATHER_ACTION_KIND.DELAY_SPRAYING));
  }

  const heatWave = _bool(f.heatWaveActive)
    || (_isNum(f.expectedMaxTempC) && f.expectedMaxTempC >= 36);
  if (heatWave) {
    actions.push(_action(WEATHER_ACTION_KIND.IRRIGATE_TODAY));
  }

  if (_isNum(f.humidityPercent) && f.humidityPercent >= 80) {
    actions.push(_action(WEATHER_ACTION_KIND.MONITOR_FUNGUS));
  }

  if (_isNum(f.windSpeedKph) && f.windSpeedKph >= 30) {
    actions.push(_action(WEATHER_ACTION_KIND.POSTPONE_PESTICIDE));
  }

  if (_bool(f.frostRiskTonight)
      || (_isNum(f.expectedMinTempC) && f.expectedMinTempC <= 2)) {
    actions.push(_action(WEATHER_ACTION_KIND.COVER_SEEDLINGS));
  }

  if (_isNum(f.expectedMinTempC) && f.expectedMinTempC <= 8
      && !_bool(f.frostRiskTonight)) {
    actions.push(_action(WEATHER_ACTION_KIND.DELAY_TRANSPLANTING));
  }

  return Object.freeze(actions);
}

function _action(kind) {
  const copy = ACTION_COPY[kind];
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    kind,
    priority: copy.priority,
    headlineKey:     copy.headlineKey,
    headlineDefault: copy.headlineDefault,
    bodyKey:         copy.bodyKey,
    bodyDefault:     copy.bodyDefault,
  });
}

export const _internal = Object.freeze({ ACTION_COPY });
