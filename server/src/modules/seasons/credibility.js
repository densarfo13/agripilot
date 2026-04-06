import prisma from '../../config/database.js';
import { getSeasonComparison } from './comparison.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';
import { STAGE_ORDER } from '../lifecycle/service.js';

/**
 * Credibility Assessment Service
 *
 * Evaluates the trustworthiness of farmer-submitted season/progress data.
 * Entirely rule-based and explainable. Separate from verification, fraud,
 * and decision engines — this is an advisory intelligence layer.
 *
 * Inspects:
 *   - Activity timing and frequency
 *   - Lifecycle stage consistency
 *   - Crop condition plausibility
 *   - Image metadata and timing
 *   - Harvest claim plausibility
 *   - Advice-followed consistency
 *   - Update gaps and anomalies
 *   - Officer validation presence
 *
 * Output:
 *   - credibilityScore (0-100)
 *   - credibilityLevel (high_confidence / medium_confidence / low_confidence / needs_review)
 *   - flags (array of issue codes)
 *   - reasons (human-readable explanations)
 *   - confidence (low / medium / high — how much data we have to judge)
 *   - evidenceCoverage (structured coverage summary)
 *   - anomalies (detected inconsistencies)
 */

const CREDIBILITY_LEVELS = {
  high_confidence: { min: 75, label: 'High Confidence', color: '#16a34a' },
  medium_confidence: { min: 50, label: 'Medium Confidence', color: '#d97706' },
  low_confidence: { min: 25, label: 'Low Confidence', color: '#dc2626' },
  needs_review: { min: 0, label: 'Needs Review', color: '#7f1d1d' },
};

export { CREDIBILITY_LEVELS };

