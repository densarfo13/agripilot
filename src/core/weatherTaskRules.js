/**
 * weatherTaskRules.js — pure rules that turn a weather
 * snapshot into actionable nudges for the daily plan.
 *
 * Strict-rule audit (spec §15):
 *   • Never recommend pesticide / chemical dosage.
 *   • Never instruct the farmer to spray during high wind.
 *   • Use "check / inspect / consider" wording.
 *
 * Output:
 *   {
 *     actions: DailyAction[],   // suggested weather-driven tasks
 *     alerts:  DailyAlert[],    // banner-style warnings
 *   }
 *
 * Input shape (loose — every field is optional):
 *   {
 *     rainExpected:        boolean,
 *     heavyRainRisk:       boolean,
 *     drySpellRisk:        boolean,
 *     temperatureC:        number,
 *     humidityPct:         number,
 *     windSpeedKph:        number,
 *     forecastDate:        string,
 *     condition:           string,
 *   }
 *
 * Each action carries:
 *   { id, title, reason, urgency, actionType }
 * — exactly the shape DailyAction in dailyIntelligenceEngine.
 */

const A = (id, title, reason, urgency, actionType) => ({
  id, title, reason, urgency, actionType,
});
const AL = (id, title, message, severity) => ({
  id, title, message, severity,
});

/**
 * applyWeatherRules — produces a NEW { actions, alerts } pair
 * each call. Pure; no I/O.
 */
export function applyWeatherRules(weather) {
  const actions = [];
  const alerts  = [];

  if (!weather || typeof weather !== 'object') {
    return { actions, alerts };
  }

  // ── Rain risk ────────────────────────────────────────────
  if (weather.heavyRainRisk) {
    alerts.push(AL(
      'wx.heavyRain',
      'Heavy rain expected',
      'Avoid watering and check that drainage channels are clear.',
      'critical',
    ));
    actions.push(A(
      'wx.checkDrainage',
      'Check drainage channels',
      'Heavy rain is expected — clear channels so water flows away from your crop.',
      'high',
      'inspect',
    ));
  } else if (weather.rainExpected) {
    alerts.push(AL(
      'wx.rainExpected',
      'Rain expected today',
      'Skip watering today unless the soil is dry — let the rain do the work.',
      'info',
    ));
    actions.push(A(
      'wx.delayWatering',
      'Delay watering today',
      'Rain is expected later — your crop should get enough water from it.',
      'medium',
      'wait',
    ));
  }

  // ── Dry-spell / heat ─────────────────────────────────────
  if (weather.drySpellRisk
      || (typeof weather.temperatureC === 'number' && weather.temperatureC >= 33)) {
    alerts.push(AL(
      'wx.heat',
      'Hot, dry weather',
      'Check soil moisture. Consider watering early morning or late afternoon.',
      'warning',
    ));
    actions.push(A(
      'wx.checkSoilMoisture',
      'Check soil moisture',
      'Hot, dry conditions can stress the crop — feel the soil 5 cm down to decide.',
      'high',
      'inspect',
    ));
  }

  // ── Humidity → pest / disease pressure ──────────────────
  if (typeof weather.humidityPct === 'number' && weather.humidityPct >= 80) {
    alerts.push(AL(
      'wx.humidity',
      'High humidity',
      'Pest and disease pressure is higher in humid weather.',
      'info',
    ));
    actions.push(A(
      'wx.inspectPestDisease',
      'Inspect for pests and disease',
      'High humidity makes leaf disease and pest damage more likely.',
      'medium',
      'inspect',
    ));
  }

  // ── Wind → suspend spraying ──────────────────────────────
  if (typeof weather.windSpeedKph === 'number' && weather.windSpeedKph >= 25) {
    alerts.push(AL(
      'wx.wind',
      'Strong wind today',
      'Do not spray any product today — wind will carry it off your crop.',
      'critical',
    ));
    // No action emitted — the alert itself is the actionable
    // instruction (spec §15 forbids spraying under wind).
  }

  return { actions, alerts };
}

export const _internal = Object.freeze({ /* nothing */ });
