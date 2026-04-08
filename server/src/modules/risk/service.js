/**
 * Risk Engine Service
 *
 * Operational risk assessment for farm seasons and farmers.
 * This is NOT a financial risk model — it is a workflow and
 * record-health risk model.
 *
 * Identifies actionable problems such as:
 *   - Missing updates
 *   - Delayed progress
 *   - Stale seasons
 *   - Missing images
 *   - Harvest overdue
 *   - Missing validation
 *   - Weak trust score
 *   - Onboarding stalled
 *
 * Risk Categories:
 *   STALE_UPDATE       — no update in threshold days
 *   MISSING_EVIDENCE   — key milestone images absent
 *   VALIDATION_OVERDUE — no officer validation when expected
 *   HARVEST_PENDING    — harvest date passed, no report
 *   LOW_TRUST          — trust score below threshold
 *   INACTIVE_SEASON    — season effectively dormant
 *   ONBOARDING_STALLED — farmer invited/approved but inactive
 *   REVIEW_BLOCKED     — application blocked and not progressing
 *
 * Risk Levels:
 *   Critical > High > Medium > Low
 *
 * All rules are explainable. No black-box logic.
 */

import prisma from '../../config/database.js';
import { computeSeasonTrust } from '../trust/service.js';

// ─── Thresholds ────────────────────────────────────────────

const STALE_MEDIUM_DAYS = 14;
const STALE_HIGH_DAYS = 30;
const STALE_CRITICAL_DAYS = 60;
const VALIDATION_OVERDUE_MEDIUM_DAYS = 7;
const VALIDATION_OVERDUE_HIGH_DAYS = 21;
const HARVEST_OVERDUE_HIGH_DAYS = 7;
const HARVEST_OVERDUE_CRITICAL_DAYS = 21;
const ONBOARDING_STALL_DAYS = 14;
const REVIEW_BLOCKED_HIGH_DAYS = 7;

// ─── Season-level risk ────────────────────────────────────

/**
 * Compute risk for a single active season.
 * Returns the single highest-severity risk.
 */
