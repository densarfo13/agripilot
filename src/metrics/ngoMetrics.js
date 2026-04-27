/**
 * ngoMetrics.js — roll farmer activity up to NGO-level KPIs.
 *
 * Pure function over a list of farm records. The dashboard renders
 * directly off the returned object. Defensive on every input -
 * non-array, empty array, or farms with missing fields all return
 * a usable zero-state result rather than crashing the page.
 */

import { computeFarmValue } from './valueEngine.js';

/**
 * aggregateNGO(farms)
 *   -> {
 *        totalFarmers, activeFarmers, highRiskFarmers,
 *        engagementRate,                  // 0..100, one decimal
 *        avgEngagementScore,              // 0..100, one decimal
 *        avgEstimatedYieldImpact,         // %, one decimal
 *        sampledAt,                       // ISO string for the demo card
 *      }
 *
 * `engagementRate` and `avgEngagementScore` are both useful: the
 * first answers "what fraction of farmers ever opened the app
 * today" (the NGO sales hook), the second answers "how engaged are
 * the active ones" (the program-success hook). NGOs typically want
 * to see both.
 */
export function aggregateNGO(farms) {
  if (!Array.isArray(farms) || farms.length === 0) {
    return Object.freeze({
      totalFarmers:            0,
      activeFarmers:           0,
      highRiskFarmers:         0,
      engagementRate:          0,
      avgEngagementScore:      0,
      avgEstimatedYieldImpact: 0,
      sampledAt:               new Date().toISOString(),
    });
  }

  let total            = 0;
  let active           = 0;
  let highRisk         = 0;
  let engagementSum    = 0;
  let yieldSum         = 0;

  for (const f of farms) {
    if (!f || typeof f !== 'object') continue;
    const v = computeFarmValue(f.id);
    total += 1;
    if (v.tasksCompleted > 0) active += 1;
    if (v.riskLevel === 'HIGH') highRisk += 1;
    engagementSum += v.engagementScore;
    yieldSum      += v.estimatedYieldImpact;
  }

  const round1 = (n) => Math.round(n * 10) / 10;

  return Object.freeze({
    totalFarmers:            total,
    activeFarmers:           active,
    highRiskFarmers:         highRisk,
    engagementRate:          total ? round1((active / total) * 100) : 0,
    avgEngagementScore:      total ? round1(engagementSum / total)  : 0,
    avgEstimatedYieldImpact: total ? round1(yieldSum / total)       : 0,
    sampledAt:               new Date().toISOString(),
  });
}
