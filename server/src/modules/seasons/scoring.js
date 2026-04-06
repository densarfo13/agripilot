import prisma from '../../config/database.js';
import { getSeasonComparison } from './comparison.js';

/**
 * Progress Scoring Service
 *
 * Computes a season performance score from the comparison dimensions.
 * Score is 0-100 with explainable factors and classification.
 *
 * Contributing factors (weights):
 *   - Stage alignment:       25%
 *   - Activity consistency:  25%
 *   - Crop condition:        20%
 *   - Advice adherence:      15%
 *   - Image progression:     15%
 *
 * Classifications:
 *   - 75-100: On Track
 *   - 55-74:  Slight Delay
 *   - 35-54:  At Risk
 *   - 0-34:   Critical
 *
 * All logic is rule-based and transparent.
 */

const STATUS_SCORES = {
  on_track: 100,
  slight_delay: 60,
  at_risk: 25,
  critical: 10,
  unknown: 40, // partial credit for unknown (no data yet)
};

const WEIGHTS = {
  stageAlignment: 0.25,
  activityConsistency: 0.25,
  cropCondition: 0.20,
  adviceAdherence: 0.15,
  imageProgression: 0.15,
};

export async function computeProgressScore(seasonId) {
  const comparison = await getSeasonComparison(seasonId);
  const dims = comparison.dimensions;

  const factors = {};
  const reasons = [];

  // ─── Score each dimension ─────────────────────────

  // 1. Stage alignment
  const stageScore = STATUS_SCORES[dims.stageAlignment.status] || 40;
  factors.stageAlignment = {
    score: stageScore,
    weight: WEIGHTS.stageAlignment,
    weighted: Math.round(stageScore * WEIGHTS.stageAlignment),
    label: dims.stageAlignment.label,
  };
  if (dims.stageAlignment.status === 'at_risk') {
    reasons.push(`Stage significantly behind: farmer at ${dims.stageAlignment.actualStage || 'unknown'}, expected ${dims.stageAlignment.expectedStage}`);
  } else if (dims.stageAlignment.status === 'slight_delay') {
    reasons.push(`Stage slightly behind expected progress`);
  }

  // 2. Activity consistency
  const activityScore = STATUS_SCORES[dims.activityConsistency.status] || 40;
  factors.activityConsistency = {
    score: activityScore,
    weight: WEIGHTS.activityConsistency,
    weighted: Math.round(activityScore * WEIGHTS.activityConsistency),
    label: dims.activityConsistency.label,
  };
  if (dims.activityConsistency.status === 'at_risk') {
    reasons.push(`Low activity logging: ${dims.activityConsistency.totalEntries} entries (expected ~${dims.activityConsistency.expectedEntries})`);
  }

  // 3. Crop condition
  const conditionScore = STATUS_SCORES[dims.cropCondition.status] || 40;
  factors.cropCondition = {
    score: conditionScore,
    weight: WEIGHTS.cropCondition,
    weighted: Math.round(conditionScore * WEIGHTS.cropCondition),
    label: dims.cropCondition.label,
  };
  if (dims.cropCondition.latestCondition === 'poor') {
    reasons.push('Crop condition reported as poor');
  }
  if (dims.cropCondition.trend === 'declining') {
    reasons.push('Crop condition trend is declining');
  }

  // 4. Advice adherence
  const adviceScore = dims.adviceAdherence.adherenceRate !== null
    ? dims.adviceAdherence.adherenceRate
    : STATUS_SCORES.unknown;
  factors.adviceAdherence = {
    score: adviceScore,
    weight: WEIGHTS.adviceAdherence,
    weighted: Math.round(adviceScore * WEIGHTS.adviceAdherence),
    label: dims.adviceAdherence.label,
  };
  if (dims.adviceAdherence.adherenceRate !== null && dims.adviceAdherence.adherenceRate < 40) {
    reasons.push(`Low advice adherence: ${dims.adviceAdherence.adherenceRate}%`);
  }

  // 5. Image progression
  const imageScore = dims.imageProgression.totalImages > 0
    ? Math.min(100, dims.imageProgression.coverageRate + (dims.imageProgression.totalImages > 3 ? 20 : 0))
    : STATUS_SCORES.unknown;
  factors.imageProgression = {
    score: imageScore,
    weight: WEIGHTS.imageProgression,
    weighted: Math.round(imageScore * WEIGHTS.imageProgression),
    label: dims.imageProgression.label,
  };
  if (dims.imageProgression.totalImages === 0) {
    reasons.push('No progress images uploaded');
  }

  // ─── Compute weighted total ───────────────────────

  const progressScore = Math.round(
    factors.stageAlignment.weighted +
    factors.activityConsistency.weighted +
    factors.cropCondition.weighted +
    factors.adviceAdherence.weighted +
    factors.imageProgression.weighted
  );

  // ─── Classification ───────────────────────────────

  let performanceClassification;
  let riskLevel;

  if (progressScore >= 75) {
    performanceClassification = 'on_track';
    riskLevel = 'low';
  } else if (progressScore >= 55) {
    performanceClassification = 'slight_delay';
    riskLevel = 'medium';
  } else if (progressScore >= 35) {
    performanceClassification = 'at_risk';
    riskLevel = 'high';
  } else {
    performanceClassification = 'critical';
    riskLevel = 'high';
  }

  // Add positive reasons if score is good
  if (reasons.length === 0 && progressScore >= 75) {
    reasons.push('Season progressing well across all dimensions');
  }
  if (dims.cropCondition.trend === 'improving') {
    reasons.push('Crop condition trend is improving');
  }
  if (dims.adviceAdherence.adherenceRate !== null && dims.adviceAdherence.adherenceRate >= 80) {
    reasons.push(`Strong advice adherence: ${dims.adviceAdherence.adherenceRate}%`);
  }

  // ─── Persist score ────────────────────────────────

  const result = await prisma.progressScore.upsert({
    where: { seasonId },
    update: { progressScore, riskLevel, performanceClassification, factors, reasons },
    create: { seasonId, progressScore, riskLevel, performanceClassification, factors, reasons },
  });

  return {
    ...result,
    comparison, // include full comparison for context
  };
}

export async function getProgressScore(seasonId) {
  const existing = await prisma.progressScore.findUnique({ where: { seasonId } });
  if (!existing) {
    // Compute on first request
    return computeProgressScore(seasonId);
  }
  return existing;
}

/**
 * Classification labels for display.
 */
export const CLASSIFICATION_LABELS = {
  on_track: { label: 'On Track', color: '#16a34a', description: 'Season progressing well' },
  slight_delay: { label: 'Slight Delay', color: '#d97706', description: 'Minor gaps — monitor closely' },
  at_risk: { label: 'At Risk', color: '#dc2626', description: 'Intervention needed' },
  critical: { label: 'Critical', color: '#7f1d1d', description: 'Serious issues — immediate action required' },
};
