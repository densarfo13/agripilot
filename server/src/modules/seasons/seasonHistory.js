import prisma from '../../config/database.js';

/**
 * Season History & Comparison Service
 *
 * Compares performance between consecutive seasons for the same farmer.
 * Used to detect improvement or decline trends for credibility and
 * investor intelligence.
 *
 * Supports:
 *   - Season-to-season performance comparison
 *   - Multi-season trend analysis
 *   - Improvement/decline signals
 */

/**
 * Compare two seasons side-by-side.
 * Returns structured comparison of metrics.
 */
export async function compareSeasons(seasonId1, seasonId2) {
  const [s1, s2] = await Promise.all([
    loadSeasonData(seasonId1),
    loadSeasonData(seasonId2),
  ]);

  if (!s1 || !s2) {
    const err = new Error('One or both seasons not found');
    err.statusCode = 404;
    throw err;
  }

  // Verify same farmer
  if (s1.farmerId !== s2.farmerId) {
    const err = new Error('Seasons must belong to the same farmer');
    err.statusCode = 400;
    throw err;
  }

  const comparison = {
    farmer: { id: s1.farmerId },
    season1: summarizeSeason(s1),
    season2: summarizeSeason(s2),
    changes: {},
  };

  // Yield comparison
  const y1 = s1.harvestReport?.yieldPerAcre;
  const y2 = s2.harvestReport?.yieldPerAcre;
  if (y1 != null && y2 != null) {
    const change = y2 - y1;
    const pct = y1 > 0 ? Math.round((change / y1) * 100) : null;
    comparison.changes.yield = {
      previous: y1, current: y2, change, changePercent: pct,
      direction: change > 0 ? 'improved' : change < 0 ? 'declined' : 'stable',
    };
  }

  // Progress score comparison
  const ps1 = s1.progressScore?.progressScore;
  const ps2 = s2.progressScore?.progressScore;
  if (ps1 != null && ps2 != null) {
    comparison.changes.progressScore = {
      previous: ps1, current: ps2, change: Math.round(ps2 - ps1),
      direction: ps2 > ps1 + 5 ? 'improved' : ps2 < ps1 - 5 ? 'declined' : 'stable',
    };
  }

  // Activity count comparison
  const a1 = s1._count.progressEntries;
  const a2 = s2._count.progressEntries;
  comparison.changes.activityCount = {
    previous: a1, current: a2, change: a2 - a1,
    direction: a2 > a1 ? 'improved' : a2 < a1 ? 'declined' : 'stable',
  };

  // Credibility comparison
  const c1 = s1.credibilityAssessment?.credibilityScore;
  const c2 = s2.credibilityAssessment?.credibilityScore;
  if (c1 != null && c2 != null) {
    comparison.changes.credibility = {
      previous: c1, current: c2, change: Math.round(c2 - c1),
      direction: c2 > c1 + 5 ? 'improved' : c2 < c1 - 5 ? 'declined' : 'stable',
    };
  }

  // Overall assessment
  const improvements = Object.values(comparison.changes).filter(c => c.direction === 'improved').length;
  const declines = Object.values(comparison.changes).filter(c => c.direction === 'declined').length;
  comparison.overallTrend = improvements > declines ? 'improving'
    : declines > improvements ? 'declining' : 'stable';

  return comparison;
}

/**
 * Get full season history with trends for a farmer.
 */
export async function getSeasonHistory(farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { id: true, fullName: true },
  });

  if (!farmer) {
    const err = new Error('Farmer not found');
    err.statusCode = 404;
    throw err;
  }

  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'asc' },
    include: {
      harvestReport: true,
      progressScore: true,
      credibilityAssessment: true,
      officerValidations: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });

  const history = seasons.map((s, idx) => {
    const prev = idx > 0 ? seasons[idx - 1] : null;
    const entry = {
      id: s.id,
      cropType: s.cropType,
      farmSizeAcres: s.farmSizeAcres,
      plantingDate: s.plantingDate,
      expectedHarvestDate: s.expectedHarvestDate,
      status: s.status,
      cropFailureReported: s.cropFailureReported,
      partialHarvest: s.partialHarvest,
      progressEntries: s._count.progressEntries,
      stageConfirmations: s._count.stageConfirmations,
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
      } : null,
      harvest: s.harvestReport ? {
        totalHarvestKg: s.harvestReport.totalHarvestKg,
        yieldPerAcre: s.harvestReport.yieldPerAcre,
        salesAmount: s.harvestReport.salesAmount,
      } : null,
      vsPreivous: null,
    };

    // Season-over-season change
    if (prev && s.harvestReport && prev.harvestReport) {
      const yieldChange = s.harvestReport.yieldPerAcre && prev.harvestReport.yieldPerAcre
        ? Math.round(((s.harvestReport.yieldPerAcre - prev.harvestReport.yieldPerAcre) / prev.harvestReport.yieldPerAcre) * 100)
        : null;
      entry.vsPreivous = { yieldChangePercent: yieldChange };
    }

    return entry;
  });

  // Overall trends
  const completedWithYield = history.filter(h => h.harvest?.yieldPerAcre);
  let yieldTrend = 'insufficient_data';
  if (completedWithYield.length >= 2) {
    const first = completedWithYield[0].harvest.yieldPerAcre;
    const last = completedWithYield[completedWithYield.length - 1].harvest.yieldPerAcre;
    if (last > first * 1.1) yieldTrend = 'improving';
    else if (last < first * 0.9) yieldTrend = 'declining';
    else yieldTrend = 'stable';
  }

  const completedWithScore = history.filter(h => h.progressScore);
  let scoreTrend = 'insufficient_data';
  if (completedWithScore.length >= 2) {
    const first = completedWithScore[0].progressScore.score;
    const last = completedWithScore[completedWithScore.length - 1].progressScore.score;
    if (last > first + 10) scoreTrend = 'improving';
    else if (last < first - 10) scoreTrend = 'declining';
    else scoreTrend = 'stable';
  }

  return {
    farmer: { id: farmer.id, fullName: farmer.fullName },
    totalSeasons: seasons.length,
    completedSeasons: seasons.filter(s => s.status === 'completed').length,
    activeSeasons: seasons.filter(s => s.status === 'active').length,
    trends: { yield: yieldTrend, progressScore: scoreTrend },
    history,
  };
}

// ─── Internal ──────────────────────────────────────────

async function loadSeasonData(seasonId) {
  return prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: {
      harvestReport: true,
      progressScore: true,
      credibilityAssessment: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });
}

function summarizeSeason(s) {
  return {
    id: s.id,
    cropType: s.cropType,
    farmSizeAcres: s.farmSizeAcres,
    plantingDate: s.plantingDate,
    status: s.status,
    progressEntries: s._count.progressEntries,
    progressScore: s.progressScore?.progressScore ?? null,
    classification: s.progressScore?.performanceClassification ?? null,
    credibilityScore: s.credibilityAssessment?.credibilityScore ?? null,
    yieldPerAcre: s.harvestReport?.yieldPerAcre ?? null,
    totalHarvestKg: s.harvestReport?.totalHarvestKg ?? null,
  };
}
