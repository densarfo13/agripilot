/**
 * interventionEngine.js — compute intervention priority for a single
 * farm/cycle using the locked-in NGO v2 component model.
 *
 * All thresholds live in INTERVENTION_CONFIG as plain data so product
 * and operations can tune weights without re-reading the engine.
 *
 * Components (spec):
 *   RiskComponent          LOW=10, MEDIUM=20, HIGH=30
 *   OverdueTaskComponent   0 tasks=0, 1=8, 2=14, 3+=20
 *   IssueComponent         none=0, LOW=5, MEDIUM=10, HIGH=20
 *                          + 5 if 2+ unresolved issues
 *   InactivityComponent    0-3d=0, 4-7=5, 8-14=10, 15+=15
 *   TimingComponent        none=0, nearly_missed=5, missed=10
 *   VerificationComponent  confidence ≥80→0, 60-79→2, 40-59→4, <40→5
 *
 * Priority thresholds:
 *   0-24   LOW
 *   25-49  MEDIUM
 *   50-74  HIGH
 *   75-100 CRITICAL
 *
 * Output:
 *   interventionScore (0..100), priority, reason, recommendedAction,
 *   dueAt, signals, explain{ components, priorityThreshold }.
 */

export const INTERVENTION_CONFIG = Object.freeze({
  risk: Object.freeze({ low: 10, medium: 20, high: 30 }),
  overdue: Object.freeze({ 0: 0, 1: 8, 2: 14, '3+': 20 }),
  issueByMaxSeverity: Object.freeze({ none: 0, low: 5, medium: 10, high: 20 }),
  multipleIssueBoost: 5,
  inactivity: Object.freeze([
    { maxDays: 3, points: 0 },
    { maxDays: 7, points: 5 },
    { maxDays: 14, points: 10 },
    { maxDays: Infinity, points: 15 },
  ]),
  timing: Object.freeze({ none: 0, nearly_missed: 5, missed: 10 }),
  verificationBands: Object.freeze([
    { min: 80, points: 0 },
    { min: 60, points: 2 },
    { min: 40, points: 4 },
    { min: 0,  points: 5 },
  ]),
  priorityThresholds: Object.freeze({ low: 0, medium: 25, high: 50, critical: 75 }),
  dueDays: Object.freeze({ critical: 1, high: 3, medium: 7, low: 14 }),
});

const CFG = INTERVENTION_CONFIG;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function riskPoints(level) {
  // Missing/unspecified risk means "no cycle in play" — contribute 0.
  // Explicit 'low' still contributes 10 per spec.
  if (level === null || level === undefined || level === '') return 0;
  return CFG.risk[String(level).toLowerCase()] ?? 0;
}
function overduePoints(count) {
  if (!Number.isFinite(count) || count <= 0) return CFG.overdue[0];
  if (count === 1) return CFG.overdue[1];
  if (count === 2) return CFG.overdue[2];
  return CFG.overdue['3+'];
}
function issuePoints({ maxSeverity, unresolvedCount }) {
  const base = CFG.issueByMaxSeverity[String(maxSeverity || 'none').toLowerCase()] ?? 0;
  const boost = (unresolvedCount || 0) >= 2 ? CFG.multipleIssueBoost : 0;
  return { base, boost, total: base + boost };
}
function inactivityPoints(days) {
  const d = Math.max(0, Number(days) || 0);
  for (const band of CFG.inactivity) if (d <= band.maxDays) return band.points;
  return CFG.inactivity[CFG.inactivity.length - 1].points;
}
function timingPoints(state) {
  const key = String(state || 'none').toLowerCase().replace(/\s+/g, '_');
  return CFG.timing[key] ?? 0;
}
function verificationPoints(confidence) {
  // Missing / unspecified confidence is neutral, not a penalty. If
  // the NGO wants to treat "no data" as a weak signal they can
  // supply 0 explicitly.
  if (confidence === null || confidence === undefined) return 0;
  const pct = Number(confidence) <= 1 ? confidence * 100 : confidence;
  for (const band of CFG.verificationBands) if (pct >= band.min) return band.points;
  return CFG.verificationBands[CFG.verificationBands.length - 1].points;
}

function decidePriority(score) {
  const th = CFG.priorityThresholds;
  if (score >= th.critical) return 'critical';
  if (score >= th.high) return 'high';
  if (score >= th.medium) return 'medium';
  return 'low';
}

