/**
 * Performance & Benchmarking Service
 *
 * Orchestrates historical performance tracking and org-scoped benchmarking.
 *
 * Exported functions:
 *   getFarmerPerformanceHistory(farmerId, organizationId, userRole)
 *     → season-by-season table + self-trend + optional simple trend for farmer-facing
 *
 *   getFarmerBenchmarks(farmerId, organizationId, userRole)
 *     → farmer baseline vs org baseline + explainable comparison outputs
 *
 *   getOrgBenchmarkSummary(organizationId)
 *     → dashboard-level org health (used by /api/dashboard/benchmarks)
 *
 *   getPerformanceSummaryReport(organizationId)
 *     → extended report data for /api/reports/performance-summary
 *
 * Permission enforcement happens in routes.js.
 * This service receives already-validated (organizationId, userRole) params.
 */

import prisma from '../../config/database.js';
import { deriveSeasonMetrics } from './metrics.js';
import {
  computeOrgBaseline,
  computeFarmerBaseline,
  computeSelfTrend,
  buildComparisonOutputs,
  getOrgBenchmarkDashboard,
} from './benchmarks.js';
import { computeSeasonTrust } from '../trust/service.js';

const SEASON_INCLUDE = {
  progressEntries: { select: { imageUrl: true, entryDate: true, createdAt: true } },
  officerValidations: { select: { id: true, validationType: true, validatedAt: true } },
  harvestReport: { select: { yieldPerAcre: true, totalHarvestKg: true, salesAmount: true, createdAt: true } },
  progressScore: { select: { progressScore: true, performanceClassification: true, riskLevel: true } },
  credibilityAssessment: { select: { credibilityScore: true, credibilityLevel: true } },
};

// ─── Farmer performance history ────────────────────────────

/**
 * Return full season-by-season performance history for a farmer.
 *
 * For farmer-facing views, returns only self-trend (no org comparisons).
 * For staff views, returns metrics + self-trend.
 *
 * @param {string} farmerId
 * @param {string|null} organizationId
 * @param {string} userRole
 */
export async function getFarmerPerformanceHistory(farmerId, organizationId, userRole) {
  const isFarmer = userRole === 'farmer';

  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    include: SEASON_INCLUDE,
  });

  if (seasons.length === 0) {
    return {
      farmerId,
      seasons: [],
      selfTrend: null,
      summary: null,
    };
  }

  const seasonMetrics = seasons.map(deriveSeasonMetrics);

  // Compute trust for each season (lightweight — uses pre-fetched data)
  const seasonTrusts = await Promise.all(
    seasons.map(s => computeSeasonTrust(s).catch(() => null))
  );

  // Build enriched season rows
  const enrichedSeasons = seasonMetrics.map((m, i) => {
    const trust = seasonTrusts[i];
    const base = {
      seasonId: m.seasonId,
      cropType: m.cropType,
      farmSizeAcres: m.farmSizeAcres,
      plantingDate: m.plantingDate,
      expectedHarvestDate: m.expectedHarvestDate,
      status: m.status,
      daysActive: m.daysActive,
      yieldPerAcre: m.yieldPerAcre,
      hasHarvestReport: m.hasHarvestReport,
    };

    if (isFarmer) {
      // Farmer-facing: simple self-assessment only
      const selfScore = trust ? trust.trustScore : null;
      let selfLabel = 'On track';
      if (selfScore !== null) {
        if (selfScore < 40) selfLabel = 'Needs attention';
        else if (selfScore < 65) selfLabel = 'Making progress';
        else selfLabel = 'On track';
      }
      return { ...base, selfLabel };
    }

    // Staff-facing: full metrics
    return {
      ...base,
      updateCount: m.updateCount,
      imageCount: m.imageCount,
      validationCount: m.validationCount,
      evidenceRate: m.evidenceRate,
      updateFrequency: m.updateFrequency,
      progressScore: m.progressScore,
      progressClassification: m.progressClassification,
      credibilityScore: m.credibilityScore,
      trustScore: trust?.trustScore ?? null,
      trustLevel: trust?.trustLevel ?? null,
    };
  });

  // Self-trend: compare last two seasons
  const selfTrend = await computeSelfTrend(farmerId).catch(() => null);

  return {
    farmerId,
    seasons: enrichedSeasons,
    selfTrend: selfTrend?.hasTrend ? selfTrend : null,
    summary: isFarmer ? null : buildHistorySummary(seasonMetrics, seasonTrusts),
  };
}

