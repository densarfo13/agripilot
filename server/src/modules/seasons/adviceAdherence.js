import prisma from '../../config/database.js';

/**
 * Advice Adherence Tracking Service
 *
 * Analyzes whether a farmer follows recommendations and guidance.
 * Links advice-followed entries to actual activities for evidence.
 *
 * Produces a structured adherence summary:
 *   - adherenceLevel: high / partial / low / no_data
 *   - adherenceRate: 0-100%
 *   - breakdown by category
 *   - evidence linking (did advice lead to matching activity?)
 *
 * This is rule-based and explainable — not a black box.
 */

const ADHERENCE_LEVELS = {
  high: { min: 70, label: 'High Adherence', color: '#16a34a' },
  partial: { min: 40, label: 'Partial Adherence', color: '#d97706' },
  low: { min: 0, label: 'Low Adherence', color: '#dc2626' },
  no_data: { min: null, label: 'No Data', color: '#6b7280' },
};

export { ADHERENCE_LEVELS };

/**
 * Get structured advice adherence analysis for a season.
 */
export async function getAdviceAdherence(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, cropType: true, status: true, plantingDate: true },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const entries = await prisma.seasonProgressEntry.findMany({
    where: { seasonId },
    orderBy: { entryDate: 'asc' },
  });

  // Advice entries — any entry where followedAdvice was recorded
  const adviceEntries = entries.filter(e => e.followedAdvice);
  const activityEntries = entries.filter(e => e.entryType === 'activity' && e.activityType);

  if (adviceEntries.length === 0) {
    return {
      seasonId,
      adherenceLevel: 'no_data',
      adherenceRate: null,
      totalAdviceRecords: 0,
      breakdown: { followed: 0, partial: 0, ignored: 0 },
      evidenceLinks: [],
      recommendations: ['Start recording whether you followed recommended practices to build a stronger track record.'],
    };
  }

  // Count adherence
  let followed = 0;
  let partial = 0;
  let ignored = 0;

  for (const entry of adviceEntries) {
    if (entry.followedAdvice === 'yes') followed++;
    else if (entry.followedAdvice === 'partial') partial++;
    else if (entry.followedAdvice === 'no') ignored++;
  }

  const adherenceRate = Math.round(((followed + partial * 0.5) / adviceEntries.length) * 100);

  let adherenceLevel;
  if (adherenceRate >= 70) adherenceLevel = 'high';
  else if (adherenceRate >= 40) adherenceLevel = 'partial';
  else adherenceLevel = 'low';

  // Evidence linking: for each advice entry that says "yes",
  // look for a matching activity within 14 days after the advice entry
  const evidenceLinks = [];
  for (const advEntry of adviceEntries.filter(e => e.followedAdvice === 'yes' || e.followedAdvice === 'partial')) {
    const advDate = new Date(advEntry.entryDate);
    const windowEnd = new Date(advDate.getTime() + 14 * 86400000);

    // Look for a corresponding activity entry in the window
    const matchingActivity = activityEntries.find(a => {
      const aDate = new Date(a.entryDate);
      return aDate >= advDate && aDate <= windowEnd;
    });

    evidenceLinks.push({
      adviceEntryId: advEntry.id,
      adviceDate: advEntry.entryDate,
      claimedFollowed: advEntry.followedAdvice,
      adviceNotes: advEntry.adviceNotes,
      matchingActivity: matchingActivity ? {
        id: matchingActivity.id,
        type: matchingActivity.activityType,
        date: matchingActivity.entryDate,
        description: matchingActivity.description,
      } : null,
      hasEvidence: !!matchingActivity,
    });
  }

  const evidencedCount = evidenceLinks.filter(l => l.hasEvidence).length;
  const claimedCount = evidenceLinks.length;

  // Categorize by activity type (which type of advice was most/least followed)
  const byCategory = {};
  for (const entry of adviceEntries) {
    const cat = entry.activityType || 'general';
    if (!byCategory[cat]) byCategory[cat] = { followed: 0, partial: 0, ignored: 0, total: 0 };
    byCategory[cat].total++;
    if (entry.followedAdvice === 'yes') byCategory[cat].followed++;
    else if (entry.followedAdvice === 'partial') byCategory[cat].partial++;
    else byCategory[cat].ignored++;
  }

  // Recommendations
  const recommendations = [];
  if (adherenceLevel === 'low') {
    recommendations.push('Consider following more recommended practices — this strengthens your performance profile.');
  }
  if (claimedCount > 0 && evidencedCount < claimedCount * 0.5) {
    recommendations.push('Log matching activities after following advice to build verifiable evidence.');
  }
  if (adherenceLevel === 'high' && evidencedCount >= claimedCount * 0.7) {
    recommendations.push('Strong advice adherence with evidence — this is a positive trust signal.');
  }

  return {
    seasonId,
    adherenceLevel,
    adherenceRate,
    totalAdviceRecords: adviceEntries.length,
    breakdown: { followed, partial, ignored },
    evidenceRate: claimedCount > 0 ? Math.round((evidencedCount / claimedCount) * 100) : null,
    evidenceLinks,
    byCategory,
    recommendations,
  };
}

/**
 * Multi-season advice adherence summary for a farmer.
 */
export async function getFarmerAdviceAdherence(farmerId) {
  const seasons = await prisma.farmSeason.findMany({
    where: { farmerId },
    orderBy: { plantingDate: 'desc' },
    select: { id: true, cropType: true, status: true, plantingDate: true },
  });

  if (seasons.length === 0) {
    return {
      farmerId,
      overallLevel: 'no_data',
      overallRate: null,
      seasons: [],
    };
  }

  const seasonSummaries = [];
  let totalAdvice = 0;
  let totalFollowed = 0;
  let totalPartial = 0;

  for (const s of seasons) {
    const adherence = await getAdviceAdherence(s.id);
    seasonSummaries.push({
      seasonId: s.id,
      cropType: s.cropType,
      status: s.status,
      plantingDate: s.plantingDate,
      adherenceLevel: adherence.adherenceLevel,
      adherenceRate: adherence.adherenceRate,
      totalRecords: adherence.totalAdviceRecords,
      evidenceRate: adherence.evidenceRate,
    });

    if (adherence.totalAdviceRecords > 0) {
      totalAdvice += adherence.totalAdviceRecords;
      totalFollowed += adherence.breakdown.followed;
      totalPartial += adherence.breakdown.partial;
    }
  }

  const overallRate = totalAdvice > 0
    ? Math.round(((totalFollowed + totalPartial * 0.5) / totalAdvice) * 100)
    : null;

  let overallLevel = 'no_data';
  if (overallRate !== null) {
    if (overallRate >= 70) overallLevel = 'high';
    else if (overallRate >= 40) overallLevel = 'partial';
    else overallLevel = 'low';
  }

  return {
    farmerId,
    overallLevel,
    overallRate,
    totalAdviceRecords: totalAdvice,
    seasons: seasonSummaries,
  };
}
