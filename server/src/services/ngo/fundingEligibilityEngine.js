/**
 * fundingEligibilityEngine.js — rule-based gating layer over
 * FarmerScore + intervention state to produce a funding decision.
 *
 * Decisions:
 *   eligible          — ready to receive funding
 *   monitor           — almost there; keep tracking
 *   not_yet_eligible  — material gaps on health or verification
 *   needs_review      — ambiguous signals; route to a human
 *
 * The function is deterministic and side-effect free so it's
 * safe to call from batch jobs and from the NGO detail UI
 * without coordinating writes.
 */

const MIN_HEALTH_FOR_ELIGIBLE = 80;
const MIN_VERIFICATION_FOR_ELIGIBLE = 70;
const MONITOR_HEALTH_BAND = 60;   // 60..79 → monitor track
const REVIEW_VERIFICATION = 50;   // low verification but otherwise OK → review

/**
 * @param {Object} args
 * @param {Object} args.score     FarmerScore shape (healthScore, verificationScore, riskScore, scoreBand)
 * @param {Object} [args.intervention]  latest Intervention row (priority, status)
 */
export function decideFundingEligibility({ score, intervention } = {}) {
  const blockers = [];
  if (!score) {
    return reason('needs_review', 'No farmer score available yet.', ['missing_score']);
  }

  const { healthScore = 0, verificationScore = 0, riskScore = 0, scoreBand = 'weak' } = score;

  // Hard blockers first — an open critical intervention means the
  // farmer has an active problem that funding won't fix.
  if (intervention?.priority === 'critical' && intervention?.status === 'open') {
    blockers.push('open_critical_intervention');
    return reason(
      'not_yet_eligible',
      'Critical intervention is open. Resolve the issue before funding.',
      blockers,
    );
  }

  if (riskScore >= 70) {
    blockers.push('high_risk_score');
    return reason('not_yet_eligible', 'Risk score is too high right now.', blockers);
  }

  // Happy path — strong health AND verified.
  if (healthScore >= MIN_HEALTH_FOR_ELIGIBLE && verificationScore >= MIN_VERIFICATION_FOR_ELIGIBLE) {
    return reason('eligible', `Strong ${scoreBand} profile with verified activity.`, []);
  }

  // Health is strong but we can't trust the data yet.
  if (healthScore >= MIN_HEALTH_FOR_ELIGIBLE && verificationScore < MIN_VERIFICATION_FOR_ELIGIBLE) {
    if (verificationScore < REVIEW_VERIFICATION) {
      blockers.push('verification_low');
      return reason('needs_review', 'Health is strong but verification is low. Route to a reviewer.', blockers);
    }
    blockers.push('verification_below_threshold');
    return reason('monitor', 'Keep verifying this farmer; otherwise they look ready.', blockers);
  }

  // Middle ground — good enough to monitor toward eligibility.
  if (healthScore >= MONITOR_HEALTH_BAND) {
    if (verificationScore < REVIEW_VERIFICATION) blockers.push('verification_low');
    return reason('monitor', 'On the right track. Keep logging activity and verifications.', blockers);
  }

  // Clearly not ready yet.
  blockers.push('health_below_band');
  if (verificationScore < REVIEW_VERIFICATION) blockers.push('verification_low');
  return reason('not_yet_eligible', `Profile is ${scoreBand}. Build activity and verifications first.`, blockers);
}

function reason(decision, text, blockers) {
  return { decision, reason: text, blockers };
}

export const _thresholds = {
  MIN_HEALTH_FOR_ELIGIBLE,
  MIN_VERIFICATION_FOR_ELIGIBLE,
  MONITOR_HEALTH_BAND,
  REVIEW_VERIFICATION,
};