/** Infer max severity and unresolved count from either shape the caller hands us. */
function normalizeIssueInput(input) {
  if (Array.isArray(input.unresolvedIssues)) {
    const sev = input.unresolvedIssues.map((i) => String(i?.severity || '').toLowerCase());
    const maxSeverity = sev.includes('high') ? 'high' : sev.includes('medium') ? 'medium' : sev.includes('low') ? 'low' : 'none';
    return { maxSeverity, unresolvedCount: input.unresolvedIssues.length };
  }
  return {
    maxSeverity: input.maxIssueSeverity || (input.highSevIssues > 0 ? 'high' : input.mediumSevIssues > 0 ? 'medium' : 'none'),
    unresolvedCount: (input.highSevIssues || 0) + (input.mediumSevIssues || 0) + (input.lowSevIssues || 0),
  };
}

function normalizeTimingInput(input) {
  if (input.timingState) return input.timingState;
  if (input.missedWindow) return 'missed';
  if (input.nearlyMissedWindow) return 'nearly_missed';
  return 'none';
}

export function assessIntervention(input = {}) {
  const cycleRisk = input.cycleRisk ? String(input.cycleRisk).toLowerCase() : null;
  const overdueCount = Math.max(0, Number(input.overdueCount) || 0);
  const issue = normalizeIssueInput(input);
  const inactivityDays = Math.max(0, Number(input.inactivityDays) || 0);
  const timingState = normalizeTimingInput(input);
  const verificationPct = Number.isFinite(input.verificationConfidence)
    ? (input.verificationConfidence <= 1 ? input.verificationConfidence * 100 : input.verificationConfidence)
    : null;

  const components = {
    risk: riskPoints(cycleRisk),
    overdue: overduePoints(overdueCount),
    issue: issuePoints(issue),
    inactivity: inactivityPoints(inactivityDays),
    timing: timingPoints(timingState),
    verification: verificationPoints(verificationPct ?? null),
  };

  let score = components.risk + components.overdue + components.issue.total +
              components.inactivity + components.timing + components.verification;
  score = clamp(Math.round(score), 0, 100);

  const priority = decidePriority(score);

  const reasons = [];
  if (cycleRisk === 'high') reasons.push('Cycle is high risk');
  if (overdueCount >= 3) reasons.push(`${overdueCount} overdue tasks`);
  else if (overdueCount > 0) reasons.push(`${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}`);
  if (issue.maxSeverity === 'high') reasons.push('High-severity issue open');
  else if (issue.maxSeverity === 'medium') reasons.push('Medium-severity issue open');
  if (inactivityDays >= 8) reasons.push(`${inactivityDays}+ days inactive`);
  if (timingState === 'missed') reasons.push('Missed planting window');
  if (timingState === 'nearly_missed') reasons.push('Nearly missed planting window');
  if ((verificationPct ?? 100) < 40) reasons.push('Very low verification confidence');

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + (CFG.dueDays[priority] ?? 14));

  return {
    interventionScore: score,
    priority,
    reason: reasons.length ? reasons.join('; ') : 'Low-concern check-in',
    recommendedAction: buildRecommendedAction({
      priority, cycleRisk, overdueCount, issue, timingState, inactivityDays,
    }),
    dueAt,
    signals: {
      cycleRisk, overdueCount, inactivityDays, timingState,
      maxIssueSeverity: issue.maxSeverity,
      unresolvedIssueCount: issue.unresolvedCount,
      verificationConfidence: verificationPct,
    },
    explain: {
      components: {
        riskComponent: components.risk,
        overdueTaskComponent: components.overdue,
        issueComponent: components.issue.total,
        issueComponentBase: components.issue.base,
        issueComponentMultiBoost: components.issue.boost,
        inactivityComponent: components.inactivity,
        timingComponent: components.timing,
        verificationComponent: components.verification,
      },
      priorityThreshold: CFG.priorityThresholds,
      total: score,
    },
  };
}

function buildRecommendedAction({ priority, cycleRisk, overdueCount, issue, timingState, inactivityDays }) {
  if (priority === 'critical') {
    if (issue.maxSeverity === 'high') return 'Contact the farmer today — high-severity issue is open.';
    if (overdueCount >= 3) return 'Call the farmer — multiple overdue tasks are stalling the cycle.';
    return 'Prioritize a field visit within 24 hours.';
  }
  if (priority === 'high') {
    if (cycleRisk === 'high') return 'Schedule a check-in within 3 days.';
    if (timingState === 'missed' || timingState === 'nearly_missed') return 'Guide the farmer on recovery or alternative crops.';
    return 'Follow up within 3 days.';
  }
  if (priority === 'medium') {
    if (inactivityDays >= 8) return 'Nudge the farmer to log recent activity.';
    return 'Monitor — follow up within a week.';
  }
  return 'No action needed right now.';
}

export const _internal = { CFG };
