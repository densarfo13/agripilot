/**
 * ngoRiskLogic.js — pure risk-band classifier for the NGO
 * dashboard.
 *
 *   import { classifyFarmerRisk, summariseRisk } from './lib/ngoRiskLogic.js';
 *
 *   const band = classifyFarmerRisk({
 *     daysSinceLastActivity: 8,
 *     completionRate:        0.22,
 *     pestAlertsLast7Days:   2,
 *   });
 *   // → { level: 'high', reasons: [...] }
 *
 * Spec rules (May 2026 NGO Dashboard v1)
 *   high   →  no activity in 7 days
 *          OR task completion rate < 30%
 *          OR repeated pest/weather alerts (≥ 2 in 7 days)
 *   medium →  no activity in 3 days
 *          OR completion rate < 50%
 *   low    →  otherwise
 *
 * Output shape:
 *   {
 *     level:   'low' | 'medium' | 'high',
 *     reasons: string[],   // human-readable explanations
 *     score:   number,     // 0..100 (lower = higher risk)
 *   }
 *
 * Strict-rule audit
 *   • Pure function. Same input → same output.
 *   • Never throws. Bad / null input collapses to "low" with
 *     a [] reason list.
 *   • Numeric inputs are coerced via Number(); NaN values are
 *     treated as missing (no contribution).
 */

const HIGH_INACTIVE_DAYS  = 7;
const MED_INACTIVE_DAYS   = 3;
const HIGH_COMPLETION_PCT = 0.30;   // strictly less than → high
const MED_COMPLETION_PCT  = 0.50;   // strictly less than → medium
const REPEATED_ALERT_THRESHOLD = 2; // ≥ 2 alerts in last 7 days

/**
 * classifyFarmerRisk(input)
 *
 *   input = {
 *     daysSinceLastActivity?:  number,
 *     completionRate?:         number,   // 0..1
 *     pestAlertsLast7Days?:    number,
 *     weatherAlertsLast7Days?: number,
 *   }
 */
export function classifyFarmerRisk(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const days = Number(o.daysSinceLastActivity);
  const rate = Number(o.completionRate);
  const pest = Number(o.pestAlertsLast7Days);
  const wx   = Number(o.weatherAlertsLast7Days);

  const reasons = [];
  let level = 'low';

  // High-risk signals (any one fires).
  if (Number.isFinite(days) && days >= HIGH_INACTIVE_DAYS) {
    level = 'high';
    reasons.push(`No activity in ${Math.floor(days)} days`);
  }
  if (Number.isFinite(rate) && rate < HIGH_COMPLETION_PCT) {
    level = 'high';
    reasons.push(`Task completion is ${Math.round(rate * 100)}%`);
  }
  const totalAlerts = (Number.isFinite(pest) ? pest : 0)
                    + (Number.isFinite(wx)   ? wx   : 0);
  if (totalAlerts >= REPEATED_ALERT_THRESHOLD) {
    level = 'high';
    reasons.push(`${totalAlerts} pest/weather alerts in the last 7 days`);
  }

  if (level !== 'high') {
    if (Number.isFinite(days) && days >= MED_INACTIVE_DAYS) {
      level = 'medium';
      reasons.push(`No activity in ${Math.floor(days)} days`);
    }
    if (Number.isFinite(rate) && rate < MED_COMPLETION_PCT) {
      level = 'medium';
      reasons.push(`Task completion is ${Math.round(rate * 100)}%`);
    }
  }

  // Score — lower = more concerning. Useful for sort orders.
  // Base 100; subtract for each fired condition.
  let score = 100;
  if (Number.isFinite(days) && days > 0)  score -= Math.min(50, days * 5);
  if (Number.isFinite(rate))              score -= Math.round((1 - Math.max(0, Math.min(1, rate))) * 30);
  if (totalAlerts > 0)                    score -= Math.min(30, totalAlerts * 10);
  score = Math.max(0, Math.min(100, score));

  return { level, reasons, score };
}

/**
 * summariseRisk(farmers) — counts risk bands across a farmer
 * array. Each farmer object is expected to expose the same
 * fields classifyFarmerRisk reads.
 *
 *   summariseRisk([{ daysSinceLastActivity: 1 }, { ... }])
 *   // → { high: 0, medium: 0, low: 1, total: 1 }
 */
export function summariseRisk(farmers) {
  const buckets = { high: 0, medium: 0, low: 0, total: 0 };
  if (!Array.isArray(farmers)) return buckets;
  for (const f of farmers) {
    const c = classifyFarmerRisk(f);
    if (c.level === 'high')   buckets.high   += 1;
    else if (c.level === 'medium') buckets.medium += 1;
    else                      buckets.low    += 1;
    buckets.total += 1;
  }
  return buckets;
}

/** Test hooks. */
export const _internal = Object.freeze({
  HIGH_INACTIVE_DAYS,
  MED_INACTIVE_DAYS,
  HIGH_COMPLETION_PCT,
  MED_COMPLETION_PCT,
  REPEATED_ALERT_THRESHOLD,
});

export default { classifyFarmerRisk, summariseRisk };