function buildHistorySummary(seasonMetrics, trusts) {
  const n = seasonMetrics.length;
  if (n === 0) return null;

  const completed = seasonMetrics.filter(m => ['completed', 'harvested'].includes(m.status)).length;
  const abandoned = seasonMetrics.filter(m => ['abandoned', 'failed'].includes(m.status)).length;

  const validScores = seasonMetrics.map(m => m.progressScore).filter(v => v != null);
  const avgProgressScore = validScores.length > 0
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : null;

  const validTrust = trusts.map(t => t?.trustScore).filter(v => v != null);
  const avgTrustScore = validTrust.length > 0
    ? Math.round(validTrust.reduce((a, b) => a + b, 0) / validTrust.length)
    : null;

  // Trust trend: is trust improving or declining across seasons (most recent = first)
  let trustTrend = 'insufficient_data';
  if (validTrust.length >= 2) {
    const recent = validTrust[0];
    const older = validTrust[validTrust.length - 1];
    if (recent > older + 8) trustTrend = 'improving';
    else if (recent < older - 8) trustTrend = 'declining';
    else trustTrend = 'stable';
  }

  // Score trend
  let scoreTrend = 'insufficient_data';
  if (validScores.length >= 2) {
    const recent = validScores[0];
    const older = validScores[validScores.length - 1];
    if (recent > older + 8) scoreTrend = 'improving';
    else if (recent < older - 8) scoreTrend = 'declining';
    else scoreTrend = 'stable';
  }

  return {
    totalSeasons: n,
    completedSeasons: completed,
    abandonedSeasons: abandoned,
    activeSeasons: seasonMetrics.filter(m => m.status === 'active').length,
    completionRate: n > 0 ? Math.round((completed / n) * 100) : 0,
    avgProgressScore,
    avgTrustScore,
    trustTrend,
    scoreTrend,
  };
}

// ─── Farmer benchmarks (vs org) ────────────────────────────

/**
 * Compare a farmer's performance against their organization's baseline.
 * Returns explainable comparison outputs + raw baseline values.
 *
 * @param {string} farmerId
 * @param {string|null} organizationId
 * @param {string} userRole
 */
export async function getFarmerBenchmarks(farmerId, organizationId, userRole) {
  const isFarmer = userRole === 'farmer';
  if (isFarmer) {
    // Farmers don't see org comparisons — return self-trend only
    const selfTrend = await computeSelfTrend(farmerId).catch(() => null);
    return {
      farmerId,
      selfTrend: selfTrend?.hasTrend ? {
        trends: selfTrend.trends,
        currentSeasonId: selfTrend.currentSeasonId,
        priorSeasonId: selfTrend.priorSeasonId,
      } : null,
      comparisons: [],
      orgBaseline: null,
      farmerBaseline: null,
    };
  }

  const [farmerBaseline, orgBaseline, selfTrend] = await Promise.all([
    computeFarmerBaseline(farmerId),
    computeOrgBaseline(organizationId),
    computeSelfTrend(farmerId).catch(() => null),
  ]);

  const comparisons = buildComparisonOutputs(farmerBaseline, orgBaseline, organizationId);

  // Add self-trend comparison outputs
  if (selfTrend?.hasTrend) {
    const trendOutputs = buildTrendOutputs(selfTrend.trends, selfTrend.current, selfTrend.prior);
    comparisons.push(...trendOutputs);
  }

  return {
    farmerId,
    selfTrend: selfTrend?.hasTrend ? {
      trends: selfTrend.trends,
      currentSeasonId: selfTrend.currentSeasonId,
      priorSeasonId: selfTrend.priorSeasonId,
    } : null,
    comparisons,
    farmerBaseline,
    orgBaseline: orgBaseline
      ? {
          seasonCount: orgBaseline.seasonCount,
          farmerCount: orgBaseline.farmerCount,
          avgProgressScore: orgBaseline.avgProgressScore,
          avgUpdateFrequency: orgBaseline.avgUpdateFrequency,
          avgValidationFrequency: orgBaseline.avgValidationFrequency,
          avgEvidenceRate: orgBaseline.avgEvidenceRate,
          completionRate: orgBaseline.completionRate,
          avgCredibilityScore: orgBaseline.avgCredibilityScore,
        }
      : null,
  };
}

function buildTrendOutputs(trends, current, prior) {
  const outputs = [];
  const trendLabel = { improving: 'Improving', declining: 'Declining', stable: 'Stable', insufficient_data: null };

  const add = (metricKey, label, improvingText, decliningText) => {
    const dir = trends[metricKey];
    if (!dir || dir === 'insufficient_data') return;
    outputs.push({
      comparisonLabel: dir === 'improving' ? improvingText : dir === 'declining' ? decliningText : `Stable ${label}`,
      comparisonReason: `${label} is ${dir === 'stable' ? 'stable' : dir} compared with your previous season`,
      benchmarkScope: 'own previous season',
      sourceMetric: metricKey,
      direction: dir,
      comparedAgainst: null,
      farmerValue: null,
    });
  };

  add('progressScore', 'Performance score', 'Improving performance score season-over-season', 'Declining performance score compared with previous season');
  add('updateFrequency', 'Update activity', 'Improving update activity compared with previous season', 'Activity declining compared with previous season');
  add('validationCount', 'Validation count', 'More officer validations than previous season', 'Fewer officer validations than previous season');
  add('evidenceRate', 'Evidence rate', 'Stronger evidence completeness than previous season', 'Evidence rate declining compared with previous season');
  add('credibilityScore', 'Data credibility', 'Improving data credibility compared with previous season', 'Data credibility declining compared with previous season');

  return outputs;
}

