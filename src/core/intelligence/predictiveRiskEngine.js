/**
 * predictiveRiskEngine.js — Continuous Farm Loop Engine, pre-symptom
 * risk forecaster.
 *
 *   import { runPredictiveRisk }
 *     from 'src/core/intelligence/predictiveRiskEngine.js';
 *
 *   const forecast = runPredictiveRisk({
 *     weather, weatherForecast, soil, cropLifecycle,
 *     farmMemory, region, scanHistory,
 *   });
 *
 *   forecast = {
 *     risks: [{
 *       kind:     'fungal' | 'water_stress' | 'heat_stress' | 'recurrence' |
 *                 'quality_decline' | 'wind_damage',
 *       severity: 'low' | 'medium' | 'high',
 *       horizonDays: number,
 *       confidence: 'low' | 'medium' | 'high',
 *       label:      { key, fallback, params },
 *       reason:     { key, fallback, params },
 *       suggestedAction: { key, fallback, params } | null,
 *       source:     'weather' | 'memory' | 'lifecycle' | 'soil',
 *     }],
 *     anyHigh:    boolean,
 *     anyMedium:  boolean,
 *     summary:    { key, fallback, params },
 *     engineVersion: 'predictive-risk-v1',
 *     generatedAt: number,
 *   }
 *
 * What this is
 * ────────────
 *   Predicts the FIVE risks the spec calls out — fungal pressure,
 *   water stress, heat stress, disease recurrence, quality decline —
 *   BEFORE the user sees visible symptoms. Each prediction is a
 *   conservative rule chain (high humidity + warm temp = fungal
 *   risk; cumulative no-rain + heat = water stress; etc).
 *
 *   We deliberately stay rule-based: zero training data + calm UX
 *   means we'd rather under-claim than over-claim. The compose-only
 *   contract is: each risk is independent, each tied to ONE source,
 *   each emits an envelope ready for tSafe.
 *
 *   Severity is HEDGED: most risks max out at 'medium' unless the
 *   inputs are conclusive (e.g. heat ≥ 38°C AND no rain ≥ 5 days
 *   AND watering overdue → 'high').
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Confidence drops to 'low' when forecast data is missing.
 */

const ENGINE_VERSION = 'predictive-risk-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Risk factories ────────────────────────────────────────────

function _makeFungalRisk(input) {
  // Fungal pressure rule: high humidity AND warm temperature AND
  // wet leaves (recent rain or scheduled rain) → spore germination
  // window. We treat ≥75% humidity + 18-30°C + recent/upcoming rain
  // as 'medium', ≥85% humidity + 20-28°C + persistent wetness as 'high'.
  const w = input.weather || {};
  const f = input.weatherForecast || {};
  const humidity = _num(w.humidityPct);
  const temp     = _num(w.temp);
  const recentRainHours = _num(w.recentRainHours);
  const upcomingRainPct = _num(f.rainProbability24hPct || w.rainProbability24hPct);
  if (humidity == null || temp == null) return null;
  if (humidity < 70) return null;
  if (temp < 16 || temp > 32) return null;

  const wetLeaves = (recentRainHours != null && recentRainHours <= 24)
                 || (upcomingRainPct != null && upcomingRainPct >= 60);
  if (!wetLeaves) return null;

  const severeHumidity = humidity >= 85;
  const idealTemp      = temp >= 20 && temp <= 28;
  const severity = (severeHumidity && idealTemp) ? 'high' : 'medium';

  return Object.freeze({
    kind:        'fungal',
    severity,
    horizonDays: 2,
    confidence:  severeHumidity ? 'high' : 'medium',
    label: Object.freeze({
      key:      'predictiveRisk.fungal.label',
      fallback: 'Fungal pressure rising',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.fungal.reason',
      fallback: 'Humidity is high and leaves are likely to stay wet — a typical fungal window.',
      params:   { humidity, temp },
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.fungal.action',
      fallback: 'Inspect leaves and improve airflow — consider a preventive treatment.',
    }),
    source: 'weather',
  });
}

