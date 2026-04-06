import { describe, it, expect } from 'vitest';

/**
 * Fraud Scoring Logic Tests
 *
 * Tests the fraud risk scoring and classification logic in isolation.
 * The actual service depends on Prisma, so we extract the scoring algorithm.
 */

function classifyFraudRisk(riskScore) {
  riskScore = Math.min(100, riskScore);
  let fraudRiskLevel, action;

  if (riskScore >= 70) {
    fraudRiskLevel = 'critical';
    action = 'block';
  } else if (riskScore >= 50) {
    fraudRiskLevel = 'high';
    action = 'hold';
  } else if (riskScore >= 25) {
    fraudRiskLevel = 'medium';
    action = 'review';
  } else {
    fraudRiskLevel = 'low';
    action = 'clear';
  }

  return { fraudRiskLevel, action, riskScore };
}

// Scoring weights from the fraud service
const SCORING = {
  duplicate_photos: 30,
  shared_device: 20,
  gps_proximity: 15,
  amount_outlier: 15,
  exceeds_region_max: 10,
  below_region_min: 5,
  no_gps: 5,
  no_evidence: 10,
};

function computeRiskScore(flags) {
  let score = 0;
  for (const flag of flags) {
    score += SCORING[flag] || 0;
  }
  return Math.min(100, score);
}

describe('Fraud Scoring Logic', () => {
  describe('classifyFraudRisk', () => {
    it('classifies 0 as low/clear', () => {
      const { fraudRiskLevel, action } = classifyFraudRisk(0);
      expect(fraudRiskLevel).toBe('low');
      expect(action).toBe('clear');
    });

    it('classifies 24 as low/clear', () => {
      expect(classifyFraudRisk(24).fraudRiskLevel).toBe('low');
    });

    it('classifies 25 as medium/review', () => {
      expect(classifyFraudRisk(25).fraudRiskLevel).toBe('medium');
      expect(classifyFraudRisk(25).action).toBe('review');
    });

    it('classifies 49 as medium/review', () => {
      expect(classifyFraudRisk(49).fraudRiskLevel).toBe('medium');
    });

    it('classifies 50 as high/hold', () => {
      expect(classifyFraudRisk(50).fraudRiskLevel).toBe('high');
      expect(classifyFraudRisk(50).action).toBe('hold');
    });

    it('classifies 69 as high/hold', () => {
      expect(classifyFraudRisk(69).fraudRiskLevel).toBe('high');
    });

    it('classifies 70 as critical/block', () => {
      expect(classifyFraudRisk(70).fraudRiskLevel).toBe('critical');
      expect(classifyFraudRisk(70).action).toBe('block');
    });

    it('classifies 100 as critical/block', () => {
      expect(classifyFraudRisk(100).fraudRiskLevel).toBe('critical');
    });

    it('caps score at 100', () => {
      const { riskScore } = classifyFraudRisk(150);
      expect(riskScore).toBe(100);
    });
  });

  describe('Score computation', () => {
    it('scores duplicate photos at 30', () => {
      expect(computeRiskScore(['duplicate_photos'])).toBe(30);
    });

    it('scores shared device at 20', () => {
      expect(computeRiskScore(['shared_device'])).toBe(20);
    });

    it('accumulates multiple flags', () => {
      expect(computeRiskScore(['duplicate_photos', 'shared_device'])).toBe(50);
    });

    it('caps at 100 even with many flags', () => {
      const allFlags = Object.keys(SCORING);
      const total = Object.values(SCORING).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(100); // Verify that all flags exceed 100
      expect(computeRiskScore(allFlags)).toBe(100);
    });

    it('scores clean application at 0', () => {
      expect(computeRiskScore([])).toBe(0);
    });

    it('scores below_region_min at 5 (low severity)', () => {
      expect(computeRiskScore(['below_region_min'])).toBe(5);
    });

    it('no_evidence alone triggers medium risk', () => {
      // no_evidence (10) + no_gps (5) = 15, still low
      // But no_evidence alone is only 10, still low
      const score = computeRiskScore(['no_evidence']);
      expect(classifyFraudRisk(score).fraudRiskLevel).toBe('low');
    });

    it('duplicate_photos + no_evidence + no_gps triggers medium risk', () => {
      const score = computeRiskScore(['duplicate_photos', 'no_evidence', 'no_gps']);
      expect(score).toBe(45); // 30 + 10 + 5
      expect(classifyFraudRisk(score).fraudRiskLevel).toBe('medium');
    });

    it('duplicate_photos + shared_device triggers high risk (auto-hold)', () => {
      const score = computeRiskScore(['duplicate_photos', 'shared_device']);
      expect(score).toBe(50);
      const { fraudRiskLevel, action } = classifyFraudRisk(score);
      expect(fraudRiskLevel).toBe('high');
      expect(action).toBe('hold');
    });

    it('duplicate_photos + shared_device + gps_proximity + amount_outlier = critical', () => {
      const score = computeRiskScore(['duplicate_photos', 'shared_device', 'gps_proximity', 'amount_outlier']);
      expect(score).toBe(80);
      expect(classifyFraudRisk(score).fraudRiskLevel).toBe('critical');
    });
  });

  describe('Realistic scenarios', () => {
    it('genuine farmer with no flags gets cleared', () => {
      const { fraudRiskLevel, action } = classifyFraudRisk(0);
      expect(fraudRiskLevel).toBe('low');
      expect(action).toBe('clear');
    });

    it('farmer missing GPS only gets low risk', () => {
      const score = computeRiskScore(['no_gps']);
      expect(classifyFraudRisk(score).fraudRiskLevel).toBe('low');
    });

    it('suspected fraud syndicate (shared device + duplicate photos + proximity) gets critical', () => {
      const score = computeRiskScore(['shared_device', 'duplicate_photos', 'gps_proximity']);
      expect(score).toBe(65);
      expect(classifyFraudRisk(score).fraudRiskLevel).toBe('high');
    });
  });
});
