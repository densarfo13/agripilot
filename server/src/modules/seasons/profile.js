import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

/**
 * Performance Profile Service
 *
 * Builds a verified farm performance profile from all seasons.
 * This is the credibility signal for institutions and investors.
 *
 * The profile compiles:
 *   - Farmer basics
 *   - Season history with outcomes
 *   - Aggregate performance metrics
 *   - Activity and condition trends
 *   - Image-backed progression availability
 *   - Reliability signals
 */

export async function getPerformanceProfile(farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: {
      id: true, fullName: true, phone: true, region: true, district: true,
      countryCode: true, primaryCrop: true, farmSizeAcres: true,
      yearsExperience: true, currentStage: true, registrationStatus: true,
      createdAt: true,
    },
  });

  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    include: {
      harvestReport: true,
      progressScore: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });

  const regionCfg = getRegionConfig(farmer.countryCode || DEFAULT_COUNTRY_CODE);

  // ─── Aggregate metrics ────────────────────────────

  const completedSeasons = seasons.filter(s => s.status === 'completed');
  const activeSeasons = seasons.filter(s => s.status === 'active');

  // Yield history
  const yieldHistory = completedSeasons
    .filter(s => s.harvestReport?.yieldPerAcre)
    .map(s => ({
      seasonId: s.id,
      cropType: s.cropType,
      plantingDate: s.plantingDate,
      yieldPerAcre: s.harvestReport.yieldPerAcre,
      totalHarvestKg: s.harvestReport.totalHarvestKg,
      farmSizeAcres: s.farmSizeAcres,
    }));

  // Performance scores
  const scoredSeasons = seasons.filter(s => s.progressScore);
  const avgProgressScore = scoredSeasons.length > 0
    ? Math.round(scoredSeasons.reduce((sum, s) => sum + s.progressScore.progressScore, 0) / scoredSeasons.length)
    : null;

  // Consistency: how many seasons had good engagement
  const highEngagement = scoredSeasons.filter(s =>
    s.progressScore.performanceClassification === 'on_track' ||
    s.progressScore.performanceClassification === 'slight_delay'
  ).length;

  const consistencyRate = scoredSeasons.length > 0
    ? Math.round((highEngagement / scoredSeasons.length) * 100)
    : null;

  // Total activity count across all seasons
  const totalActivities = seasons.reduce((sum, s) => sum + s._count.progressEntries, 0);

  // Productivity trend (yield over time)
  let productivityTrend = 'insufficient_data';
  if (yieldHistory.length >= 2) {
    const recent = yieldHistory[0].yieldPerAcre;
    const older = yieldHistory[yieldHistory.length - 1].yieldPerAcre;
    if (recent > older * 1.1) productivityTrend = 'improving';
    else if (recent < older * 0.9) productivityTrend = 'declining';
    else productivityTrend = 'stable';
  }

  // Crop diversity
  const cropTypes = [...new Set(seasons.map(s => s.cropType))];

  // ─── Reliability signals ──────────────────────────

  const reliabilitySignals = [];

  if (completedSeasons.length >= 2) {
    reliabilitySignals.push({ signal: 'multi_season_track_record', label: `${completedSeasons.length} completed seasons`, positive: true });
  }
  if (consistencyRate !== null && consistencyRate >= 70) {
    reliabilitySignals.push({ signal: 'consistent_engagement', label: `${consistencyRate}% seasons with good engagement`, positive: true });
  }
  if (avgProgressScore !== null && avgProgressScore >= 70) {
    reliabilitySignals.push({ signal: 'strong_avg_score', label: `Average progress score: ${avgProgressScore}/100`, positive: true });
  }
  if (productivityTrend === 'improving') {
    reliabilitySignals.push({ signal: 'improving_yield', label: 'Yield trend improving over seasons', positive: true });
  }
  if (totalActivities >= 10) {
    reliabilitySignals.push({ signal: 'active_reporter', label: `${totalActivities} total progress entries logged`, positive: true });
  }

  // Negative signals
  if (completedSeasons.length === 0 && seasons.length > 0) {
    reliabilitySignals.push({ signal: 'no_completed_seasons', label: 'No completed seasons yet', positive: false });
  }
  if (avgProgressScore !== null && avgProgressScore < 40) {
    reliabilitySignals.push({ signal: 'low_avg_score', label: `Low average progress score: ${avgProgressScore}/100`, positive: false });
  }
  if (productivityTrend === 'declining') {
    reliabilitySignals.push({ signal: 'declining_yield', label: 'Yield trend declining', positive: false });
  }

  return {
    farmer: {
      ...farmer,
      currency: regionCfg.currencyCode,
      country: regionCfg.country,
    },
    summary: {
      totalSeasons: seasons.length,
      completedSeasons: completedSeasons.length,
      activeSeasons: activeSeasons.length,
      avgProgressScore,
      consistencyRate,
      totalActivities,
      productivityTrend,
      cropTypes,
    },
    yieldHistory,
    reliabilitySignals,
    seasons: seasons.map(s => ({
      id: s.id,
      cropType: s.cropType,
      farmSizeAcres: s.farmSizeAcres,
      plantingDate: s.plantingDate,
      expectedHarvestDate: s.expectedHarvestDate,
      status: s.status,
      progressEntries: s._count.progressEntries,
      stageConfirmations: s._count.stageConfirmations,
      progressScore: s.progressScore ? {
        score: s.progressScore.progressScore,
        classification: s.progressScore.performanceClassification,
        riskLevel: s.progressScore.riskLevel,
      } : null,
      harvestReport: s.harvestReport ? {
        totalHarvestKg: s.harvestReport.totalHarvestKg,
        yieldPerAcre: s.harvestReport.yieldPerAcre,
        salesAmount: s.harvestReport.salesAmount,
      } : null,
    })),
  };
}

