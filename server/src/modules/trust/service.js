/**
 * Trust Scoring Service
 *
 * Computes an operational record-trust score for a farm season.
 * Answers: how complete, consistent, and validated is this record?
 *
 * This is distinct from:
 *   - CredibilityAssessment (data anomaly/consistency checker)
 *   - FraudResult (fraud risk engine)
 *   - VerificationResult (identity/application verification)
 *   - DecisionResult (final credit decision)
 *
 * Trust score is advisory and explainable. No black-box logic.
 *
 * Factors (each 0-25 pts, total 0-100):
 *   1. Update Consistency  — are updates logged at expected frequency?
 *   2. Evidence Completeness — are key milestone images present?
 *   3. Validation Presence — has an officer validated key milestones?
 *   4. Cycle Completeness — harvest/end-of-cycle data present?
 *
 * Trust Levels:
 *   High Trust       75-100
 *   Moderate Trust   50-74
 *   Low Trust        25-49
 *   Needs Review     0-24
 */

import prisma from '../../config/database.js';

// ─── Trust Level Thresholds ────────────────────────────────

export const TRUST_LEVELS = {
  HIGH: { min: 75, label: 'High Trust', color: '#16a34a' },
  MODERATE: { min: 50, label: 'Moderate Trust', color: '#d97706' },
  LOW: { min: 25, label: 'Low Trust', color: '#dc2626' },
  NEEDS_REVIEW: { min: 0, label: 'Needs Review', color: '#7f1d1d' },
};

export function getTrustLevel(score) {
  if (score >= 75) return 'High Trust';
  if (score >= 50) return 'Moderate Trust';
  if (score >= 25) return 'Low Trust';
  return 'Needs Review';
}

// ─── Main computation ──────────────────────────────────────

/**
 * Compute trust score for a season.
 * Accepts a full season object (pre-fetched) OR a seasonId string.
 * @returns {{ trustScore, trustLevel, trustReasons, negativeTrustFactors, trustUpdatedAt }}
 */
