/**
 * Weather Intelligence Engine — converts raw weather into farmer actions.
 *
 * Pure function: weather data in, guidance out.
 * No React, no API calls, no side effects.
 *
 * Rain classification (critical for avoiding false warnings):
 *   - rainingNow:      current weather code is rain OR current precip >= 0.5mm
 *   - rainTodayLikely: today's daily forecast >= 2mm but NOT raining now
 *   - rainExpected:    3-day forecast > 1mm — softer signal, NOT a hard warning
 *   - heavyRainRisk:   3-day forecast > 30mm
 *
 * Rule priority (highest first):
 *   1. Heavy rain now or imminent     → protect crop, stop outdoor work
 *   2. Raining now (light/moderate)   → don't water/spray/dry
 *   3. Rain likely later today        → store before rain, softer warning
 *   4. High wind                      → don't spray
 *   5. Dry spell risk                 → water urgently
 *   6. Dry + low humidity             → water today
 *   7. Heat stress                    → water morning
 *   8. 3-day rain forecast only       → NO hard warning (just a note)
 *   9. Moderate wind                  → safe, noted
 *  10. All clear                      → safe
 */

// ─── Thresholds ──────────────────────────────────────────────
const WIND_SPRAY_LIMIT = 20;     // km/h — above this, spraying is unsafe
const WIND_CAUTION = 15;         // km/h — moderate wind warning
const HUMIDITY_DRY = 40;         // % — below this, crop stress risk
const HUMIDITY_VERY_DRY = 25;    // % — severe dry stress
const TEMP_HIGH = 35;            // °C — heat stress threshold
const RAIN_TODAY_THRESHOLD = 2;  // mm — today's forecast must exceed this to count
const RAIN_NOW_THRESHOLD = 0.5;  // mm — current precipitation to count as "raining"
const RAIN_HEAVY = 15;           // mm — heavy rain (today)
const RAIN_HEAVY_3D = 30;       // mm — heavy rain risk across 3-day window

/** WMO weather codes that indicate active rain */
const RAIN_CODES = new Set([
  51, 53, 55, 56, 57,            // drizzle
  61, 63, 65, 66, 67,            // rain
  80, 81, 82,                    // showers
  95, 96, 99,                    // thunderstorm
]);

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
 * @property {'none'|'now'|'later'|'forecast_only'} rainTiming - when rain matters
 */

