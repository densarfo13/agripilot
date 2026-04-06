import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

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

  const regionCfg = getRegionConfig(app.farmer.countryCode || DEFAULT_COUNTRY_CODE);
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

  // ─── Humanize raw verification/fraud flag names ─────
  const FLAG_LABELS = {
    no_gps: 'GPS location not captured',
    no_evidence: 'No evidence files uploaded',
    no_boundary: 'Farm boundary not captured',
    low_evidence: 'Fewer evidence files than expected',
    size_mismatch: 'Claimed farm size differs from measured boundary',
    duplicate_photos: 'Same photos found in other applications',
    shared_device: 'Device used by multiple farmers',
    gps_proximity: 'GPS location very close to another application',
    amount_outlier: 'Requested amount unusually high for region/crop',
    exceeds_region_max: 'Amount exceeds regional maximum loan limit',
    below_region_min: 'Amount below regional minimum loan',
    incomplete_profile: 'Farmer profile is incomplete',
  };
  function humanizeFlag(flag) {
    return FLAG_LABELS[flag] || flag.replace(/_/g, ' ');
  }

  // Fraud overrides
  // Surface specific fraud flags in decision reasons for clarity
  const fraudFlags = app.fraudResult.flags || [];
  const fraudReasons = app.fraudResult.reasons || [];

  if (fRiskLevel === 'critical') {
    decision = 'reject';
    decisionLabel = 'Rejected — Critical fraud indicators detected. This application cannot proceed.';
    riskLevel = 'high';
    blockers.push('Critical fraud risk — application blocked');
    reasons.push(`Fraud risk score: ${fRiskScore}/100 (critical threshold: 70+)`);
    if (fraudReasons.length > 0) {
      reasons.push(...fraudReasons.slice(0, 3));
    }
    nextActions.push('Investigate the fraud flags listed below', 'Contact the farmer directly to verify identity and details');
  } else if (fRiskLevel === 'high') {
    decision = 'escalate';
    decisionLabel = 'Escalated — High fraud risk requires senior review before proceeding.';
    riskLevel = 'high';
    blockers.push('High fraud risk — needs senior reviewer sign-off');
    reasons.push(`Fraud risk score: ${fRiskScore}/100 (high threshold: 50+)`);
    if (fraudReasons.length > 0) {
      reasons.push(...fraudReasons.slice(0, 3));
    }
    nextActions.push('Assign to a senior reviewer for manual assessment', 'Schedule a field visit to verify farm and farmer');
  } else if (vScore >= approveThreshold && fRiskLevel === 'low') {
    decision = 'approve';
    decisionLabel = 'Recommended for full approval — strong verification with low fraud risk.';
    riskLevel = 'low';
    recommendedAmount = app.requestedAmount;
    reasons.push(`Verification score ${vScore}/100 (above ${approveThreshold} threshold)`, 'Fraud risk is low');
    nextActions.push('Click Approve above to confirm this recommendation', 'Verify farmer identity before disbursing funds');
  } else if (vScore >= conditionalThreshold && (fRiskLevel === 'low' || fRiskLevel === 'medium')) {
    decision = 'conditional_approve';
    decisionLabel = `Conditionally recommended at 80% of requested amount — resolve issues before full approval.`;
    riskLevel = fRiskLevel === 'medium' ? 'medium' : 'low';
    recommendedAmount = app.requestedAmount * 0.8;
    reasons.push(`Verification score ${vScore}/100 (above ${conditionalThreshold} regional threshold, below ${approveThreshold} full-approval threshold)`);
    if (fRiskLevel === 'medium') reasons.push('Medium fraud risk — amount reduced as precaution');
    nextActions.push('Resolve the blockers listed below', 'Consider a field visit before approving');

    if (app.verificationResult.flags?.length > 0) {
      blockers.push(...app.verificationResult.flags.map(f => humanizeFlag(f)));
    }
  } else if (vScore >= rejectThreshold) {
    decision = 'needs_more_evidence';
    decisionLabel = 'More evidence needed — verification score is too low to proceed.';
    riskLevel = 'medium';
    reasons.push(`Verification score ${vScore}/100 (needs ${conditionalThreshold}+ for conditional approval)`);
    nextActions.push('Use "Request Evidence" to ask the farmer for missing documentation', 'Schedule a field visit to verify the farm');

    if (app.verificationResult.flags?.length > 0) {
      blockers.push(...app.verificationResult.flags.map(f => humanizeFlag(f)));
    }
  } else {
    decision = 'reject';
    decisionLabel = 'Rejected — verification score is below the minimum threshold.';
    riskLevel = 'high';
    reasons.push(`Verification score ${vScore}/100 (below ${rejectThreshold} minimum)`);
    blockers.push('Verification too low — farmer should reapply with complete GPS, boundary, and evidence data');
    nextActions.push('Inform the farmer they may reapply with complete documentation');
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
