/**
 * overallRiskEngine.js — merges the three risk channels into one
 * farmer-facing payload:
 *
 *   base       → crop × region × season (static-ish)
 *   weather    → today's forecast vs crop tolerances
 *   behavior   → farmer action history (skips, issues, streak)
 *
 *   { level, score, factors[], nextAction }
 *
 * Used by the Today route + the NGO dashboard so both speak the
 * same language.
 */

import { getWeatherRisk } from '../weather/weatherRiskEngine.js';

const RISK_SCORES = { low: 10, medium: 45, high: 85 };
const RISK_ORDER = { low: 0, medium: 1, high: 2 };

function bandFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

/**
 * getBaseRisk({ region, crop, seasonFit, plantingStatus })
 *
 * Converts the scoring-engine components into an initial risk band.
 * A crop with a weak climate match or a missed planting window
 * starts at higher base risk even before weather + behavior.
 */
export function getBaseRisk({ region, seasonFit = 100, plantingStatus = 'plant_now', climateFit = 100, fitLevel = 'medium' } = {}) {
  const factors = [];
  let score = 0;

  if (fitLevel === 'low') { score += 35; factors.push('Crop is a weak fit for your region.'); }
  else if (fitLevel === 'medium') { score += 15; }

  if (climateFit < 50) { score += 15; factors.push('Climate is a weak match.'); }

  if (plantingStatus === 'avoid') { score += 30; factors.push('Outside the normal planting window.'); }
  else if (plantingStatus === 'wait') { score += 15; factors.push('Planting window is not open yet.'); }

  if (seasonFit < 30) { score += 15; factors.push('Season mismatch for this crop.'); }

  if (region?.frostRisk === 'high') { score += 10; factors.push('High frost risk in your region.'); }
  if (region?.heatBand === 'high')  { score += 5;  factors.push('High heat band for your region.'); }

  score = Math.min(100, score);
  return { level: bandFromScore(score), score, factors };
}

/**
 * getBehaviorRisk(summary) — reads the output of
 * feedback/responseEngine.summarizeBehavior and turns it into a risk
 * payload.
 */
export function getBehaviorRisk(summary = {}) {
  const factors = [];
  let score = 0;
  const skipRate = Number(summary.skipRate) || 0;
  const issues = Number(summary.recentIssueCount) || 0;
  const streak = Number(summary.streak) || 0;

  if (skipRate >= 0.5) { score += 35; factors.push('Several recent tasks were skipped.'); }
  else if (skipRate >= 0.25) { score += 15; factors.push('Some tasks are being skipped.'); }

  if (issues >= 2) { score += 30; factors.push('Multiple issues reported recently.'); }
  else if (issues === 1) { score += 15; factors.push('A recent issue is still open.'); }

  // Stacking penalty: two elevated channels at once is worse than
  // either alone. This lifts the {high skip + multiple issues} case
  // from 'medium' to the 'high' band the spec calls for.
  if (skipRate >= 0.5 && issues >= 2) score += 15;

  if (streak >= 5 && score > 0) { score = Math.max(0, score - 10); }

  score = Math.min(100, score);
  return { level: bandFromScore(score), score, factors };
}

/**
 * getWeatherRiskPayload(weather) — thin adapter that puts the
 * weather engine output into the same shape as the other two
 * channels so the combiner can treat them uniformly.
 */
export function getWeatherRiskPayload(weather) {
  if (!weather) return { level: 'low', score: 0, factors: [] };
  const wr = getWeatherRisk(weather);
  const score = wr.overallWeatherRisk === 'high' ? 70
    : wr.overallWeatherRisk === 'medium' ? 40
    : 10;
  return {
    level: wr.overallWeatherRisk,
    score,
    factors: wr.reasons.slice(0, 3),
    raw: wr,
  };
}

/**
 * getOverallRisk({ base, weather, behavior }) → the unified payload.
 *
 * The combined score is a capped weighted max — any single channel
 * at 'high' brings overall to at least 'medium', two at 'high' goes
 * to 'high'. The factor list is deduped and capped at 5.
 */
export function getOverallRisk({ base, weather, behavior } = {}) {
  const channels = [base, weather, behavior].filter(Boolean);
  const maxScore = channels.reduce((m, c) => Math.max(m, Number(c.score) || 0), 0);
  const highs = channels.filter((c) => c.level === 'high').length;
  const mediums = channels.filter((c) => c.level === 'medium').length;

  let level;
  if (highs >= 2) level = 'high';
  else if (highs === 1) level = 'high';
  else if (mediums >= 2) level = 'medium';
  else if (mediums === 1 && maxScore >= 40) level = 'medium';
  else level = bandFromScore(maxScore);

  const factorsRaw = channels.flatMap((c) => c.factors || []);
  const seen = new Set();
  const factors = [];
  for (const f of factorsRaw) {
    if (!f || seen.has(f)) continue;
    seen.add(f);
    factors.push(f);
    if (factors.length >= 5) break;
  }

  return {
    level,
    score: Math.min(100, Math.round((maxScore + (highs * 5) + (mediums * 2)))),
    factors,
    nextAction: getRiskAwareNextAction({ level, factors, weather, behavior }),
    channels: { base, weather, behavior },
  };
}

/**
 * getRiskAwareNextAction({ level, factors, weather, behavior })
 *
 * Short imperative string the Today header can render above the
 * primary-task card. Prioritizes weather > open issue > skip pattern
 * > general risk guidance.
 */
export function getRiskAwareNextAction({ level, factors = [], weather, behavior } = {}) {
  if (weather?.level === 'high' && weather?.factors?.[0]) return weather.factors[0];
  if ((behavior?.factors || []).some((f) => /issue/i.test(f))) {
    return 'Follow up on the open issue you reported.';
  }
  if ((behavior?.factors || []).some((f) => /skipped/i.test(f))) {
    return 'Pick one skipped task to finish today.';
  }
  if (level === 'high') return factors[0] || 'Your cycle is at high risk — act on the top task today.';
  if (level === 'medium') return factors[0] || 'Watch your crop closely today.';
  return 'You are on track — stay with today\'s task.';
}

/**
 * getRiskFactors(overall) — helper for UI renderers that just want
 * the list of strings.
 */
export function getRiskFactors(overall) {
  return Array.isArray(overall?.factors) ? overall.factors : [];
}

export const _internal = { bandFromScore, RISK_SCORES, RISK_ORDER };
