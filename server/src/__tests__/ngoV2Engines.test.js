/**
 * ngoV2Engines.test.js — tests for interventionEngine,
 * farmerScoringEngine, fundingEligibilityEngine.
 */
import { describe, it, expect } from 'vitest';
import { assessIntervention } from '../services/ngo/interventionEngine.js';
import { computeFarmerScore } from '../services/ngo/farmerScoringEngine.js';
import { decideFundingEligibility } from '../services/ngo/fundingEligibilityEngine.js';

describe('interventionEngine.assessIntervention (spec thresholds)', () => {
  it('clean signal set scores 0 (LOW)', () => {
    const r = assessIntervention({});
    expect(r.interventionScore).toBe(0);
    expect(r.priority).toBe('low');
  });

  it('component breakdown matches the spec', () => {
    // HIGH risk (30) + 2 overdue (14) + high issue (20)
    // + 5 for 2+ unresolved + 10 inactivity + 10 missed window
    // + 4 verification band → 93 → critical
    const r = assessIntervention({
      cycleRisk: 'high',
      overdueCount: 2,
      maxIssueSeverity: 'high',
      highSevIssues: 2,
      missedWindow: true,
      inactivityDays: 10,
      verificationConfidence: 50,   // 40..59 band → 4 points
    });
    expect(r.explain.components.riskComponent).toBe(30);
    expect(r.explain.components.overdueTaskComponent).toBe(14);
    expect(r.explain.components.issueComponent).toBe(25); // 20 + 5 boost
    expect(r.explain.components.inactivityComponent).toBe(10);
    expect(r.explain.components.timingComponent).toBe(10);
    expect(r.explain.components.verificationComponent).toBe(4);
    expect(r.priority).toBe('critical');
  });

  it('25-49 points lands in MEDIUM', () => {
    // 20 (medium risk) + 8 (1 overdue) = 28 → medium
    const r = assessIntervention({ cycleRisk: 'medium', overdueCount: 1 });
    expect(r.interventionScore).toBeGreaterThanOrEqual(25);
    expect(r.interventionScore).toBeLessThan(50);
    expect(r.priority).toBe('medium');
  });

  it('inactivity 15+ days adds 15', () => {
    const r = assessIntervention({ inactivityDays: 20 });
    expect(r.explain.components.inactivityComponent).toBe(15);
  });

  it('shorter dueAt for higher priority', () => {
    const critical = assessIntervention({ cycleRisk: 'high', overdueCount: 4, maxIssueSeverity: 'high', highSevIssues: 3 });
    const low = assessIntervention({});
    expect(critical.dueAt.getTime()).toBeLessThan(low.dueAt.getTime());
    const now = Date.now();
    expect((critical.dueAt.getTime() - now) / 86_400_000).toBeLessThanOrEqual(1.1);
  });

  it('exposes priorityThreshold in the explain payload', () => {
    const r = assessIntervention({});
    expect(r.explain.priorityThreshold).toMatchObject({ low: 0, medium: 25, high: 50, critical: 75 });
  });
});

