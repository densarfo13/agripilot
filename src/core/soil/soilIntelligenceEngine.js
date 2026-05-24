/**
 * soilIntelligenceEngine.js — hedged soil-context engine.
 *
 *   import { analyzeSoilContext, SOIL_RISK }
 *     from 'src/core/soil/soilIntelligenceEngine.js';
 *
 *   const s = analyzeSoilContext({
 *     crop: 'tomato', stage: 'planting',
 *     soil: { type: 'sandy', drainage: 'good' },
 *     weather: { daysSinceRain: 9, rainProbability24hPct: 10 },
 *     scan:    { issueCategory: 'water_stress' },
 *   });
 *   // s.soilRisk          → 'low' | 'moderate' | 'high' | 'unknown'
 *   // s.drainageRisk      → ditto
 *   // s.moistureRisk      → ditto
 *   // s.nutrientRisk      → ditto
 *   // s.recommendedCheck  → { key, fallback, params } | null
 *   // s.safeGuidance      → [{ key, fallback, params }]
 *   // s.confidence        → 'low' | 'medium' (NEVER 'high')
 *   // s.isEstimate        → true
 *   // s.disclaimer        → { key, fallback }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Honest soil reasoning. Inputs are user-entered soil notes +
 *   the same intelligence-snapshot signals other engines use
 *   (crop / lifecycle stage / weather / scan).
 *
 *   It NEVER returns exact pH, nitrogen, phosphorus, or potassium
 *   numbers unless real soil-test data was supplied. When data is
 *   sparse it returns `unknown` / `low` confidence and points the
 *   user toward a soil test — better honest gaps than fabricated
 *   precision.
 *
 *   `confidence` is HARD-CAPPED at 'medium'. The string 'high' is
 *   never returned — the spec rules out claiming certainty in
 *   this domain.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Every text envelope is
 *     `{ key, fallback, params }`.
 */

export const SOIL_RISK = Object.freeze({
  LOW:      'low',
  MODERATE: 'moderate',
  HIGH:     'high',
  UNKNOWN:  'unknown',
});

