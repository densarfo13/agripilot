/**
 * fundingEngine.js — pure tier mapper + transparent eligibility.
 *
 * getFundingDecision(score) → {
 *   eligible:    boolean,
 *   tier:        'A' | 'B' | 'C',
 *   messageKey:  i18n key,
 *   messageFallback: English last-resort,
 *   thresholds: { a, b }  // for UI "how close am I?" hints
 * }
 *
 * Rule set from spec:
 *   >= 75 → tier A (high reliability, eligible)
 *   >= 50 → tier B (moderate, eligible with monitoring)
 *   else  → tier C (not eligible yet, improve consistency/completion)
 *
 * Pure. No strings emitted at engine layer — caller localizes.
 */

const TIER_A_MIN = 75;
const TIER_B_MIN = 50;

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
}

function getFundingDecision(rawScore) {
  const score = clampScore(rawScore);

  if (score >= TIER_A_MIN) {
    return Object.freeze({
      eligible: true,
      tier: 'A',
      score,
      messageKey:      'funding.tier_a.message',
      messageFallback: 'High reliability farmer. Eligible for funding.',
      thresholds: Object.freeze({ a: TIER_A_MIN, b: TIER_B_MIN }),
    });
  }

  if (score >= TIER_B_MIN) {
    return Object.freeze({
      eligible: true,
      tier: 'B',
      score,
      messageKey:      'funding.tier_b.message',
      messageFallback: 'Moderate reliability. Eligible with monitoring.',
      thresholds: Object.freeze({ a: TIER_A_MIN, b: TIER_B_MIN }),
    });
  }

  return Object.freeze({
    eligible: false,
    tier: 'C',
    score,
    messageKey:      'funding.tier_c.message',
    messageFallback: 'Not eligible yet. Improve consistency and task completion.',
    thresholds: Object.freeze({ a: TIER_A_MIN, b: TIER_B_MIN }),
  });
}

/**
 * pointsToNextTier — returns how many more points needed to
 * reach the next tier (or 0 if already at A). Used by the
 * farmer-side card to encourage improvement.
 */
function pointsToNextTier(rawScore) {
  const s = clampScore(rawScore);
  if (s >= TIER_A_MIN) return 0;
  if (s >= TIER_B_MIN) return TIER_A_MIN - s;
  return TIER_B_MIN - s;
}

module.exports = {
  getFundingDecision,
  pointsToNextTier,
  _internal: { TIER_A_MIN, TIER_B_MIN, clampScore },
};
