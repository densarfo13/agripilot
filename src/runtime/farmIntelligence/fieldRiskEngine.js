/**
 * fieldRiskEngine.js — Phase 10 daily field risk composite.
 *
 *   import { computeFieldRisk } from
 *     'src/runtime/farmIntelligence/fieldRiskEngine.js';
 *
 * What this is
 * ────────────
 *   Pure deterministic composite that produces a per-risk-kind
 *   level for the day. Reads ONLY the signals the caller supplies
 *   — no network, no clock, no global state. Six risk kinds:
 *
 *     disease, drought, flooding, heat_stress,
 *     nutrient_deficiency, pest_outbreak
 *
 *   Each is graded 'low' | 'medium' | 'high' with a per-risk reason
 *   string the UI can show without further reasoning.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • No raw probabilities exposed — every risk is graded into
 *     a 3-band human label.
 *   • Returns frozen envelope.
 */

const RUNTIME_VERSION = 'field-risk-engine-v1';

export const RISK_KIND = Object.freeze({
  DISEASE:              'disease',
  DROUGHT:              'drought',
  FLOODING:             'flooding',
  HEAT_STRESS:          'heat_stress',
  NUTRIENT_DEFICIENCY:  'nutrient_deficiency',
  PEST_OUTBREAK:        'pest_outbreak',
});

const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _str  = (v) => (typeof v === 'string' ? v : '');
const _clamp01 = (v) => Math.max(0, Math.min(1, _isNum(v) ? v : 0));

function _bandFromScore(s) {
  if (!_isNum(s)) return null;
  if (s >= 0.66) return 'high';
  if (s >= 0.33) return 'medium';
  return 'low';
}

// Per-risk evaluators. Each takes the signals envelope and returns
//   { level: 'low'|'medium'|'high'|null, reason: string }
// `null` means "insufficient data to grade".

function _evalDisease(signals) {
  const issueLoad = signals.recentScanIssueLoad;
  const humidity = signals.humidityRiskScore;
  const recent = signals.recentDiseaseDetections;
  if (!_isNum(issueLoad) && !_isNum(humidity) && !_isNum(recent)) {
    return { level: null, reason: 'no_disease_signals' };
  }
  const composite = (_clamp01(issueLoad) * 0.5)
                  + (_clamp01(humidity)  * 0.3)
                  + (_clamp01(recent != null ? recent / 3 : 0) * 0.2);
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'high_disease_signals'
          : composite >= 0.33 ? 'moderate_disease_signals'
          : 'low_disease_signals',
  };
}

function _evalDrought(signals) {
  const dryDays = signals.consecutiveDryDays;
  const rainRisk = signals.rainfallShortfall;
  const irrigation = signals.irrigationAvailable;
  if (!_isNum(dryDays) && !_isNum(rainRisk)) {
    return { level: null, reason: 'no_drought_signals' };
  }
  const dryComponent = _isNum(dryDays) ? Math.min(1, dryDays / 14) : 0;
  const rainComponent = _clamp01(rainRisk);
  let composite = (dryComponent * 0.6) + (rainComponent * 0.4);
  if (irrigation === true) composite *= 0.7; // discounted but not zero
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'extended_dry_period'
          : composite >= 0.33 ? 'rainfall_below_normal'
          : 'rainfall_sufficient',
  };
}

function _evalFlooding(signals) {
  const heavyRain = signals.heavyRainExpected;
  const saturation = signals.soilSaturation;
  if (!_isNum(saturation) && heavyRain == null) {
    return { level: null, reason: 'no_flooding_signals' };
  }
  const composite = (_clamp01(saturation) * 0.5)
                  + (heavyRain === true ? 0.5 : 0);
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'heavy_rain_saturated_soil'
          : composite >= 0.33 ? 'rain_or_saturation_present'
          : 'no_flood_risk',
  };
}

