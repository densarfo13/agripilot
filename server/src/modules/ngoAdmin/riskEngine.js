/**
 * riskEngine.js — deterministic, explainable farm risk scorer.
 *
 * calculateRisk({ weather, completionRate, stage }) → {
 *   level:   'low' | 'medium' | 'high',
 *   score:   0–100 (sum of reason deltas, clamped),
 *   reasons: string[]  — stable machine ids the UI can localize
 * }
 *
 * Rule set matches the spec. Keeping the output richer than the
 * spec's single-string `level` so downstream consumers (farmer
 * app banner, analytics, tests) can explain WHY a farm is at
 * risk without parsing English text.
 *
 * Pure. No React, no network, no Prisma.
 */

const WEATHER_RAIN_RISK    = 20;
const WEATHER_HEAT_RISK    = 20;
const LOW_COMPLETION_RISK  = 40;
const MID_COMPLETION_RISK  = 20;
const STAGE_SENSITIVE_RISK = 20;

const STAGE_SENSITIVE = new Set(['planting', 'flowering', 'harvest']);

function clamp(n, min = 0, max = 100) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** calculateRisk — spec-compatible, richer return shape. */
function calculateRisk({ weather = null, completionRate = null, stage = null } = {}) {
  let score = 0;
  const reasons = [];

  // ── Weather contribution ──────────────────────────────
  if (weather && typeof weather === 'object') {
    if (weather.rainExpected) {
      score += WEATHER_RAIN_RISK;
      reasons.push('risk.reason.rain_expected');
    }
    if (weather.extremeHeat) {
      score += WEATHER_HEAT_RISK;
      reasons.push('risk.reason.extreme_heat');
    }
    if (weather.drought) {
      score += WEATHER_HEAT_RISK;
      reasons.push('risk.reason.drought');
    }
  }

  // ── Behaviour contribution ────────────────────────────
  if (typeof completionRate === 'number' && Number.isFinite(completionRate)) {
    if (completionRate < 0.3) {
      score += LOW_COMPLETION_RISK;
      reasons.push('risk.reason.low_completion');
    } else if (completionRate < 0.6) {
      score += MID_COMPLETION_RISK;
      reasons.push('risk.reason.mid_completion');
    }
  }

  // ── Stage sensitivity ─────────────────────────────────
  if (typeof stage === 'string' && STAGE_SENSITIVE.has(stage)) {
    score += STAGE_SENSITIVE_RISK;
    reasons.push('risk.reason.stage_sensitive');
  }

  score = clamp(score, 0, 100);
  let level = 'low';
  if (score >= 70) level = 'high';
  else if (score >= 40) level = 'medium';

  return Object.freeze({ level, score, reasons: Object.freeze(reasons) });
}

/** Spec-compatible shorthand — returns just the level. */
function calculateRiskLevel(input) {
  return calculateRisk(input).level;
}

module.exports = {
  calculateRisk,
  calculateRiskLevel,
  _internal: {
    WEATHER_RAIN_RISK, WEATHER_HEAT_RISK,
    LOW_COMPLETION_RISK, MID_COMPLETION_RISK,
    STAGE_SENSITIVE_RISK, STAGE_SENSITIVE,
  },
};
