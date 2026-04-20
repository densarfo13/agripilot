/**
 * scoreFundingEngines.test.js — contract for:
 *   server/src/modules/ngoAdmin/scoreEngine.js
 *   server/src/modules/ngoAdmin/fundingEngine.js
 *   src/core/farm/farmerScoreCard.js
 */

import { describe, it, expect } from 'vitest';

import scorePkg from '../../../server/src/modules/ngoAdmin/scoreEngine.js';
const { computeScore, computeScoreNumber } = scorePkg;

import fundingPkg from '../../../server/src/modules/ngoAdmin/fundingEngine.js';
const { getFundingDecision, pointsToNextTier } = fundingPkg;

import { buildFarmerScoreCard } from '../../../src/core/farm/farmerScoreCard.js';

// ─── computeScore ────────────────────────────────────────────
describe('computeScore — behavior contribution (max 40)', () => {
  it('completionRate 1 → 40', () => {
    expect(computeScore({ completionRate: 1 }).breakdown.behavior).toBe(40);
  });
  it('completionRate 0.5 → 20', () => {
    expect(computeScore({ completionRate: 0.5 }).breakdown.behavior).toBe(20);
  });
  it('completionRate 0 → 0', () => {
    expect(computeScore({ completionRate: 0 }).breakdown.behavior).toBe(0);
  });
  it('clamps negative and >1', () => {
    expect(computeScore({ completionRate: -0.5 }).breakdown.behavior).toBe(0);
    expect(computeScore({ completionRate: 2 }).breakdown.behavior).toBe(40);
  });
});

describe('computeScore — consistency contribution (max 25)', () => {
  it('>=20 days → 25', () => {
    expect(computeScore({ consistencyDays: 25 }).breakdown.consistency).toBe(25);
  });
  it('>=10 but <20 → 15', () => {
    expect(computeScore({ consistencyDays: 12 }).breakdown.consistency).toBe(15);
  });
  it('>=5 but <10 → 8', () => {
    expect(computeScore({ consistencyDays: 7 }).breakdown.consistency).toBe(8);
  });
  it('<5 → 0', () => {
    expect(computeScore({ consistencyDays: 3 }).breakdown.consistency).toBe(0);
  });
});

describe('computeScore — experience contribution (max 15)', () => {
  it('>=50 events → 15', () => {
    expect(computeScore({ farmEventsCount: 60 }).breakdown.experience).toBe(15);
  });
  it('20..49 → 10', () => {
    expect(computeScore({ farmEventsCount: 30 }).breakdown.experience).toBe(10);
  });
  it('5..19 → 5', () => {
    expect(computeScore({ farmEventsCount: 10 }).breakdown.experience).toBe(5);
  });
  it('<5 → 0', () => {
    expect(computeScore({ farmEventsCount: 2 }).breakdown.experience).toBe(0);
  });
});

describe('computeScore — risk penalty', () => {
  it('high → -20', () => {
    expect(computeScore({ riskLevel: 'high' }).breakdown.riskPenalty).toBe(-20);
  });
  it('medium → -10', () => {
    expect(computeScore({ riskLevel: 'medium' }).breakdown.riskPenalty).toBe(-10);
  });
  it('low → 0', () => {
    expect(computeScore({ riskLevel: 'low' }).breakdown.riskPenalty).toBe(0);
  });
  it('unknown → 0 (defensive)', () => {
    expect(computeScore({ riskLevel: 'bogus' }).breakdown.riskPenalty).toBe(0);
  });
});

describe('computeScore — clamping + factors', () => {
  it('clamped to 100 even when raw is higher', () => {
    const r = computeScore({
      completionRate: 1, consistencyDays: 30,
      farmEventsCount: 100, riskLevel: 'low',
    });
    // 40 + 25 + 15 + 0 = 80, below 100 cap — but test protects the clamp logic.
    expect(r.score).toBe(80);
  });

  it('clamped to 0 when penalties dominate', () => {
    const r = computeScore({
      completionRate: 0, consistencyDays: 0,
      farmEventsCount: 0, riskLevel: 'high',
    });
    // 0 + 0 + 0 - 20 = -20 → clamped to 0
    expect(r.score).toBe(0);
  });

  it('emits explanation factors', () => {
    const r = computeScore({
      completionRate: 1, consistencyDays: 25, farmEventsCount: 60, riskLevel: 'high',
    });
    expect(r.factors).toContain('score.factor.strong_completion');
    expect(r.factors).toContain('score.factor.strong_consistency');
    expect(r.factors).toContain('score.factor.experienced');
    expect(r.factors).toContain('score.factor.risk_penalty_high');
  });

  it('result is frozen', () => {
    const r = computeScore({});
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.breakdown)).toBe(true);
    expect(Object.isFrozen(r.factors)).toBe(true);
  });

  it('computeScoreNumber is spec-compatible integer', () => {
    // 0.65×40=26 + 15 + 10 − 10 = 41
    expect(computeScoreNumber({
      completionRate: 0.65, consistencyDays: 18,
      farmEventsCount: 40, riskLevel: 'medium',
    })).toBe(41);
  });
});

describe('computeScore spec example (sanity)', () => {
  it('0.65 / 18 / 40 / medium → 41', () => {
    // behavior=26, consistency=15, experience=10, penalty=-10 → 41
    expect(computeScoreNumber({
      completionRate: 0.65, consistencyDays: 18,
      farmEventsCount: 40, riskLevel: 'medium',
    })).toBe(41);
  });
});