export async function computeSeasonTrust(seasonOrId) {
  let season;
  if (typeof seasonOrId === 'string') {
    season = await prisma.farmSeason.findUnique({
      where: { id: seasonOrId },
      include: {
        progressEntries: { orderBy: { entryDate: 'asc' } },
        officerValidations: { orderBy: { validatedAt: 'desc' } },
        stageConfirmations: { orderBy: { createdAt: 'desc' }, take: 1 },
        harvestReport: true,
        credibilityAssessment: { select: { credibilityScore: true, credibilityLevel: true, confidence: true } },
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
  const positiveReasons = [];
  const negativeTrustFactors = [];
  let score = 0;

  // ─── 1. Update Consistency (max 25 pts) ───────────────
  // How recently was the season updated?

  const lastActivity = season.lastActivityDate
    ? new Date(season.lastActivityDate)
    : season.createdAt ? new Date(season.createdAt) : null;

  const daysSinceActivity = lastActivity
    ? Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24))
    : null;

  let updateScore = 0;
  if (['harvested', 'completed'].includes(season.status)) {
    // Completed cycle — update consistency no longer required
    updateScore = 20;
    positiveReasons.push('Stage updates are current');
  } else if (season.status === 'active') {
    if (daysSinceActivity === null || daysSinceActivity > 60) {
      updateScore = 0;
      negativeTrustFactors.push(`No updates logged (season inactive for ${daysSinceActivity ?? '?'} days)`);
    } else if (daysSinceActivity > 30) {
      updateScore = 5;
      negativeTrustFactors.push(`No update in ${daysSinceActivity} days`);
    } else if (daysSinceActivity > 14) {
      updateScore = 10;
      negativeTrustFactors.push(`No update in ${daysSinceActivity} days`);
    } else if (daysSinceActivity > 7) {
      updateScore = 18;
      positiveReasons.push('Stage updates are recent');
    } else {
      updateScore = 25;
      positiveReasons.push('Stage updates are current');
    }
  } else {
    // abandoned/failed — honest reporting still counts
    updateScore = 12;
    positiveReasons.push('Season status reported honestly');
  }
  score += updateScore;

  // ─── 2. Evidence Completeness (max 25 pts) ────────────
  // Are key milestone images present?

  const entries = season.progressEntries || [];
  const imageEntries = entries.filter(e => e.imageUrl);
  const imageStages = new Set(imageEntries.map(e => e.imageStage).filter(Boolean));

  let evidenceScore = 0;
  if (entries.length > 0) evidenceScore += 5;
  if (imageEntries.length >= 1) evidenceScore += 8;
  if (imageStages.size >= 2) evidenceScore += 7;
  if (imageStages.has('mid_stage') || imageStages.has('pre_harvest')) evidenceScore += 5;

  score += evidenceScore;

  if (imageEntries.length === 0 && entries.length > 0) {
    negativeTrustFactors.push('No progress images uploaded');
  } else if (imageEntries.length >= 2) {
    positiveReasons.push(`${imageEntries.length} progress images provide visual evidence`);
  }

  if (!imageStages.has('mid_stage') && season.status === 'active') {
    const plantingDate = season.plantingDate ? new Date(season.plantingDate) : null;
    if (plantingDate) {
      const growthPercent = Math.round(
        ((now - plantingDate) / ((season.expectedHarvestDate ? new Date(season.expectedHarvestDate) : new Date(plantingDate.getTime() + 120 * 86400000)) - plantingDate)) * 100
      );
      if (growthPercent > 40) {
        negativeTrustFactors.push('Mid-stage image missing');
      }
    }
  }

  // ─── 3. Validation Presence (max 25 pts) ──────────────
  // Has a field officer confirmed any milestones?

  const validations = season.officerValidations || [];
  let validationScore = 0;

  if (validations.length >= 2) {
    validationScore = 25;
    positiveReasons.push(`${validations.length} field officer validations recorded`);
  } else if (validations.length === 1) {
    validationScore = 15;
    positiveReasons.push('Field officer validation recorded');
  } else {
    // Check season age
    const seasonAgeMs = now - new Date(season.createdAt);
    const seasonAgeDays = Math.floor(seasonAgeMs / (1000 * 60 * 60 * 24));
    if (seasonAgeDays >= 7) {
      negativeTrustFactors.push('No officer validation recorded');
    }
  }
  score += validationScore;

  // Harvest validation bonus — specifically confirmed harvest
  const harvestValidated = validations.some(v => v.validationType === 'harvest' && v.confirmedHarvest);
  if (harvestValidated) {
    positiveReasons.push('Harvest reported and validated by field officer');
  }

  // ─── 4. Cycle Completeness (max 25 pts) ───────────────
  // Has the cycle ended properly with full data?

  const harvestReport = season.harvestReport;
  let cycleScore = 0;

  if (season.status === 'completed' && harvestReport) {
    cycleScore = 25;
    positiveReasons.push('Harvest reported and season completed');
  } else if (season.status === 'harvested' && harvestReport) {
    cycleScore = 22;
    positiveReasons.push('Harvest reported');
  } else if (season.status === 'active') {
    // Not yet expected to be complete — give partial credit
    const expectedHarvest = season.expectedHarvestDate ? new Date(season.expectedHarvestDate) : null;
    if (!expectedHarvest || expectedHarvest > now) {
      // Harvest not yet due
      cycleScore = 20;
    } else {
      // Harvest overdue
      const overdueDays = Math.floor((now - expectedHarvest) / (1000 * 60 * 60 * 24));
      cycleScore = 5;
      negativeTrustFactors.push(`Harvest expected ${overdueDays} day(s) ago but not reported`);
    }
  } else if (season.status === 'harvested' && !harvestReport) {
    cycleScore = 8;
    negativeTrustFactors.push('Marked harvested but harvest report missing');
  } else if (['abandoned', 'failed'].includes(season.status)) {
    cycleScore = 15; // Honest reporting of failure
  }
  score += cycleScore;

  // ─── Compute final trust level ─────────────────────────

  const trustScore = Math.max(0, Math.min(100, Math.round(score)));
  const trustLevel = getTrustLevel(trustScore);

  // trustUpdatedAt = when the most recent trust-relevant data was recorded
  const candidates = [
    season.updatedAt,
    season.lastActivityDate,
    harvestReport?.createdAt,
    validations[0]?.validatedAt,
  ].filter(Boolean).map(d => new Date(d));

  const trustUpdatedAt = candidates.length > 0
    ? new Date(Math.max(...candidates.map(d => d.getTime())))
    : new Date(season.createdAt || now);

  return {
    trustScore,
    trustLevel,
    trustReasons: positiveReasons,
    negativeTrustFactors,
    trustUpdatedAt,
  };
}

/**
 * Compute a lightweight farmer-level trust summary (across all their seasons).
 */
export async function computeFarmerTrust(farmerId) {
  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    include: {
      progressEntries: { orderBy: { entryDate: 'asc' } },
      officerValidations: { select: { validationType: true, confirmedHarvest: true, validatedAt: true } },
      stageConfirmations: { orderBy: { createdAt: 'desc' }, take: 1 },
      harvestReport: { select: { totalHarvestKg: true, yieldPerAcre: true, createdAt: true } },
      credibilityAssessment: { select: { credibilityScore: true, credibilityLevel: true, confidence: true } },
    },
  });

  if (seasons.length === 0) {
    return {
      trustScore: null,
      trustLevel: 'Needs Review',
      trustReasons: ['No seasons recorded yet'],
      negativeTrustFactors: ['No season data to assess'],
      trustUpdatedAt: new Date(),
      seasonCount: 0,
    };
  }

  const seasonTrusts = await Promise.all(seasons.map(s => computeSeasonTrust(s)));

  // Weighted average: recent seasons count more
  const weights = seasonTrusts.map((_, i) => Math.max(1, seasonTrusts.length - i));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedScore = seasonTrusts.reduce((sum, t, i) => sum + t.trustScore * weights[i], 0) / totalWeight;
  const trustScore = Math.round(weightedScore);
  const trustLevel = getTrustLevel(trustScore);

  // Collect reasons from the most recent season
  const latest = seasonTrusts[0];

  return {
    trustScore,
    trustLevel,
    trustReasons: latest.trustReasons,
    negativeTrustFactors: latest.negativeTrustFactors,
    trustUpdatedAt: latest.trustUpdatedAt,
    seasonCount: seasons.length,
    latestSeasonId: seasons[0]?.id || null,
  };
}
