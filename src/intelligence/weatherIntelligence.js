/**
 * weatherIntelligence.js — Phase 2 architecture interface.
 *
 * STATUS: STUB. Returns structured data only — no UI text, no
 * network calls, no side effects. NOT IMPORTED by any consumer
 * yet. Wire when product is ready to consolidate weather-aware
 * recommendations behind a single entrypoint.
 *
 * Existing scattered weather logic this module will eventually
 * consolidate:
 *   src/context/ForecastContext.jsx       (provider + cache)
 *   src/lib/weather/* (if present)        (provider adapters)
 *   src/lib/intelligence/smartAlertEngine (weather-driven alerts)
 *   src/lib/tasks/taskEngine               (weather-modifier layer)
 *
 * The wiring strategy when activating this stub:
 *   1. Move the consuming sites to call buildWeatherIntelligence()
 *   2. Delete (or thin) the per-call duplication in those files
 *   3. Add unit tests against the deterministic mapping below
 *
 * Until then this file is dead code that costs nothing at runtime
 * (no top-level side effects, no imports of the existing weather
 * stack, no entries in the bundle graph).
 *
 * Output shape (stable contract — do not break post-wire):
 *
 *   {
 *     status:          'safe' | 'watch' | 'risk',
 *     headlineKey:     string  // i18n key, never raw text
 *     recommendationKey: string  // i18n key
 *     reason:          string  // dev-only, never UI-rendered
 *     urgency:         'low' | 'medium' | 'high',
 *     factors: {
 *       rainExpected:    boolean,
 *       heatRisk:        boolean,
 *       humidityRisk:    boolean,
 *       windRisk:        boolean,
 *       soilDryRisk:     boolean,
 *     },
 *   }
 *
 * The UI consumes ONLY the *Key fields via t() so every output
 * is automatically multilingual; reason + factors are for
 * debugging / analytics.
 */

/**
 * @typedef {object} WeatherSnapshot
 * @property {number} [tempC]
 * @property {number} [rainProbability]   0..1
 * @property {number} [rainMmNext24h]
 * @property {number} [humidity]          0..1
 * @property {number} [windKph]
 * @property {number} [soilMoisture]      0..1 (estimated)
 *
 * @typedef {object} BuildArgs
 * @property {string}          [crop]
 * @property {string}          [stage]
 * @property {WeatherSnapshot} [weather]
 * @property {string}          [country]
 * @property {string}          [stateCode]
 *
 * @typedef {object} WeatherIntelligence
 * @property {'safe'|'watch'|'risk'} status
 * @property {string}                headlineKey
 * @property {string}                recommendationKey
 * @property {string}                reason
 * @property {'low'|'medium'|'high'} urgency
 * @property {object}                factors
 */

/**
 * @param {BuildArgs} input
 * @returns {WeatherIntelligence}
 */
export function buildWeatherIntelligence(input = {}) {
  const w = (input && input.weather) || {};
  const factors = {
    rainExpected: typeof w.rainProbability === 'number' && w.rainProbability >= 0.5,
    heatRisk:     typeof w.tempC === 'number' && w.tempC >= 32,
    humidityRisk: typeof w.humidity === 'number' && w.humidity >= 0.85,
    windRisk:     typeof w.windKph === 'number' && w.windKph >= 30,
    soilDryRisk:  typeof w.soilMoisture === 'number' && w.soilMoisture <= 0.25,
  };
  // Severity ladder is intentionally simple — the wiring PR can
  // replace this with a per-crop / per-stage matrix once a real
  // consumer pins requirements.
  const trippedHigh = factors.heatRisk || factors.windRisk;
  const trippedAny  = trippedHigh || factors.rainExpected || factors.humidityRisk || factors.soilDryRisk;
  const status = trippedHigh ? 'risk' : (trippedAny ? 'watch' : 'safe');
  const urgency = trippedHigh ? 'high' : (trippedAny ? 'medium' : 'low');

  // Pick the highest-priority single recommendation. The wiring
  // PR can promote this into a list for UIs that want all signals.
  let headlineKey = 'weatherIntelligence.headline.safe';
  let recommendationKey = 'weatherIntelligence.recommendation.continueRoutine';
  let reason = 'no factor tripped';
  if (factors.heatRisk) {
    headlineKey = 'weatherIntelligence.headline.heat';
    recommendationKey = 'weatherIntelligence.recommendation.waterEarlyMorning';
    reason = 'tempC >= 32';
  } else if (factors.windRisk) {
    headlineKey = 'weatherIntelligence.headline.wind';
    recommendationKey = 'weatherIntelligence.recommendation.protectYoungPlants';
    reason = 'windKph >= 30';
  } else if (factors.rainExpected) {
    headlineKey = 'weatherIntelligence.headline.rain';
    recommendationKey = 'weatherIntelligence.recommendation.delayWatering';
    reason = 'rainProbability >= 0.5';
  } else if (factors.humidityRisk) {
    headlineKey = 'weatherIntelligence.headline.humidity';
    recommendationKey = 'weatherIntelligence.recommendation.watchForFungus';
    reason = 'humidity >= 0.85';
  } else if (factors.soilDryRisk) {
    headlineKey = 'weatherIntelligence.headline.dry';
    recommendationKey = 'weatherIntelligence.recommendation.irrigate';
    reason = 'soilMoisture <= 0.25';
  }

  return Object.freeze({
    status, urgency, headlineKey, recommendationKey, reason,
    factors: Object.freeze(factors),
  });
}

export const WEATHER_INTELLIGENCE_VERSION = '0.1.0-stub';
