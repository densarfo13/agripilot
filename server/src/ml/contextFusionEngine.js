/**
 * contextFusionEngine.js — server-side mirror of the frontend
 * hybrid scan engine. Same rule pipeline, same safe taxonomy,
 * runs after the inference service so the queue worker can
 * produce a complete verdict without waiting on the client.
 *
 *   import { fuseContext } from './contextFusionEngine.js';
 *   const verdict = fuseContext({
 *     symptom:    'spots',         // from analyzePlantImage
 *     confidence: 'medium',         // from analyzePlantImage
 *     activeExperience: 'farm',
 *     country, region, weather,
 *     scanHistory,                  // optional — escalation signal
 *   });
 *
 * Strict rules (mirror src/core/hybridScanEngine.js)
 *   * Pure function. Never throws.
 *   * Output uses ONLY the safe taxonomy (Possible* / Looks* /
 *     Needs* / Unknown). Never emits "confirmed disease",
 *     "guaranteed", or specific dosage.
 *   * Confidence rules:
 *       HIGH   — ML signal + weather/region agree
 *       MEDIUM — ML signal clear but context incomplete
 *       LOW    — unclear image or conflicting signals
 *   * `repeated same issue` raises urgency to TODAY (spec §7).
 */

export const ISSUES = Object.freeze({
  LOOKS_HEALTHY:                'Looks healthy',
  NEEDS_CLOSER_INSPECTION:      'Needs closer inspection',
  POSSIBLE_PEST_DAMAGE:         'Possible pest damage',
  POSSIBLE_FUNGAL_STRESS:       'Possible fungal stress',
  POSSIBLE_NUTRIENT_DEFICIENCY: 'Possible nutrient deficiency',
  POSSIBLE_WATER_STRESS:        'Possible water stress',
  POSSIBLE_HEAT_STRESS:         'Possible heat stress',
  POSSIBLE_TRANSPLANT_SHOCK:    'Possible transplant shock',
  UNKNOWN:                      'Unknown issue',
});

const ALLOWED = new Set(Object.values(ISSUES));

const URGENCY = Object.freeze({
  TODAY:     'Today',
  THIS_WEEK: 'This week',
  MONITOR:   'Monitor',
});

function _weatherSignals(weather) {
  const w = weather && typeof weather === 'object' ? weather : {};
  const tempC      = Number(w.temperatureC ?? w.tempC ?? w.temp);
  const humidity   = Number(w.humidity ?? w.relativeHumidity);
  const rainMm     = Number(w.rainMm ?? w.precipitationMm ?? w.rain);
  const recentRain = Boolean(w.recentRain ?? w.rainedRecently);
  const soilWet    = String(w.soil || '').toLowerCase() === 'wet' || recentRain;
  const soilDry    = String(w.soil || '').toLowerCase() === 'dry';
  return {
    hot:       Number.isFinite(tempC) && tempC >= 30,
    humid:     Number.isFinite(humidity) && humidity >= 70,
    rainy:     recentRain || (Number.isFinite(rainMm) && rainMm >= 5),
    soilWet,
    soilDry,
    hasSignal: Number.isFinite(tempC) || Number.isFinite(humidity)
            || Number.isFinite(rainMm) || recentRain || soilWet || soilDry,
  };
}

