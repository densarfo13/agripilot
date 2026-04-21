/**
 * insightFormatter.js — turns a raw weather/risk signal into a
 * structured action triple (spec §3 "Turn Insights Into Real
 * Actions"):
 *
 *   { condition, timeWindow, actions: [string, string?] }
 *
 * Callers render the three parts as three short lines. That format
 * makes the farmer card decision-first:
 *
 *   Dry weather for the next 3 days
 *     → Water crops tomorrow morning
 *     → Check soil moisture in the evening
 *
 *   formatWeatherInsight({ weather, crop, stage, forecastDays })
 *   formatRiskInsight({ risk, crop })
 *
 * Pure + deterministic. No React. No i18n lookups — callers
 * translate the returned keys via the existing t() chain, fallback
 * to the English string already bundled in each result.
 */

// ─── Helpers ─────────────────────────────────────────────────────
function normalize(s) { return String(s || '').toLowerCase(); }

function cropBaseline(crop) {
  return {
    thirsty:   ['rice', 'maize', 'tomato', 'banana'].includes(normalize(crop)),
    tolerant:  ['cassava', 'sorghum', 'millet'].includes(normalize(crop)),
  };
}

// ─── Weather insights ────────────────────────────────────────────
/**
 * formatWeatherInsight — given a summarizeWeather-shape payload
 * (status, cautions, forecast7dMm, tempC, precip7dMm) produce an
 * action triple.
 *
 *   returns null when we don't have a confident action to emit
 *   (status 'ok' / 'unavailable') — caller should fall back to
 *   its own generic message or hide the banner.
 */
export function formatWeatherInsight({
  weather = null, crop = null, stage = null, forecastDays = 3,
} = {}) {
  if (!weather || typeof weather !== 'object') return null;
  const status = normalize(weather.status);
  const { thirsty } = cropBaseline(crop);

  if (status === 'excessive_heat') {
    return Object.freeze({
      tone: 'danger',
      conditionKey:    'farmer.insight.weather.condition.hot',
      condition:       'Extreme heat expected today',
      timeWindowKey:   'farmer.insight.weather.window.today',
      timeWindow:      'Later today',
      actions: Object.freeze([
        'Shade seedlings during the hottest hours',
        thirsty
          ? 'Water early morning or after sunset'
          : 'Check soil moisture in the evening',
      ]),
      actionKeys: Object.freeze([
        'farmer.insight.weather.action.shade',
        thirsty
          ? 'farmer.insight.weather.action.water_morning'
          : 'farmer.insight.weather.action.check_moisture',
      ]),
      ruleTag: 'weather_excessive_heat',
    });
  }

  if (status === 'low_rain' || status === 'dry_ahead') {
    return Object.freeze({
      tone: 'warn',
      conditionKey:    'farmer.insight.weather.condition.dry',
      condition:       `Dry weather for the next ${forecastDays} days`,
      timeWindowKey:   'farmer.insight.weather.window.days3',
      timeWindow:      `Next ${forecastDays} days`,
      actions: Object.freeze([
        'Water crops tomorrow morning',
        'Check soil moisture in the evening',
      ]),
      actionKeys: Object.freeze([
        'farmer.insight.weather.action.water_tomorrow',
        'farmer.insight.weather.action.check_moisture',
      ]),
      ruleTag: 'weather_low_rain',
    });
  }

  if (status === 'rain_expected' || status === 'rain_coming' || status === 'heavy_rain') {
    const harvestStage = normalize(stage) === 'harvest'
                      || normalize(stage) === 'post_harvest';
    return Object.freeze({
      tone: 'info',
      conditionKey:    'farmer.insight.weather.condition.rain',
      condition:       'Rain expected later today',
      timeWindowKey:   'farmer.insight.weather.window.today',
      timeWindow:      'Later today',
      actions: Object.freeze([
        harvestStage ? 'Harvest early if the crop is ready' : 'Move tools and seed to dry storage',
        'Clear drainage channels before evening',
      ]),
      actionKeys: Object.freeze([
        harvestStage
          ? 'farmer.insight.weather.action.harvest_early'
          : 'farmer.insight.weather.action.move_to_dry',
        'farmer.insight.weather.action.clear_drainage',
      ]),
      ruleTag: 'weather_rain_expected',
    });
  }

  return null;
}

// ─── Risk insights ───────────────────────────────────────────────
/**
 * formatRiskInsight — risk-engine output → action triple. Plays
 * nicely alongside formatWeatherInsight; callers typically pick
 * the higher-priority one to show above the fold.
 */
export function formatRiskInsight({ risk = null, crop = null } = {}) {
  if (!risk || typeof risk !== 'object') return null;
  const level = normalize(risk.level);
  const type  = normalize(risk.type);

  if (level === 'low') return null;

  if (type === 'pest') {
    return Object.freeze({
      tone: level === 'high' ? 'danger' : 'warn',
      conditionKey:  'farmer.insight.risk.condition.pest',
      condition:     crop
        ? `Pest pressure rising in ${normalize(crop)}`
        : 'Pest pressure rising this week',
      timeWindowKey: 'farmer.insight.risk.window.week',
      timeWindow:    'This week',
      actions: Object.freeze([
        'Inspect affected plants today',
        'Report any new damage for officer review',
      ]),
      actionKeys: Object.freeze([
        'farmer.insight.risk.action.inspect',
        'farmer.insight.risk.action.report_officer',
      ]),
      ruleTag: 'risk_pest',
    });
  }

  if (type === 'disease') {
    return Object.freeze({
      tone: level === 'high' ? 'danger' : 'warn',
      conditionKey:  'farmer.insight.risk.condition.disease',
      condition:     'Disease risk elevated for your crop',
      timeWindowKey: 'farmer.insight.risk.window.week',
      timeWindow:    'This week',
      actions: Object.freeze([
        'Photograph any unusual leaves',
        'Avoid handling other plants after inspecting',
      ]),
      actionKeys: Object.freeze([
        'farmer.insight.risk.action.photograph',
        'farmer.insight.risk.action.hands_clean',
      ]),
      ruleTag: 'risk_disease',
    });
  }

  if (type === 'weather') {
    return Object.freeze({
      tone: level === 'high' ? 'danger' : 'warn',
      conditionKey:  'farmer.insight.risk.condition.weather',
      condition:     'Weather stress likely this week',
      timeWindowKey: 'farmer.insight.risk.window.week',
      timeWindow:    'This week',
      actions: Object.freeze([
        'Check moisture each morning',
        'Adjust watering based on soil feel',
      ]),
      actionKeys: Object.freeze([
        'farmer.insight.risk.action.check_morning',
        'farmer.insight.risk.action.adjust_watering',
      ]),
      ruleTag: 'risk_weather',
    });
  }

  return null;
}

/**
 * pickTopInsight — given both a weather and a risk insight, return
 * the one the UI should surface above the fold. Danger tones win;
 * ties broken by weather (fresher signal) then risk.
 */
export function pickTopInsight({ weatherInsight = null, riskInsight = null } = {}) {
  const tier = (x) => (x && x.tone === 'danger' ? 2 : x && x.tone === 'warn' ? 1 : 0);
  const tw = tier(weatherInsight);
  const tr = tier(riskInsight);
  if (tw === 0 && tr === 0) return null;
  if (tw >= tr) return weatherInsight || riskInsight;
  return riskInsight || weatherInsight;
}

export const _internal = Object.freeze({ normalize, cropBaseline });
