/**
 * cycleRiskEngine.js — deterministic, reviewable risk scoring for a
 * single crop cycle.
 *
 * Inputs:
 *   tasks          — CycleTaskPlan rows for the cycle
 *   issues         — IssueReport rows for the farm (pre-scoped)
 *   cycle          — V2CropCycle row (lifecycleStatus, plantingDate,
 *                    expectedHarvestDate)
 *   snapshot       — RecommendationSnapshot (optional; used for
 *                    plantingWindow reference)
 *
 * Output shape:
 *   {
 *     riskLevel: 'low' | 'medium' | 'high',
 *     riskScore: 0..100,          // raw composite for analytics
 *     reasons:   [string, ...],
 *     nextAction: string | null,
 *   }
 */

const OVERDUE_POINTS_PER_TASK = 8;      // each overdue task adds 8
const HIGH_OVERDUE_THRESHOLD = 3;        // 3+ overdue → additional cliff
const HIGH_SEV_ISSUE_POINTS = 25;        // each open high-severity issue
                                        // (2 issues = 50 → high risk cliff)
const MED_SEV_ISSUE_POINTS = 8;
const MISSED_WINDOW_POINTS = 18;
const INACTIVITY_POINTS = 10;            // no task completed in 14 days
const MAX_SCORE = 100;

const INACTIVITY_DAYS = 14;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function dayDiff(a, b) {
  if (!a || !b) return 0;
  return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/**
 * Pure risk calculation — no I/O.
 *
 * @param {Object} args
 * @param {Array}  args.tasks
 * @param {Array}  args.issues
 * @param {Object} args.cycle
 * @param {Object} [args.snapshot]
 * @param {Date}   [args.now]
 */
export function assessCycleRisk({ tasks = [], issues = [], cycle, snapshot, now = new Date() }) {
  const reasons = [];
  let score = 0;
  const nowMs = now.getTime();

  // ─── Overdue tasks ───────────────────────────────────
  const overdue = tasks.filter((t) =>
    t.status === 'pending' && t.dueDate && new Date(t.dueDate).getTime() < nowMs
  );
  if (overdue.length === 1) {
    score += OVERDUE_POINTS_PER_TASK;
    reasons.push('1 task is overdue — catch up when you can.');
  } else if (overdue.length >= HIGH_OVERDUE_THRESHOLD) {
    score += OVERDUE_POINTS_PER_TASK * overdue.length + 10;
    reasons.push(`${overdue.length} overdue tasks — this is hurting your yield.`);
  } else if (overdue.length > 1) {
    score += OVERDUE_POINTS_PER_TASK * overdue.length;
    reasons.push(`${overdue.length} tasks are overdue.`);
  }

  // ─── Open issues by severity ─────────────────────────
  const openIssues = (issues || []).filter((i) =>
    (i.status === 'open' || i.status === 'in_review')
  );
  const highSev = openIssues.filter((i) => i.severity === 'high').length;
  const medSev  = openIssues.filter((i) => i.severity === 'medium').length;
  if (highSev > 0) {
    score += highSev * HIGH_SEV_ISSUE_POINTS;
    reasons.push(`${highSev} high-severity issue${highSev > 1 ? 's' : ''} reported.`);
  }
  if (medSev > 0) {
    score += medSev * MED_SEV_ISSUE_POINTS;
  }

  // ─── Missed planting window ──────────────────────────
  const plantingWindow = snapshot?.plantingWindow;
  if (plantingWindow?.endMonth && cycle?.plantingDate) {
    const planted = new Date(cycle.plantingDate);
    const plantedMonth = planted.getMonth() + 1;
    // If plantedMonth is outside [start..end] by more than one month (wrap-aware).
    const start = plantingWindow.startMonth;
    const end = plantingWindow.endMonth;
    const insideWindow = start <= end
      ? plantedMonth >= start && plantedMonth <= end
      : plantedMonth >= start || plantedMonth <= end;
    if (!insideWindow) {
      score += MISSED_WINDOW_POINTS;
      reasons.push('Planted outside the usual window for this crop.');
    }
  }

  // ─── Inactivity ──────────────────────────────────────
  const lastCompletion = tasks
    .filter((t) => t.status === 'completed' && t.completedAt)
    .reduce((latest, t) => {
      const ts = new Date(t.completedAt).getTime();
      return ts > latest ? ts : latest;
    }, 0);
  if (lastCompletion === 0 && cycle?.createdAt && dayDiff(now, cycle.createdAt) >= INACTIVITY_DAYS) {
    score += INACTIVITY_POINTS;
    reasons.push(`No activity logged in ${INACTIVITY_DAYS}+ days.`);
  } else if (lastCompletion > 0 && dayDiff(now, lastCompletion) >= INACTIVITY_DAYS) {
    score += INACTIVITY_POINTS;
    reasons.push(`Last activity was ${dayDiff(now, lastCompletion)} days ago.`);
  }

  // ─── Roll up ─────────────────────────────────────────
  const clamped = clamp(score, 0, MAX_SCORE);
  const riskLevel = clamped >= 50 ? 'high' : clamped >= 25 ? 'medium' : 'low';
  const nextAction = buildNextAction({ riskLevel, overdue, openIssues, cycle });

  return { riskLevel, riskScore: clamped, reasons, nextAction };
}

function buildNextAction({ riskLevel, overdue, openIssues, cycle }) {
  const highSev = openIssues.filter((i) => i.severity === 'high');
  if (highSev.length > 0) {
    return `Address the ${highSev[0].category.replace('_', ' ')} issue you reported.`;
  }
  if (overdue.length >= 1) {
    return `Finish the overdue task: "${overdue[0].title}".`;
  }
  if (riskLevel === 'high') {
    return 'Walk the field today and log what you see.';
  }
  if (cycle?.lifecycleStatus === 'planned') {
    return 'Start planting when the soil is ready.';
  }
  return null;
}

export const _internal = {
  OVERDUE_POINTS_PER_TASK, HIGH_OVERDUE_THRESHOLD,
  HIGH_SEV_ISSUE_POINTS, MED_SEV_ISSUE_POINTS,
  MISSED_WINDOW_POINTS, INACTIVITY_POINTS, INACTIVITY_DAYS,
};