export async function computeCredibility(seasonId) {
  const season = await prisma.farmSeason.findUnique({
    where: { id: seasonId },
    include: {
      farmer: { select: { id: true, countryCode: true, assignedOfficerId: true } },
      progressEntries: { orderBy: { entryDate: 'asc' } },
      stageConfirmations: { orderBy: { createdAt: 'asc' } },
      harvestReport: true,
      progressScore: true,
      officerValidations: { orderBy: { validatedAt: 'asc' } },
    },
  });

  if (!season) {
    const err = new Error('Season not found');
    err.statusCode = 404;
    throw err;
  }

  const flags = [];
  const reasons = [];
  const anomalies = [];
  let scoreDeductions = 0; // start at 100, deduct for issues

  const entries = season.progressEntries;
  const now = new Date();
  const plantingDate = new Date(season.plantingDate);
  const daysSincePlanting = Math.floor((now - plantingDate) / (1000 * 60 * 60 * 24));
  const regionCfg = getRegionConfig(season.farmer?.countryCode || DEFAULT_COUNTRY_CODE);
  const growingDays = regionCfg.cropCalendars?.[season.cropType]?.growingDays || 120;

  // ─── 1. Timeline consistency ─────────────────────

  // Check for entries before planting date
  const prePlantEntries = entries.filter(e => new Date(e.entryDate) < plantingDate);
  if (prePlantEntries.length > 0) {
    flags.push('entries_before_planting');
    reasons.push(`${prePlantEntries.length} progress entries logged before planting date`);
    anomalies.push({ type: 'timeline', issue: 'entries_before_planting', count: prePlantEntries.length });
    scoreDeductions += 10;
  }

  // Check for future-dated entries
  const futureEntries = entries.filter(e => new Date(e.entryDate) > now);
  if (futureEntries.length > 0) {
    flags.push('future_dated_entries');
    reasons.push(`${futureEntries.length} entries with future dates`);
    anomalies.push({ type: 'timeline', issue: 'future_dated_entries', count: futureEntries.length });
    scoreDeductions += 15;
  }

  // Check for burst submissions (many entries in a single day — may indicate backfilling)
  const entriesByDate = {};
  for (const e of entries) {
    const day = new Date(e.entryDate).toISOString().slice(0, 10);
    entriesByDate[day] = (entriesByDate[day] || 0) + 1;
  }
  const burstDays = Object.entries(entriesByDate).filter(([, count]) => count >= 5);
  if (burstDays.length > 0) {
    flags.push('burst_submissions');
    reasons.push(`${burstDays.length} day(s) with 5+ entries — possible backfilling`);
    anomalies.push({ type: 'pattern', issue: 'burst_submissions', days: burstDays.map(([d]) => d) });
    scoreDeductions += 8;
  }

  // ─── 2. Update gap detection ─────────────────────

  const updateGap = detectUpdateGaps(entries, plantingDate, daysSincePlanting);
  if (updateGap.maxGapDays > 28 && season.status === 'active') {
    flags.push('update_gap_detected');
    reasons.push(`Longest gap between updates: ${updateGap.maxGapDays} days`);
    anomalies.push({ type: 'gap', issue: 'update_gap_detected', maxGapDays: updateGap.maxGapDays });
    scoreDeductions += Math.min(15, Math.floor(updateGap.maxGapDays / 7) * 3);
  }

  if (entries.length === 0 && daysSincePlanting > 14 && season.status === 'active') {
    flags.push('no_updates_logged');
    reasons.push('No progress entries logged despite season being active for over 2 weeks');
    scoreDeductions += 20;
  }

  // ─── 3. Stage progression consistency ────────────

  const stageIssues = checkStageProgression(season.stageConfirmations, entries, plantingDate, growingDays);
  for (const issue of stageIssues) {
    flags.push(issue.flag);
    reasons.push(issue.reason);
    anomalies.push({ type: 'stage', ...issue });
    scoreDeductions += issue.severity;
  }

  // ─── 4. Image validation ─────────────────────────

  const imageIssues = validateImageMetadata(entries, plantingDate, growingDays, season.status);
  for (const issue of imageIssues) {
    flags.push(issue.flag);
    reasons.push(issue.reason);
    anomalies.push({ type: 'image', ...issue });
    scoreDeductions += issue.severity;
  }

  // ─── 5. Harvest plausibility ─────────────────────

  if (season.harvestReport) {
    const harvestIssues = checkHarvestPlausibility(season, plantingDate, growingDays);
    for (const issue of harvestIssues) {
      flags.push(issue.flag);
      reasons.push(issue.reason);
      anomalies.push({ type: 'harvest', ...issue });
      scoreDeductions += issue.severity;
    }
  }

  // ─── 6. Advice consistency ───────────────────────

  const adviceEntries = entries.filter(e => e.followedAdvice);
  if (adviceEntries.length >= 3) {
    const allYes = adviceEntries.every(e => e.followedAdvice === 'yes');
    const allNo = adviceEntries.every(e => e.followedAdvice === 'no');
    if (allYes && adviceEntries.length > 5) {
      flags.push('advice_always_yes');
      reasons.push('Farmer reports following all advice every time — may lack nuance');
      anomalies.push({ type: 'advice', issue: 'advice_always_yes', count: adviceEntries.length });
      scoreDeductions += 5;
    }
    if (allNo) {
      flags.push('advice_never_followed');
      reasons.push('Farmer reports never following advice');
      scoreDeductions += 10;
    }
  }

  // ─── 7. Condition plausibility ───────────────────

  const conditionEntries = entries.filter(e => e.cropCondition);
  if (conditionEntries.length >= 3) {
    // Check for dramatic swings (poor → good in consecutive entries)
    for (let i = 1; i < conditionEntries.length; i++) {
      const prev = conditionEntries[i - 1].cropCondition;
      const curr = conditionEntries[i].cropCondition;
      const daysBetween = Math.floor(
        (new Date(conditionEntries[i].entryDate) - new Date(conditionEntries[i - 1].entryDate)) / (1000 * 60 * 60 * 24)
      );
      if (prev === 'poor' && curr === 'good' && daysBetween < 7) {
        flags.push('condition_rapid_recovery');
        reasons.push('Condition jumped from poor to good within a week — unusual recovery');
        anomalies.push({ type: 'condition', issue: 'condition_rapid_recovery', daysBetween });
        scoreDeductions += 8;
        break; // flag once
      }
    }
  }

  // ─── 8. Edge case flags ──────────────────────────

  if (season.cropFailureReported) {
    flags.push('crop_failure_reported');
    reasons.push('Crop failure was reported for this season');
    // Not a deduction — it's honest reporting
  }

  if (season.partialHarvest) {
    flags.push('partial_harvest_reported');
    reasons.push('Partial harvest was reported');
  }

  if (season.status === 'abandoned') {
    flags.push('season_abandoned');
    reasons.push('Season was abandoned');
    scoreDeductions += 5;
  }

  // ─── 9. Officer validation bonus ─────────────────

  const validations = season.officerValidations;
  let officerBonus = 0;
  if (validations.length > 0) {
    officerBonus += Math.min(15, validations.length * 5); // up to 15 bonus points
    reasons.push(`${validations.length} field officer validation(s) recorded`);
  }

  // ─── 10. Evidence coverage ───────────────────────

  const evidenceCoverage = computeEvidenceCoverage(entries, season.harvestReport, validations);

  // ─── Compute final score ─────────────────────────

  const rawScore = Math.max(0, Math.min(100, 100 - scoreDeductions + officerBonus));
  const credibilityScore = Math.round(rawScore);

  let credibilityLevel;
  if (credibilityScore >= 75) credibilityLevel = 'high_confidence';
  else if (credibilityScore >= 50) credibilityLevel = 'medium_confidence';
  else if (credibilityScore >= 25) credibilityLevel = 'low_confidence';
  else credibilityLevel = 'needs_review';

  // Confidence in our assessment (how much data do we have)
  let confidence = 'medium';
  const totalDataPoints = entries.length + season.stageConfirmations.length + validations.length;
  if (totalDataPoints >= 15) confidence = 'high';
  else if (totalDataPoints <= 3) confidence = 'low';

  // Add positive reasons
  if (flags.length === 0 && entries.length >= 5) {
    reasons.push('No data inconsistencies detected');
  }
  if (evidenceCoverage.imageCount >= 3) {
    reasons.push(`${evidenceCoverage.imageCount} progress images provide visual evidence`);
  }

  // ─── Persist ─────────────────────────────────────

  const result = await prisma.credibilityAssessment.upsert({
    where: { seasonId },
    update: {
      credibilityScore, credibilityLevel, flags, reasons, confidence,
      evidenceCoverage, anomalies, computedAt: new Date(),
    },
    create: {
      seasonId, credibilityScore, credibilityLevel, flags, reasons,
      confidence, evidenceCoverage, anomalies,
    },
  });

  return result;
}

