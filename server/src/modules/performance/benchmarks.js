/**
 * Benchmarking Engine
 *
 * Computes org-level aggregate baselines and produces explainable
 * comparison outputs for individual farmers.
 *
 * Scoping rules:
 *   - institutional_admin: org-scoped only
 *   - super_admin: cross-org (organizationId = null)
 *   - field_officer: org-scoped (sees same comparisons as org averages)
 *   - reviewer: org-scoped
 *   - investor_viewer: org-scoped, summary only
 *   - farmer: no org comparisons exposed
 *
 * Comparison outputs follow the shape:
 *   { comparisonLabel, comparisonReason, benchmarkScope, sourceMetric, comparedAgainst, direction }
 */

import prisma from '../../config/database.js';
import { deriveSeasonMetrics, aggregateMetrics } from './metrics.js';

const SEASON_INCLUDE = {
  progressEntries: { select: { imageUrl: true, entryDate: true, createdAt: true } },
  officerValidations: { select: { id: true, validationType: true, validatedAt: true } },
  harvestReport: { select: { yieldPerAcre: true, totalHarvestKg: true } },
  progressScore: { select: { progressScore: true, performanceClassification: true, riskLevel: true } },
  credibilityAssessment: { select: { credibilityScore: true, credibilityLevel: true } },
};

// ─── Org-level aggregate baseline ─────────────────────────

/**
 * Compute aggregate benchmark baseline for all farmers in an org.
 * Seasons from the past 24 months (recency window).
 *
 * @param {string|null} organizationId
 * @returns {Object} orgAverages
 */
export async function computeOrgBaseline(organizationId) {
  const cutoff = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000); // ~24 months

  const farmerFilter = organizationId ? { organizationId } : {};

  const seasons = await prisma.farmSeason.findMany({
    where: {
      farmer: farmerFilter,
      plantingDate: { gte: cutoff },
    },
    include: SEASON_INCLUDE,
    orderBy: { plantingDate: 'desc' },
  });

  if (seasons.length === 0) return null;

  const seasonMetrics = seasons.map(deriveSeasonMetrics);
  const agg = aggregateMetrics(seasonMetrics);

  // Officer breakdown: how many farmers per officer, and their avg score
  const officerGroups = {};
  const farmerIds = [...new Set(seasons.map(s => s.farmerId))];

  const farmers = await prisma.farmer.findMany({
    where: { id: { in: farmerIds } },
    select: { id: true, assignedOfficerId: true },
  });

  const farmerOfficerMap = Object.fromEntries(farmers.map(f => [f.id, f.assignedOfficerId]));

  for (const m of seasonMetrics) {
    const season = seasons.find(s => s.id === m.seasonId);
    if (!season) continue;
    const officerId = farmerOfficerMap[season.farmerId];
    if (!officerId) continue;
    if (!officerGroups[officerId]) officerGroups[officerId] = [];
    officerGroups[officerId].push(m);
  }

  const officerSummaries = Object.entries(officerGroups).map(([officerId, metrics]) => {
    const a = aggregateMetrics(metrics);
    return {
      officerId,
      farmerCount: new Set(metrics.map(m => {
        const s = seasons.find(se => se.id === m.seasonId);
        return s?.farmerId;
      })).size,
      avgProgressScore: a?.avgProgressScore ?? null,
      avgUpdateFrequency: a?.avgUpdateFrequency ?? null,
      completionRate: a?.completionRate ?? 0,
    };
  });

  return {
    organizationId,
    seasonCount: seasons.length,
    farmerCount: farmerIds.length,
    ...agg,
    officerSummaries,
    computedAt: new Date().toISOString(),
  };
}

// ─── Farmer-level metrics (recent seasons) ─────────────────

/**
 * Compute aggregate metrics for a single farmer's recent seasons.
 */
export async function computeFarmerBaseline(farmerId) {
  const cutoff = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000);

  const seasons = await prisma.farmSeason.findMany({
    where: {
      farmerId,
      plantingDate: { gte: cutoff },
    },
    include: SEASON_INCLUDE,
    orderBy: { plantingDate: 'desc' },
  });

  if (seasons.length === 0) return null;
  return aggregateMetrics(seasons.map(deriveSeasonMetrics));
}

