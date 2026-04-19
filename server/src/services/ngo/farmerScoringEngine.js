/**
 * farmerScoringEngine.js — NGO v2 composite scoring.
 *
 * Weights and formulas are spec-locked and live in FARMER_SCORE_CONFIG
 * so operations can tune them without re-reading the engine.
 *
 *   Performance   = TaskCompletionRate*0.35
 *                 + CropCycleCompletionRate*0.25
 *                 + HarvestReportingRate*0.20
 *                 + OutcomeQualityScore*0.20
 *
 *   Consistency   = WeeklyActivityScore*0.50
 *                 + UpdateRegularityScore*0.30
 *                 + RepeatCycleEngagementScore*0.20
 *
 *   Risk          = CurrentCycleRisk*0.40
 *                 + OverdueBurden*0.25
 *                 + IssueSeverityBurden*0.20
 *                 + DelayFailureHistory*0.15
 *
 *   Verification  = ProfileCompleteness*0.25
 *                 + ActivityEvidenceScore*0.30
 *                 + LocationConfidenceScore*0.20
 *                 + HarvestEvidenceScore*0.15
 *                 + ReviewOutcomeScore*0.10
 *
 *   Health = Performance*0.35 + Consistency*0.25
 *          + Verification*0.20 + (100-Risk)*0.20
 *
 * All sub-score inputs are 0..100. Callers can either pass
 * pre-computed sub-scores or pass raw counts and let the engine
 * derive them.
 */

export const FARMER_SCORE_CONFIG = Object.freeze({
  performance: Object.freeze({
    taskCompletion: 0.35,
    cycleCompletion: 0.25,
    harvestReporting: 0.20,
    outcomeQuality: 0.20,
  }),
  consistency: Object.freeze({
    weeklyActivity: 0.50,
    updateRegularity: 0.30,
    repeatCycleEngagement: 0.20,
  }),
  risk: Object.freeze({
    currentCycleRisk: 0.40,
    overdueBurden: 0.25,
    issueSeverityBurden: 0.20,
    delayFailureHistory: 0.15,
  }),
  verification: Object.freeze({
    profileCompleteness: 0.25,
    activityEvidence: 0.30,
    locationConfidence: 0.20,
    harvestEvidence: 0.15,
    reviewOutcome: 0.10,
  }),
  health: Object.freeze({
    performance: 0.35,
    consistency: 0.25,
    verification: 0.20,
    invertedRisk: 0.20,
  }),
  bands: Object.freeze({ excellent: 80, good: 60, fair: 40 }),
});

const CFG = FARMER_SCORE_CONFIG;

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function weighted(weights, parts) {
  let total = 0;
  for (const key of Object.keys(weights)) {
    const v = Number(parts[key]);
    if (Number.isFinite(v)) total += clamp(v, 0, 100) * weights[key];
  }
  return clamp(Math.round(total), 0, 100);
}

/**
 * Derive sub-scores (0..100) from the raw input shape the route
 * hands us. Each sub-score is clamped and any missing signal falls
 * back to a neutral 50 so the composite doesn't collapse on partial
 * data — the verification inputs default to 0 because "no evidence"
 * is genuinely weak, not neutral.
 */
function derivePerformanceParts(raw) {
  const taskRatio = raw.totalTasks > 0 ? raw.completedTasks / raw.totalTasks : 0;
  const cycleRatio = raw.totalCycles > 0
    ? (raw.completedCycles || 0) / raw.totalCycles : 0;
  const harvestRatio = (raw.completedCycles || 0) > 0
    ? Math.min(1, (raw.harvestReports || 0) / raw.completedCycles) : 0;
  const outcomeQuality = Number.isFinite(raw.outcomeQualityScore)
    ? clamp(raw.outcomeQualityScore, 0, 100)
    : ((raw.completedCycles || 0) - (raw.failedCycles || 0) >= 0 && (raw.totalCycles || 0) > 0
        ? Math.max(0, ((raw.completedCycles || 0) - (raw.failedCycles || 0)) / raw.totalCycles * 100)
        : 50);
  return {
    taskCompletion: taskRatio * 100,
    cycleCompletion: cycleRatio * 100,
    harvestReporting: harvestRatio * 100,
    outcomeQuality,
  };
}

function deriveConsistencyParts(raw) {
  // WeeklyActivityScore — approximate from inactivityDays: 0 days → 100,
  // 30+ days → 0, linear in between.
  const inactivity = Math.max(0, Number(raw.inactivityDays) || 0);
  const weeklyActivity = clamp(100 - (inactivity / 30) * 100, 0, 100);

  // UpdateRegularityScore — proxy from task completion + harvest reports.
  const completedTasks = raw.completedTasks || 0;
  const harvestReports = raw.harvestReports || 0;
  const regularity = clamp(Math.min(100, completedTasks * 3 + harvestReports * 10), 0, 100);

  // RepeatCycleEngagementScore — farmers who've run multiple cycles
  // get credit; 3+ cycles → 100, linear from 0.
  const repeatEngagement = clamp(Math.min(100, (raw.totalCycles || 0) * 33), 0, 100);

  return {
    weeklyActivity: Number.isFinite(raw.weeklyActivityScore) ? clamp(raw.weeklyActivityScore, 0, 100) : weeklyActivity,
    updateRegularity: Number.isFinite(raw.updateRegularityScore) ? clamp(raw.updateRegularityScore, 0, 100) : regularity,
    repeatCycleEngagement: Number.isFinite(raw.repeatCycleEngagementScore) ? clamp(raw.repeatCycleEngagementScore, 0, 100) : repeatEngagement,
  };
}