export async function getCredibility(seasonId) {
  const existing = await prisma.credibilityAssessment.findUnique({ where: { seasonId } });
  if (!existing) {
    return computeCredibility(seasonId);
  }
  return existing;
}

/**
 * Multi-season credibility summary for a farmer.
 */
export async function getFarmerCredibilitySummary(farmerId) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { id: true, fullName: true, countryCode: true, region: true },
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
      credibilityAssessment: true,
      progressScore: true,
      harvestReport: true,
      officerValidations: true,
      _count: { select: { progressEntries: true, stageConfirmations: true } },
    },
  });

  // Compute credibility for any season missing it
  for (const s of seasons) {
    if (!s.credibilityAssessment) {
      try {
        s.credibilityAssessment = await computeCredibility(s.id);
      } catch { /* skip if fails */ }
    }
  }

  const assessed = seasons.filter(s => s.credibilityAssessment);

  const avgCredibility = assessed.length > 0
    ? Math.round(assessed.reduce((sum, s) => sum + s.credibilityAssessment.credibilityScore, 0) / assessed.length)
    : null;

  // Aggregate flags across seasons
  const allFlags = assessed.flatMap(s => s.credibilityAssessment.flags || []);
  const flagCounts = {};
  for (const f of allFlags) {
    flagCounts[f] = (flagCounts[f] || 0) + 1;
  }

  // Overall level
  let overallLevel = 'needs_review';
  if (avgCredibility !== null) {
    if (avgCredibility >= 75) overallLevel = 'high_confidence';
    else if (avgCredibility >= 50) overallLevel = 'medium_confidence';
    else if (avgCredibility >= 25) overallLevel = 'low_confidence';
  }

  // Trend
  let credibilityTrend = 'insufficient_data';
  if (assessed.length >= 2) {
    const recent = assessed[0].credibilityAssessment.credibilityScore;
    const older = assessed[assessed.length - 1].credibilityAssessment.credibilityScore;
    if (recent > older + 10) credibilityTrend = 'improving';
    else if (recent < older - 10) credibilityTrend = 'declining';
    else credibilityTrend = 'stable';
  }

  return {
    farmer: { id: farmer.id, fullName: farmer.fullName, region: farmer.region },
    overallCredibility: {
      avgScore: avgCredibility,
      level: overallLevel,
      trend: credibilityTrend,
      seasonsAssessed: assessed.length,
      totalSeasons: seasons.length,
    },
    recurringFlags: flagCounts,
    seasons: seasons.map(s => ({
      id: s.id,
      cropType: s.cropType,
      status: s.status,
      plantingDate: s.plantingDate,
      credibility: s.credibilityAssessment ? {
        score: s.credibilityAssessment.credibilityScore,
        level: s.credibilityAssessment.credibilityLevel,
        flags: s.credibilityAssessment.flags,
        confidence: s.credibilityAssessment.confidence,
      } : null,
      progressScore: s.progressScore ? {
        score: s.progressScore.progressScore,
        classification: s.progressScore.performanceClassification,
      } : null,
      officerValidations: s.officerValidations.length,
      dataPoints: s._count.progressEntries + s._count.stageConfirmations,
    })),
  };
}