function _resolveIssue(symptom, weather) {
  if (symptom === 'healthy')  return { issue: ISSUES.LOOKS_HEALTHY,            support: 'image' };
  if (symptom === 'unclear')  return { issue: ISSUES.NEEDS_CLOSER_INSPECTION,  support: null };

  if (symptom === 'spots'  && (weather.humid || weather.rainy)) {
    return { issue: ISSUES.POSSIBLE_FUNGAL_STRESS, support: 'weather' };
  }
  if (symptom === 'yellow' && (weather.soilWet || weather.rainy)) {
    return { issue: ISSUES.POSSIBLE_WATER_STRESS,  support: 'weather' };
  }
  if ((symptom === 'wilt' || symptom === 'discoloration')
      && weather.soilDry && weather.hot) {
    return { issue: ISSUES.POSSIBLE_WATER_STRESS,  support: 'weather' };
  }
  if (weather.hot && symptom === 'discoloration') {
    return { issue: ISSUES.POSSIBLE_HEAT_STRESS,   support: 'weather' };
  }
  if (symptom === 'holes')         return { issue: ISSUES.POSSIBLE_PEST_DAMAGE,         support: 'image' };
  if (symptom === 'spots')         return { issue: ISSUES.POSSIBLE_FUNGAL_STRESS,       support: 'image' };
  if (symptom === 'yellow')        return { issue: ISSUES.POSSIBLE_NUTRIENT_DEFICIENCY, support: 'image' };
  if (symptom === 'wilt')          return { issue: ISSUES.POSSIBLE_WATER_STRESS,        support: 'image' };
  if (symptom === 'discoloration') return { issue: ISSUES.POSSIBLE_HEAT_STRESS,         support: 'image' };

  return { issue: ISSUES.NEEDS_CLOSER_INSPECTION, support: null };
}

function _confidenceFromSignals(mlConfidence, support, weather) {
  // ML signal + context agree → high.
  if (support === 'weather' && (mlConfidence === 'high' || mlConfidence === 'medium')) return 'high';
  if (support === 'image'   && mlConfidence === 'high'   && weather.hasSignal)         return 'high';
  if (support === 'image'   && mlConfidence === 'high')                                 return 'medium';
  if (support === 'image'   && mlConfidence === 'medium')                               return 'medium';
  return 'low';
}

function _isRepeatedIssue(scanHistory, issue, lookbackHours = 7 * 24) {
  if (!Array.isArray(scanHistory) || scanHistory.length === 0) return false;
  const now = Date.now();
  const cutoff = now - (lookbackHours * 3600 * 1000);
  let count = 0;
  for (const e of scanHistory) {
    if (!e || e.possibleIssue !== issue) continue;
    const t = Date.parse(e.createdAt || '');
    if (Number.isFinite(t) && t >= cutoff) count += 1;
    if (count >= 2) return true;
  }
  return false;
}

function _urgency(issue, repeated) {
  if (issue === ISSUES.LOOKS_HEALTHY)            return URGENCY.MONITOR;
  if (repeated)                                  return URGENCY.TODAY;
  if (issue === ISSUES.NEEDS_CLOSER_INSPECTION) return URGENCY.TODAY;
  if (issue === ISSUES.POSSIBLE_FUNGAL_STRESS
   || issue === ISSUES.POSSIBLE_PEST_DAMAGE)    return URGENCY.TODAY;
  return URGENCY.THIS_WEEK;
}

/**
 * fuseContext(input) → verdict.
 *
 * @param {object} input
 * @param {string} input.symptom               from analyzePlantImage
 * @param {'low'|'medium'|'high'} input.confidence  from analyzePlantImage
 * @param {string} [input.activeExperience]    'garden' | 'farm'
 * @param {string} [input.country]
 * @param {string} [input.region]
 * @param {object} [input.weather]
 * @param {Array}  [input.scanHistory]
 * @returns {{ possibleIssue, confidence, urgency, support, repeated, contextType }}
 */
export function fuseContext(input = {}) {
  const safe = (input && typeof input === 'object') ? input : {};
  const weather  = _weatherSignals(safe.weather);
  const symptom  = String(safe.symptom || 'unclear').toLowerCase();
  const ml       = String(safe.confidence || 'low').toLowerCase();
  const { issue, support } = _resolveIssue(symptom, weather);
  const confidence = _confidenceFromSignals(ml, support, weather);
  const repeated   = _isRepeatedIssue(safe.scanHistory, issue);
  const urgency    = _urgency(issue, repeated);
  const exp        = String(safe.activeExperience || '').toLowerCase();
  const contextType = (exp === 'garden' || exp === 'backyard') ? 'garden'
                    : (exp === 'farm' ? 'farm' : 'generic');
  const possibleIssue = ALLOWED.has(issue) ? issue : ISSUES.NEEDS_CLOSER_INSPECTION;
  return {
    possibleIssue,
    confidence,
    urgency,
    support,
    repeated,
    contextType,
  };
}

export default fuseContext;
