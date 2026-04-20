/**
 * scoreEngine.js — deterministic, transparent farmer score.
 *
 * Rule set from spec. Extends the spec's single-number return
 * with a full breakdown so §6 ("scoring must be transparent")
 * is satisfied — the UI can show WHY a farmer has the score
 * they do and HOW to improve it.
 *
 *   computeScore({ completionRate, consistencyDays, riskLevel, farmEventsCount })
 *     → {
 *         score:      0..100 integer (clamped)
 *         breakdown:  {
 *           behavior:     0..40    // completion contribution
 *           consistency:  0..25
 *           experience:   0..15
 *           riskPenalty:  -20..0   // negative
 *         },
 *         factors: string[]         // i18n keys for "what helped"
 *       }
 *
 * computeScoreNumber() is the spec-compatible shorthand that
 * returns just the integer.
 */

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function behaviorPoints(completionRate) {
  if (!Number.isFinite(completionRate)) return 0;
  const cr = clamp(completionRate, 0, 1);
  return Math.round(cr * 40);
}

function consistencyPoints(consistencyDays) {
  const d = Number.isFinite(consistencyDays) ? consistencyDays : 0;
  if (d >= 20) return 25;
  if (d >= 10) return 15;
  if (d >= 5)  return 8;
  return 0;
}

function experiencePoints(farmEventsCount) {
  const n = Number.isFinite(farmEventsCount) ? farmEventsCount : 0;
  if (n >= 50) return 15;
  if (n >= 20) return 10;
  if (n >= 5)  return 5;
  return 0;
}

function riskPenalty(riskLevel) {
  const r = typeof riskLevel === 'string' ? riskLevel.toLowerCase() : null;
  if (r === 'high')   return -20;
  if (r === 'medium') return -10;
  return 0;
}

/** computeScore — main entry. Returns the rich breakdown. */
function computeScore({
  completionRate   = 0,
  consistencyDays  = 0,
  riskLevel        = 'low',
  farmEventsCount  = 0,
} = {}) {
  const b = behaviorPoints(completionRate);
  const c = consistencyPoints(consistencyDays);
  const x = experiencePoints(farmEventsCount);
  const p = riskPenalty(riskLevel);

  const raw = b + c + x + p;
  const score = clamp(raw, 0, 100);

  // Factor i18n keys — what helped / what's hurting. Kept machine-
  // readable so the UI can localize and test assertions stay stable.
  const factors = [];
  if (b >= 24)   factors.push('score.factor.strong_completion');
  else if (b >= 12) factors.push('score.factor.moderate_completion');
  else              factors.push('score.factor.weak_completion');
  if (c >= 15)   factors.push('score.factor.strong_consistency');
  else if (c > 0) factors.push('score.factor.some_consistency');
  if (x >= 10)   factors.push('score.factor.experienced');
  if (p <= -20)  factors.push('score.factor.risk_penalty_high');
  else if (p <= -10) factors.push('score.factor.risk_penalty_medium');

  return Object.freeze({
    score,
    breakdown: Object.freeze({
      behavior:    b,
      consistency: c,
      experience:  x,
      riskPenalty: p,
    }),
    factors: Object.freeze(factors),
  });
}

/** Spec-compatible shorthand — just the integer. */
function computeScoreNumber(input) {
  return computeScore(input).score;
}

module.exports = {
  computeScore,
  computeScoreNumber,
  _internal: {
    behaviorPoints, consistencyPoints, experiencePoints, riskPenalty,
  },
};
