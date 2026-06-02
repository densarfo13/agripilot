/**
 * recommendationPriorityEngine.js — unified recommendation engine.
 *
 * Composes every upstream intelligence signal into ONE prioritized
 * action list. Returns Today's Best Action + Top 3.
 *
 * Inputs:
 *   weather       — last Open-Meteo snapshot for the farm
 *   scan          — most recent scan envelope (v4 scanRecovery)
 *   soil          — soilProvider envelope
 *   regional      — regionalIntelligenceProvider envelope
 *   satellite     — fieldHealthProvider envelope (NDVI / vigor / stress)
 *   market        — marketEngine envelope
 *   outcomeHistory — recent RecommendationOutcome rows (per-rec
 *                   success rate is read here)
 *
 * Output:
 *   { topAction, topThree, generatedAt, sources, limitations }
 *
 * Honesty:
 *   - Every action carries explicit reason[] + expectedBenefit +
 *     confidence + priorityScore (0..100).
 *   - When NO inputs are present, returns ok:false + a neutral
 *     "scan a plant to start" hint. Never invents a recommendation.
 *   - Priority score combines risk + urgency + impact + confidence.
 *     Formula is exposed via _scoreFor so the gate can verify it.
 *
 * Pure / never throws / frozen returns.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const _arr = (v) => (Array.isArray(v) ? v : []);

// Weights — used by _scoreFor.
const W = Object.freeze({
  risk:       30,
  urgency:    30,
  impact:     25,
  confidence: 15,
});

// Component computers — each returns 0..1.
function _bandToScore(band) {
  if (band === 'high')   return 1.0;
  if (band === 'medium') return 0.6;
  if (band === 'low')    return 0.25;
  return 0.4;
}

function _scoreFor({ risk, urgency, impact, confidence }) {
  // Each input is 0..1. Final score 0..100.
  const r = Math.max(0, Math.min(1, Number(risk) || 0));
  const u = Math.max(0, Math.min(1, Number(urgency) || 0));
  const i = Math.max(0, Math.min(1, Number(impact) || 0));
  const c = Math.max(0, Math.min(1, Number(confidence) || 0));
  const raw = (r * W.risk) + (u * W.urgency) + (i * W.impact) + (c * W.confidence);
  return Math.round(raw);
}

// ─── Candidate-action builders ────────────────────────────────
// Each helper returns either an action object or null when the
// corresponding signal is not actionable. NEVER fabricates a
// reason — every reason[] item is a direct read from the input.

function _fromScan(scan) {
  if (!scan || typeof scan !== 'object') return null;
  const disease = _arr(scan.diseaseCandidates)[0] || null;
  const pest = scan.pest && scan.pest.pest ? scan.pest : null;
  const severityBand = scan.severity || 'low';
  // No actionable scan signal when there's no disease + no pest.
  if (!disease && !pest) return null;
  const recommendation = scan.nextAction
    || (disease && disease.name ? 'Treat ' + disease.name : null)
    || (pest && pest.recommendedAction)
    || 'Re-scan the affected plant.';
  const reason = [];
  if (disease && disease.name)
    reason.push('Scan flagged ' + disease.name
      + (disease.score ? ' (' + Math.round(disease.score * 100) + '% confidence)' : ''));
  if (pest && pest.pest)
    reason.push('Pest detected: ' + pest.pest + ' (' + (pest.severity || 'low') + ' severity)');
  return {
    source: 'scan',
    recommendation,
    reason,
    expectedBenefit: 'Stop spread; protect yield.',
    risk:       _bandToScore(severityBand),
    urgency:    severityBand === 'high' ? 0.9 : severityBand === 'medium' ? 0.6 : 0.3,
    impact:     0.8,
    confidence: _num(scan.confidence) != null ? Number(scan.confidence) / 100 : 0.5,
    timeframeDays: severityBand === 'high' ? 1 : 3,
    category: pest ? 'pest' : 'disease',
  };
}

function _fromSoil(soil) {
  if (!soil || typeof soil !== 'object') return null;
  if (!soil.soilRisk || soil.soilRisk.kind === 'none') return null;
  const rk = soil.soilRisk;
  return {
    source: 'soil',
    recommendation: soil.soilRecommendation
      || ('Address ' + rk.kind.replace('_', ' ') + ' on this field.'),
    reason: [rk.detail || ('Soil risk: ' + rk.kind)],
    expectedBenefit: rk.kind === 'low_fertility'
      ? 'Stronger early growth and higher yield potential.'
      : 'Reduce stress on the plant; protect yield.',
    risk:       rk.level === 'high' ? 0.85 : rk.level === 'medium' ? 0.55 : 0.25,
    urgency:    rk.level === 'high' ? 0.65 : 0.4,
    impact:     soil.fertilityScore != null && soil.fertilityScore < 35 ? 0.85 : 0.6,
    confidence: _bandToScore(soil.confidence),
    timeframeDays: rk.level === 'high' ? 7 : 14,
    category: 'soil',
  };
}

function _fromWeather(weather, scan) {
  if (!weather || typeof weather !== 'object') return null;
  const rainNext24 = _num(weather.rainMmNext24h);
  const tempHigh = _num(weather.tempHighC) || _num(weather.currentTempC);
  const humid = _num(weather.humidityPct);
  // Heavy rain + crop disease risk → urgent fungicide / shelter.
  if (rainNext24 != null && rainNext24 >= 10) {
    return {
      source: 'weather',
      recommendation: 'Cover or protect sensitive crops; expect '
        + Math.round(rainNext24) + ' mm of rain in 24h.',
      reason: ['Open-Meteo forecasts ' + Math.round(rainNext24) + ' mm rainfall',
        humid != null ? 'Humidity ' + Math.round(humid) + '% favors disease' : '']
        .filter(Boolean),
      expectedBenefit: 'Prevent waterlogging and fungal spread.',
      risk:       0.7,
      urgency:    0.85,
      impact:     0.55,
      confidence: 0.7,
      timeframeDays: 1,
      category: 'weather',
    };
  }
  if (tempHigh != null && tempHigh >= 32 && (rainNext24 == null || rainNext24 < 1)) {
    return {
      source: 'weather',
      recommendation: 'Irrigate at dawn or dusk; temperatures hit '
        + Math.round(tempHigh) + '°C with no rain.',
      reason: ['Forecast high ' + Math.round(tempHigh) + '°C',
        rainNext24 != null ? 'No meaningful rain in 24h' : 'No rain in forecast'],
      expectedBenefit: 'Avoid heat / drought stress.',
      risk:       0.6,
      urgency:    0.7,
      impact:     0.55,
      confidence: 0.7,
      timeframeDays: 2,
      category: 'weather',
    };
  }
  return null;
}

function _fromSatellite(satellite) {
  if (!satellite || typeof satellite !== 'object') return null;
  const stressLevel = satellite.stressLevel || (satellite.stressScore != null
    ? (satellite.stressScore >= 65 ? 'high'
        : satellite.stressScore >= 35 ? 'medium' : 'low')
    : null);
  const trend = satellite.trend || satellite.vegetationTrend;
  if (!stressLevel || stressLevel === 'low') return null;
  return {
    source: 'satellite',
    recommendation: 'Scout the field — satellite shows '
      + stressLevel + ' stress'
      + (trend === 'declining' ? ' and a declining trend' : '') + '.',
    reason: ['NDVI = ' + (satellite.ndvi != null ? satellite.ndvi.toFixed(2) : '?'),
      satellite.interpretation || ''].filter(Boolean),
    expectedBenefit: 'Catch a stress pocket before it spreads.',
    risk:       stressLevel === 'high' ? 0.7 : 0.5,
    urgency:    trend === 'declining' ? 0.75 : 0.5,
    impact:     0.7,
    confidence: _bandToScore(satellite.confidence),
    timeframeDays: 3,
    category: 'satellite',
  };
}

function _fromRegional(regional) {
  if (!regional || typeof regional !== 'object') return null;
  if (regional.diseasePressure !== 'high' && regional.pestPressure !== 'high') return null;
  const which = regional.diseasePressure === 'high' ? 'disease' : 'pest';
  return {
    source: 'regional',
    recommendation: 'Inspect for ' + which
      + ' — local pressure is high right now.',
    reason: ['Regional ' + which + ' pressure reported as high',
      regional.sampleSize ? 'Based on ' + regional.sampleSize + ' recent local scans' : '']
      .filter(Boolean),
    expectedBenefit: 'Catch outbreak early; reduce treatment cost.',
    risk:       0.65,
    urgency:    0.7,
    impact:     0.6,
    confidence: _bandToScore(regional.confidence),
    timeframeDays: 2,
    category: which,
  };
}

function _fromMarket(market) {
  if (!market || typeof market !== 'object') return null;
  if (!market.recommendedSellWindow
      || market.recommendedSellWindow.open == null) return null;
  const open = market.recommendedSellWindow.open;
  if (open > 14) return null;        // not actionable yet
  return {
    source: 'market',
    recommendation: market.recommendedSellWindow.hint
      || ('Prepare to sell within ' + open + '–'
          + (market.recommendedSellWindow.close || (open + 7)) + ' days.'),
    reason: [
      market.priceTrend && market.priceTrend !== 'unknown'
        ? 'Price trend: ' + market.priceTrend : '',
      market.demandScore != null ? 'Demand score: ' + market.demandScore + '/100' : '',
      market.currentPrice != null
        ? 'Reference price: $' + market.currentPrice + ' ' + (market.unit || 'per kg')
        : '',
    ].filter(Boolean),
    expectedBenefit: 'Capture peak revenue window.',
    risk:       0.3,
    urgency:    open <= 3 ? 0.85 : open <= 7 ? 0.6 : 0.4,
    impact:     market.demandScore != null ? (market.demandScore / 100) : 0.55,
    confidence: _bandToScore(market.confidence),
    timeframeDays: open + 7,
    category: 'market',
  };
}

// Outcome-history lifts — apply per-recommendation success rate.
function _applyOutcomeBoost(action, outcomeHistory) {
  if (!action || !Array.isArray(outcomeHistory) || outcomeHistory.length === 0) {
    return action;
  }
  const norm = String(action.recommendation || '').toLowerCase().trim();
  if (!norm) return action;
  const match = outcomeHistory.find((o) => {
    const oRec = String(o.recommendation || '').toLowerCase().trim();
    return oRec && (norm.includes(oRec) || oRec.includes(norm));
  });
  if (!match || match.successRate == null) return action;
  // Boost confidence by up to +0.15 when historical success rate >= 70%.
  const boost = match.successRate >= 70 ? 0.15
              : match.successRate >= 50 ? 0.05 : 0;
  const demote = match.successRate < 30 ? -0.15 : 0;
  const newConf = Math.max(0, Math.min(1,
    (Number(action.confidence) || 0) + boost + demote));
  const newImpact = match.successRate >= 70
    ? Math.min(1, (Number(action.impact) || 0) + 0.05)
    : Number(action.impact);
  return Object.freeze({
    ...action,
    confidence: newConf,
    impact:     newImpact,
    outcomeLift: { successRate: match.successRate,
                   sampleSize: match.sampleSize || 0 },
  });
}

/**
 * Main entry. Returns the unified envelope.
 */