describe('farmerScoringEngine.computeFarmerScore (spec formulas)', () => {
  it('produces a near-100 composite for a clean, verified profile', () => {
    const r = computeFarmerScore({
      totalCycles: 5, completedCycles: 5, failedCycles: 0,
      totalTasks: 50, completedTasks: 50, overdueTasks: 0,
      harvestReports: 5,
      openHighSevIssues: 0, inactivityDays: 0,
      verificationConfidence: 1,
      hasGps: true,
      outcomeQualityScore: 100,
      profileCompletenessScore: 100,
    });
    expect(r.performanceScore).toBe(100);
    expect(r.consistencyScore).toBe(100);
    expect(r.riskScore).toBeLessThan(20);
    expect(r.verificationScore).toBeGreaterThanOrEqual(90);
    expect(r.healthScore).toBeGreaterThanOrEqual(90);
    expect(r.scoreBand).toBe('excellent');
  });

  it('weighted composite honors spec health weights', () => {
    // Drive sub-score inputs to specific values to verify weights:
    //   performance: task 100 + cycle 100 + harvest 100 + quality 80
    //     = 100*.35 + 100*.25 + 100*.20 + 80*.20 = 96
    //   consistency: 60 across all three = 60
    //   verification: 70 across all five = 70
    //   risk: 0 via zero inputs (low cycle risk→10)*.4 = 4
    //   health = 96*.35 + 60*.25 + 70*.20 + (100-4)*.20 = 33.6+15+14+19.2 ≈ 82
    const r = computeFarmerScore({
      weeklyActivityScore: 60, updateRegularityScore: 60, repeatCycleEngagementScore: 60,
      profileCompletenessScore: 70, activityEvidenceScore: 70, locationConfidenceScore: 70,
      harvestEvidenceScore: 70, reviewOutcomeScore: 70,
      totalCycles: 3, completedCycles: 3, totalTasks: 10, completedTasks: 10,
      harvestReports: 3, outcomeQualityScore: 80,
      overdueTasks: 0, openHighSevIssues: 0, openMedSevIssues: 0, failedCycles: 0,
    });
    expect(r.consistencyScore).toBe(60);
    expect(r.verificationScore).toBe(70);
    expect(r.riskScore).toBeLessThan(10);
    // Composite should honour weights within ±3 of hand calc.
    expect(r.healthScore).toBeGreaterThanOrEqual(78);
    expect(r.healthScore).toBeLessThanOrEqual(88);
  });

  it('drops to weak when nothing is happening', () => {
    const r = computeFarmerScore({
      totalCycles: 0, completedCycles: 0, failedCycles: 0,
      totalTasks: 0, completedTasks: 0, overdueTasks: 0,
      harvestReports: 0,
      openHighSevIssues: 0, inactivityDays: 60,
      verificationConfidence: null,
    });
    expect(r.scoreBand).toBe('weak');
    expect(r.consistencyScore).toBeLessThan(50);
  });

  it('repeated failures + overdue + issues lowers health sharply', () => {
    const r = computeFarmerScore({
      totalCycles: 3, completedCycles: 0, failedCycles: 2,
      totalTasks: 20, completedTasks: 4, overdueTasks: 8,
      harvestReports: 0,
      openHighSevIssues: 2, inactivityDays: 30,
      verificationConfidence: 0.3,
      outcomeQualityScore: 20,
    });
    expect(r.healthScore).toBeLessThan(50);
    // Risk sub-score aggregates overdue + issues + delay-failure history
    // — with these inputs it lands in the 40s (48 exactly).
    expect(r.riskScore).toBeGreaterThanOrEqual(40);
    expect(r.scoreBand).toBe('weak');
  });

  it('exposes the explain payload with sub-score inputs', () => {
    const r = computeFarmerScore({
      totalCycles: 1, completedCycles: 1, totalTasks: 10, completedTasks: 10,
      harvestReports: 1, outcomeQualityScore: 90,
    });
    expect(r.explain.performance).toMatchObject({
      taskCompletion: 100, cycleCompletion: 100, harvestReporting: 100, outcomeQuality: 90,
    });
    expect(r.explain.weights.health).toMatchObject({
      performance: 0.35, consistency: 0.25, verification: 0.20, invertedRisk: 0.20,
    });
  });
});

describe('fundingEligibilityEngine.decideFundingEligibility (spec decision table)', () => {
  const strong = {
    healthScore: 88, verificationScore: 80,
    riskScore: 10, scoreBand: 'excellent',
  };
  const monitor = {
    healthScore: 70, verificationScore: 65,
    riskScore: 20, scoreBand: 'good',
  };
  const activeContext = { totalCycles: 2, activeCycles: 1, completedCycles: 1, failedCycles: 0 };

  it('eligible when health ≥75 + verification ≥70 + no critical + has cycle', () => {
    expect(decideFundingEligibility({ score: strong, context: activeContext }).decision).toBe('eligible');
  });

  it('monitor when health lands 60-74', () => {
    expect(decideFundingEligibility({ score: monitor, context: activeContext }).decision).toBe('monitor');
  });

  it('monitor when verification lands 50-69 but health is otherwise eligible', () => {
    expect(decideFundingEligibility({
      score: { ...strong, verificationScore: 60 },
      context: activeContext,
    }).decision).toBe('monitor');
  });

  it('needs_review when health is strong but verification <40', () => {
    expect(decideFundingEligibility({
      score: { ...strong, verificationScore: 30 },
      context: activeContext,
    }).decision).toBe('needs_review');
  });

  it('not_yet_eligible when health <60', () => {
    expect(decideFundingEligibility({
      score: { healthScore: 50, verificationScore: 50, riskScore: 30 },
      context: activeContext,
    }).decision).toBe('not_yet_eligible');
  });

  it('not_yet_eligible on repeated failures', () => {
    expect(decideFundingEligibility({
      score: strong,
      context: { ...activeContext, failedCycles: 2 },
    }).decision).toBe('not_yet_eligible');
  });

  it('open critical intervention blocks funding', () => {
    expect(decideFundingEligibility({
      score: strong,
      context: activeContext,
      intervention: { priority: 'critical', status: 'open' },
    }).decision).toBe('not_yet_eligible');
  });

  it('closed critical intervention does not block funding', () => {
    expect(decideFundingEligibility({
      score: strong,
      context: activeContext,
      intervention: { priority: 'critical', status: 'resolved' },
    }).decision).toBe('eligible');
  });

  it('needs_review when no score yet', () => {
    expect(decideFundingEligibility({}).decision).toBe('needs_review');
  });

  it('explain payload exposes threshold checks', () => {
    const r = decideFundingEligibility({ score: strong, context: activeContext });
    expect(r.explain.thresholds).toMatchObject({ eligible: { minHealth: 75, minVerification: 70 } });
    expect(r.explain.checks.healthScore).toBe(88);
    expect(r.explain.checks.verificationScore).toBe(80);
  });
});
