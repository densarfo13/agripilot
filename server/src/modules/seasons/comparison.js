import prisma from '../../config/database.js';
import { STAGE_ORDER } from '../lifecycle/service.js';
import { computeExpectedStage, getExpectedTimeline } from './service.js';

/**
 * Season Comparison Service
 *
 * Compares expected progress vs actual progress for a farm season.
 * Produces a structured comparison across multiple dimensions:
 *   1. Growth stage alignment
 *   2. Activity consistency
 *   3. Crop condition trend
 *   4. Advice adherence
 *   5. Image progression coverage
 *
 * All logic is rule-based and explainable.
 */

export async function getSeasonComparison(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: {
      farmer: { select: { id: true, fullName: true, countryCode: true } },
      progressEntries: { orderBy: { entryDate: 'asc' } },
      stageConfirmations: { orderBy: { createdAt: 'desc' } },
      harvestReport: true,
    },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const countryCode = season.farmer?.countryCode || 'KE';
  const expectedStage = computeExpectedStage(season.plantingDate, season.cropType, countryCode);
  const expectedTimeline = getExpectedTimeline(season.plantingDate, season.cropType, countryCode);

  // 1. Stage alignment
  const stageComparison = compareStages(expectedStage, season.stageConfirmations, season.progressEntries);

  // 2. Activity consistency
  const activityComparison = compareActivities(season.progressEntries, season.plantingDate, expectedTimeline);

  // 3. Crop condition trend
  const conditionComparison = compareConditions(season.progressEntries);

  // 4. Advice adherence
  const adviceComparison = compareAdvice(season.progressEntries);

  // 5. Image progression coverage
  const imageComparison = compareImages(season.progressEntries);

  // 6. Harvest completion
  const harvestComparison = compareHarvest(season, expectedTimeline);

  return {
    seasonId: season.id,
    cropType: season.cropType,
    plantingDate: season.plantingDate,
    expectedHarvestDate: season.expectedHarvestDate,
    status: season.status,
    expectedStage,
    dimensions: {
      stageAlignment: stageComparison,
      activityConsistency: activityComparison,
      cropCondition: conditionComparison,
      adviceAdherence: adviceComparison,
      imageProgression: imageComparison,
      harvestCompletion: harvestComparison,
    },
  };
}

// ─── Stage Alignment ────────────────────────────────────

function compareStages(expectedStage, confirmations, progressEntries) {
  const expectedIndex = STAGE_ORDER.indexOf(expectedStage);

  // Use most recent confirmation if available
  const latestConfirmation = confirmations.length > 0 ? confirmations[0] : null;

  // Or derive actual stage from most recent activity entry
  let actualStage = null;
  let actualSource = 'none';

  if (latestConfirmation) {
    actualStage = latestConfirmation.confirmedStage;
    actualSource = 'farmer_confirmation';
  } else {
    // Find the latest progress entry with a lifecycle stage
    const stageEntries = progressEntries.filter(e => e.lifecycleStage);
    if (stageEntries.length > 0) {
      actualStage = stageEntries[stageEntries.length - 1].lifecycleStage;
      actualSource = 'progress_entry';
    }
  }

  const actualIndex = actualStage ? STAGE_ORDER.indexOf(actualStage) : -1;
  const stageDiff = actualIndex >= 0 ? actualIndex - expectedIndex : null;

  let status = 'unknown';
  let label = 'No stage data available';

  if (stageDiff !== null) {
    if (stageDiff >= 0) {
      status = 'on_track';
      label = stageDiff === 0
        ? `On track — both at ${expectedStage}`
        : `Ahead — farmer at ${actualStage}, expected ${expectedStage}`;
    } else if (stageDiff === -1) {
      status = 'slight_delay';
      label = `Slightly behind — farmer at ${actualStage}, expected ${expectedStage}`;
    } else {
      status = 'at_risk';
      label = `Significantly behind — farmer at ${actualStage}, expected ${expectedStage}`;
    }
  }

  return {
    expectedStage,
    actualStage,
    actualSource,
    stageDifference: stageDiff,
    status,
    label,
    latestConfirmation: latestConfirmation ? {
      confirmedStage: latestConfirmation.confirmedStage,
      isMismatch: latestConfirmation.isMismatch,
      date: latestConfirmation.createdAt,
    } : null,
  };
}

// ─── Activity Consistency ───────────────────────────────

function compareActivities(entries, plantingDate, expectedTimeline) {
  const activityEntries = entries.filter(e => e.entryType === 'activity');
  const totalEntries = activityEntries.length;

  // Calculate expected number of entries based on weeks since planting
  const daysSincePlanting = Math.max(0, Math.floor((Date.now() - new Date(plantingDate)) / (1000 * 60 * 60 * 24)));
  const weeksSincePlanting = Math.max(1, Math.floor(daysSincePlanting / 7));

  // Expect roughly 1 activity entry per 2 weeks (biweekly)
  const expectedEntries = Math.floor(weeksSincePlanting / 2);

  const ratio = expectedEntries > 0 ? totalEntries / expectedEntries : totalEntries > 0 ? 1 : 0;

  // Check activity type diversity
  const activityTypes = new Set(activityEntries.map(e => e.activityType).filter(Boolean));

  let status = 'unknown';
  let label = '';

  if (ratio >= 0.8) {
    status = 'on_track';
    label = `${totalEntries} activities logged (expected ~${expectedEntries}) — good consistency`;
  } else if (ratio >= 0.5) {
    status = 'slight_delay';
    label = `${totalEntries} activities logged (expected ~${expectedEntries}) — some gaps`;
  } else if (totalEntries > 0) {
    status = 'at_risk';
    label = `Only ${totalEntries} activities logged (expected ~${expectedEntries}) — low engagement`;
  } else {
    status = 'at_risk';
    label = 'No activities logged yet';
  }

  return {
    totalEntries,
    expectedEntries,
    ratio: Math.round(ratio * 100) / 100,
    activityTypes: [...activityTypes],
    weeksSincePlanting,
    status,
    label,
  };
}

