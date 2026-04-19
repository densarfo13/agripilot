/**
 * ngoV2Engines.test.js — tests for interventionEngine,
 * farmerScoringEngine, fundingEligibilityEngine.
 */
import { describe, it, expect } from 'vitest';
import { assessIntervention } from '../services/ngo/interventionEngine.js';
import { computeFarmerScore } from '../services/ngo/farmerScoringEngine.js';
import { decideFundingEligibility } from '../services/ngo/fundingEligibilityEngine.js';

describe('interventionEngine.assessIntervention', () => {
  it('returns low priority for a clean signal set', () => {
    const r = assessIntervention({});
    expect(r.priority).toBe('low');
    expect(r.interventionScore).toBe(0);
    expect(r.dueAt).toBeInstanceOf(Date);
  });

  it('escalates to critical when there is a high-severity issue + overdue tasks', () => {
    const r = assessIntervention({
      cycleRisk: 'high',
      overdueCount: 4,
      highSevIssues: 2,
      inactivityDays: 20,
    });
    expect(r.priority).toBe('critical');
    expect(r.interventionScore).toBeGreaterThanOrEqual(70);
    expect(r.recommendedAction).toMatch(/today|within 24|contact/i);
  });

  it('marks inactivity without issues as medium', () => {
    const r = assessIntervention({ inactivityDays: 25 });
    expect(['medium', 'low']).toContain(r.priority);
    expect(r.reason).toMatch(/inactive/);
  });

  it('adds a missed-window signal', () => {
    const r = assessIntervention({ missedWindow: true, cycleRisk: 'medium' });
    expect(r.reason).toMatch(/window/i);
  });

  it('sets a shorter dueAt for higher priority', () => {
    const now = new Date();
    const critical = assessIntervention({ cycleRisk: 'high', highSevIssues: 3, overdueCount: 4 });
    const low = assessIntervention({});
    expect(critical.dueAt.getTime()).toBeLessThan(low.dueAt.getTime());
    // Critical is within 1 day from now.
    expect((critical.dueAt.getTime() - now.getTime()) / 86400000).toBeLessThanOrEqual(1.1);
  });

  it('includes the emitted signal snapshot', () => {
    const r = assessIntervention({ overdueCount: 2, highSevIssues: 1 });
    expect(r.signals).toMatchObject({ overdueCount: 2, highSevIssues: 1 });
  });
});

describe('farmerScoringEngine.computeFarmerScore', () => {
  it('produces a 100 composite for a clean, verified profile', () => {
    const r = computeFarmerScore({
      totalCycles: 5, completedCycles: 5, failedCycles: 0,
      totalTasks: 50, completedTasks: 50, overdueTasks: 0,
      harvestReports: 5,
      openHighSevIssues: 0, inactivityDays: 0,
      verificationConfidence: 1,
    });
    expect(r.performanceScore).toBe(100);
    expect(r.consistencyScore).toBe(100);
    expect(r.riskScore).toBe(0);
    expect(r.verificationScore).toBe(100);
    expect(r.healthScore).toBeGreaterThanOrEqual(95);
    expect(r.scoreBand).toBe('excellent');
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
    expect(r.consistencyScore).toBeLessThan(100);
  });

  it('inactivity + overdue tasks + high-severity issue lowers health', () => {
    const r = computeFarmerScore({
      totalCycles: 2, completedCycles: 0, failedCycles: 0,
      totalTasks: 20, completedTasks: 4, overdueTasks: 8,
      harvestReports: 0,
      openHighSevIssues: 2, inactivityDays: 30,
      verificationConfidence: 0.3,
    });
    expect(r.healthScore).toBeLessThan(50);
    expect(r.riskScore).toBeGreaterThanOrEqual(40);
    expect(r.scoreBand).toBe('weak');
  });

  it('assumes neutral verification when data is missing', () => {
    const r = computeFarmerScore({
      totalCycles: 2, completedCycles: 2, failedCycles: 0,
      totalTasks: 20, completedTasks: 20, overdueTasks: 0,
      harvestReports: 2, openHighSevIssues: 0, inactivityDays: 0,
      verificationConfidence: null,
    });
    expect(r.verificationScore).toBe(50);
    expect(r.scoreBand).not.toBe('weak');
  });
});

describe('fundingEligibilityEngine.decideFundingEligibility', () => {
  const strong = {
    healthScore: 88, verificationScore: 80,
    riskScore: 10, scoreBand: 'excellent',
  };
  const monitor = {
    healthScore: 70, verificationScore: 65,
    riskScore: 20, scoreBand: 'good',
  };

  it('eligible when health and verification are both strong', () => {
    expect(decideFundingEligibility({ score: strong }).decision).toBe('eligible');
  });

  it('monitor in the 60–79 middle band', () => {
    expect(decideFundingEligibility({ score: monitor }).decision).toBe('monitor');
  });

  it('needs_review when health is strong but verification is very low', () => {
    expect(decideFundingEligibility({
      score: { ...strong, verificationScore: 20 },
    }).decision).toBe('needs_review');
  });

  it('not_yet_eligible on high risk', () => {
    expect(decideFundingEligibility({
      score: { ...strong, riskScore: 80 },
    }).decision).toBe('not_yet_eligible');
  });

  it('open critical intervention blocks funding', () => {
    expect(decideFundingEligibility({
      score: strong,
      intervention: { priority: 'critical', status: 'open' },
    }).decision).toBe('not_yet_eligible');
  });

  it('closed critical intervention does not block funding', () => {
    expect(decideFundingEligibility({
      score: strong,
      intervention: { priority: 'critical', status: 'resolved' },
    }).decision).toBe('eligible');
  });

  it('needs_review when no score yet', () => {
    expect(decideFundingEligibility({}).decision).toBe('needs_review');
  });

  it('surfaces blocker codes so reviewers can action them', () => {
    const r = decideFundingEligibility({
      score: { healthScore: 50, verificationScore: 30, riskScore: 20, scoreBand: 'fair' },
    });
    expect(r.decision).toBe('not_yet_eligible');
    expect(r.blockers).toContain('health_below_band');
    expect(r.blockers).toContain('verification_low');
  });
});
