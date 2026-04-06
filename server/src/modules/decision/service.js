import prisma from '../../config/database.js';
import { getRegionConfig } from '../regionConfig/service.js';

/**
 * Decision Engine (Region-Aware)
 * Combines verification score + fraud risk to produce a final decision recommendation.
 * Region config influences thresholds.
 *
 * IMPORTANT: Both verification AND fraud analysis must be run before this engine.
 *
 * Rules:
 * - If fraud is critical → auto-reject
 * - If fraud is high → auto-escalate
 * - If verification >= 80 and fraud low → RECOMMEND approve (human must confirm)
 * - If verification >= region threshold and fraud low/medium → RECOMMEND conditional_approve (human must confirm)
 * - If verification >= 40 → auto-transition to needs_more_evidence
 * - If verification < 40 → auto-reject
 *
 * Positive decisions (approve, conditional_approve) are RECOMMENDATIONS only.
 * A human reviewer must explicitly approve via the approve endpoint.
 */
export async function runDecisionEngine(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      verificationResult: true,
      fraudResult: true,
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  if (!app.verificationResult) {
    const err = new Error('Verification must be run before decision engine');
    err.statusCode = 400;
    throw err;
  }

  if (!app.fraudResult) {
    const err = new Error('Fraud analysis must be run before decision engine');
    err.statusCode = 400;
    throw err;
  }

  const regionCfg = getRegionConfig(app.farmer.countryCode || 'KE');
  const approveThreshold = 80;
  const conditionalThreshold = regionCfg.verificationThreshold || 60;
  const rejectThreshold = 40;

  const vScore = app.verificationResult.verificationScore;
  const vConfidence = app.verificationResult.confidence;
  const fRiskLevel = app.fraudResult.fraudRiskLevel;
  const fRiskScore = app.fraudResult.fraudRiskScore;

  let decision, decisionLabel, riskLevel, recommendedAmount;
  const blockers = [];
  const reasons = [];
  const nextActions = [];

  // Fraud overrides
  if (fRiskLevel === 'critical') {
    decision = 'reject';
    decisionLabel = 'Rejected — Critical Fraud Risk';
    riskLevel = 'high';
    blockers.push('Critical fraud indicators detected');
    reasons.push(`Fraud risk score: ${fRiskScore}/100`);
    nextActions.push('Investigate fraud flags', 'Contact farmer for verification');
  } else if (fRiskLevel === 'high') {
    decision = 'escalate';
    decisionLabel = 'Escalated — High Fraud Risk';
    riskLevel = 'high';
    blockers.push('High fraud risk requires manual review');
    reasons.push(`Fraud risk score: ${fRiskScore}/100`);
    nextActions.push('Senior reviewer assessment required', 'Additional field visit recommended');
  } else if (vScore >= approveThreshold && fRiskLevel === 'low') {
    decision = 'approve';
    decisionLabel = 'Approved';
    riskLevel = 'low';
    recommendedAmount = app.requestedAmount;
    reasons.push(`Strong verification (${vScore}/100)`, 'Low fraud risk');
    reasons.push(`Region: ${regionCfg.country} (${regionCfg.currencyCode})`);
  } else if (vScore >= conditionalThreshold && (fRiskLevel === 'low' || fRiskLevel === 'medium')) {
    decision = 'conditional_approve';
    decisionLabel = 'Conditionally Approved';
    riskLevel = fRiskLevel === 'medium' ? 'medium' : 'low';
    recommendedAmount = app.requestedAmount * 0.8;
    reasons.push(`Moderate verification (${vScore}/100, threshold: ${conditionalThreshold})`);
    if (fRiskLevel === 'medium') reasons.push('Medium fraud risk — reduced amount');
    nextActions.push('Verify conditions before disbursement');

    if (app.verificationResult.flags?.length > 0) {
      blockers.push(...app.verificationResult.flags.map(f => `Resolve: ${f}`));
    }
  } else if (vScore >= rejectThreshold) {
    decision = 'needs_more_evidence';
    decisionLabel = 'Needs More Evidence';
    riskLevel = 'medium';
    reasons.push(`Insufficient verification (${vScore}/100, need ${conditionalThreshold}+)`);
    nextActions.push('Request additional evidence', 'Schedule field visit');

    if (app.verificationResult.flags?.length > 0) {
      blockers.push(...app.verificationResult.flags.map(f => `Missing: ${f}`));
    }
  } else {
    decision = 'reject';
    decisionLabel = 'Rejected — Insufficient Verification';
    riskLevel = 'high';
    reasons.push(`Low verification score (${vScore}/100)`);
    blockers.push('Verification score below minimum threshold');
    nextActions.push('Farmer may reapply with complete documentation');
  }

  const result = await prisma.decisionResult.upsert({
    where: { applicationId },
    update: { decision, decisionLabel, riskLevel, recommendedAmount, blockers, reasons, nextActions },
    create: { applicationId, decision, decisionLabel, riskLevel, recommendedAmount, blockers, reasons, nextActions },
  });

  // Auto-transition only for negative/neutral outcomes.
  // Positive outcomes (approve, conditional_approve) are RECOMMENDATIONS —
  // a human reviewer must explicitly approve via the approve endpoint.
  const autoTransitionMap = {
    reject: 'rejected',
    needs_more_evidence: 'needs_more_evidence',
    field_review_required: 'field_review_required',
    escalate: 'escalated',
  };

  if (autoTransitionMap[decision]) {
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: autoTransitionMap[decision] },
    });
  }

  return result;
}

export async function getDecisionResult(applicationId) {
  return prisma.decisionResult.findUnique({ where: { applicationId } });
}