function deriveRiskParts(raw) {
  // CurrentCycleRisk — map 'low'|'medium'|'high' → 10|50|80.
  const riskMap = { low: 10, medium: 50, high: 80 };
  const currentCycleRisk = Number.isFinite(raw.currentCycleRiskScore)
    ? clamp(raw.currentCycleRiskScore, 0, 100)
    : (riskMap[String(raw.currentCycleRisk || 'low').toLowerCase()] || 10);

  // OverdueBurden — 0 overdue → 0, 10+ → 100.
  const overdueBurden = clamp(Math.min(100, (raw.overdueTasks || 0) * 10), 0, 100);

  // IssueSeverityBurden — high counts heavily, medium moderately.
  const issueBurden = clamp(Math.min(100, (raw.openHighSevIssues || 0) * 40 + (raw.openMedSevIssues || 0) * 15), 0, 100);

  // DelayFailureHistory — each failed cycle adds 25.
  const delayFailure = clamp((raw.failedCycles || 0) * 25, 0, 100);

  return {
    currentCycleRisk,
    overdueBurden,
    issueSeverityBurden: issueBurden,
    delayFailureHistory: delayFailure,
  };
}

function deriveVerificationParts(raw) {
  // If the caller supplies explicit sub-scores we use them; otherwise
  // we derive conservatively from what the farm record already has.
  return {
    profileCompleteness: Number.isFinite(raw.profileCompletenessScore) ? clamp(raw.profileCompletenessScore, 0, 100)
      : clamp((raw.profileCompleteness || 0.5) * 100, 0, 100),
    activityEvidence: Number.isFinite(raw.activityEvidenceScore) ? clamp(raw.activityEvidenceScore, 0, 100)
      : clamp(Math.min(100, (raw.completedTasks || 0) * 3), 0, 100),
    locationConfidence: Number.isFinite(raw.locationConfidenceScore) ? clamp(raw.locationConfidenceScore, 0, 100)
      : clamp(((raw.hasGps ? 1 : 0.5) * 100), 0, 100),
    harvestEvidence: Number.isFinite(raw.harvestEvidenceScore) ? clamp(raw.harvestEvidenceScore, 0, 100)
      : clamp(Math.min(100, (raw.harvestReports || 0) * 30), 0, 100),
    reviewOutcome: Number.isFinite(raw.reviewOutcomeScore) ? clamp(raw.reviewOutcomeScore, 0, 100)
      : clamp((Number.isFinite(raw.verificationConfidence) ? raw.verificationConfidence * 100 : 50), 0, 100),
  };
}

export function computeFarmerScore(input = {}) {
  const performanceParts  = derivePerformanceParts(input);
  const consistencyParts  = deriveConsistencyParts(input);
  const riskParts         = deriveRiskParts(input);
  const verificationParts = deriveVerificationParts(input);

  const performanceScore  = weighted(CFG.performance,   performanceParts);
  const consistencyScore  = weighted(CFG.consistency,   consistencyParts);
  const riskScore         = weighted(CFG.risk,          riskParts);
  const verificationScore = weighted(CFG.verification,  verificationParts);

  const healthScore = weighted(CFG.health, {
    performance: performanceScore,
    consistency: consistencyScore,
    verification: verificationScore,
    invertedRisk: 100 - riskScore,
  });

  const scoreBand =
    healthScore >= CFG.bands.excellent ? 'excellent' :
    healthScore >= CFG.bands.good      ? 'good' :
    healthScore >= CFG.bands.fair      ? 'fair' : 'weak';

  return {
    performanceScore,
    consistencyScore,
    riskScore,
    verificationScore,
    healthScore,
    scoreBand,
    signals: {
      totalCycles: input.totalCycles || 0,
      completedCycles: input.completedCycles || 0,
      failedCycles: input.failedCycles || 0,
      totalTasks: input.totalTasks || 0,
      completedTasks: input.completedTasks || 0,
      overdueTasks: input.overdueTasks || 0,
      harvestReports: input.harvestReports || 0,
      openHighSevIssues: input.openHighSevIssues || 0,
      inactivityDays: input.inactivityDays || 0,
      verificationConfidence: Number.isFinite(input.verificationConfidence)
        ? input.verificationConfidence : null,
    },
    explain: {
      performance: performanceParts,
      consistency: consistencyParts,
      risk: riskParts,
      verification: verificationParts,
      weights: CFG,
    },
  };
}

export const _bands = CFG.bands;