// ─── Self-trend: last two seasons ─────────────────────────

/**
 * Compare farmer's most recent season against the one before it.
 * Returns direction signals for each metric.
 */
export async function computeSelfTrend(farmerId) {
  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    take: 3,
    include: SEASON_INCLUDE,
  });

  if (seasons.length < 2) {
    return { hasTrend: false, seasons: seasons.map(deriveSeasonMetrics) };
  }

  const [current, prior] = seasons.map(deriveSeasonMetrics);

  function trend(curr, prev) {
    if (curr == null || prev == null) return 'insufficient_data';
    if (curr > prev * 1.08) return 'improving';
    if (curr < prev * 0.92) return 'declining';
    return 'stable';
  }

  return {
    hasTrend: true,
    currentSeasonId: current.seasonId,
    priorSeasonId: prior.seasonId,
    trends: {
      progressScore:      trend(current.progressScore, prior.progressScore),
      updateFrequency:    trend(current.updateFrequency, prior.updateFrequency),
      validationCount:    trend(current.validationCount, prior.validationCount),
      evidenceRate:       trend(current.evidenceRate, prior.evidenceRate),
      credibilityScore:   trend(current.credibilityScore, prior.credibilityScore),
    },
    current,
    prior,
  };
}

// ─── Explainable comparison outputs ───────────────────────

const SCOPE_LABEL = (orgId) => orgId ? 'farmers in this organization' : 'all farmers';

/**
 * Compare a farmer's baseline metrics against the org baseline.
 * Returns an array of explainable ComparisonOutput objects.
 *
 * Each output:
 *   { comparisonLabel, comparisonReason, benchmarkScope, sourceMetric, comparedAgainst, direction }
 */
export function buildComparisonOutputs(farmerBaseline, orgBaseline, organizationId) {
  if (!farmerBaseline || !orgBaseline) return [];

  const scope = SCOPE_LABEL(organizationId);
  const outputs = [];

  function compare(farmerVal, orgVal, metricKey, positiveLabel, belowLabel, aboveLabel, unit = '') {
    if (farmerVal == null || orgVal == null) return;
    const diff = farmerVal - orgVal;
    const pctDiff = orgVal > 0 ? (diff / orgVal) * 100 : 0;
    const isAbove = pctDiff >= 8;
    const isBelow = pctDiff <= -8;

    let comparisonLabel, comparisonReason, direction;

    if (isAbove) {
      comparisonLabel = aboveLabel;
      comparisonReason = `${positiveLabel} (${farmerVal}${unit}) is above the ${scope} average of ${orgVal}${unit}`;
      direction = 'above_average';
    } else if (isBelow) {
      comparisonLabel = belowLabel;
      comparisonReason = `${positiveLabel} (${farmerVal}${unit}) is below the ${scope} average of ${orgVal}${unit}`;
      direction = 'below_average';
    } else {
      comparisonLabel = `Around average ${positiveLabel.toLowerCase()}`;
      comparisonReason = `${positiveLabel} is close to the ${scope} average of ${orgVal}${unit}`;
      direction = 'around_average';
    }

    outputs.push({
      comparisonLabel,
      comparisonReason,
      benchmarkScope: scope,
      sourceMetric: metricKey,
      farmerValue: farmerVal,
      comparedAgainst: orgVal,
      direction,
    });
  }

  compare(
    farmerBaseline.avgUpdateFrequency,
    orgBaseline.avgUpdateFrequency,
    'activity_consistency',
    'Update frequency',
    'Below average update consistency',
    'Above average update consistency',
    ' updates/month'
  );

  compare(
    farmerBaseline.avgValidationFrequency,
    orgBaseline.avgValidationFrequency,
    'validation_completion',
    'Validation frequency',
    'Validation lagging behind peers',
    'Validation completion stronger than peer average',
    ' validations/month'
  );

  compare(
    farmerBaseline.avgEvidenceRate,
    orgBaseline.avgEvidenceRate,
    'evidence_completeness',
    'Evidence rate',
    'Evidence weaker than peer average',
    'Evidence stronger than peer average',
    '%'
  );

  compare(
    farmerBaseline.avgProgressScore,
    orgBaseline.avgProgressScore,
    'progress_score',
    'Progress score',
    'Progress score below peer average',
    'Progress score above peer average',
    '/100'
  );

  compare(
    farmerBaseline.completionRate,
    orgBaseline.completionRate,
    'cycle_completion',
    'Season completion rate',
    'Completion rate below peers',
    'Completion rate stronger than peers',
    '%'
  );

  if (farmerBaseline.avgCredibilityScore != null && orgBaseline.avgCredibilityScore != null) {
    compare(
      farmerBaseline.avgCredibilityScore,
      orgBaseline.avgCredibilityScore,
      'credibility',
      'Data credibility score',
      'Data credibility weaker than peer average',
      'Data credibility stronger than peer average',
      '/100'
    );
  }

  return outputs;
}

