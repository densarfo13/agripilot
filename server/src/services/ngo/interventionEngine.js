/**
 * interventionEngine.js — compute intervention priority for a single
 * farm/cycle from the signals we already capture.
 *
 * Inputs (all optional; the engine is robust to missing data):
 *   cycleRisk              — 'low' | 'medium' | 'high'    (cycleRiskEngine output)
 *   overdueCount           — integer ≥ 0
 *   highSevIssues          — integer ≥ 0
 *   mediumSevIssues        — integer ≥ 0
 *   inactivityDays         — integer ≥ 0
 *   missedWindow           — boolean
 *   verificationConfidence — 0..1 (higher = more verified)
 *
 * Output:
 *   interventionScore  0..100
 *   priority           'critical' | 'high' | 'medium' | 'low'
 *   reason             human-facing short explanation
 *   recommendedAction  short imperative sentence
 *   dueAt              Date — when to follow up
 *   signals            { ...inputs as emitted }
 */

const WEIGHTS = Object.freeze({
  highRisk: 25,
  mediumRisk: 12,
  overduePerTask: 4,
  overdueCliff: 12,          // applied at 3+ overdue
  highSevIssue: 20,
  mediumSevIssue: 8,
  inactivityPerDay: 1.2,     // capped at 30 days so it can't dominate
  missedWindow: 15,
  lowVerification: 10,       // confidence < 0.4
});

const DUE_DAYS = Object.freeze({
  critical: 1,
  high: 3,
  medium: 7,
  low: 14,
});

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export function assessIntervention(input = {}) {
  const cycleRisk      = input.cycleRisk || 'low';
  const overdueCount   = Math.max(0, Number(input.overdueCount) || 0);
  const highSevIssues  = Math.max(0, Number(input.highSevIssues) || 0);
  const medSevIssues   = Math.max(0, Number(input.mediumSevIssues) || 0);
  const inactivityDays = Math.max(0, Number(input.inactivityDays) || 0);
  const missedWindow   = !!input.missedWindow;
  const vConfidence    = Number.isFinite(input.verificationConfidence)
    ? clamp(input.verificationConfidence, 0, 1) : null;

  const reasons = [];
  let score = 0;

  if (cycleRisk === 'high') {
    score += WEIGHTS.highRisk;
    reasons.push('Cycle is high risk');
  } else if (cycleRisk === 'medium') {
    score += WEIGHTS.mediumRisk;
  }

  if (overdueCount >= 3) {
    score += WEIGHTS.overduePerTask * overdueCount + WEIGHTS.overdueCliff;
    reasons.push(`${overdueCount} overdue tasks`);
  } else if (overdueCount > 0) {
    score += WEIGHTS.overduePerTask * overdueCount;
    if (overdueCount > 1) reasons.push(`${overdueCount} overdue tasks`);
  }

  if (highSevIssues > 0) {
    score += highSevIssues * WEIGHTS.highSevIssue;
    reasons.push(`${highSevIssues} high-severity issue${highSevIssues > 1 ? 's' : ''}`);
  }
  if (medSevIssues > 0) {
    score += medSevIssues * WEIGHTS.mediumSevIssue;
  }

  if (inactivityDays >= 7) {
    const capped = Math.min(inactivityDays, 30);
    score += capped * WEIGHTS.inactivityPerDay;
    reasons.push(`${inactivityDays}+ days inactive`);
  }

  if (missedWindow) {
    score += WEIGHTS.missedWindow;
    reasons.push('Missed planting window');
  }

  if (vConfidence !== null && vConfidence < 0.4) {
    score += WEIGHTS.lowVerification;
    reasons.push('Low verification confidence');
  }

  score = clamp(Math.round(score), 0, 100);
  const priority =
    score >= 70 ? 'critical' :
    score >= 45 ? 'high' :
    score >= 20 ? 'medium' : 'low';

  const recommendedAction = buildRecommendedAction({
    priority, cycleRisk, overdueCount, highSevIssues, missedWindow, inactivityDays,
  });

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + DUE_DAYS[priority]);

  return {
    interventionScore: score,
    priority,
    reason: reasons.length ? reasons.join('; ') : 'Low-concern check-in',
    recommendedAction,
    dueAt,
    signals: {
      cycleRisk, overdueCount, highSevIssues, mediumSevIssues: medSevIssues,
      inactivityDays, missedWindow, verificationConfidence: vConfidence,
    },
  };
}

function buildRecommendedAction({ priority, cycleRisk, overdueCount, highSevIssues, missedWindow, inactivityDays }) {
  if (priority === 'critical') {
    if (highSevIssues > 0) return 'Contact the farmer today — high-severity issue is open.';
    if (overdueCount >= 3) return 'Call the farmer — multiple overdue tasks are stalling the cycle.';
    return 'Prioritize a field visit within 24 hours.';
  }
  if (priority === 'high') {
    if (cycleRisk === 'high') return 'Schedule a check-in within 3 days.';
    if (missedWindow) return 'Guide the farmer on alternative crops or recovery steps.';
    return 'Follow up within 3 days.';
  }
  if (priority === 'medium') {
    if (inactivityDays >= 14) return 'Nudge the farmer to log recent activity.';
    return 'Monitor — follow up within a week.';
  }
  return 'No action needed right now.';
}

export const _internal = { WEIGHTS, DUE_DAYS };