export async function computeSeasonRisk(seasonOrId) {
  let season;
  if (typeof seasonOrId === 'string') {
    season = await prisma.farmSeason.findUnique({
      where: { id: seasonOrId },
      include: {
        progressEntries: { orderBy: { entryDate: 'asc' } },
        officerValidations: { orderBy: { validatedAt: 'desc' } },
        stageConfirmations: { orderBy: { createdAt: 'desc' }, take: 1 },
        harvestReport: true,
        farmer: { select: { id: true, fullName: true, assignedOfficerId: true } },
      },
    });
    if (!season) {
      const err = new Error('Season not found');
      err.statusCode = 404;
      throw err;
    }
  } else {
    season = seasonOrId;
  }

  const now = new Date();
  const risks = [];

  // Compute trust score (used as one of the risk signals)
  let trust = null;
  try {
    trust = await computeSeasonTrust(season);
  } catch { /* non-fatal */ }

  // ─── 1. Harvest Pending (harvest date passed, no report) ──

  if (season.status === 'active' && season.expectedHarvestDate && !season.harvestReport) {
    const overdueDays = Math.floor((now - new Date(season.expectedHarvestDate)) / (1000 * 60 * 60 * 24));
    if (overdueDays > 0) {
      risks.push({
        riskLevel: overdueDays >= HARVEST_OVERDUE_CRITICAL_DAYS ? 'Critical' : 'High',
        riskCategory: 'HARVEST_PENDING',
        riskReason: `Harvest was expected ${overdueDays} day(s) ago but has not been reported`,
        nextRecommendedAction: 'Ask farmer to submit harvest report, or field officer to confirm status',
        agingDays: overdueDays,
      });
    }
  }

  // ─── 2. Inactive Season (no activity) ─────────────────────

  if (season.status === 'active') {
    const lastActivity = season.lastActivityDate
      ? new Date(season.lastActivityDate)
      : new Date(season.createdAt);
    const inactiveDays = Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24));

    if (inactiveDays >= STALE_CRITICAL_DAYS) {
      risks.push({
        riskLevel: 'Critical',
        riskCategory: 'INACTIVE_SEASON',
        riskReason: `No activity recorded in ${inactiveDays} days — season may be abandoned`,
        nextRecommendedAction: 'Field officer should contact farmer to verify season status',
        agingDays: inactiveDays,
      });
    } else if (inactiveDays >= STALE_HIGH_DAYS) {
      risks.push({
        riskLevel: 'High',
        riskCategory: 'STALE_UPDATE',
        riskReason: `No update in ${inactiveDays} days`,
        nextRecommendedAction: 'Field officer should follow up — farmer may need support logging updates',
        agingDays: inactiveDays,
      });
    } else if (inactiveDays >= STALE_MEDIUM_DAYS) {
      risks.push({
        riskLevel: 'Medium',
        riskCategory: 'STALE_UPDATE',
        riskReason: `No update in ${inactiveDays} days`,
        nextRecommendedAction: 'Remind farmer to log a progress update',
        agingDays: inactiveDays,
      });
    }
  }

  // ─── 3. Validation Overdue ─────────────────────────────────

  if (season.status === 'active') {
    const validations = season.officerValidations || [];
    const seasonAgeDays = Math.floor((now - new Date(season.createdAt)) / (1000 * 60 * 60 * 24));
    const lastValidation = validations[0]?.validatedAt ? new Date(validations[0].validatedAt) : null;
    const daysSinceValidation = lastValidation
      ? Math.floor((now - lastValidation) / (1000 * 60 * 60 * 24))
      : seasonAgeDays;

    if (seasonAgeDays >= VALIDATION_OVERDUE_MEDIUM_DAYS) {
      if (daysSinceValidation >= VALIDATION_OVERDUE_HIGH_DAYS) {
        risks.push({
          riskLevel: 'High',
          riskCategory: 'VALIDATION_OVERDUE',
          riskReason: `No officer validation in ${daysSinceValidation} days`,
          nextRecommendedAction: 'Assigned field officer should validate farmer progress or stage',
          agingDays: daysSinceValidation,
        });
      } else if (daysSinceValidation >= VALIDATION_OVERDUE_MEDIUM_DAYS && validations.length === 0) {
        risks.push({
          riskLevel: 'Medium',
          riskCategory: 'VALIDATION_OVERDUE',
          riskReason: 'Season has no officer validation recorded',
          nextRecommendedAction: 'Field officer should validate farmer progress',
          agingDays: daysSinceValidation,
        });
      }
    }
  }

  // ─── 4. Missing Evidence ───────────────────────────────────

  if (season.status === 'active') {
    const entries = season.progressEntries || [];
    const imageEntries = entries.filter(e => e.imageUrl);
    const plantingDate = season.plantingDate ? new Date(season.plantingDate) : null;
    const expectedHarvest = season.expectedHarvestDate ? new Date(season.expectedHarvestDate) : null;

    if (plantingDate && expectedHarvest) {
      const totalDays = (expectedHarvest - plantingDate) / (1000 * 60 * 60 * 24);
      const elapsed = (now - plantingDate) / (1000 * 60 * 60 * 24);
      const growthPct = Math.min(100, Math.round((elapsed / totalDays) * 100));

      // At 40%+ growth, expect at least a mid-stage image
      const imageStages = new Set(imageEntries.map(e => e.imageStage).filter(Boolean));
      if (growthPct >= 40 && !imageStages.has('mid_stage') && !imageStages.has('pre_harvest')) {
        risks.push({
          riskLevel: 'Medium',
          riskCategory: 'MISSING_EVIDENCE',
          riskReason: `Season is ${growthPct}% through growing period with no mid-stage image`,
          nextRecommendedAction: 'Farmer should upload a progress photo for the current crop stage',
          agingDays: Math.floor(elapsed),
        });
      }
    }
  }

  // ─── 5. Low Trust ─────────────────────────────────────────

  if (trust) {
    if (trust.trustScore < 25) {
      risks.push({
        riskLevel: 'High',
        riskCategory: 'LOW_TRUST',
        riskReason: `Trust score is very low (${trust.trustScore}/100): ${trust.negativeTrustFactors.slice(0, 2).join('; ')}`,
        nextRecommendedAction: 'Admin or field officer should review record completeness and schedule validation',
        agingDays: null,
      });
    } else if (trust.trustScore < 50) {
      risks.push({
        riskLevel: 'Medium',
        riskCategory: 'LOW_TRUST',
        riskReason: `Trust score is low (${trust.trustScore}/100): ${trust.negativeTrustFactors.slice(0, 2).join('; ')}`,
        nextRecommendedAction: 'Field officer should validate progress and encourage image uploads',
        agingDays: null,
      });
    }
  }

  // ─── Return highest-priority risk ─────────────────────────

  const PRIORITY = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  risks.sort((a, b) => (PRIORITY[b.riskLevel] || 0) - (PRIORITY[a.riskLevel] || 0));

  const topRisk = risks[0] || {
    riskLevel: 'Low',
    riskCategory: null,
    riskReason: 'No significant risk factors detected',
    nextRecommendedAction: null,
    agingDays: null,
  };

  return {
    ...topRisk,
    allRisks: risks, // caller may inspect all risks if needed
    trust: trust ? { trustScore: trust.trustScore, trustLevel: trust.trustLevel } : null,
  };
}