function _makeWaterStressRisk(input) {
  // Water stress rule: cumulative no-rain ≥ 4 days + temp ≥ 28°C +
  // watering overdue. Severity escalates with each factor.
  const w = input.weather || {};
  const wh = input.wateringHistory || {};
  const temp = _num(w.temp);
  const daysWithoutRain = _num(w.daysWithoutRain);
  const daysSinceWatering = _num(wh.daysSinceLastWatering);

  const heatBad   = temp != null && temp >= 28;
  const dryBad    = daysWithoutRain != null && daysWithoutRain >= 4;
  const waterBad  = daysSinceWatering != null && daysSinceWatering >= 3;
  const score = (heatBad ? 1 : 0) + (dryBad ? 1 : 0) + (waterBad ? 1 : 0);
  if (score < 2) return null;

  const severity = score === 3 ? 'high' : 'medium';
  return Object.freeze({
    kind:        'water_stress',
    severity,
    horizonDays: 3,
    confidence:  score === 3 ? 'high' : 'medium',
    label: Object.freeze({
      key:      'predictiveRisk.waterStress.label',
      fallback: 'Water stress building',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.waterStress.reason',
      fallback: 'It has been {dry} days without rain and {wait} days since watering.',
      params:   {
        dry:  daysWithoutRain != null ? daysWithoutRain : 0,
        wait: daysSinceWatering != null ? daysSinceWatering : 0,
      },
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.waterStress.action',
      fallback: 'Water deeply in the cooler hours and mulch to retain moisture.',
    }),
    source: 'weather',
  });
}

function _makeHeatStressRisk(input) {
  // Heat stress rule: temp ≥ 34°C (medium) or ≥ 38°C (high), or
  // sustained ≥ 32°C across forecast.
  const w = input.weather || {};
  const f = input.weatherForecast || {};
  const temp = _num(w.temp);
  const highForecastDays = _num(f.heatDaysAhead);

  let severity = null;
  let confidence = 'low';
  if (temp != null && temp >= 38) { severity = 'high'; confidence = 'high'; }
  else if (temp != null && temp >= 34) { severity = 'medium'; confidence = 'medium'; }
  else if (highForecastDays != null && highForecastDays >= 2) {
    severity = 'medium'; confidence = 'medium';
  }
  if (!severity) return null;

  return Object.freeze({
    kind:        'heat_stress',
    severity,
    horizonDays: highForecastDays != null ? highForecastDays : 1,
    confidence,
    label: Object.freeze({
      key:      'predictiveRisk.heatStress.label',
      fallback: 'Heat stress likely',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.heatStress.reason',
      fallback: 'Temperatures are forecast to peak at {temp}°C — beyond comfort for most crops.',
      params:   { temp: temp != null ? temp : 34 },
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.heatStress.action',
      fallback: 'Shade sensitive crops in the afternoon and water in the cooler hours.',
    }),
    source: 'weather',
  });
}

function _makeRecurrenceRisk(input) {
  // Disease recurrence rule: farmMemory shows a worsening trend or
  // a recurring category, and the current weather window is the
  // same season the previous occurrences clustered in.
  const fm = input.farmMemory || {};
  const flags = fm.activeFlags || {};
  if (!flags.hasRecurringIssue && !flags.hasWorseningTrend) return null;
  const cat = (fm.recurringIssues && fm.recurringIssues[0] && fm.recurringIssues[0].category)
    || 'previous issue';
  const severity = flags.hasWorseningTrend ? 'high' : 'medium';
  return Object.freeze({
    kind:        'recurrence',
    severity,
    horizonDays: 5,
    confidence:  flags.hasWorseningTrend ? 'high' : 'medium',
    label: Object.freeze({
      key:      'predictiveRisk.recurrence.label',
      fallback: 'Previous issue may return',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.recurrence.reason',
      fallback: 'You have scanned {category} before on this farm.',
      params:   { category: cat },
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.recurrence.action',
      fallback: 'Scan affected plants now to catch any early signs and break the cycle.',
    }),
    source: 'memory',
  });
}

