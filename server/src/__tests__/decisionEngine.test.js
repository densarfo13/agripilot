import { describe, it, expect } from 'vitest';

/**
 * Decision Engine Logic Tests
 *
 * Tests the decision matrix in isolation. The actual service depends on Prisma,
 * so we extract and test the core decision logic here.
 */

// Decision logic extracted from decision/service.js
function computeDecision({ vScore, fRiskLevel, fRiskScore, fraudReasons = [], fraudFlags = [], verificationFlags = [], requestedAmount, regionCfg }) {
  const approveThreshold = 80;
  const conditionalThreshold = regionCfg.verificationThreshold || 60;
  const rejectThreshold = 40;

  let decision, decisionLabel, riskLevel, recommendedAmount;
  const blockers = [];
  const reasons = [];
  const nextActions = [];

  if (fRiskLevel === 'critical') {
    decision = 'reject';
    decisionLabel = 'Rejected — Critical Fraud Risk';
    riskLevel = 'high';
    blockers.push('Critical fraud indicators detected');
    reasons.push(`Fraud risk score: ${fRiskScore}/100`);
    if (fraudReasons.length > 0) {
      reasons.push(...fraudReasons.slice(0, 3).map(r => `Fraud: ${r}`));
    }
    nextActions.push('Investigate fraud flags', 'Contact farmer for verification');
  } else if (fRiskLevel === 'high') {
    decision = 'escalate';
    decisionLabel = 'Escalated — High Fraud Risk';
    riskLevel = 'high';
    blockers.push('High fraud risk requires manual review');
    reasons.push(`Fraud risk score: ${fRiskScore}/100`);
    if (fraudReasons.length > 0) {
      reasons.push(...fraudReasons.slice(0, 3).map(r => `Fraud: ${r}`));
    }
    nextActions.push('Senior reviewer assessment required', 'Additional field visit recommended');
  } else if (vScore >= approveThreshold && fRiskLevel === 'low') {
    decision = 'approve';
    decisionLabel = 'Recommended for Approval';
    riskLevel = 'low';
    recommendedAmount = requestedAmount;
    reasons.push(`Strong verification (${vScore}/100)`, 'Low fraud risk');
    nextActions.push('Review recommendation and confirm approval', 'Verify farmer identity before disbursement');
  } else if (vScore >= conditionalThreshold && (fRiskLevel === 'low' || fRiskLevel === 'medium')) {
    decision = 'conditional_approve';
    decisionLabel = 'Conditionally Recommended';
    riskLevel = fRiskLevel === 'medium' ? 'medium' : 'low';
    recommendedAmount = requestedAmount * 0.8;
    reasons.push(`Moderate verification (${vScore}/100, threshold: ${conditionalThreshold})`);
    if (fRiskLevel === 'medium') reasons.push('Medium fraud risk — reduced amount');
    nextActions.push('Verify conditions before disbursement', 'Consider field visit before approval');
    if (verificationFlags.length > 0) {
      blockers.push(...verificationFlags.map(f => `Resolve: ${f}`));
    }
  } else if (vScore >= rejectThreshold) {
    decision = 'needs_more_evidence';
    decisionLabel = 'Needs More Evidence';
    riskLevel = 'medium';
    reasons.push(`Insufficient verification (${vScore}/100, need ${conditionalThreshold}+)`);
    nextActions.push('Request additional evidence', 'Schedule field visit');
    if (verificationFlags.length > 0) {
      blockers.push(...verificationFlags.map(f => `Missing: ${f}`));
    }
  } else {
    decision = 'reject';
    decisionLabel = 'Rejected — Insufficient Verification';
    riskLevel = 'high';
    reasons.push(`Low verification score (${vScore}/100)`);
    blockers.push('Verification score below minimum threshold');
    nextActions.push('Farmer may reapply with complete documentation');
  }

  return { decision, decisionLabel, riskLevel, recommendedAmount, blockers, reasons, nextActions };
}

const KE_CONFIG = { verificationThreshold: 70, country: 'Kenya', currencyCode: 'KES' };
const TZ_CONFIG = { verificationThreshold: 65, country: 'Tanzania', currencyCode: 'TZS' };