const _str = (v) => String(v == null ? '' : v).toLowerCase();
// IMPORTANT: explicit null/undefined guard. `Number(null)` is 0,
// not NaN, which would silently coerce missing values into "0 days
// since rain" or "0% organic matter" — both of which would cause
// the engine to fire false-positive moderate-risk verdicts for
// users who simply haven't entered the data yet. Returning null
// keeps the "no signal" branch reachable.
const _num = (v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

const _DISCLAIMER = Object.freeze({
  key:      'soil.disclaimer.estimate',
  fallback: 'Soil guidance is an estimate — local conditions vary. Consider a soil test for important decisions.',
});

// ─── Sub-engines ────────────────────────────────────────

function _drainageRisk(soil, weather) {
  try {
    if (!soil && !weather) return SOIL_RISK.UNKNOWN;
    const drainage = _str(soil && soil.drainage);
    if (drainage === 'poor') return SOIL_RISK.HIGH;
    if (drainage === 'good') return SOIL_RISK.LOW;
    // No explicit drainage — infer cautiously from soil type.
    const type = _str(soil && soil.type);
    if (type === 'clay')  return SOIL_RISK.MODERATE;
    if (type === 'sandy') return SOIL_RISK.LOW;  // sandy drains fast → low risk
    if (type === 'loam')  return SOIL_RISK.LOW;
    return SOIL_RISK.UNKNOWN;
  } catch { return SOIL_RISK.UNKNOWN; }
}

function _moistureRisk(soil, weather, scan) {
  try {
    const days = _num(weather && weather.daysSinceRain);
    const rainPct = _num(weather && weather.rainProbability24hPct);
    const scanCat = _str(scan && scan.issueCategory);
    // Strongest signal: scan says water stress.
    if (scanCat === 'water_stress') return SOIL_RISK.HIGH;
    // Heavy rain coming + clay/poor drainage → moisture overload.
    if (rainPct != null && rainPct >= 70) {
      const drainage = _drainageRisk(soil, weather);
      if (drainage === SOIL_RISK.HIGH) return SOIL_RISK.HIGH;
    }
    // Dry spell → moisture risk scales with days.
    if (days != null && days >= 10) return SOIL_RISK.HIGH;
    if (days != null && days >= 6)  return SOIL_RISK.MODERATE;
    if (soil && _str(soil.type) === 'sandy' && days != null && days >= 4) return SOIL_RISK.MODERATE;
    if (days == null && !scan && !soil) return SOIL_RISK.UNKNOWN;
    return SOIL_RISK.LOW;
  } catch { return SOIL_RISK.UNKNOWN; }
}

function _nutrientRisk(soil, scan, stage) {
  try {
    const cat = _str(scan && scan.issueCategory);
    if (cat === 'nutrient_stress') return SOIL_RISK.HIGH;
    // Post-harvest soil is often depleted — flag for attention.
    if (_str(stage) === 'post_harvest') return SOIL_RISK.MODERATE;
    // User-supplied "low organic matter" note.
    const om = _num(soil && soil.organicMatterPct);
    if (om != null && om < 1.5) return SOIL_RISK.MODERATE;
    if (soil && (soil.testPH != null || soil.organicMatterPct != null)) {
      return SOIL_RISK.LOW;
    }
    return SOIL_RISK.UNKNOWN;
  } catch { return SOIL_RISK.UNKNOWN; }
}

function _overallSoilRisk(...risks) {
  // Rank: HIGH > MODERATE > LOW > UNKNOWN. Returns the highest.
  const order = { high: 3, moderate: 2, low: 1, unknown: 0 };
  let best = SOIL_RISK.UNKNOWN;
  for (const r of risks) {
    if ((order[r] || 0) > (order[best] || 0)) best = r;
  }
  return best;
}

function _safeGuidance(stage, soilRisk, moistureRisk, drainageRisk, nutrientRisk) {
  const out = [];
  switch (_str(stage)) {
    case 'planning':
    case 'planting':
      out.push(_msg('soil.guidance.improveSoil', 'Consider adding compost or organic matter before planting.'));
      out.push(_msg('soil.guidance.checkDrainage', 'Check that water drains within an hour after a heavy pour.'));
      break;
    case 'vegetative':
    case 'flowering':
    case 'fruiting':
      out.push(_msg('soil.guidance.mulchSteady', 'A layer of mulch helps keep soil moisture steady.'));
      break;
    case 'harvest_ready':
    case 'harvest':
      out.push(_msg('soil.guidance.holdSteady', 'Avoid sudden changes — keep watering steady through harvest.'));
      break;
    case 'post_harvest':
      out.push(_msg('soil.guidance.recoverSoil', 'Add compost or rest the bed to help the soil recover.'));
      out.push(_msg('soil.guidance.rotateCrops', 'Consider a different crop family next season to keep the soil healthy.'));
      break;
    default: break;
  }
  if (moistureRisk === SOIL_RISK.HIGH)
    out.push(_msg('soil.guidance.moistureHigh', 'Soil may be very dry — water deeply rather than often.'));
  if (drainageRisk === SOIL_RISK.HIGH)
    out.push(_msg('soil.guidance.drainagePoor', 'Drainage looks slow — consider raised beds or extra organic matter.'));
  if (nutrientRisk === SOIL_RISK.HIGH || nutrientRisk === SOIL_RISK.MODERATE)
    out.push(_msg('soil.guidance.nutrientCheck', 'A soil test may show what nutrients to add.'));
  return out;
}

function _recommendedCheck(soilRisk, moistureRisk, drainageRisk, nutrientRisk, soil) {
  // If user already supplied a recent soil test, no need to push.
  if (soil && soil.testPH != null) return null;
  if (nutrientRisk === SOIL_RISK.HIGH) {
    return _msg('soil.check.testForNutrients', 'A soil test can clarify what nutrients to add.');
  }
  if (soilRisk === SOIL_RISK.HIGH) {
    return _msg('soil.check.testSoil', 'Consider a soil test to confirm what the soil needs.');
  }
  return null;
}

function _confidenceFor(soil, scan, weather) {
  // Never 'high'. Spec: only hedged outputs unless real lab data
  // is wired in.
  const haveSoil    = !!soil;
  const haveScan    = !!scan;
  const haveWeather = !!weather && (weather.daysSinceRain != null || weather.temperatureC != null);
  const signals = (haveSoil ? 1 : 0) + (haveScan ? 1 : 0) + (haveWeather ? 1 : 0);
  return signals >= 2 ? 'medium' : 'low';
}

/**
 * Compute the soil-context view for the current snapshot.
 *
 * @param {object} ctx
 * @returns {object}
 */
export function analyzeSoilContext(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const soil = (c.soil && typeof c.soil === 'object') ? c.soil : null;
    const weather = (c.weather && typeof c.weather === 'object') ? c.weather : null;
    const scan = (c.scan && typeof c.scan === 'object') ? c.scan : null;

    const drainageRisk = _drainageRisk(soil, weather);
    const moistureRisk = _moistureRisk(soil, weather, scan);
    const nutrientRisk = _nutrientRisk(soil, scan, c.stage);
    const soilRisk = _overallSoilRisk(drainageRisk, moistureRisk, nutrientRisk);

    return {
      ok:               true,
      soilRisk,
      drainageRisk,
      moistureRisk,
      nutrientRisk,
      recommendedCheck: _recommendedCheck(soilRisk, moistureRisk, drainageRisk, nutrientRisk, soil),
      safeGuidance:     _safeGuidance(c.stage, soilRisk, moistureRisk, drainageRisk, nutrientRisk),
      confidence:       _confidenceFor(soil, scan, weather),
      isEstimate:       true,
      disclaimer:       { ..._DISCLAIMER },
    };
  } catch {
    return {
      ok:               false,
      soilRisk:         SOIL_RISK.UNKNOWN,
      drainageRisk:     SOIL_RISK.UNKNOWN,
      moistureRisk:     SOIL_RISK.UNKNOWN,
      nutrientRisk:     SOIL_RISK.UNKNOWN,
      recommendedCheck: null,
      safeGuidance:     [],
      confidence:       'low',
      isEstimate:       true,
      disclaimer:       { ..._DISCLAIMER },
    };
  }
}

const _module = { SOIL_RISK, analyzeSoilContext };
export default _module;
