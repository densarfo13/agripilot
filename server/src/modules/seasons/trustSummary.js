import prisma from '../../config/database.js';
import { getCredibility } from './credibility.js';
import { getValidationSummary } from './officerValidation.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

/**
 * Trust Summary Service
 *
 * Concise intelligence summary for institutional read-only roles.
 * Aggregates progress, credibility, evidence, validation, and harvest
 * into a single structured view suitable for investors, grant providers,
 * and institutional reviewers.
 *
 * This is NOT the raw internal log — it is a curated trust signal.
 */

/**
 * Season-level trust summary.
 */
export async function getSeasonTrustSummary(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: {
      farmer: {
        select: {
          id: true, fullName: true, region: true, district: true,
          countryCode: true, primaryCrop: true, farmSizeAcres: true,
          yearsExperience: true,
        },
      },
      progressEntries: { orderBy: { entryDate: 'asc' } },
      stageConfirmations: { orderBy: { createdAt: 'desc' }, take: 1 },
      harvestReport: true,
      progressScore: true,
      credibilityAssessment: true,
      officerValidations: true,
    },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  // Ensure credibility is computed
  let credibility = season.credibilityAssessment;
  if (!credibility) {
    try { credibility = await getCredibility(seasonId); } catch { credibility = null; }
  }

  const validationSummary = await getValidationSummary(seasonId);
  const regionCfg = getRegionConfig(season.farmer?.countryCode || DEFAULT_COUNTRY_CODE);

  // Evidence coverage
  const entries = season.progressEntries;
  const imageEntries = entries.filter(e => e.imageUrl);
  const conditionEntries = entries.filter(e => e.cropCondition);
  const adviceEntries = entries.filter(e => e.followedAdvice);

  const adherenceRate = adviceEntries.length > 0
    ? Math.round(adviceEntries.filter(e => e.followedAdvice === 'yes' || e.followedAdvice === 'partial').length / adviceEntries.length * 100)
    : null;

  // Score breakdown (from stored factors)
  let scoreBreakdown = null;
  if (season.progressScore?.factors) {
    const factors = typeof season.progressScore.factors === 'string'
      ? JSON.parse(season.progressScore.factors) : season.progressScore.factors;
    scoreBreakdown = {
      contributingFactors: [],
      negativeFactors: [],
    };
    for (const [key, val] of Object.entries(factors)) {
      const entry = {
        dimension: key,
        score: val.score,
        weight: Math.round(val.weight * 100) + '%',
        weighted: val.weighted,
        label: val.label,
      };
      if (val.score >= 60) scoreBreakdown.contributingFactors.push(entry);
      else scoreBreakdown.negativeFactors.push(entry);
    }
  }

  return {
    season: {
      id: season.id,
      cropType: season.cropType,
      farmSizeAcres: season.farmSizeAcres,
      plantingDate: season.plantingDate,
      expectedHarvestDate: season.expectedHarvestDate,
      status: season.status,
      cropFailureReported: season.cropFailureReported,
      partialHarvest: season.partialHarvest,
    },
    farmer: {
      id: season.farmer.id,
      fullName: season.farmer.fullName,
      region: season.farmer.region,
      district: season.farmer.district,
      country: regionCfg.country,
      primaryCrop: season.farmer.primaryCrop,
      farmSizeAcres: season.farmer.farmSizeAcres,
      yearsExperience: season.farmer.yearsExperience,
    },
    progressClassification: season.progressScore ? {
      score: season.progressScore.progressScore,
      classification: season.progressScore.performanceClassification,
      riskLevel: season.progressScore.riskLevel,
      reasons: season.progressScore.reasons,
      scoreBreakdown,
    } : null,
    credibility: credibility ? {
      score: credibility.credibilityScore,
      level: credibility.credibilityLevel,
      confidence: credibility.confidence,
      flags: credibility.flags,
      reasons: credibility.reasons,
    } : null,
    evidenceCoverage: {
      totalEntries: entries.length,
      activityEntries: entries.filter(e => e.entryType === 'activity').length,
      conditionReports: conditionEntries.length,
      adviceRecords: adviceEntries.length,
      adviceAdherenceRate: adherenceRate,
      progressImages: imageEntries.length,
      imageStageCoverage: [...new Set(imageEntries.map(e => e.imageStage).filter(Boolean))],
      latestStageConfirmation: season.stageConfirmations[0]?.confirmedStage || null,
    },
    officerValidation: validationSummary,
    harvestOutcome: season.harvestReport ? {
      totalHarvestKg: season.harvestReport.totalHarvestKg,
      yieldPerAcre: season.harvestReport.yieldPerAcre,
      salesAmount: season.harvestReport.salesAmount,
      salesCurrency: season.harvestReport.salesCurrency || regionCfg.currencyCode,
      notes: season.harvestReport.notes,
    } : null,
  };
}