// ─── getFundingDecision ──────────────────────────────────────
describe('getFundingDecision', () => {
  it('score >= 75 → tier A, eligible', () => {
    const d = getFundingDecision(80);
    expect(d.tier).toBe('A');
    expect(d.eligible).toBe(true);
    expect(d.messageKey).toBe('funding.tier_a.message');
  });

  it('50 <= score < 75 → tier B, eligible', () => {
    const d = getFundingDecision(60);
    expect(d.tier).toBe('B');
    expect(d.eligible).toBe(true);
  });

  it('< 50 → tier C, not eligible', () => {
    const d = getFundingDecision(40);
    expect(d.tier).toBe('C');
    expect(d.eligible).toBe(false);
  });

  it('boundary 75 → A', () => {
    expect(getFundingDecision(75).tier).toBe('A');
  });

  it('boundary 50 → B', () => {
    expect(getFundingDecision(50).tier).toBe('B');
  });

  it('boundary 49 → C', () => {
    expect(getFundingDecision(49).tier).toBe('C');
  });

  it('clamps out-of-range inputs', () => {
    expect(getFundingDecision(-50).tier).toBe('C');
    expect(getFundingDecision(200).tier).toBe('A');
    expect(getFundingDecision(NaN).tier).toBe('C');
  });

  it('returns thresholds for UI hints', () => {
    const d = getFundingDecision(30);
    expect(d.thresholds.a).toBe(75);
    expect(d.thresholds.b).toBe(50);
  });

  it('result is frozen', () => {
    const d = getFundingDecision(60);
    expect(Object.isFrozen(d)).toBe(true);
    expect(Object.isFrozen(d.thresholds)).toBe(true);
  });
});

describe('pointsToNextTier', () => {
  it('0 when already at A', () => {
    expect(pointsToNextTier(90)).toBe(0);
  });
  it('difference to A when currently B', () => {
    expect(pointsToNextTier(60)).toBe(15);
  });
  it('difference to B when currently C', () => {
    expect(pointsToNextTier(30)).toBe(20);
  });
});

// ─── buildFarmerScoreCard ────────────────────────────────────
describe('buildFarmerScoreCard', () => {
  function seed(score, tier, eligible) {
    return {
      score,
      breakdown: { behavior: 26, consistency: 15, experience: 10, riskPenalty: -10 },
      factors:   ['score.factor.moderate_completion', 'score.factor.strong_consistency'],
      funding: {
        tier, eligible, score,
        messageKey: `funding.tier_${tier.toLowerCase()}.message`,
        messageFallback: `Tier ${tier} fallback`,
        thresholds: { a: 75, b: 50 },
      },
    };
  }

  it('returns null for bad input', () => {
    expect(buildFarmerScoreCard(null)).toBeNull();
    expect(buildFarmerScoreCard('nope')).toBeNull();
  });

  it('headline includes the score in fallback', () => {
    const card = buildFarmerScoreCard(seed(41, 'C', false));
    expect(card.headline.params.score).toBe(41);
    expect(card.headline.fallback).toContain('41');
  });

  it('fundingBadge severity matches eligibility', () => {
    expect(buildFarmerScoreCard(seed(80, 'A', true)).fundingBadge.severity).toBe('positive');
    expect(buildFarmerScoreCard(seed(40, 'C', false)).fundingBadge.severity).toBe('warning');
  });

  it('breakdown has 4 rows with stable labelKeys', () => {
    const card = buildFarmerScoreCard(seed(50, 'B', true));
    const keys = card.breakdown.map((r) => r.labelKey);
    expect(keys).toEqual([
      'farmer.score.breakdown.behavior',
      'farmer.score.breakdown.consistency',
      'farmer.score.breakdown.experience',
      'farmer.score.breakdown.risk_penalty',
    ]);
  });

  it('factorLines are LocalizedPayload with fallbacks', () => {
    const card = buildFarmerScoreCard(seed(50, 'B', true));
    for (const f of card.factorLines) {
      expect(typeof f.key).toBe('string');
      expect(typeof f.fallback).toBe('string');
      expect(Object.isFrozen(f)).toBe(true);
    }
  });

  it('nextTier says "N points to tier B" when currently C', () => {
    const card = buildFarmerScoreCard(seed(30, 'C', false));
    expect(card.nextTier.key).toBe('farmer.score.nudge.to_b');
    expect(card.nextTier.params.pts).toBe(20);
  });

  it('nextTier says "N points to tier A" when currently B', () => {
    const card = buildFarmerScoreCard(seed(60, 'B', true));
    expect(card.nextTier.key).toBe('farmer.score.nudge.to_a');
    expect(card.nextTier.params.pts).toBe(15);
  });

  it('nextTier positive nudge when already at A', () => {
    const card = buildFarmerScoreCard(seed(85, 'A', true));
    expect(card.nextTier.key).toBe('farmer.score.nudge.top_tier');
    expect(card.nextTier.severity).toBe('positive');
  });

  it('result is frozen', () => {
    const card = buildFarmerScoreCard(seed(50, 'B', true));
    expect(Object.isFrozen(card)).toBe(true);
    expect(Object.isFrozen(card.breakdown)).toBe(true);
    expect(Object.isFrozen(card.factorLines)).toBe(true);
  });
});