// ─── Farmer-level risk (onboarding / account) ─────────────

/**
 * Risk assessment at the farmer level (account and onboarding health).
 */
export async function computeFarmerRisk(farmerOrId) {
  let farmer;
  if (typeof farmerOrId === 'string') {
    farmer = await prisma.farmer.findUnique({
      where: { id: farmerOrId },
      include: {
        farmSeasons: {
          where: { status: 'active' },
          include: {
            progressEntries: { orderBy: { entryDate: 'asc' } },
            officerValidations: { orderBy: { validatedAt: 'desc' } },
            harvestReport: { select: { id: true } },
          },
        },
        userAccount: { select: { id: true, lastLoginAt: true, active: true } },
      },
    });
    if (!farmer) {
      const err = new Error('Farmer not found');
      err.statusCode = 404;
      throw err;
    }
  } else {
    farmer = farmerOrId;
  }

  const now = new Date();
  const risks = [];

  // ─── 1. Onboarding Stalled ─────────────────────────────────

  if (farmer.registrationStatus === 'approved' && farmer.invitedAt && !farmer.userAccount) {
    const inviteAge = Math.floor((now - new Date(farmer.invitedAt)) / (1000 * 60 * 60 * 24));
    if (inviteAge >= ONBOARDING_STALL_DAYS) {
      risks.push({
        riskLevel: inviteAge >= 30 ? 'High' : 'Medium',
        riskCategory: 'ONBOARDING_STALLED',
        riskReason: `Farmer was invited ${inviteAge} days ago but has not activated their account`,
        nextRecommendedAction: 'Resend invite or contact farmer directly to assist with onboarding',
        agingDays: inviteAge,
      });
    }
  }

  // ─── 2. Approved but no activity ──────────────────────────

  if (farmer.registrationStatus === 'approved' && farmer.farmSeasons.length === 0) {
    const approvedAge = farmer.approvedAt
      ? Math.floor((now - new Date(farmer.approvedAt)) / (1000 * 60 * 60 * 24))
      : null;
    if (approvedAge && approvedAge >= ONBOARDING_STALL_DAYS) {
      risks.push({
        riskLevel: 'Medium',
        riskCategory: 'ONBOARDING_STALLED',
        riskReason: `Approved ${approvedAge} days ago but no season started`,
        nextRecommendedAction: 'Field officer should help farmer start their first season',
        agingDays: approvedAge,
      });
    }
  }

  const PRIORITY = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  risks.sort((a, b) => (PRIORITY[b.riskLevel] || 0) - (PRIORITY[a.riskLevel] || 0));

  return risks[0] || {
    riskLevel: 'Low',
    riskCategory: null,
    riskReason: 'No significant onboarding risk factors',
    nextRecommendedAction: null,
    agingDays: null,
  };
}

// ─── Application-level risk ────────────────────────────────

/**
 * Risk assessment for a loan application.
 */
export async function computeApplicationRisk(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true, status: true, createdAt: true,
      assignedReviewerId: true,
      verificationResult: { select: { verificationScore: true } },
      fraudResult: { select: { fraudRiskLevel: true } },
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date();
  const ageDays = Math.floor((now - new Date(app.createdAt)) / (1000 * 60 * 60 * 24));
  const risks = [];

  if (app.status === 'needs_more_evidence') {
    risks.push({
      riskLevel: ageDays >= REVIEW_BLOCKED_HIGH_DAYS ? 'High' : 'Medium',
      riskCategory: 'REVIEW_BLOCKED',
      riskReason: `Application awaiting additional evidence for ${ageDays} day(s)`,
      nextRecommendedAction: 'Reviewer should specify required evidence or contact farmer',
      agingDays: ageDays,
    });
  }

  if (['submitted', 'under_review'].includes(app.status) && ageDays >= 14) {
    risks.push({
      riskLevel: ageDays >= 21 ? 'High' : 'Medium',
      riskCategory: 'REVIEW_BLOCKED',
      riskReason: `Application has been pending for ${ageDays} days without a decision`,
      nextRecommendedAction: 'Reviewer should prioritize this application',
      agingDays: ageDays,
    });
  }

  const PRIORITY = { Critical: 4, High: 3, Medium: 2, Low: 1 };
  risks.sort((a, b) => (PRIORITY[b.riskLevel] || 0) - (PRIORITY[a.riskLevel] || 0));

  return risks[0] || {
    riskLevel: 'Low',
    riskCategory: null,
    riskReason: 'No significant application risk factors',
    nextRecommendedAction: null,
    agingDays: ageDays,
  };
}
