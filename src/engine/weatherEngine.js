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
      adjustments: { watering: -10, spraying: -5, drying: -10, harvest: +3 },
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
      adjustments: { watering: -5, drying: -5 },
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

// ─── Weather Decision (display-ready) ───────────────────────

/**
 * Produce a display-ready weather decision for the farmer home.
 *
 * Combines guidance rules + raw weather + freshness into one object
 * that the UI can render directly (chip, action line, voice, override).
 *
 * @param {Object} params
 * @param {Object|null} params.weather - Normalized weather from API
 * @param {string} params.crop - Crop type
 * @param {string} params.stage - Crop stage key
 * @param {Object|null} params.currentTask - The primary task before override
 * @param {number|null} params.fetchedAt - Epoch ms when weather was fetched
 * @param {'fresh'|'aging'|'stale'|'none'} params.freshness - Staleness category
 * @param {Function} t - i18n function
 * @returns {Object} Weather decision for UI
 */
export function getWeatherDecision({ weather, crop, stage, currentTask, fetchedAt, freshness }, t) {
  const guidance = getWeatherGuidance({ weather, crop, stage });

  // ─── Chip fields ──────────────────────────────────
  const temp = weather?.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : null;
  const chipIcon = guidance.icon;
  const chipTemp = temp;

  // Derive chip label from recommendation key
  const recKey = guidance.recommendationKey || '';
  let chipLabelKey = 'wxChip.good';
  if (recKey.includes('heavyRain') || recKey.includes('rainExpected')) chipLabelKey = 'wxChip.rain';
  else if (recKey.includes('highWind')) chipLabelKey = 'wxChip.wind';
  else if (recKey.includes('dry') || recKey.includes('veryDry') || recKey.includes('drySpell')) chipLabelKey = 'wxChip.dry';
  else if (recKey.includes('hot')) chipLabelKey = 'wxChip.hot';
  else if (guidance.status === 'warning' || guidance.status === 'caution') chipLabelKey = 'wxChip.care';
  const chipLabel = t(chipLabelKey);

  // ─── Action line ──────────────────────────────────
  const actionLine = guidance.status !== 'safe'
    ? t(guidance.recommendationKey, guidance.params)
    : t('wx.safeAction');

  // ─── Last updated label ───────────────────────────
  const lastUpdatedLabel = formatLastUpdated(fetchedAt, t);

  // ─── Severity mapping ─────────────────────────────
  const severity = guidance.status; // 'safe' | 'caution' | 'warning' | 'danger'

  // ─── Task override check ──────────────────────────
  let shouldOverrideTask = false;
  let replacementTaskType = null;
  let overrideReason = null;

  if (currentTask && guidance.status !== 'safe') {
    const title = (currentTask.title || '').toLowerCase();
    const taskId = currentTask.id || '';
    const actionType = currentTask.actionType || '';
    const adj = guidance.adjustments || {};

    // Rain + drying task
    if ((adj.drying < -3 || adj.watering < -3) &&
        (taskId === 'post-dry' || actionType === 'drying' || title.includes('dry') || title.includes('spread') || title.includes('sun'))) {
      shouldOverrideTask = true;
      replacementTaskType = 'protect_harvest_from_rain';
      overrideReason = t('wxConflict.skipDrying');
    }
    // Rain + watering task
    else if (adj.watering < -3 &&
        (actionType === 'watering' || title.includes('water') || title.includes('irrigat'))) {
      shouldOverrideTask = true;
      replacementTaskType = 'skip_watering';
      overrideReason = t('wxConflict.skipWatering');
    }
    // Wind + spraying task
    else if (adj.spraying < -5 &&
        (actionType === 'spraying' || title.includes('spray') || title.includes('pesticide'))) {
      shouldOverrideTask = true;
      replacementTaskType = 'delay_spraying';
      overrideReason = t('wxConflict.skipSpraying');
    }
  }

  // ─── Voice text ───────────────────────────────────
  const voiceText = guidance.voiceKey ? t(guidance.voiceKey) : '';

  // ─── Stale weather handling ───────────────────────
  const isStale = freshness === 'stale';
  const isAging = freshness === 'aging';

  return {
    // Chip display
    chipIcon,
    chipTemp,
    chipLabel,
    // Action guidance
    actionLine,
    lastUpdatedLabel,
    severity,
    // Task override
    shouldOverrideTask,
    replacementTaskType,
    overrideReason,
    // Voice
    voiceText,
    // Freshness
    freshness,
    isStale,
    isAging,
    fetchedAt,
    // Pass-through for engine internals
    guidance,
  };
}

/**
 * Format fetchedAt into a localized "Updated X min ago" string.
 * @param {number|null} fetchedAt - epoch ms
 * @param {Function} t - i18n function
 * @returns {string}
 */
function formatLastUpdated(fetchedAt, t) {
  if (!fetchedAt) return t('wx.updated.never') || '';
  const mins = Math.round((Date.now() - fetchedAt) / 60000);
  if (mins < 1) return t('wx.updated.justNow');
  if (mins === 1) return t('wx.updated.1min');
  if (mins < 60) return t('wx.updated.mins', { mins });
  const hours = Math.floor(mins / 60);
  if (hours === 1) return t('wx.updated.1hour');
  return t('wx.updated.hours', { hours });
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
  if (actionType === 'drying' || task.id === 'post-dry' || title.includes('dry') || title.includes('sun') || title.includes('spread')) {
    return guidance.adjustments.drying || 0;
  }
  if (actionType === 'harvest' || title.includes('harvest') || title.includes('pick')) {
    return guidance.adjustments.harvest || 0;
  }

  return 0;
}