// ─── Internal helpers ──────────────────────────────────

function detectUpdateGaps(entries, plantingDate, daysSincePlanting) {
  if (entries.length === 0) return { maxGapDays: daysSincePlanting, gaps: [] };

  const dates = [plantingDate, ...entries.map(e => new Date(e.entryDate))].sort((a, b) => a - b);
  let maxGap = 0;
  const gaps = [];

  for (let i = 1; i < dates.length; i++) {
    const gap = Math.floor((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
    if (gap > maxGap) maxGap = gap;
    if (gap > 21) {
      gaps.push({ from: dates[i - 1], to: dates[i], days: gap });
    }
  }

  return { maxGapDays: maxGap, gaps };
}

function checkStageProgression(confirmations, entries, plantingDate, growingDays) {
  const issues = [];

  if (confirmations.length < 2) return issues;

  // Check for backward stage jumps in confirmations
  for (let i = 1; i < confirmations.length; i++) {
    const prevIdx = STAGE_ORDER.indexOf(confirmations[i - 1].confirmedStage);
    const currIdx = STAGE_ORDER.indexOf(confirmations[i].confirmedStage);
    if (currIdx < prevIdx && currIdx >= 0 && prevIdx >= 0) {
      issues.push({
        flag: 'stage_regression',
        reason: `Stage went backward: ${confirmations[i - 1].confirmedStage} → ${confirmations[i].confirmedStage}`,
        severity: 10,
      });
      break;
    }
  }

  // Check for impossible fast progression (e.g., planting to harvest in < 30% of growing days)
  if (confirmations.length >= 2) {
    const first = confirmations[0];
    const last = confirmations[confirmations.length - 1];
    const firstIdx = STAGE_ORDER.indexOf(first.confirmedStage);
    const lastIdx = STAGE_ORDER.indexOf(last.confirmedStage);
    const daysBetween = Math.floor(
      (new Date(last.createdAt) - new Date(first.createdAt)) / (1000 * 60 * 60 * 24)
    );

    if (lastIdx - firstIdx >= 3 && daysBetween < growingDays * 0.3) {
      issues.push({
        flag: 'impossible_fast_progression',
        reason: `Jumped ${lastIdx - firstIdx} stages in ${daysBetween} days (growing period: ${growingDays} days)`,
        severity: 15,
      });
    }
  }

  // Check for high mismatch rate
  const mismatches = confirmations.filter(c => c.isMismatch);
  if (confirmations.length >= 3 && mismatches.length / confirmations.length > 0.5) {
    issues.push({
      flag: 'high_stage_mismatch',
      reason: `${mismatches.length}/${confirmations.length} stage confirmations mismatched expected stage`,
      severity: 8,
    });
  }

  return issues;
}

function validateImageMetadata(entries, plantingDate, growingDays, seasonStatus) {
  const issues = [];
  const imageEntries = entries.filter(e => e.imageUrl);

  if (imageEntries.length === 0) return issues;

  // Check: harvest image before harvest stage (60% of growing period)
  const harvestThresholdDays = growingDays * 0.6;
  for (const img of imageEntries) {
    if (!img.imageStage) continue;

    const daysSincePlanting = Math.floor(
      (new Date(img.entryDate) - plantingDate) / (1000 * 60 * 60 * 24)
    );

    // Harvest/storage image too early
    if ((img.imageStage === 'harvest' || img.imageStage === 'storage') && daysSincePlanting < harvestThresholdDays) {
      issues.push({
        flag: 'harvest_image_too_early',
        reason: `Harvest/storage image uploaded ${daysSincePlanting} days after planting (expected after ~${Math.round(harvestThresholdDays)} days)`,
        severity: 10,
        entryId: img.id,
      });
      break; // flag once
    }

    // Early growth image during post-harvest phase
    if (img.imageStage === 'early_growth' && daysSincePlanting > growingDays * 1.1) {
      issues.push({
        flag: 'early_image_in_post_harvest',
        reason: 'Early growth image uploaded during post-harvest phase',
        severity: 8,
        entryId: img.id,
      });
      break;
    }
  }

  // Check image sequence coherence (stages should generally progress forward)
  const stageOrder = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];
  const stagedImages = imageEntries.filter(e => e.imageStage).sort((a, b) => new Date(a.entryDate) - new Date(b.entryDate));

  if (stagedImages.length >= 3) {
    let regressions = 0;
    for (let i = 1; i < stagedImages.length; i++) {
      const prevIdx = stageOrder.indexOf(stagedImages[i - 1].imageStage);
      const currIdx = stageOrder.indexOf(stagedImages[i].imageStage);
      if (currIdx >= 0 && prevIdx >= 0 && currIdx < prevIdx) {
        regressions++;
      }
    }
    if (regressions >= 2) {
      issues.push({
        flag: 'image_stage_incoherent',
        reason: `Image stages regress ${regressions} time(s) — sequence not internally coherent`,
        severity: 8,
      });
    }
  }

  return issues;
}

function checkHarvestPlausibility(season, plantingDate, growingDays) {
  const issues = [];
  const report = season.harvestReport;
  if (!report) return issues;

  // Harvest too early (before 50% of growing period)
  const daysSincePlanting = Math.floor(
    (new Date(report.createdAt) - plantingDate) / (1000 * 60 * 60 * 24)
  );
  if (daysSincePlanting < growingDays * 0.5) {
    issues.push({
      flag: 'harvest_too_early',
      reason: `Harvest report submitted ${daysSincePlanting} days after planting (expected ~${growingDays} days)`,
      severity: 12,
    });
  }

  // Implausible yield per acre (extremely high)
  // Average maize yield in Kenya: ~400-800 kg/acre. Flag if > 5x that.
  if (report.yieldPerAcre && report.yieldPerAcre > 4000) {
    issues.push({
      flag: 'implausible_yield',
      reason: `Reported yield of ${report.yieldPerAcre} kg/acre is unusually high`,
      severity: 12,
    });
  }

  // Very low yield might indicate issues but is plausible (drought, pests)
  if (report.yieldPerAcre && report.yieldPerAcre < 10 && report.totalHarvestKg > 0) {
    issues.push({
      flag: 'very_low_yield',
      reason: `Reported yield of ${report.yieldPerAcre} kg/acre is very low`,
      severity: 3,
    });
  }

  return issues;
}

function computeEvidenceCoverage(entries, harvestReport, validations) {
  const imageEntries = entries.filter(e => e.imageUrl);
  const conditionEntries = entries.filter(e => e.cropCondition);
  const activityEntries = entries.filter(e => e.entryType === 'activity');
  const adviceEntries = entries.filter(e => e.followedAdvice);

  const imageStages = [...new Set(imageEntries.map(e => e.imageStage).filter(Boolean))];
  const expectedImageStages = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

  return {
    totalEntries: entries.length,
    activityCount: activityEntries.length,
    conditionCount: conditionEntries.length,
    adviceCount: adviceEntries.length,
    imageCount: imageEntries.length,
    imageStageCoverage: imageStages,
    imageStageCoverageRate: expectedImageStages.length > 0
      ? Math.round((imageStages.length / expectedImageStages.length) * 100) : 0,
    hasHarvestReport: !!harvestReport,
    officerValidationCount: validations.length,
    hasOfficerValidation: validations.length > 0,
  };
}
