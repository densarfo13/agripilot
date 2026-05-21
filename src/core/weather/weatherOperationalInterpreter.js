/**
 * weatherOperationalInterpreter.js — turns raw weather signals
 * into a small, calm list of OPERATIONAL insights a farmer or
 * gardener can act on (watering, spray timing, heat stress, frost,
 * harvest timing, humidity/mold, drought).
 *
 *   import { interpretWeather, pickPrimaryWeatherInsight,
 *            localizeWeatherMessage, WEATHER_INSIGHT, SEVERITY }
 *     from 'src/core/weather/weatherOperationalInterpreter.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure read-view. The wateringEngine already reads weather; it
 *   is NOT replaced. notificationOrchestrator already routes pushes;
 *   it is NOT replaced. This module is the "what does the weather
 *   MEAN today?" layer that Home can render in one short card.
 *
 *   It does not store anything, does not call any API, and does
 *   not duplicate the existing notification or watering logic.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Honest wording — no false certainty; chemical / pesticide
 *     advice routes to a local expert (see agronomySafetyRules).
 *   • Every user-visible string ships as a translation key + an
 *     English fallback with {crop} / {hours} substitution.
 */

const _num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const _str = (v) => String(v == null ? '' : v).toLowerCase();

// Insight types — Home + Tasks branch on these.
export const WEATHER_INSIGHT = Object.freeze({
  WATERING:       'watering',
  SPRAY_TIMING:   'spray_timing',
  HEAT_STRESS:    'heat_stress',
  FROST:          'frost',
  HARVEST_TIMING: 'harvest_timing',
  HUMIDITY_MOLD:  'humidity_mold',
  DROUGHT:        'drought',
  CURRENT:        'current',     // calm "current condition" fallback
});

export const SEVERITY = Object.freeze({ LOW: 'low', NORMAL: 'normal', HIGH: 'high' });

// Translation key registry — every fallback is short, calm, and
// uses the permitted hedged wording (possible / may / consider).
const MSG = Object.freeze({
  WATER_SKIP_RAIN_SOON:    { key: 'weather.msg.skip_rain_soon',    fallback: 'Rain expected soon. You may delay watering.' },
  WATER_SKIP_RAINED:       { key: 'weather.msg.skip_rained',       fallback: 'Soil already soaked by rain. Skip watering today.' },
  HEAT_WATER_EARLY:        { key: 'weather.msg.heat_water_early',  fallback: 'High heat this afternoon. Water {crop} early or in the evening.' },
  HEAT_WATER_EARLY_FARM:   { key: 'weather.msg.heat_water_farm',   fallback: 'High heat today. Irrigate {crop} early to limit evaporation.' },
  FROST_NIGHT:             { key: 'weather.msg.frost_night',       fallback: 'Frost likely tonight. Cover vulnerable plants and avoid watering late.' },
  FROST_NIGHT_FARM:        { key: 'weather.msg.frost_night_farm',  fallback: 'Frost likely tonight. Protect sensitive crops where possible.' },
  HUMIDITY_MOLD:           { key: 'weather.msg.humidity_mold',     fallback: 'Cool, humid conditions may increase mold or fungal risk. Water at the base, not on leaves.' },
  DROUGHT_AWARE:           { key: 'weather.msg.drought_aware',     fallback: 'Long dry spell. Check the soil and water if it feels dry.' },
  SPRAY_WIND_TOO_HIGH:     { key: 'weather.msg.spray_wind',        fallback: 'Wind is high — avoid spraying today; droplets drift.' },
  HARVEST_DRY_WINDOW:      { key: 'weather.msg.harvest_dry',       fallback: 'A dry window is coming — a good time to plan harvest of {crop}.' },
  CURRENT_CONDITION:       { key: 'weather.msg.current',           fallback: 'Conditions look steady today.' },
});

function _msg(template, params) {
  const p = (params && typeof params === 'object') ? params : {};
  return { key: template.key, fallback: template.fallback, params: { ...p } };
}