function _evalHeatStress(signals) {
  const tempMax = signals.expectedMaxTempC;
  const heatWave = signals.heatWaveActive;
  if (!_isNum(tempMax) && heatWave == null) {
    return { level: null, reason: 'no_heat_signals' };
  }
  // Heat stress scales from 30°C (none) to 40°C+ (high).
  const tempComponent = _isNum(tempMax)
    ? Math.max(0, Math.min(1, (tempMax - 30) / 10))
    : 0;
  const composite = (tempComponent * 0.7)
                  + (heatWave === true ? 0.3 : 0);
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'high_temperatures_today'
          : composite >= 0.33 ? 'warm_conditions_today'
          : 'temperatures_normal',
  };
}

function _evalNutrient(signals) {
  const yellowing = signals.recentYellowingDetections;
  const soilScore = signals.soilSuitabilityScore;
  if (!_isNum(yellowing) && !_isNum(soilScore)) {
    return { level: null, reason: 'no_nutrient_signals' };
  }
  const yellowComponent = _isNum(yellowing) ? Math.min(1, yellowing / 2) : 0;
  const soilComponent = _isNum(soilScore) ? (1 - _clamp01(soilScore)) : 0;
  const composite = (yellowComponent * 0.6) + (soilComponent * 0.4);
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'multiple_yellowing_or_poor_soil'
          : composite >= 0.33 ? 'some_nutrient_signals'
          : 'nutrient_state_normal',
  };
}

function _evalPest(signals) {
  const pressure = signals.pestPressure;
  const recent = signals.recentPestDetections;
  if (!_isNum(pressure) && !_isNum(recent)) {
    return { level: null, reason: 'no_pest_signals' };
  }
  const composite = (_clamp01(pressure) * 0.6)
                  + (_isNum(recent) ? Math.min(1, recent / 2) * 0.4 : 0);
  return {
    level: _bandFromScore(composite),
    reason: composite >= 0.66 ? 'high_pest_pressure'
          : composite >= 0.33 ? 'moderate_pest_pressure'
          : 'low_pest_pressure',
  };
}

const EVALUATORS = Object.freeze({
  [RISK_KIND.DISEASE]:             _evalDisease,
  [RISK_KIND.DROUGHT]:             _evalDrought,
  [RISK_KIND.FLOODING]:            _evalFlooding,
  [RISK_KIND.HEAT_STRESS]:         _evalHeatStress,
  [RISK_KIND.NUTRIENT_DEFICIENCY]: _evalNutrient,
  [RISK_KIND.PEST_OUTBREAK]:       _evalPest,
});

/**
 * @param {Object} signals — caller-supplied envelope. Missing
 *                            fields are tolerated.
 * @returns {Object} frozen risk snapshot.
 */
export function computeFieldRisk(signals) {
  const s = signals && typeof signals === 'object' ? signals : {};
  const risks = {};
  let highCount = 0;
  let mediumCount = 0;
  let gradedCount = 0;
  for (const kind of Object.values(RISK_KIND)) {
    const out = EVALUATORS[kind](s);
    risks[kind] = Object.freeze({
      kind,
      level:  out.level,
      reason: out.reason || null,
    });
    if (out.level != null) {
      gradedCount += 1;
      if (out.level === 'high') highCount += 1;
      else if (out.level === 'medium') mediumCount += 1;
    }
  }
  const topLevel = highCount > 0 ? 'high'
                 : mediumCount > 0 ? 'medium'
                 : gradedCount > 0 ? 'low' : 'insufficient';
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    topLevel,
    risks: Object.freeze(risks),
    summary: Object.freeze({
      highCount, mediumCount, gradedCount,
      totalRisks: Object.values(RISK_KIND).length,
    }),
  });
}

export const _internal = Object.freeze({
  _evalDisease, _evalDrought, _evalFlooding, _evalHeatStress,
  _evalNutrient, _evalPest, _bandFromScore,
});
