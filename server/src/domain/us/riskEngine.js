/**
 * riskEngine.js — scores three specific risks for a (crop × state ×
 * month) context and rolls them up into an overall risk level.
 *
 *   frostRisk       — frost-sensitive crop × high-frost state × cool month
 *   heatRisk        — cool-loving crop × high-heat state × hot month
 *   waterStressRisk — high-water crop × dry zone (low rainfall band)
 *
 * Each risk is one of 'low' | 'medium' | 'high'. The overall level is
 * the maximum of the three, mapped the same way.
 */

const COOL_MONTHS = new Set([12, 1, 2, 3]);
const HOT_MONTHS = new Set([6, 7, 8]);

function rank(level) {
  return level === 'high' ? 3 : level === 'medium' ? 2 : 1;
}
function fromRank(r) {
  return r >= 3 ? 'high' : r === 2 ? 'medium' : 'low';
}

/**
 * @param {Object} args
 * @param {Object} args.profile         crop profile entry
 * @param {Object} args.stateProfile    resolved location profile
 * @param {number} [args.currentMonth]  1..12
 */
export function assessRisks({ profile, stateProfile, currentMonth }) {
  const month = Number.isFinite(currentMonth) ? currentMonth : null;

  // ─── Frost risk ──────────────────────────────────────────
  let frostRisk = 'low';
  if (profile.frostSensitive) {
    if (stateProfile.frostRisk === 'high') frostRisk = month && COOL_MONTHS.has(month) ? 'high' : 'medium';
    else if (stateProfile.frostRisk === 'medium') frostRisk = month && COOL_MONTHS.has(month) ? 'medium' : 'low';
  }

  // ─── Heat risk ───────────────────────────────────────────
  let heatRisk = 'low';
  if (profile.heatTolerance === 'low') {
    if (stateProfile.heatBand === 'high') heatRisk = month && HOT_MONTHS.has(month) ? 'high' : 'medium';
    else if (stateProfile.heatBand === 'medium') heatRisk = month && HOT_MONTHS.has(month) ? 'medium' : 'low';
  } else if (profile.heatTolerance === 'medium' && stateProfile.heatBand === 'high' && month && HOT_MONTHS.has(month)) {
    heatRisk = 'medium';
  }

  // ─── Water stress risk ───────────────────────────────────
  let waterStressRisk = 'low';
  if (profile.waterNeed === 'high') {
    if (stateProfile.rainfallBand === 'low') waterStressRisk = 'high';
    else if (stateProfile.rainfallBand === 'medium') waterStressRisk = 'medium';
  } else if (profile.waterNeed === 'medium' && stateProfile.rainfallBand === 'low') {
    waterStressRisk = 'medium';
  }

  const overallRank = Math.max(rank(frostRisk), rank(heatRisk), rank(waterStressRisk));
  const overallRisk = fromRank(overallRank);

  const notes = [];
  if (frostRisk === 'high') notes.push('Frost could damage young plants — watch overnight lows');
  if (heatRisk === 'high') notes.push('Peak heat can stress this crop — shade or mulch helps');
  if (waterStressRisk === 'high') notes.push('Needs reliable irrigation in this dry zone');

  return { frostRisk, heatRisk, waterStressRisk, overallRisk, notes };
}