/**
 * Farmer-level performance export — bridge-ready structured data.
 * Suitable for external systems: lenders, grant providers, AgriVill.
 */
export async function getPerformanceExport(farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: {
      id: true, fullName: true, region: true, district: true,
      countryCode: true, primaryCrop: true, farmSizeAcres: true,
      yearsExperience: true, registrationStatus: true, createdAt: true,
    },
  });

  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  const regionCfg = getRegionConfig(farmer.countryCode || DEFAULT_COUNTRY_CODE);

  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    include: {
      harvestReport: true,
      progressScore: true,
      credibilityAssessment: true,
      officerValidations: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });

  const completed = seasons.filter(s => s.status === 'completed');
  const withYield = completed.filter(s => s.harvestReport?.yieldPerAcre);

  // Aggregate metrics
  const avgYield = withYield.length > 0
    ? Math.round(withYield.reduce((sum, s) => sum + s.harvestReport.yieldPerAcre, 0) / withYield.length)
    : null;

  const avgProgressScore = seasons.filter(s => s.progressScore).length > 0
    ? Math.round(seasons.filter(s => s.progressScore).reduce((sum, s) => sum + s.progressScore.progressScore, 0) / seasons.filter(s => s.progressScore).length)
    : null;

  const avgCredibility = seasons.filter(s => s.credibilityAssessment).length > 0
    ? Math.round(seasons.filter(s => s.credibilityAssessment).reduce((sum, s) => sum + s.credibilityAssessment.credibilityScore, 0) / seasons.filter(s => s.credibilityAssessment).length)
    : null;

  const totalOfficerValidations = seasons.reduce((sum, s) => sum + s.officerValidations.length, 0);

  // Yield trend
  let yieldTrend = 'insufficient_data';
  if (withYield.length >= 2) {
    const recent = withYield[0].harvestReport.yieldPerAcre;
    const older = withYield[withYield.length - 1].harvestReport.yieldPerAcre;
    if (recent > older * 1.1) yieldTrend = 'improving';
    else if (recent < older * 0.9) yieldTrend = 'declining';
    else yieldTrend = 'stable';
  }

  // All flags across seasons
  const allFlags = seasons
    .filter(s => s.credibilityAssessment?.flags)
    .flatMap(s => s.credibilityAssessment.flags);
  const uniqueFlags = [...new Set(allFlags)];

  return {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    farmer: {
      id: farmer.id,
      fullName: farmer.fullName,
      region: farmer.region,
      district: farmer.district,
      country: regionCfg.country,
      countryCode: farmer.countryCode,
      currency: regionCfg.currencyCode,
      primaryCrop: farmer.primaryCrop,
      farmSizeAcres: farmer.farmSizeAcres,
      yearsExperience: farmer.yearsExperience,
      registrationStatus: farmer.registrationStatus,
      memberSince: farmer.createdAt,
    },
    summary: {
      totalSeasons: seasons.length,
      completedSeasons: completed.length,
      activeSeasons: seasons.filter(s => s.status === 'active').length,
      avgYieldPerAcre: avgYield,
      avgProgressScore,
      avgCredibilityScore: avgCredibility,
      yieldTrend,
      totalOfficerValidations,
      credibilityFlags: uniqueFlags,
    },
    seasons: seasons.map(s => ({
      id: s.id,
      cropType: s.cropType,
      farmSizeAcres: s.farmSizeAcres,
      plantingDate: s.plantingDate,
      expectedHarvestDate: s.expectedHarvestDate,
      status: s.status,
      cropFailureReported: s.cropFailureReported,
      partialHarvest: s.partialHarvest,
      dataPoints: s._count.progressEntries + s._count.stageConfirmations,
      officerValidations: s.officerValidations.length,
      progressScore: s.progressScore ? {
        score: s.progressScore.progressScore,
        classification: s.progressScore.performanceClassification,
        riskLevel: s.progressScore.riskLevel,
      } : null,
      credibility: s.credibilityAssessment ? {
        score: s.credibilityAssessment.credibilityScore,
        level: s.credibilityAssessment.credibilityLevel,
        confidence: s.credibilityAssessment.confidence,
        flags: s.credibilityAssessment.flags,
      } : null,
      harvest: s.harvestReport ? {
        totalHarvestKg: s.harvestReport.totalHarvestKg,
        yieldPerAcre: s.harvestReport.yieldPerAcre,
        salesAmount: s.harvestReport.salesAmount,
        salesCurrency: s.harvestReport.salesCurrency || regionCfg.currencyCode,
      } : null,
    })),
  };
}
