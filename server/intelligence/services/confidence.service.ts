/**
 * Confidence & Uncertainty Service
 *
 * Computes diagnosis confidence from multiple signals,
 * determines uncertainty, and always provides an alternative issue.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import { computeAlertConfidence } from './scoring.service.js';
import type { AlertConfidenceComponents } from '../types/index.js';

const UNCERTAINTY_THRESHOLD = 55; // below this = uncertain

// Alternative issue mapping (what else could it be?)
const ALTERNATIVE_MAP: Record<string, string> = {
  pest: 'disease',
  disease: 'nutrient_deficiency',
  nutrient_deficiency: 'water_heat_stress',
  water_heat_stress: 'nutrient_deficiency',
  uncertain: 'pest',
};

export interface DiagnosisConfidenceResult {
  likelyIssue: string;
  alternativeIssue: string;
  confidenceScore: number;
  severityScore: number;
  isUncertain: boolean;
  riskLevel: string;
  confidenceComponents: AlertConfidenceComponents;
}

/**
 * Compute diagnosis confidence from available signals for a report.
 */
export async function computeDiagnosisConfidence(
  profileId: string,
  imageIds: string[],
  verificationScore: number,
  riskScore: number,
  riskLevel: string,
): Promise<DiagnosisConfidenceResult> {
  // 1. Model confidence: average detection confidence from images
  const detections = await prisma.v2ImageDetection.findMany({
    where: { imageId: { in: imageIds } },
    select: { confidenceScore: true, likelyIssue: true, severityScore: true, alternativeIssue: true },
  });

  const modelConfidence = detections.length > 0
    ? detections.reduce((s: number, d: any) => s + d.confidenceScore, 0) / detections.length
    : 30; // no detections = low confidence

  // 2. Signal agreement: do detections agree on the issue?
  const issues = detections.map((d: any) => d.likelyIssue);
  const uniqueIssues = new Set(issues);
  const signalAgreement = uniqueIssues.size <= 1 ? 80 : uniqueIssues.size === 2 ? 50 : 25;

  // 3. Data quality: based on number of images and verification
  const dataQuality = Math.min(100,
    (imageIds.length >= 3 ? 40 : imageIds.length * 15) + (verificationScore > 0 ? 30 : 0) + 20,
  );

  // 4. Spatial relevance: whether nearby farms (same region) have similar issues
  const currentProfile = await prisma.farmProfile.findUnique({
    where: { id: profileId },
    select: { locationName: true },
  });
  const nearbyRisks = await prisma.v2FarmPestRisk.findMany({
    where: {
      profileId: { not: profileId },
      computedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      riskLevel: { in: ['high', 'urgent'] },
      ...(currentProfile?.locationName
        ? { profile: { locationName: currentProfile.locationName } }
        : {}),
    },
    take: 5,
    select: { overallRiskScore: true },
  });
  const spatialRelevance = nearbyRisks.length > 0
    ? Math.min(100, nearbyRisks.length * 20)
    : 10;

  // 5. Trend strength: is this a new or recurring issue?
  const pastReports = await prisma.v2PestReport.count({
    where: {
      profileId,
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });
  const recentTrendStrength = Math.min(100, pastReports * 25);

  const components: AlertConfidenceComponents = {
    model_confidence: modelConfidence,
    signal_agreement: signalAgreement,
    data_quality: dataQuality,
    spatial_relevance: spatialRelevance,
    recent_trend_strength: recentTrendStrength,
  };

  const result = computeAlertConfidence(components);
  const confidenceScore = Math.round(result.score);
  const isUncertain = confidenceScore < UNCERTAINTY_THRESHOLD;

  // Determine likely issue from detections or fallback
  const dominant = findDominantIssue(issues);
  const likelyIssue = isUncertain && dominant === 'uncertain' ? 'uncertain' : dominant;
  const alternativeIssue = ALTERNATIVE_MAP[likelyIssue] || 'uncertain';

  // Average severity
  const severityScore = detections.length > 0
    ? Math.round(detections.reduce((s: number, d: any) => s + d.severityScore, 0) / detections.length)
    : Math.round(riskScore * 0.6);

  return {
    likelyIssue,
    alternativeIssue,
    confidenceScore,
    severityScore,
    isUncertain,
    riskLevel,
    confidenceComponents: components,
  };
}

function findDominantIssue(issues: string[]): string {
  if (issues.length === 0) return 'uncertain';
  const counts: Record<string, number> = {};
  for (const i of issues) counts[i] = (counts[i] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}
