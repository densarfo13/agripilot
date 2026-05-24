/**
 * riskEngine.js — composes weather + scan + lifecycle stage into
 * ranked operational risks.
 *
 *   import { detectFarmRisks, RISK_TYPE }
 *     from 'src/core/intelligence/riskEngine.js';
 *
 *   const risks = detectFarmRisks({ weather, scanHistory, lifecycle });
 *   // → [{ type, severity, message, why, prevention }, …]
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure rule-based detector that classifies the SIX risk
 *   classes the spec lists (fungal / heat-stress / drought /
 *   overwatering / pest-likelihood / harvest-spoilage). No ML —
 *   each risk is gated by simple, auditable signals.
 *
 *   It does NOT duplicate `farmHealthScore` (a categorical
 *   state) or `weatherOperationalInterpreter` (single best
 *   weather insight). This module returns a RANKED LIST so
 *   surfaces can render risk badges side-by-side.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Hedged wording — no "confirmed".
 *   • Every message + prevention is a { key, fallback, params }
 *     envelope.
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

export const RISK_TYPE = Object.freeze({
  FUNGAL:           'fungal',
  HEAT_STRESS:      'heat_stress',
  DROUGHT:          'drought',
  OVERWATERING:     'overwatering',
  PEST_LIKELIHOOD:  'pest_likelihood',
  HARVEST_SPOILAGE: 'harvest_spoilage',
});

export const RISK_SEVERITY = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

const SEV_RANK = { high: 3, medium: 2, low: 1 };

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

function _risk(type, severity, messageKey, messageFallback, whyKey, whyFallback, preventionKey, preventionFallback, crop) {
  return {
    type,
    severity,
    message:    _msg(messageKey, messageFallback, { crop }),
    why:        _msg(whyKey, whyFallback, { crop }),
    prevention: _msg(preventionKey, preventionFallback, { crop }),
  };
}

function _classifyRecentScan(scanHistory) {
  try {
    const list = Array.isArray(scanHistory) ? scanHistory : [];
    if (list.length === 0) return null;
    const recent = list[list.length - 1];
    return _str(recent && (recent.issueCategory || recent.category));
  } catch { return null; }
}

/**
 * Detect operational risks and rank them by severity.
 *
 * @param {object} args
 * @param {object} [args.weather]
 * @param {Array}  [args.scanHistory]
 * @param {object} [args.lifecycle]   from cropLifecycleEngine
 * @param {string} [args.crop]
 * @returns {Array<object>}
 */
