/**
 * farmerScoreCard.js — pure helper that turns the raw
 * /farmer-score/:farmId response into a farmer-ready card
 * payload: header line, tier chip, factor bullets, and
 * "N points to tier X" nudge — all as LocalizedPayloads.
 *
 * Pure. No React. No strings — caller renders via
 * renderLocalizedMessage.
 */

// Mirror of makeLocalizedPayload — kept inline so this module has
// no core/i18n import at tree-shake time.
function payload(key, params = {}, extra = {}) {
  return Object.freeze({ key, params: params || {}, ...extra });
}

/**
 * buildFarmerScoreCard(data)
 *   data: {
 *     score, breakdown, factors, funding: { tier, eligible,
 *       messageKey, messageFallback, thresholds: { a, b } }
 *   }
 *
 * → {
 *     headline,     // LocalizedPayload
 *     fundingBadge, // LocalizedPayload
 *     breakdown,    // [ { labelKey, labelFallback, value } ]
 *     factorLines,  // [ LocalizedPayload ]
 *     nextTier,     // LocalizedPayload | null
 *     tier,         // 'A'|'B'|'C'
 *     score         // pass-through
 *   }
 */
export function buildFarmerScoreCard(data) {
  if (!data || typeof data !== 'object') return null;

  const score = Number.isFinite(data.score) ? data.score : 0;
  const funding = data.funding || {};
  const breakdown = data.breakdown || {};
  const factors = Array.isArray(data.factors) ? data.factors : [];

  const tier = funding.tier || 'C';

  const headline = payload(
    'farmer.score.headline',
    { score },
    { fallback: `Your score: ${score}`, severity: 'neutral' },
  );

  const fundingBadge = payload(
    funding.messageKey || 'funding.tier_c.message',
    {},
    {
      fallback: funding.messageFallback || 'Keep improving your consistency.',
      severity: funding.eligible ? 'positive' : 'warning',
      tier,
    },
  );

  // Breakdown rows — stable label keys so tests & UI stay aligned.
  const breakdownRows = [
    {
      labelKey:      'farmer.score.breakdown.behavior',
      labelFallback: 'Task completion',
      value:         Number.isFinite(breakdown.behavior)    ? breakdown.behavior    : 0,
      max:           40,
    },
    {
      labelKey:      'farmer.score.breakdown.consistency',
      labelFallback: 'Consistency',
      value:         Number.isFinite(breakdown.consistency) ? breakdown.consistency : 0,
      max:           25,
    },
    {
      labelKey:      'farmer.score.breakdown.experience',
      labelFallback: 'Experience',
      value:         Number.isFinite(breakdown.experience)  ? breakdown.experience  : 0,
      max:           15,
    },
    {
      labelKey:      'farmer.score.breakdown.risk_penalty',
      labelFallback: 'Risk adjustment',
      value:         Number.isFinite(breakdown.riskPenalty) ? breakdown.riskPenalty : 0,
      max:           0,    // negative contribution
    },
  ];

  // Factor lines — convert the engine's machine ids into full payloads
  // with sensible English fallbacks.
  const FACTOR_FALLBACKS = {
    'score.factor.strong_completion':   'Strong task completion',
    'score.factor.moderate_completion': 'Moderate task completion',
    'score.factor.weak_completion':     'Task completion needs work',
    'score.factor.strong_consistency':  'Consistent activity',
    'score.factor.some_consistency':    'Some recent activity',
    'score.factor.experienced':         'Experienced — many logged actions',
    'score.factor.risk_penalty_high':   'High risk is reducing your score',
    'score.factor.risk_penalty_medium': 'Medium risk is reducing your score',
  };
  const factorLines = factors.map((k) =>
    payload(k, {}, { fallback: FACTOR_FALLBACKS[k] || k }));

  // Next-tier nudge.
  const thresholds = funding.thresholds || { a: 75, b: 50 };
  let nextTier = null;
  if (tier === 'C' && score < thresholds.b) {
    nextTier = payload(
      'farmer.score.nudge.to_b',
      { pts: Math.max(0, thresholds.b - score) },
      { fallback: `${Math.max(0, thresholds.b - score)} points to tier B`, severity: 'neutral' },
    );
  } else if (tier === 'B' && score < thresholds.a) {
    nextTier = payload(
      'farmer.score.nudge.to_a',
      { pts: Math.max(0, thresholds.a - score) },
      { fallback: `${Math.max(0, thresholds.a - score)} points to tier A`, severity: 'neutral' },
    );
  } else if (tier === 'A') {
    nextTier = payload(
      'farmer.score.nudge.top_tier',
      {},
      { fallback: 'Top tier — keep it up!', severity: 'positive' },
    );
  }

  return Object.freeze({
    headline, fundingBadge,
    breakdown: Object.freeze(breakdownRows.map((r) => Object.freeze(r))),
    factorLines: Object.freeze(factorLines),
    nextTier,
    tier, score,
  });
}