/**
 * Season performance summary — detailed single-season view.
 */
export async function getSeasonPerformanceSummary(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: {
      farmer: { select: { id: true, fullName: true, countryCode: true, region: true } },
      progressEntries: { orderBy: { entryDate: 'asc' } },
      stageConfirmations: { orderBy: { createdAt: 'asc' } },
      harvestReport: true,
      progressScore: true,
    },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  // Activity timeline (grouped by week)
  const activityTimeline = buildWeeklyTimeline(season.progressEntries, season.plantingDate);

  // Condition history
  const conditionHistory = season.progressEntries
    .filter(e => e.cropCondition)
    .map(e => ({ date: e.entryDate, condition: e.cropCondition, notes: e.conditionNotes }));

  // Image progression
  const imageProgression = season.progressEntries
    .filter(e => e.imageUrl)
    .map(e => ({ date: e.entryDate, url: e.imageUrl, stage: e.imageStage }));

  // Advice tracking
  const adviceHistory = season.progressEntries
    .filter(e => e.followedAdvice)
    .map(e => ({ date: e.entryDate, followed: e.followedAdvice, notes: e.adviceNotes }));

  return {
    season: {
      id: season.id,
      cropType: season.cropType,
      farmSizeAcres: season.farmSizeAcres,
      plantingDate: season.plantingDate,
      expectedHarvestDate: season.expectedHarvestDate,
      status: season.status,
      declaredIntent: season.declaredIntent,
    },
    farmer: season.farmer,
    activityTimeline,
    conditionHistory,
    imageProgression,
    adviceHistory,
    stageConfirmations: season.stageConfirmations,
    harvestReport: season.harvestReport,
    progressScore: season.progressScore,
  };
}

/**
 * Investor intelligence summary — controlled read-only view.
 * Strips sensitive personal data, surfaces performance signals.
 */
export async function getInvestorIntelligence(farmerId) {
  const profile = await getPerformanceProfile(farmerId);

  // Strip sensitive fields for investor view
  const { phone, ...farmerSafe } = profile.farmer;

  return {
    farmer: farmerSafe,
    summary: profile.summary,
    yieldHistory: profile.yieldHistory,
    reliabilitySignals: profile.reliabilitySignals,
    // Seasons without granular entries — just outcomes
    seasonOutcomes: profile.seasons.map(s => ({
      cropType: s.cropType,
      farmSizeAcres: s.farmSizeAcres,
      plantingDate: s.plantingDate,
      status: s.status,
      progressScore: s.progressScore,
      harvestReport: s.harvestReport,
    })),
  };
}

// ─── Helpers ────────────────────────────────────────────

function buildWeeklyTimeline(entries, plantingDate) {
  const planting = new Date(plantingDate);
  const weeks = {};

  for (const entry of entries) {
    const daysSince = Math.floor((new Date(entry.entryDate) - planting) / (1000 * 60 * 60 * 24));
    const weekNum = Math.max(1, Math.ceil(daysSince / 7));
    const key = `week_${weekNum}`;

    if (!weeks[key]) {
      weeks[key] = { week: weekNum, dayRange: `${(weekNum - 1) * 7 + 1}-${weekNum * 7}`, entries: [] };
    }
    weeks[key].entries.push({
      type: entry.entryType,
      activityType: entry.activityType,
      condition: entry.cropCondition,
      date: entry.entryDate,
    });
  }

  return Object.values(weeks).sort((a, b) => a.week - b.week);
}
