/**
 * fundingEligibilityEngine.js — decision table per NGO v2 spec.
 *
 *   ELIGIBLE:
 *     healthScore ≥ 75 AND verificationScore ≥ 70 AND
 *     no open CRITICAL intervention AND at least one
 *     active or completed crop cycle
 *
 *   MONITOR:
 *     healthScore 60-74  OR verificationScore 50-69
 *
 *   NOT_YET_ELIGIBLE:
 *     healthScore < 60  OR repeated inactivity / high operational risk
 *
 *   NEEDS_REVIEW:
 *     conflicting or insufficient verification data
 *
 * Thresholds live in FUNDING_CONFIG so ops can retune without
 * re-reading the engine. The output always carries a `blockers[]`
 * list and an `explain{}` payload describing which thresholds fired.
 */

export const FUNDING_CONFIG = Object.freeze({
  eligible: Object.freeze({
    minHealth: 75,
    minVerification: 70,
  }),
  monitor: Object.freeze({
    healthFloor: 60,   // inclusive
    healthCap: 74,     // inclusive
    verificationFloor: 50,
    verificationCap: 69,
  }),
  reviewVerificationFloor: 40,   // below this + otherwise eligible → needs_review
  notEligibleHealthCutoff: 60,
  highRiskScore: 70,
  repeatedInactivityCyclesFailed: 2,
});

const CFG = FUNDING_CONFIG;

function isHealthEligible(h)       { return (h ?? 0) >= CFG.eligible.minHealth; }
function isVerificationEligible(v) { return (v ?? 0) >= CFG.eligible.minVerification; }
function isCriticalOpen(intervention) {
  return intervention?.priority === 'critical' &&
    (intervention.status === 'open' || intervention.status === 'in_progress');
}

function hasQualifyingCycle(context) {
  if (context == null) return undefined;       // caller didn't supply; leave undecided
  const total = Number(context.totalCycles) || 0;
  const completed = Number(context.completedCycles) || 0;
  const active = Number(context.activeCycles) || 0;
  return active > 0 || completed > 0 || total > 0;
}

export function decideFundingEligibility({ score, intervention, context } = {}) {
  const explain = {
    thresholds: CFG,
    checks: {
      healthScore: score?.healthScore ?? null,
      verificationScore: score?.verificationScore ?? null,
      riskScore: score?.riskScore ?? null,
      openCriticalIntervention: !!isCriticalOpen(intervention),
      hasQualifyingCycle: hasQualifyingCycle(context),
    },
  };

  const blockers = [];

  if (!score) {
    return fail('needs_review', 'No farmer score available yet.', ['missing_score'], explain);
  }

  const { healthScore, verificationScore, riskScore } = score;

  // ─── Hard blockers first — they stop the eligible path ────
  if (isCriticalOpen(intervention)) {
    blockers.push('open_critical_intervention');
    return fail('not_yet_eligible',
      'Critical intervention is open. Resolve it before funding.',
      blockers, explain);
  }
  if ((riskScore ?? 0) >= CFG.highRiskScore) {
    blockers.push('high_risk_score');
    return fail('not_yet_eligible',
      'Operational risk is too high right now.',
      blockers, explain);
  }
  if ((context?.failedCycles || 0) >= CFG.repeatedInactivityCyclesFailed) {
    blockers.push('repeated_failures');
    return fail('not_yet_eligible',
      'Repeated cycle failures — build a track record first.',
      blockers, explain);
  }

  // ─── Happy path: ELIGIBLE ─────────────────────────────────
  const eligibleCheck = (
    isHealthEligible(healthScore) &&
    isVerificationEligible(verificationScore) &&
    hasQualifyingCycle(context) !== false
  );
  if (eligibleCheck) {
    return fail('eligible', 'Strong profile with verified activity and no open critical interventions.', [], explain);
  }

  // ─── Verification-forward checks ──────────────────────────
  // Strong health but very weak verification → review.
  if (isHealthEligible(healthScore) && (verificationScore ?? 0) < CFG.reviewVerificationFloor) {
    blockers.push('verification_low');
    return fail('needs_review',
      'Health is strong but verification is very low. Route to a reviewer.',
      blockers, explain);
  }

  // Below clear eligibility cutoff → not yet.
  if ((healthScore ?? 0) < CFG.notEligibleHealthCutoff) {
    blockers.push('health_below_cutoff');
    if ((verificationScore ?? 0) < CFG.reviewVerificationFloor) blockers.push('verification_low');
    return fail('not_yet_eligible',
      'Keep building activity and verifications before applying.',
      blockers, explain);
  }

  // ─── MONITOR band: 60-74 health or 50-69 verification ─────
  const healthInMonitor = (healthScore >= CFG.monitor.healthFloor && healthScore <= CFG.monitor.healthCap);
  const verificationInMonitor = (verificationScore >= CFG.monitor.verificationFloor && verificationScore <= CFG.monitor.verificationCap);
  if (healthInMonitor || verificationInMonitor) {
    if ((verificationScore ?? 0) < CFG.reviewVerificationFloor) blockers.push('verification_low');
    if (!isVerificationEligible(verificationScore)) blockers.push('verification_below_threshold');
    if (hasQualifyingCycle(context) === false) blockers.push('no_cycles_yet');
    return fail('monitor',
      'On the right track — keep logging activity and verifications.',
      blockers, explain);
  }

  // ─── Fallback: needs_review when signals are ambiguous ────
  blockers.push('insufficient_data');
  return fail('needs_review',
    'Conflicting or insufficient data. Route to a reviewer.',
    blockers, explain);
}

function fail(decision, reasonText, blockers, explain) {
  return { decision, reason: reasonText, blockers, explain };
}

export const _thresholds = CFG;