/**
 * Get weather-driven farmer guidance.
 *
 * @param {Object} input
 * @param {Object|null} input.weather - Normalized weather data from API
 * @param {string} [input.crop] - Crop type
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
      rainTiming: 'none',
    };
  }

  // ─── Extract + classify rain ──────────────────────
  const currentPrecip = weather.currentPrecipMm ?? ((weather.rain || 0) + (weather.showers || 0) + (weather.precipitation || 0));
  const weatherCode = weather.weatherCode ?? null;
  const rainingNow = weather.rainingNow ?? (RAIN_CODES.has(weatherCode) || currentPrecip >= RAIN_NOW_THRESHOLD);
  const rainTodayMm = weather.rainTodayMm ?? 0;
  const rainTodayLikely = weather.rainTodayLikely ?? (!rainingNow && rainTodayMm >= RAIN_TODAY_THRESHOLD);
  const rainForecast3d = weather.rainForecastMm || 0;
  const heavyRainRisk = weather.heavyRainRisk || rainTodayMm >= RAIN_HEAVY || rainForecast3d >= RAIN_HEAVY_3D;

  const wind = weather.windSpeed || 0;
  const humidity = weather.humidityPct ?? weather.humidity ?? null;
  const temp = weather.temperatureC ?? weather.temperature ?? null;
  const drySpellRisk = weather.drySpellRisk || false;

  // ─── Rule 1: Heavy rain (now or imminent today) ───
  if (heavyRainRisk && (rainingNow || rainTodayMm >= RAIN_HEAVY)) {
    return {
      status: 'warning',
      recommendationKey: 'wx.heavyRain',
      reasonKey: 'wx.heavyRainReason',
      riskLevel: 'high',
      voiceKey: 'wx.heavyRainVoice',
      icon: '🌧️',
      adjustments: { watering: -10, spraying: -5, drying: -10, harvest: +3 },
      params: { rain: Math.round(rainingNow ? currentPrecip : rainTodayMm) },
      rainTiming: 'now',
    };
  }

  // ─── Rule 2: Raining now (light/moderate) ─────────
  if (rainingNow) {
    const guidance = {
      status: 'caution',
      recommendationKey: 'wx.rainingNow',
      reasonKey: 'wx.rainingNowReason',
      riskLevel: 'moderate',
      voiceKey: 'wx.rainingNowVoice',
      icon: '🌧️',
      adjustments: { watering: -10, drying: -8 },
      params: {},
      rainTiming: 'now',
    };
    if (wind >= WIND_SPRAY_LIMIT) guidance.adjustments.spraying = -5;
    return guidance;
  }

  // ─── Rule 3: Rain likely later today ──────────────
  if (rainTodayLikely) {
    const guidance = {
      status: 'caution',
      recommendationKey: 'wx.rainLater',
      reasonKey: 'wx.rainLaterReason',
      riskLevel: 'low',
      voiceKey: 'wx.rainLaterVoice',
      icon: '🌦️',
      adjustments: { watering: -5, drying: -5 },
      params: { rain: Math.round(rainTodayMm) },
      rainTiming: 'later',
    };
    if (wind >= WIND_SPRAY_LIMIT) guidance.adjustments.spraying = -5;
    return guidance;
  }

  // ─── Rule 4: High wind (no rain today) ────────────
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
      rainTiming: 'none',
    };
  }

  // ─── Rule 5: Dry spell risk (server-flagged) ──────
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
      rainTiming: 'none',
    };
  }

  // ─── Rule 6: Dry + low humidity ───────────────────
  if (humidity !== null && humidity <= HUMIDITY_DRY && !rainingNow && rainTodayMm < RAIN_TODAY_THRESHOLD) {
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
      rainTiming: 'none',
    };
  }

  // ─── Rule 7: Heat stress ──────────────────────────
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
      rainTiming: 'none',
    };
  }

  // ─── Rule 8: 7-day forecast rain signal (from Open-Meteo) ──
  // When forecast data is available, provide an informational note
  // about upcoming rain. NOT a hard warning — just farmer awareness.
  if (weather.forecastRainWeekMm > 0 && !rainingNow && !rainTodayLikely) {
    const weekMm = weather.forecastRainWeekMm;
    if (weekMm >= 30) {
      return {
        status: 'safe',
        recommendationKey: 'wx.rainWeekHeavy',
        reasonKey: 'wx.rainWeekHeavyReason',
        riskLevel: 'low',
        voiceKey: 'wx.rainWeekHeavyVoice',
        icon: '\u{1F327}\u{FE0F}',
        adjustments: {},
        params: { mm: Math.round(weekMm) },
        rainTiming: 'forecast_only',
      };
    }
    if (weekMm >= 10) {
      return {
        status: 'safe',
        recommendationKey: 'wx.rainWeekSome',
        reasonKey: 'wx.rainWeekSomeReason',
        riskLevel: 'none',
        voiceKey: 'wx.rainWeekSomeVoice',
        icon: '\u{1F326}\u{FE0F}',
        adjustments: {},
        params: { mm: Math.round(weekMm) },
        rainTiming: 'forecast_only',
      };
    }
  }

  // ─── Rule 9: Moderate wind ────────────────────────
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
      rainTiming: 'none',
    };
  }

  // ─── Rule 10: All clear ───────────────────────────
  return {
    status: 'safe',
    recommendationKey: 'wx.safe',
    reasonKey: 'wx.safeReason',
    riskLevel: 'none',
    voiceKey: 'wx.safeVoice',
    icon: '☀️',
    adjustments: {},
    params: {},
    rainTiming: 'none',
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

  // Derive chip label from rain timing + recommendation key
  const recKey = guidance.recommendationKey || '';
  let chipLabelKey = 'wxChip.good';
  if (recKey.includes('heavyRain') || recKey.includes('rainingNow')) chipLabelKey = 'wxChip.rain';
  else if (recKey.includes('rainLater') || recKey.includes('rainExpected')) chipLabelKey = 'wxChip.rainLater';
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
        (taskId.startsWith('post-dry') || actionType === 'drying'
         || title.includes('dry') || title.includes('séch')
         || title.includes('spread') || title.includes('sun') || title.includes('tarp'))) {
      shouldOverrideTask = true;
      replacementTaskType = 'protect_harvest_from_rain';
      overrideReason = t('wxConflict.protectHarvest');
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

// ─── Weather Override Pipeline Stage ────────────────────────

/**
 * Apply weather override to a resolved action — the core pipeline stage.
 *
 * This runs AFTER the priority cascade (resolvePrimaryAction) but BEFORE
 * rendering, so it catches tasks from ALL paths (pest, alert, daily).
 * If weather conflicts with the action's task, the action is replaced
 * with a weather-safe alternative. Otherwise the action passes through.
 *
 * @param {Object} action - Resolved action from resolvePrimaryAction()
 * @param {WeatherGuidance|null} weatherGuidance - From getWeatherGuidance()
 * @param {Function} t - i18n function
 * @returns {Object} Final action (original or weather-overridden)
 */