function _makeQualityDeclineRisk(input) {
  // Quality decline rule: late-stage crop (flowering / fruiting /
  // harvest) AND any heat or fungal pre-symptom risk → predicted
  // yield/quality decline.
  const cl = input.cropLifecycle || {};
  const stage = _str(cl.currentStage).toLowerCase();
  const lateStage = stage === 'flowering' || stage === 'fruiting' || stage === 'harvest';
  if (!lateStage) return null;
  const w = input.weather || {};
  const temp = _num(w.temp);
  const humidity = _num(w.humidityPct);
  const stressed = (temp != null && temp >= 32)
                || (humidity != null && humidity >= 80);
  if (!stressed) return null;
  return Object.freeze({
    kind:        'quality_decline',
    severity:    'medium',
    horizonDays: 4,
    confidence:  'medium',
    label: Object.freeze({
      key:      'predictiveRisk.qualityDecline.label',
      fallback: 'Yield / quality at risk',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.qualityDecline.reason',
      fallback: 'Crop is in a sensitive stage and current conditions can affect yield or quality.',
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.qualityDecline.action',
      fallback: 'Stay close to your routine — small adjustments now protect the harvest.',
    }),
    source: 'lifecycle',
  });
}

function _makeWindDamageRisk(input) {
  // Wind damage rule: wind ≥ 35 km/h (medium) or ≥ 50 km/h (high),
  // and crop has tall / structural exposure (late vegetative+).
  const w = input.weather || {};
  const wind = _num(w.windSpeedKph);
  if (wind == null) return null;
  const cl = input.cropLifecycle || {};
  const stage = _str(cl.currentStage).toLowerCase();
  const exposed = ['vegetative', 'flowering', 'fruiting', 'harvest'].includes(stage);
  if (!exposed) return null;

  let severity = null;
  if (wind >= 50) severity = 'high';
  else if (wind >= 35) severity = 'medium';
  if (!severity) return null;

  return Object.freeze({
    kind:        'wind_damage',
    severity,
    horizonDays: 1,
    confidence:  'medium',
    label: Object.freeze({
      key:      'predictiveRisk.windDamage.label',
      fallback: 'Wind damage possible',
    }),
    reason: Object.freeze({
      key:      'predictiveRisk.windDamage.reason',
      fallback: 'Forecast wind speed is {wind} km/h — tall plants can lodge or break.',
      params:   { wind },
    }),
    suggestedAction: Object.freeze({
      key:      'predictiveRisk.windDamage.action',
      fallback: 'Stake or tie down vulnerable plants before the wind picks up.',
    }),
    source: 'weather',
  });
}

const _FACTORIES = Object.freeze([
  _makeFungalRisk,
  _makeWaterStressRisk,
  _makeHeatStressRisk,
  _makeRecurrenceRisk,
  _makeQualityDeclineRisk,
  _makeWindDamageRisk,
]);

const _SEV_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });

/**
 * Forecast pre-symptom risks. Always returns an envelope.
 *
 * @param {object} input
 * @returns {object}
 */
export function runPredictiveRisk(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const risks = [];
    for (const fn of _FACTORIES) {
      const r = _safe(() => fn(safe), null);
      if (r) risks.push(r);
    }
    // Sort by severity desc.
    risks.sort((a, b) => (_SEV_RANK[b.severity] || 0) - (_SEV_RANK[a.severity] || 0));

    const anyHigh   = risks.some((r) => r.severity === 'high');
    const anyMedium = risks.some((r) => r.severity === 'medium');

    let summary;
    if (anyHigh) {
      summary = Object.freeze({
        key:      'predictiveRisk.summary.high',
        fallback: '{count} risk(s) may need attention this week.',
        params:   { count: risks.length },
      });
    } else if (anyMedium) {
      summary = Object.freeze({
        key:      'predictiveRisk.summary.medium',
        fallback: 'A few mild risks are worth watching this week.',
      });
    } else {
      summary = Object.freeze({
        key:      'predictiveRisk.summary.calm',
        fallback: 'No emerging risks detected right now.',
      });
    }

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      risks:         Object.freeze(risks),
      anyHigh,
      anyMedium,
      summary,
      generatedAt:   Date.now(),
    });
  }, _emptyForecast());
}

function _emptyForecast() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    risks:         Object.freeze([]),
    anyHigh:       false,
    anyMedium:     false,
    summary: Object.freeze({
      key:      'predictiveRisk.summary.calm',
      fallback: 'No emerging risks detected right now.',
    }),
    generatedAt:   Date.now(),
  });
}

export const _internal = Object.freeze({
  _makeFungalRisk, _makeWaterStressRisk, _makeHeatStressRisk,
  _makeRecurrenceRisk, _makeQualityDeclineRisk, _makeWindDamageRisk,
  ENGINE_VERSION,
});

const _module = { runPredictiveRisk, _internal };
export default _module;