describe('Decision Engine Logic', () => {
  describe('Fraud overrides', () => {
    it('rejects on critical fraud regardless of verification score', () => {
      const result = computeDecision({
        vScore: 95, fRiskLevel: 'critical', fRiskScore: 85,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('reject');
      expect(result.decisionLabel).toContain('Critical Fraud');
    });

    it('escalates on high fraud regardless of verification score', () => {
      const result = computeDecision({
        vScore: 95, fRiskLevel: 'high', fRiskScore: 60,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('escalate');
      expect(result.decisionLabel).toContain('High Fraud');
    });

    it('includes top 3 fraud reasons in decision reasons', () => {
      const result = computeDecision({
        vScore: 95, fRiskLevel: 'critical', fRiskScore: 85,
        fraudReasons: ['Duplicate photos', 'Shared device', 'GPS proximity', 'Extra reason'],
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      // Should include at most 3 fraud reasons
      const fraudPrefixed = result.reasons.filter(r => r.startsWith('Fraud:'));
      expect(fraudPrefixed).toHaveLength(3);
    });
  });

  describe('Approval decisions', () => {
    it('recommends approval for high verification + low fraud', () => {
      const result = computeDecision({
        vScore: 85, fRiskLevel: 'low', fRiskScore: 10,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('approve');
      expect(result.decisionLabel).toBe('Recommended for Approval');
      expect(result.recommendedAmount).toBe(100000);
      expect(result.riskLevel).toBe('low');
    });

    it('does not auto-approve — label says "Recommended"', () => {
      const result = computeDecision({
        vScore: 90, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 50000, regionCfg: KE_CONFIG,
      });
      expect(result.decisionLabel).toContain('Recommended');
      expect(result.nextActions.some(a => a.includes('confirm'))).toBe(true);
    });

    it('does not recommend approval when fraud is medium even with high score', () => {
      const result = computeDecision({
        vScore: 90, fRiskLevel: 'medium', fRiskScore: 30,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      // With medium fraud and high score, should be conditional, not full approve
      expect(result.decision).toBe('conditional_approve');
    });
  });

  describe('Conditional approval', () => {
    it('conditionally approves for moderate verification + low fraud', () => {
      const result = computeDecision({
        vScore: 75, fRiskLevel: 'low', fRiskScore: 10,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('conditional_approve');
      expect(result.recommendedAmount).toBe(80000); // 80% of requested
    });

    it('reduces risk level to medium for medium fraud', () => {
      const result = computeDecision({
        vScore: 75, fRiskLevel: 'medium', fRiskScore: 30,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('conditional_approve');
      expect(result.riskLevel).toBe('medium');
    });

    it('includes verification flags as blockers', () => {
      const result = computeDecision({
        vScore: 75, fRiskLevel: 'low', fRiskScore: 10,
        verificationFlags: ['missing_farm_photos', 'no_boundary'],
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.blockers).toContain('Resolve: missing_farm_photos');
      expect(result.blockers).toContain('Resolve: no_boundary');
    });
  });

  describe('Evidence needed', () => {
    it('requests more evidence for low-moderate verification', () => {
      const result = computeDecision({
        vScore: 50, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('needs_more_evidence');
      expect(result.riskLevel).toBe('medium');
    });

    it('surfaces verification flags as Missing: blockers', () => {
      const result = computeDecision({
        vScore: 50, fRiskLevel: 'low', fRiskScore: 5,
        verificationFlags: ['farm_photo'],
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.blockers).toContain('Missing: farm_photo');
    });
  });

  describe('Rejection for low verification', () => {
    it('rejects when verification score is below 40', () => {
      const result = computeDecision({
        vScore: 25, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('reject');
      expect(result.decisionLabel).toContain('Insufficient Verification');
    });
  });

  describe('Region-aware thresholds', () => {
    it('uses KE threshold of 70 for conditional approval', () => {
      // 65 is below KE threshold (70), should be needs_more_evidence
      const result = computeDecision({
        vScore: 65, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('needs_more_evidence');
    });

    it('uses TZ threshold of 65 for conditional approval', () => {
      // 65 meets TZ threshold (65), should be conditional_approve
      const result = computeDecision({
        vScore: 65, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: TZ_CONFIG,
      });
      expect(result.decision).toBe('conditional_approve');
    });
  });

  describe('Edge cases', () => {
    it('handles verification score exactly at approve threshold (80)', () => {
      const result = computeDecision({
        vScore: 80, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('approve');
    });

    it('handles verification score exactly at reject threshold (40)', () => {
      const result = computeDecision({
        vScore: 40, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('needs_more_evidence');
    });

    it('handles verification score at 39 (below reject threshold)', () => {
      const result = computeDecision({
        vScore: 39, fRiskLevel: 'low', fRiskScore: 5,
        requestedAmount: 100000, regionCfg: KE_CONFIG,
      });
      expect(result.decision).toBe('reject');
    });

    it('all decisions have nextActions', () => {
      const scenarios = [
        { vScore: 95, fRiskLevel: 'critical', fRiskScore: 90 },
        { vScore: 95, fRiskLevel: 'high', fRiskScore: 60 },
        { vScore: 85, fRiskLevel: 'low', fRiskScore: 5 },
        { vScore: 70, fRiskLevel: 'low', fRiskScore: 5 },
        { vScore: 50, fRiskLevel: 'low', fRiskScore: 5 },
        { vScore: 20, fRiskLevel: 'low', fRiskScore: 5 },
      ];

      for (const s of scenarios) {
        const result = computeDecision({ ...s, requestedAmount: 100000, regionCfg: KE_CONFIG });
        expect(result.nextActions.length).toBeGreaterThan(0);
      }
    });
  });
});