function _insight(type, severity, message, params, advice) {
  return {
    type,
    severity,
    localizedMessage: _msg(message, params),
    advice: advice || '',
  };
}

// Severity rank for sorting — higher number = more important.
const SEV_RANK = { high: 3, normal: 2, low: 1 };

// Type priority when severity ties — frost/heat/spray beat
// long-term drought, etc.
const TYPE_RANK = {
  [WEATHER_INSIGHT.FROST]:          10,
  [WEATHER_INSIGHT.HEAT_STRESS]:     9,
  [WEATHER_INSIGHT.SPRAY_TIMING]:    8,
  [WEATHER_INSIGHT.WATERING]:        7,
  [WEATHER_INSIGHT.HUMIDITY_MOLD]:   6,
  [WEATHER_INSIGHT.HARVEST_TIMING]:  5,
  [WEATHER_INSIGHT.DROUGHT]:         4,
  [WEATHER_INSIGHT.CURRENT]:         0,
};

/**
 * Interpret a weather snapshot into operational insights.
 *
 * @param {object} args
 * @param {object} [args.weather]   { temperatureC, humidityPct,
 *                                    rainProbability24hPct,
 *                                    rainfallTodayMm, windKmh,
 *                                    frostRiskTonight, daysSinceRain,
 *                                    uvIndex }
 * @param {string} [args.mode]      'farmer' | 'gardener'
 * @param {string} [args.crop]
 * @param {string} [args.cropStage] e.g. 'harvest'
 * @param {string} [args.region]
 * @returns {{ insights: Array<object>, primary: object|null }}
 */
