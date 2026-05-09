/**
 * risk — soft probabilistic risk engine (spec §6).
 *
 * RULES
 *   • Returns ONE risk per call (the highest-priority one for
 *     the supplied context). The orchestrator can call this
 *     module multiple times if it needs the full ladder.
 *   • Bands: low | medium | high. Confidence: low | medium | high.
 *   • userFacingText is calm + action-framed — the adapter
 *     trusts this string and only filters forbidden words as a
 *     last-resort safety net.
 *   • Pure function — never throws, no side effects.
 *
 * FORBIDDEN COPY (spec §6)
 *   "High disease risk detected." / "Your farm is risky." /
 *   "Fraud risk." → these MUST NOT appear here. The wording
 *   below uses "may", "consider", "monitor", "check".
 */

import { RISK_TYPE, RISK_BAND, CONFIDENCE } from './intelligenceTypes.js';
import { contextSignalStrength } from './intelligenceContext.js';

/**
 * Estimate the most relevant single risk for a context.
 *
 * @param {import('./intelligenceTypes.js').IntelligenceContext} context
 * @returns {import('./intelligenceTypes.js').RiskEstimate|null}
 */
export function estimateCropRisk(context) {
  if (!context || typeof context !== 'object') return null;

  const w = context.weather || {};
  const tempC = Number(w.tempC ?? w.temperature ?? w.temp);
  const rainProb = Number(w.rainProbability ?? w.precipitationProbability ?? w.rainProb);
  const isHot = Number.isFinite(tempC) && tempC >= 32;
  const rainSoon = Number.isFinite(rainProb) && rainProb >= 0.6;

  const recentScan = (context.scanHistory || [])[0] || null;
  const recentScanFlagged = recentScan
    && typeof recentScan === 'object'
    && recentScan.category
    && recentScan.category !== 'healthy'
    && recentScan.category !== 'no_issue_detected';

  const recentSoil = (context.soilChecks || [])[0] || null;
  const soilDry = recentSoil && (recentSoil.status === 'dry' || recentSoil.condition === 'dry');
  const soilWaterlog = recentSoil
    && (recentSoil.status === 'waterlogging' || recentSoil.condition === 'waterlogging');

  const isGarden  = context.mode === 'garden';
  const smallPot  = isGarden && (context.gardenContainer || '').match(/(small|pot|tin)/i);

  // Weather risk takes priority — rain or heat affects every
  // downstream task and changes the right action for today.
  if (rainSoon) {
    return _risk({
      riskType:        RISK_TYPE.WEATHER,
      probabilityBand: RISK_BAND.MEDIUM,
      confidence:      CONFIDENCE.MEDIUM,
      reason:          `rainProb=${rainProb}`,
      recommendedAction: 'check_drainage',
      userFacingText:    'Rain may make drainage important today.',
    });
  }
  if (isHot && smallPot) {
    return _risk({
      riskType:        RISK_TYPE.MOISTURE,
      probabilityBand: RISK_BAND.MEDIUM,
      confidence:      CONFIDENCE.MEDIUM,
      reason:          `tempC=${tempC} smallPot`,
      recommendedAction: 'check_soil_moisture',
      userFacingText:    'Dry heat may stress small pots — check soil moisture.',
    });
  }
  if (recentScanFlagged) {
    return _risk({
      riskType:        RISK_TYPE.DISEASE,
      probabilityBand: RISK_BAND.LOW,
      confidence:      CONFIDENCE.LOW,
      reason:          `recentScan.category=${recentScan && recentScan.category}`,
      recommendedAction: 'scan_followup',
      userFacingText:    'Your last scan may need a follow-up check.',
    });
  }
  if (soilDry) {
    return _risk({
      riskType:        RISK_TYPE.MOISTURE,
      probabilityBand: RISK_BAND.MEDIUM,
      confidence:      CONFIDENCE.MEDIUM,
      reason:          'soilDry',
      recommendedAction: 'check_soil_moisture',
      userFacingText:    'Soil looked dry on your last check — water gently and re-inspect.',
    });
  }
  if (soilWaterlog) {
    return _risk({
      riskType:        RISK_TYPE.MOISTURE,
      probabilityBand: RISK_BAND.MEDIUM,
      confidence:      CONFIDENCE.MEDIUM,
      reason:          'soilWaterlog',
      recommendedAction: 'check_drainage',
      userFacingText:    'Drainage may need attention based on your last soil check.',
    });
  }

  // Buyer readiness: the listing exists but no buyer interest yet.
  if ((context.produceListings || []).length > 0
      && (context.buyerInterest || []).length === 0) {
    return _risk({
      riskType:        RISK_TYPE.BUYER_READINESS,
      probabilityBand: RISK_BAND.LOW,
      confidence:      CONFIDENCE.LOW,
      reason:          'listing_no_interest',
      recommendedAction: 'improve_listing',
      userFacingText:    'Adding a clear photo can help buyers find your listing.',
    });
  }

  // No usable signal at all → DATA_CONFIDENCE risk steers the
  // user toward setting up location/crop so future calls hit
  // the confident branches above.
  if (contextSignalStrength(context) === CONFIDENCE.LOW) {
    return _risk({
      riskType:        RISK_TYPE.DATA_CONFIDENCE,
      probabilityBand: RISK_BAND.LOW,
      confidence:      CONFIDENCE.LOW,
      reason:          'sparse_context',
      recommendedAction: 'complete_profile',
      userFacingText:    'Add your region and crop so we can tailor today’s guidance.',
    });
  }

  return null;
}

function _risk(o) {
  return Object.freeze({
    riskType:          String(o.riskType),
    probabilityBand:   String(o.probabilityBand),
    confidence:        String(o.confidence),
    reason:            String(o.reason || ''),
    recommendedAction: String(o.recommendedAction),
    userFacingText:    String(o.userFacingText),
  });
}

const _module = { estimateCropRisk };
export default _module;