// ─── Org dashboard benchmark summary ──────────────────────

export async function getOrgBenchmarkSummary(organizationId) {
  return getOrgBenchmarkDashboard(organizationId);
}

// ─── Performance summary report ───────────────────────────

/**
 * Extended performance summary for reports/export.
 * Includes org baseline, officer breakdowns, completion distribution.
 *
 * @param {string|null} organizationId
 */
export async function getPerformanceSummaryReport(organizationId) {
  const [orgBaseline, dashboard] = await Promise.all([
    computeOrgBaseline(organizationId),
    getOrgBenchmarkDashboard(organizationId),
  ]);

  // Top and bottom performing farmers by progress score (recent seasons)
  const cutoff = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
  const farmerFilter = organizationId ? { organizationId } : {};

  const recentSeasons = await prisma.farmSeason.findMany({
    where: { farmer: farmerFilter, plantingDate: { gte: cutoff }, progressScore: { isNot: null } },
    orderBy: { plantingDate: 'desc' },
    select: {
      id: true,
      farmerId: true,
      cropType: true,
      status: true,
      farmer: { select: { id: true, fullName: true, region: true, assignedOfficerId: true } },
      progressScore: { select: { progressScore: true, performanceClassification: true } },
      harvestReport: { select: { yieldPerAcre: true } },
    },
  });

  // De-dup: keep most recent season per farmer
  const farmerSeasonMap = new Map();
  for (const s of recentSeasons) {
    if (!farmerSeasonMap.has(s.farmerId)) farmerSeasonMap.set(s.farmerId, s);
  }
  const latestPerFarmer = [...farmerSeasonMap.values()];

  const sorted = latestPerFarmer
    .filter(s => s.progressScore?.progressScore != null)
    .sort((a, b) => b.progressScore.progressScore - a.progressScore.progressScore);

  const top = sorted.slice(0, 5).map(s => ({
    farmerId: s.farmer.id,
    farmerName: s.farmer.fullName,
    region: s.farmer.region,
    cropType: s.cropType,
    progressScore: s.progressScore.progressScore,
    classification: s.progressScore.performanceClassification,
    yieldPerAcre: s.harvestReport?.yieldPerAcre ?? null,
  }));

  const bottom = sorted.slice(-5).reverse().map(s => ({
    farmerId: s.farmer.id,
    farmerName: s.farmer.fullName,
    region: s.farmer.region,
    cropType: s.cropType,
    progressScore: s.progressScore.progressScore,
    classification: s.progressScore.performanceClassification,
    yieldPerAcre: s.harvestReport?.yieldPerAcre ?? null,
  }));

  // Region breakdown
  const regionBreakdown = {};
  for (const s of latestPerFarmer) {
    const region = s.farmer.region || 'Unknown';
    if (!regionBreakdown[region]) regionBreakdown[region] = { count: 0, totalScore: 0, scoredCount: 0 };
    regionBreakdown[region].count++;
    if (s.progressScore?.progressScore != null) {
      regionBreakdown[region].totalScore += s.progressScore.progressScore;
      regionBreakdown[region].scoredCount++;
    }
  }
  const regionSummary = Object.entries(regionBreakdown).map(([region, d]) => ({
    region,
    farmerCount: d.count,
    avgProgressScore: d.scoredCount > 0 ? Math.round(d.totalScore / d.scoredCount) : null,
  })).sort((a, b) => (b.avgProgressScore ?? 0) - (a.avgProgressScore ?? 0));

  return {
    generatedAt: new Date().toISOString(),
    organizationId,
    orgBaseline: orgBaseline
      ? {
          seasonCount: orgBaseline.seasonCount,
          farmerCount: orgBaseline.farmerCount,
          avgProgressScore: orgBaseline.avgProgressScore,
          avgUpdateFrequency: orgBaseline.avgUpdateFrequency,
          avgValidationFrequency: orgBaseline.avgValidationFrequency,
          avgEvidenceRate: orgBaseline.avgEvidenceRate,
          completionRate: orgBaseline.completionRate,
          harvestReportRate: orgBaseline.harvestReportRate,
        }
      : null,
    dashboard,
    topPerformers: top,
    bottomPerformers: bottom,
    regionSummary,
    officerSummaries: orgBaseline?.officerSummaries ?? [],
  };
}