// ─── Crop Condition Trend ───────────────────────────────

function compareConditions(entries) {
  const conditionEntries = entries.filter(e => e.cropCondition);
  const totalReports = conditionEntries.length;

  if (totalReports === 0) {
    return {
      totalReports: 0,
      latestCondition: null,
      trend: 'unknown',
      status: 'unknown',
      label: 'No crop condition reports submitted',
    };
  }

  const conditionScores = { good: 3, average: 2, poor: 1 };
  const latest = conditionEntries[conditionEntries.length - 1];
  const latestScore = conditionScores[latest.cropCondition] || 2;

  // Trend: compare first half vs second half average
  let trend = 'stable';
  if (totalReports >= 3) {
    const mid = Math.floor(totalReports / 2);
    const firstHalf = conditionEntries.slice(0, mid);
    const secondHalf = conditionEntries.slice(mid);
    const avgFirst = firstHalf.reduce((s, e) => s + (conditionScores[e.cropCondition] || 2), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + (conditionScores[e.cropCondition] || 2), 0) / secondHalf.length;

    if (avgSecond > avgFirst + 0.3) trend = 'improving';
    else if (avgSecond < avgFirst - 0.3) trend = 'declining';
  }

  let status = 'on_track';
  let label = `Latest condition: ${latest.cropCondition}`;

  if (latest.cropCondition === 'poor') {
    status = 'at_risk';
    label = 'Crop condition is poor — intervention may be needed';
  } else if (latest.cropCondition === 'average' && trend === 'declining') {
    status = 'slight_delay';
    label = 'Crop condition average and declining';
  } else if (trend === 'improving') {
    label += ' (improving trend)';
  }

  return {
    totalReports,
    latestCondition: latest.cropCondition,
    latestNotes: latest.conditionNotes,
    latestDate: latest.entryDate,
    trend,
    status,
    label,
  };
}

// ─── Advice Adherence ───────────────────────────────────

function compareAdvice(entries) {
  const adviceEntries = entries.filter(e => e.followedAdvice);
  const total = adviceEntries.length;

  if (total === 0) {
    return {
      totalTracked: 0,
      followed: 0,
      partial: 0,
      ignored: 0,
      adherenceRate: null,
      status: 'unknown',
      label: 'No advice tracking data',
    };
  }

  const followed = adviceEntries.filter(e => e.followedAdvice === 'yes').length;
  const partial = adviceEntries.filter(e => e.followedAdvice === 'partial').length;
  const ignored = adviceEntries.filter(e => e.followedAdvice === 'no').length;

  // Score: yes=1, partial=0.5, no=0
  const adherenceRate = Math.round(((followed + partial * 0.5) / total) * 100);

  let status = 'on_track';
  let label = `${adherenceRate}% advice adherence (${total} tracked)`;

  if (adherenceRate < 40) {
    status = 'at_risk';
    label = `Low advice adherence: ${adherenceRate}% — farmer may need more support`;
  } else if (adherenceRate < 70) {
    status = 'slight_delay';
    label = `Moderate advice adherence: ${adherenceRate}%`;
  }

  return { totalTracked: total, followed, partial, ignored, adherenceRate, status, label };
}

// ─── Image Progression ──────────────────────────────────

function compareImages(entries) {
  const imageEntries = entries.filter(e => e.imageUrl);
  const total = imageEntries.length;

  const stagesCovered = new Set(imageEntries.map(e => e.imageStage).filter(Boolean));
  const expectedStages = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];
  const coverage = expectedStages.map(s => ({ stage: s, hasImage: stagesCovered.has(s) }));
  const coverageRate = Math.round((stagesCovered.size / expectedStages.length) * 100);

  let status = 'on_track';
  let label = `${total} images uploaded, ${stagesCovered.size}/${expectedStages.length} stages covered`;

  if (total === 0) {
    status = 'at_risk';
    label = 'No progress images uploaded';
  } else if (coverageRate < 40) {
    status = 'slight_delay';
    label = `Limited image coverage: ${stagesCovered.size}/${expectedStages.length} stages`;
  }

  return { totalImages: total, stagesCovered: [...stagesCovered], coverage, coverageRate, status, label };
}

// ─── Harvest Completion ─────────────────────────────────

function compareHarvest(season, expectedTimeline) {
  const harvestStage = expectedTimeline.find(t => t.stage === 'harvest');
  const now = new Date();
  const harvestEndDate = harvestStage ? new Date(harvestStage.expectedEndDate) : null;
  const isHarvestDue = harvestEndDate && now >= harvestEndDate;

  if (season.harvestReport) {
    return {
      completed: true,
      totalHarvestKg: season.harvestReport.totalHarvestKg,
      yieldPerAcre: season.harvestReport.yieldPerAcre,
      status: 'on_track',
      label: `Harvest completed: ${season.harvestReport.totalHarvestKg}kg`,
    };
  }

  if (season.status === 'completed') {
    return { completed: true, status: 'on_track', label: 'Season marked as completed' };
  }

  if (isHarvestDue) {
    return {
      completed: false,
      status: 'at_risk',
      label: 'Expected harvest date has passed — no harvest report submitted',
    };
  }

  return {
    completed: false,
    expectedHarvestDate: season.expectedHarvestDate,
    status: 'on_track',
    label: season.expectedHarvestDate
      ? `Harvest expected by ${new Date(season.expectedHarvestDate).toLocaleDateString()}`
      : 'Harvest date not yet determined',
  };
}