export function interpretWeather(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const w = (a.weather && typeof a.weather === 'object') ? a.weather : {};
    const mode = _str(a.mode) === 'farmer' ? 'farmer' : 'gardener';
    const crop = String(a.crop || '').trim()
      || (mode === 'farmer' ? 'the crop' : 'your plants');
    const cropStage = _str(a.cropStage);

    const tempC      = _num(w.temperatureC);
    const humidity   = _num(w.humidityPct);
    const rainProb   = _num(w.rainProbability24hPct);
    const rainToday  = _num(w.rainfallTodayMm);
    const windKmh    = _num(w.windKmh);
    const daysSince  = _num(w.daysSinceRain);
    const frostRisk  = w.frostRiskTonight === true;

    const insights = [];
    const cropParams = { crop };

    // Frost — safety-critical, highest severity.
    if (frostRisk) {
      insights.push(_insight(
        WEATHER_INSIGHT.FROST, SEVERITY.HIGH,
        mode === 'farmer' ? MSG.FROST_NIGHT_FARM : MSG.FROST_NIGHT,
        cropParams,
        'Cover vulnerable plants; avoid watering late.',
      ));
    }

    // Heat stress — water early or in the evening.
    if (tempC != null && tempC >= 32) {
      insights.push(_insight(
        WEATHER_INSIGHT.HEAT_STRESS,
        tempC >= 38 ? SEVERITY.HIGH : SEVERITY.NORMAL,
        mode === 'farmer' ? MSG.HEAT_WATER_EARLY_FARM : MSG.HEAT_WATER_EARLY,
        cropParams,
        'Water in the cool hours; provide shade where you can.',
      ));
    }

    // Spray timing — wind dictates it, never chemistry (no exact
    // products — agronomySafetyRules handles that boundary).
    if (windKmh != null && windKmh >= 25 && (rainProb == null || rainProb < 30)) {
      insights.push(_insight(
        WEATHER_INSIGHT.SPRAY_TIMING, SEVERITY.NORMAL,
        MSG.SPRAY_WIND_TOO_HIGH, cropParams,
        'Wait for calmer conditions before applying any spray.',
      ));
    }

    // Watering — coordinated with wateringEngine but read independently.
    if (rainToday != null && rainToday >= 5) {
      insights.push(_insight(
        WEATHER_INSIGHT.WATERING, SEVERITY.NORMAL,
        MSG.WATER_SKIP_RAINED, cropParams,
        'Skip watering today.',
      ));
    } else if (rainProb != null && rainProb >= 70) {
      insights.push(_insight(
        WEATHER_INSIGHT.WATERING, SEVERITY.NORMAL,
        MSG.WATER_SKIP_RAIN_SOON, cropParams,
        'You may delay watering until after the rain.',
      ));
    }

    // Humidity / mold risk.
    if (humidity != null && humidity >= 85 && tempC != null && tempC >= 18 && tempC <= 26) {
      insights.push(_insight(
        WEATHER_INSIGHT.HUMIDITY_MOLD, SEVERITY.NORMAL,
        MSG.HUMIDITY_MOLD, cropParams,
        'Water at the base, not on the leaves.',
      ));
    }

    // Drought awareness — slower-burn, lower severity.
    if (daysSince != null && daysSince >= 7
        && !(rainToday != null && rainToday >= 5)
        && !(rainProb != null && rainProb >= 70)) {
      insights.push(_insight(
        WEATHER_INSIGHT.DROUGHT, SEVERITY.LOW,
        MSG.DROUGHT_AWARE, cropParams,
        'Check the soil; water if dry.',
      ));
    }

    // Harvest timing — only when cropStage signals harvest is near
    // AND a dry window is realistic.
    if ((cropStage === 'harvest' || cropStage === 'ripening')
        && (rainProb != null && rainProb < 30)
        && (windKmh == null || windKmh < 25)) {
      insights.push(_insight(
        WEATHER_INSIGHT.HARVEST_TIMING, SEVERITY.NORMAL,
        MSG.HARVEST_DRY_WINDOW, cropParams,
        'A drier window is a good time to plan harvest.',
      ));
    }

    // Calm fallback — nothing operational? Home shows only the
    // current condition. CURRENT is the lowest priority so any
    // real insight pre-empts it.
    if (insights.length === 0) {
      insights.push(_insight(
        WEATHER_INSIGHT.CURRENT, SEVERITY.LOW,
        MSG.CURRENT_CONDITION, cropParams,
        '',
      ));
    }

    const sorted = insights
      .map((it, i) => ({ it, i }))
      .sort((a, b) => {
        const sb = (SEV_RANK[b.it.severity] || 0) - (SEV_RANK[a.it.severity] || 0);
        if (sb !== 0) return sb;
        const tb = (TYPE_RANK[b.it.type] || 0) - (TYPE_RANK[a.it.type] || 0);
        if (tb !== 0) return tb;
        return a.i - b.i;
      })
      .map(({ it }) => it);

    return {
      insights: sorted,
      primary:  sorted.length > 0 ? sorted[0] : null,
    };
  } catch {
    return { insights: [], primary: null };
  }
}

/** Highest-priority insight, or null. The single calm Home line. */
export function pickPrimaryWeatherInsight(insights) {
  try {
    const list = Array.isArray(insights) ? insights.filter(Boolean) : [];
    if (list.length === 0) return null;
    return list.slice().sort((a, b) => {
      const sb = (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0);
      if (sb !== 0) return sb;
      return (TYPE_RANK[b.type] || 0) - (TYPE_RANK[a.type] || 0);
    })[0] || null;
  } catch {
    return null;
  }
}

/**
 * Localise a weather `localizedMessage` envelope with a tSafe-style
 * translator. Substitutes `{paramName}` from `params`.
 */
export function localizeWeatherMessage(msg, t) {
  try {
    if (!msg || typeof msg !== 'object') return '';
    const translator = typeof t === 'function' ? t : (_k, fb) => fb;
    let text = translator(msg.key, msg.fallback) || '';
    const params = (msg.params && typeof msg.params === 'object') ? msg.params : {};
    text = String(text).replace(/\{(\w+)\}/g, (_m, name) => {
      const v = params[name];
      return v == null ? '' : String(v);
    });
    return text.replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

const _module = {
  WEATHER_INSIGHT, SEVERITY,
  interpretWeather, pickPrimaryWeatherInsight, localizeWeatherMessage,
};
export default _module;
