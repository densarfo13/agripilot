/**
 * farmerScoringEngine.js — rolls a farmer's operational data into
 * four sub-scores plus a weighted health composite.
 *
 * Inputs:
 *   totalCycles             — cycles the farmer has started
 *   completedCycles         — cycles reaching harvested status
 *   failedCycles            — cycles reaching failed status
 *   totalTasks              — total CycleTaskPlan rows across cycles
 *   completedTasks          — completed
 *   overdueTasks            — pending past due
 *   harvestReports          — count of V2HarvestRecord rows
 *   openHighSevIssues       — issues open/in_review at severity high
 *   inactivityDays          — days since last signal (task / harvest / issue)
 *   verificationConfidence  — mean confidence across VerificationRecord rows (0..1)
 *
 * Outputs (0..100 each unless noted):
 *   performanceScore   — task completion × harvest reporting
 *   consistencyScore   — inverse of inactivity + variance
 *   riskScore          — higher = more risk (so the farmer side wants it low)
 *   verificationScore  — 100 × verificationConfidence (null-safe)
 *   healthScore        — weighted composite
 *   scoreBand          — 'excellent' | 'good' | 'fair' | 'weak'
 *   signals            — echo of key input counts so reviewers can audit
 */

const BAND = Object.freeze({
  excellent: 80,
  good: 60,
  fair: 40,
});

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function safeDiv(a, b, fallback = 0) {
  return b > 0 ? a / b : fallback;
}

export function computeFarmerScore(input = {}) {
  const totalCycles    = Math.max(0, Number(input.totalCycles) || 0);
  const completedCycles = Math.max(0, Number(input.completedCycles) || 0);
  const failedCycles   = Math.max(0, Number(input.failedCycles) || 0);
  const totalTasks     = Math.max(0, Number(input.totalTasks) || 0);
  const completedTasks = Math.max(0, Number(input.completedTasks) || 0);
  const overdueTasks   = Math.max(0, Number(input.overdueTasks) || 0);
  const harvestReports = Math.max(0, Number(input.harvestReports) || 0);
  const openHighSevIssues = Math.max(0, Number(input.openHighSevIssues) || 0);
  const inactivityDays = Math.max(0, Number(input.inactivityDays) || 0);
  const vConf          = Number.isFinite(input.verificationConfidence)
    ? clamp(input.verificationConfidence, 0, 1) : null;

  // ─── Performance ────────────────────────────────────────
  // Task completion ratio (60%) + harvest reporting per completed
  // cycle (40%). A farmer who harvests but never reports still gets
  // partial credit for the tasks they completed.
  const taskRatio = safeDiv(completedTasks, totalTasks, 0);
  const harvestRatio = safeDiv(harvestReports, Math.max(1, completedCycles), 0);
  const performanceScore = clamp(Math.round(
    (taskRatio * 60) + (Math.min(harvestRatio, 1) * 40)
  ), 0, 100);

  // ─── Consistency ────────────────────────────────────────
  // Starts at 100, drops on inactivity and failed cycles.
  // 30+ days idle → -40; every failed cycle → -10.
  let consistency = 100;
  if (inactivityDays >= 30) consistency -= 40;
  else if (inactivityDays >= 14) consistency -= 20;
  else if (inactivityDays >= 7) consistency -= 10;
  consistency -= Math.min(30, failedCycles * 10);
  const consistencyScore = clamp(Math.round(consistency), 0, 100);

  // ─── Risk ───────────────────────────────────────────────
  // Higher = more risk. Overdue tasks and open high-severity
  // issues dominate; modest base rises with failed cycles.
  // No track record is a genuine concern — treat "never engaged"
  // as a substantial risk signal (25 points) rather than a nudge.
  let risk = 0;
  risk += Math.min(60, overdueTasks * 5);
  risk += Math.min(60, openHighSevIssues * 20);
  risk += Math.min(20, failedCycles * 5);
  if (totalCycles === 0) risk += 25;
  const riskScore = clamp(Math.round(risk), 0, 100);

  // ─── Verification ──────────────────────────────────────
  // When we have no confidence data, assume neutral 50 so the
  // composite isn't penalised for absence of audits.
  const verificationScore = vConf === null ? 50 : clamp(Math.round(vConf * 100), 0, 100);

  // ─── Health (weighted composite) ───────────────────────
  // performance 40%, consistency 25%, verification 15%, inverse-risk 20%.
  const healthScore = clamp(Math.round(
    performanceScore * 0.40 +
    consistencyScore * 0.25 +
    verificationScore * 0.15 +
    (100 - riskScore) * 0.20
  ), 0, 100);

  const scoreBand =
    healthScore >= BAND.excellent ? 'excellent' :
    healthScore >= BAND.good ? 'good' :
    healthScore >= BAND.fair ? 'fair' : 'weak';

  return {
    performanceScore,
    consistencyScore,
    riskScore,
    verificationScore,
    healthScore,
    scoreBand,
    signals: {
      totalCycles, completedCycles, failedCycles,
      totalTasks, completedTasks, overdueTasks,
      harvestReports, openHighSevIssues, inactivityDays,
      verificationConfidence: vConf,
    },
  };
}

export const _bands = BAND;