export function detectFarmRisks(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const w = (a.weather && typeof a.weather === 'object') ? a.weather : {};
    const lifecycle = (a.lifecycle && typeof a.lifecycle === 'object') ? a.lifecycle : {};
    const crop = String(a.crop || lifecycle.crop || 'the plant');
    const stage = _str(lifecycle.currentStage);
    const scanCat = _classifyRecentScan(a.scanHistory);

    const tempC = _num(w.temperatureC);
    const humidity = _num(w.humidityPct);
    const rainProb = _num(w.rainProbability24hPct);
    const rainToday = _num(w.rainfallTodayMm);
    const daysSinceRain = _num(w.daysSinceRain);

    const risks = [];

    // 1. Fungal — cool/humid OR recent rain + scan history of fungal/leaf-spot.
    if ((humidity != null && humidity >= 80 && tempC != null && tempC <= 28)
        || scanCat === 'fungal_risk' || scanCat === 'leaf_spot') {
      const severe = scanCat === 'fungal_risk' && humidity != null && humidity >= 85;
      risks.push(_risk(
        RISK_TYPE.FUNGAL,
        severe ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        'risk.msg.fungal',   'Fungal risk rising on {crop}.',
        'risk.why.fungal',   'High humidity and cool conditions favour fungal growth.',
        'risk.prev.fungal',  'Water at the base, improve airflow, and remove badly affected leaves.',
        crop,
      ));
    }

    // 2. Heat stress — high temp + flowering / fruiting / seedling stages most exposed.
    if (tempC != null && tempC >= 32) {
      const tender = (stage === 'seedling' || stage === 'germination' || stage === 'flowering' || stage === 'fruiting');
      risks.push(_risk(
        RISK_TYPE.HEAT_STRESS,
        tempC >= 38 ? RISK_SEVERITY.HIGH : (tender ? RISK_SEVERITY.MEDIUM : RISK_SEVERITY.LOW),
        'risk.msg.heat',     'Heat stress likely for {crop}.',
        'risk.why.heat',     'Today’s temperature is high — plants lose water faster.',
        'risk.prev.heat',    'Water in the cool hours; provide shade for tender plants.',
        crop,
      ));
    }

    // 3. Drought — long dry spell + no rain in forecast.
    if (daysSinceRain != null && daysSinceRain >= 7
        && (rainProb == null || rainProb < 30)) {
      risks.push(_risk(
        RISK_TYPE.DROUGHT,
        daysSinceRain >= 14 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        'risk.msg.drought',  'Drought risk for {crop}.',
        'risk.why.drought',  'It hasn’t rained in {daysSinceRain}+ days and rain is not expected soon.',
        'risk.prev.drought', 'Water more deeply but less often; mulch helps hold moisture.',
        crop,
      ));
    }

    // 4. Overwatering — heavy rain today + already-wet signs from scan.
    if ((rainToday != null && rainToday >= 15)
        || scanCat === 'overwatering'
        || (humidity != null && humidity >= 90 && tempC != null && tempC >= 20 && scanCat === 'yellowing')) {
      risks.push(_risk(
        RISK_TYPE.OVERWATERING,
        rainToday != null && rainToday >= 25 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        'risk.msg.overwater','Overwatering risk for {crop}.',
        'risk.why.overwater','Heavy rain or humid wet conditions can saturate roots.',
        'risk.prev.overwater','Skip watering today; check that drainage is working.',
        crop,
      ));
    }

    // 5. Pest likelihood — warm + humid + flowering / fruiting + recent pest scan.
    if (scanCat === 'pest_damage'
        || (tempC != null && tempC >= 24 && humidity != null && humidity >= 70
            && (stage === 'flowering' || stage === 'fruiting'))) {
      risks.push(_risk(
        RISK_TYPE.PEST_LIKELIHOOD,
        scanCat === 'pest_damage' ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        'risk.msg.pest',     'Pest pressure may rise on {crop}.',
        'risk.why.pest',     'Warm, humid conditions during flowering / fruiting attract pests.',
        'risk.prev.pest',    'Inspect under leaves; remove damaged fruit; consult a local expert before any chemical.',
        crop,
      ));
    }

    // 6. Harvest spoilage — near-harvest stage + rain expected.
    if ((stage === 'harvest_ready' || stage === 'harvest')
        && ((rainProb != null && rainProb >= 60) || (rainToday != null && rainToday >= 5))) {
      risks.push(_risk(
        RISK_TYPE.HARVEST_SPOILAGE,
        rainProb != null && rainProb >= 80 ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
        'risk.msg.spoilage', 'Harvest-spoilage risk for {crop}.',
        'risk.why.spoilage', 'Rain on ripe / near-ripe crops can cause splitting or rot.',
        'risk.prev.spoilage','Bring harvest forward where possible; store ripe fruit in a dry place.',
        crop,
      ));
    }

    // Sort by severity desc, then by type rank for stable order.
    const TYPE_RANK = {
      [RISK_TYPE.HARVEST_SPOILAGE]: 6,
      [RISK_TYPE.HEAT_STRESS]:      5,
      [RISK_TYPE.FUNGAL]:           4,
      [RISK_TYPE.PEST_LIKELIHOOD]:  3,
      [RISK_TYPE.DROUGHT]:          2,
      [RISK_TYPE.OVERWATERING]:     1,
    };
    risks.sort((a, b) => {
      const sd = (SEV_RANK[b.severity] || 0) - (SEV_RANK[a.severity] || 0);
      if (sd !== 0) return sd;
      return (TYPE_RANK[b.type] || 0) - (TYPE_RANK[a.type] || 0);
    });

    return risks;
  } catch {
    return [];
  }
}

const _module = { RISK_TYPE, RISK_SEVERITY, detectFarmRisks };
export default _module;
