/**
 * Weather Intelligence Engine — converts raw weather into farmer actions.
 *
 * Pure function: weather data in, guidance out.
 * No React, no API calls, no side effects.
 *
 * Rules (v1 — deterministic, simple, explainable):
 *   1. Heavy rain → don't water, harvest risk
 *   2. Rain expected → don't water, plan indoor work
 *   3. High wind → don't spray
 *   4. Dry + low humidity → water today
 *   5. Dry spell risk flagged by server → water urgently
 *   6. Normal → safe for activity
 *   7. No data → graceful fallback
 */

// ─── Thresholds ──────────────────────────────────────────────
const WIND_SPRAY_LIMIT = 20;     // km/h — above this, spraying is unsafe
const WIND_CAUTION = 15;         // km/h — moderate wind warning
const HUMIDITY_DRY = 40;         // % — below this, crop stress risk
const HUMIDITY_VERY_DRY = 25;    // % — severe dry stress
const TEMP_HIGH = 35;            // °C — heat stress threshold
const RAIN_LIGHT = 2;            // mm — light rain
const RAIN_HEAVY = 15;           // mm — heavy rain

/**
 * @typedef {Object} WeatherGuidance
 * @property {'safe'|'caution'|'warning'|'danger'} status
 * @property {string} recommendationKey - i18n key for the recommendation
 * @property {string} reasonKey - i18n key for the reason
 * @property {'none'|'low'|'moderate'|'high'} riskLevel
 * @property {string} voiceKey - i18n key for voice text
 * @property {string} icon - emoji icon
 * @property {Object} adjustments - task priority adjustments
 * @property {Object} params - interpolation params for i18n keys
 */

/**
 * Get weather-driven farmer guidance.
 *
 * @param {Object} input
 * @param {Object|null} input.weather - Raw weather data from API
 * @param {string} [input.crop] - Crop type (for future crop-specific rules)
 * @param {string} [input.stage] - Current crop stage
 * @returns {WeatherGuidance}
 */