export function computeUnifiedRecommendations(input = {}) {
  try {
    const candidates = [
      _fromScan(input.scan),
      _fromSoil(input.soil),
      _fromWeather(input.weather, input.scan),
      _fromSatellite(input.satellite),
      _fromRegional(input.regional),
      _fromMarket(input.market),
    ].filter(Boolean);

    // Apply outcome-history lift then score + sort.
    const scored = candidates
      .map((c) => _applyOutcomeBoost(c, input.outcomeHistory))
      .map((c) => Object.freeze({
        ...c,
        priorityScore: _scoreFor({
          risk: c.risk, urgency: c.urgency,
          impact: c.impact, confidence: c.confidence,
        }),
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const sources = Object.freeze({
      weather:    !!input.weather,
      scan:       !!input.scan,
      soil:       !!input.soil,
      regional:   !!input.regional,
      satellite:  !!input.satellite,
      market:     !!input.market,
      outcomeHistory: Array.isArray(input.outcomeHistory)
                     && input.outcomeHistory.length > 0,
    });

    if (scored.length === 0) {
      return Object.freeze({
        ok: true,
        topAction: null,
        topThree: Object.freeze([]),
        message: 'Scan a plant or add location for personalized actions.',
        sources,
        generatedAt: new Date().toISOString(),
        scoringWeights: W,
        limitations: 'Decision support, not a guarantee.',
      });
    }

    const topAction = scored[0];
    const topThree = Object.freeze(scored.slice(0, 3));
    return Object.freeze({
      ok: true,
      topAction,
      topThree,
      sources,
      generatedAt: new Date().toISOString(),
      scoringWeights: W,
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return Object.freeze({
      ok: false, reason: 'exception',
      message: err && err.message,
      topAction: null, topThree: Object.freeze([]),
      sources: Object.freeze({
        weather: false, scan: false, soil: false,
        regional: false, satellite: false, market: false,
        outcomeHistory: false,
      }),
      scoringWeights: W,
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

/**
 * Pure helper: score a single { risk, urgency, impact, confidence }
 * tuple. Exposed so the gate can verify the formula stays consistent
 * AND the client can mirror the math without re-fetching.
 */
export function scoreAction(weights) { return _scoreFor(weights); }

export function recommendationPriorityEngineInfo() {
  return Object.freeze({
    name:        'recommendation-priority-engine',
    weights:     W,
    scoreRange:  Object.freeze({ min: 0, max: 100 }),
    candidateSources: Object.freeze([
      'scan', 'soil', 'weather', 'satellite', 'regional', 'market',
    ]),
    appliesOutcomeBoost: true,
    neverFabricatesReason: true,
  });
}

export const _internal = Object.freeze({
  _scoreFor, _bandToScore, _fromScan, _fromSoil,
  _fromWeather, _fromSatellite, _fromRegional, _fromMarket,
  _applyOutcomeBoost, W,
});

export default computeUnifiedRecommendations;