// ─── Org-level dashboard summary ──────────────────────────

/**
 * Produce a concise dashboard-level org health summary.
 * Returns top-line benchmark indicators for the admin dashboard.
 */
export async function getOrgBenchmarkDashboard(organizationId) {
  const farmerFilter = organizationId ? { organizationId } : {};

  const [
    totalFarmers,
    farmersWithSeasons,
    activeSeasonCount,
    completedSeasonCount,
    abandonedSeasonCount,
  ] = await Promise.all([
    prisma.farmer.count({ where: farmerFilter }),
    prisma.farmer.count({ where: { ...farmerFilter, farmSeasons: { some: {} } } }),
    prisma.farmSeason.count({ where: { farmer: farmerFilter, status: 'active' } }),
    prisma.farmSeason.count({ where: { farmer: farmerFilter, status: { in: ['completed', 'harvested'] } } }),
    prisma.farmSeason.count({ where: { farmer: farmerFilter, status: { in: ['abandoned', 'failed'] } } }),
  ]);

  // Seasons with validation vs without (over past 12 months)
  const cutoff12m = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);

  const recentSeasons = await prisma.farmSeason.findMany({
    where: { farmer: farmerFilter, plantingDate: { gte: cutoff12m } },
    select: {
      id: true, status: true,
      _count: { select: { progressEntries: true, officerValidations: true } },
      progressScore: { select: { progressScore: true, performanceClassification: true } },
    },
  });

  const total = recentSeasons.length;
  const withValidation = recentSeasons.filter(s => s._count.officerValidations > 0).length;
  const withProgress = recentSeasons.filter(s => s._count.progressEntries > 0).length;

  const scoredSeasons = recentSeasons.filter(s => s.progressScore?.progressScore != null);
  const avgProgressScore = scoredSeasons.length > 0
    ? Math.round(scoredSeasons.reduce((sum, s) => sum + s.progressScore.progressScore, 0) / scoredSeasons.length)
    : null;

  // Classification distribution
  const classDistribution = {};
  for (const s of scoredSeasons) {
    const c = s.progressScore.performanceClassification;
    classDistribution[c] = (classDistribution[c] || 0) + 1;
  }

  // Officer portfolio summary
  const officers = await prisma.user.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      role: 'field_officer',
      active: true,
    },
    select: {
      id: true,
      fullName: true,
      _count: { select: { fieldAssignments: true } },
    },
  });

  return {
    organizationId,
    farmers: {
      total: totalFarmers,
      withSeasons: farmersWithSeasons,
      adoptionRate: totalFarmers > 0 ? Math.round((farmersWithSeasons / totalFarmers) * 100) : 0,
    },
    seasons: {
      active: activeSeasonCount,
      completed: completedSeasonCount,
      abandoned: abandonedSeasonCount,
      recentTotal: total,
      recentWithValidation: withValidation,
      recentWithProgress: withProgress,
      validationCoverageRate: total > 0 ? Math.round((withValidation / total) * 100) : 0,
      progressEngagementRate: total > 0 ? Math.round((withProgress / total) * 100) : 0,
    },
    performance: {
      avgProgressScore,
      classDistribution,
    },
    officers: officers.map(o => ({
      officerId: o.id,
      officerName: o.fullName,
      assignedApplicationCount: o._count.fieldAssignments,
    })),
    computedAt: new Date().toISOString(),
  };
}