export function getWeatherGuidance({ weather, crop, stage }) {
  // ─── No data fallback ─────────────────────────────
  if (!weather) {
    return {
      status: 'safe',
      recommendationKey: 'wx.noData',
      reasonKey: 'wx.noDataReason',
      riskLevel: 'none',
      voiceKey: 'wx.noDataVoice',
      icon: '🌤️',
      adjustments: {},
      params: {},
    };
  }

  // ─── Extract fields (safe defaults) ────────────────
  const rain = (weather.rain || 0) + (weather.showers || 0) + (weather.precipitation || 0);
  const rainForecast = weather.rainForecastMm || 0;
  const totalRain = Math.max(rain, rainForecast);
  const wind = weather.windSpeed || 0;
  const humidity = weather.humidityPct ?? weather.humidity ?? null;
  const temp = weather.temperatureC ?? weather.temperature ?? null;
  const rainExpected = weather.rainExpected || totalRain > 0;
  const heavyRainRisk = weather.heavyRainRisk || totalRain >= RAIN_HEAVY;
  const drySpellRisk = weather.drySpellRisk || false;

  // ─── Rule 1: Heavy rain ────────────────────────────
  if (heavyRainRisk || totalRain >= RAIN_HEAVY) {
    return {
      status: 'warning',
      recommendationKey: 'wx.heavyRain',
      reasonKey: 'wx.heavyRainReason',
      riskLevel: 'high',
      voiceKey: 'wx.heavyRainVoice',
      icon: '🌧️',
      adjustments: { watering: -10, spraying: -5, harvest: +3 },
      params: { rain: Math.round(totalRain) },
    };
  }

  // ─── Rule 2: Rain expected (light/moderate) ────────
  if (rainExpected || totalRain >= RAIN_LIGHT) {
    const guidance = {
      status: 'caution',
      recommendationKey: 'wx.rainExpected',
      reasonKey: 'wx.rainExpectedReason',
      riskLevel: 'low',
      voiceKey: 'wx.rainExpectedVoice',
      icon: '🌦️',
      adjustments: { watering: -5 },
      params: { rain: Math.round(totalRain) },
    };
    // If also windy, add spray warning
    if (wind >= WIND_SPRAY_LIMIT) {
      guidance.adjustments.spraying = -5;
    }
    return guidance;
  }

  // ─── Rule 3: High wind (no rain) ──────────────────
  if (wind >= WIND_SPRAY_LIMIT) {
    return {
      status: 'caution',
      recommendationKey: 'wx.highWind',
      reasonKey: 'wx.highWindReason',
      riskLevel: 'moderate',
      voiceKey: 'wx.highWindVoice',
      icon: '💨',
      adjustments: { spraying: -10 },
      params: { wind: Math.round(wind) },
    };
  }

  // ─── Rule 4: Dry spell risk (server-flagged) ──────
  if (drySpellRisk) {
    return {
      status: 'warning',
      recommendationKey: 'wx.drySpell',
      reasonKey: 'wx.drySpellReason',
      riskLevel: 'high',
      voiceKey: 'wx.drySpellVoice',
      icon: '🏜️',
      adjustments: { watering: +5 },
      params: {},
    };
  }

  // ─── Rule 5: Dry + low humidity ───────────────────
  if (humidity !== null && humidity <= HUMIDITY_DRY && totalRain === 0) {
    const severe = humidity <= HUMIDITY_VERY_DRY;
    return {
      status: severe ? 'warning' : 'caution',
      recommendationKey: severe ? 'wx.veryDry' : 'wx.dry',
      reasonKey: severe ? 'wx.veryDryReason' : 'wx.dryReason',
      riskLevel: severe ? 'high' : 'moderate',
      voiceKey: severe ? 'wx.veryDryVoice' : 'wx.dryVoice',
      icon: '☀️',
      adjustments: { watering: severe ? +5 : +3 },
      params: { humidity: Math.round(humidity) },
    };
  }

  // ─── Rule 6: Heat stress ──────────────────────────
  if (temp !== null && temp >= TEMP_HIGH) {
    return {
      status: 'caution',
      recommendationKey: 'wx.hot',
      reasonKey: 'wx.hotReason',
      riskLevel: 'moderate',
      voiceKey: 'wx.hotVoice',
      icon: '🌡️',
      adjustments: { watering: +2 },
      params: { temp: Math.round(temp) },
    };
  }

  // ─── Rule 7: Moderate wind (not blocking but notable)
  if (wind >= WIND_CAUTION) {
    return {
      status: 'safe',
      recommendationKey: 'wx.windyButSafe',
      reasonKey: 'wx.windyButSafeReason',
      riskLevel: 'low',
      voiceKey: 'wx.windyButSafeVoice',
      icon: '🍃',
      adjustments: {},
      params: { wind: Math.round(wind) },
    };
  }

  // ─── Rule 8: All clear ────────────────────────────
  return {
    status: 'safe',
    recommendationKey: 'wx.safe',
    reasonKey: 'wx.safeReason',
    riskLevel: 'none',
    voiceKey: 'wx.safeVoice',
    icon: '☀️',
    adjustments: {},
    params: {},
  };
}

/**
 * Apply weather adjustments to a task's effective priority score.
 * Returns a number modifier (negative = lower priority, positive = higher).
 *
 * @param {WeatherGuidance} guidance
 * @param {Object} task - Task from server
 * @returns {number} priority adjustment (-10 to +10)
 */
export function getWeatherTaskAdjustment(guidance, task) {
  if (!guidance || !task || !guidance.adjustments) return 0;

  const title = (task.title || '').toLowerCase();
  const actionType = task.actionType || '';

  // Match task to weather adjustment categories
  if (actionType === 'watering' || title.includes('water') || title.includes('irrigat')) {
    return guidance.adjustments.watering || 0;
  }
  if (actionType === 'spraying' || title.includes('spray') || title.includes('pesticide')) {
    return guidance.adjustments.spraying || 0;
  }
  if (actionType === 'harvest' || title.includes('harvest') || title.includes('pick')) {
    return guidance.adjustments.harvest || 0;
  }

  return 0;
}