export function applyWeatherOverride(action, weatherGuidance, t) {
  // Only override actions that have a task attached
  if (!action.task || !weatherGuidance || weatherGuidance.status === 'safe') return action;

  const task = action.task;
  const taskId = task.id || '';
  const titleLower = (task.title || '').toLowerCase();
  const actionType = task.actionType || '';
  const adj = weatherGuidance.adjustments || {};
  const rainTiming = weatherGuidance.rainTiming || 'none';

  // Detect task category from ID prefix, actionType, and title keywords
  const isDryTask = taskId.startsWith('post-dry') || actionType === 'drying'
    || titleLower.includes('dry') || titleLower.includes('séch')
    || titleLower.includes('sun') || titleLower.includes('spread') || titleLower.includes('tarp');
  const isWaterTask = actionType === 'watering' || titleLower.includes('water') || titleLower.includes('irrigat');
  const isSprayTask = actionType === 'spraying' || titleLower.includes('spray') || titleLower.includes('pesticide');

  if (!isDryTask && !isWaterTask && !isSprayTask) return action;

  // Wind override: spray tasks should be blocked regardless of rain
  const hasWindOverride = adj.spraying <= -5 && isSprayTask;

  // Rain override: only when rain is TODAY (now or later today).
  // A 3-day-only forecast does NOT trigger overrides.
  const hasRainOverride = (rainTiming === 'now' || rainTiming === 'later') &&
    (adj.watering < -3 || adj.drying < -3 || adj.spraying < -5);

  if (!hasWindOverride && !hasRainOverride) return action;

  // Build weather-safe replacement
  let altTitle, altReason;
  if (isDryTask) {
    altTitle = rainTiming === 'now' ? t('wxConflict.protectHarvest') : t('wxConflict.storeBefore');
    altReason = rainTiming === 'now' ? t('wxConflict.protectHarvestReason') : t('wxConflict.storeBeforeReason');
  } else if (isWaterTask) {
    altTitle = t('wxConflict.skipWatering');
    altReason = '';
  } else {
    altTitle = t('wxConflict.skipSpraying');
    altReason = '';
  }

  return {
    ...action,
    key: 'weather_override',
    icon: weatherGuidance.icon,
    iconBg: 'rgba(14,165,233,0.12)',
    title: altTitle,
    reason: altReason,
    priority: 'high',
    weatherOverride: true,
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
  if (actionType === 'drying' || (task.id || '').startsWith('post-dry') || title.includes('dry') || title.includes('séch') || title.includes('sun') || title.includes('spread') || title.includes('tarp')) {
    return guidance.adjustments.drying || 0;
  }
  if (actionType === 'harvest' || title.includes('harvest') || title.includes('pick')) {
    return guidance.adjustments.harvest || 0;
  }

  return 0;
}
