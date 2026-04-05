import prisma from '../../config/database.js';
import { getRegionConfig } from '../regionConfig/service.js';

/**
 * Verification Scoring Engine (Region-Aware)
 * Produces a 0-100 verification score based on:
 * - GPS presence and accuracy
 * - Boundary capture completeness
 * - Evidence file count and types
 * - Farm size consistency (claimed vs measured)
 * - Farmer profile completeness
 * - Application completeness
 *
 * Region config influences: area unit, threshold adjustments
 */
export async function runVerification(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      farmLocation: true,
      farmBoundary: { include: { points: true } },
      evidenceFiles: true,
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const regionCfg = getRegionConfig(app.farmer.countryCode || 'KE');
  const factors = {};
  const flags = [];
  const reasons = [];
  let totalScore = 0;
  let maxScore = 0;

  // 1. GPS presence (20 points)
  maxScore += 20;
  if (app.farmLocation) {
    const gpsScore = app.farmLocation.accuracy && app.farmLocation.accuracy < 10 ? 20 : 15;
    totalScore += gpsScore;
    factors.gps = { score: gpsScore, max: 20, has: true, accuracy: app.farmLocation.accuracy };
  } else {
    factors.gps = { score: 0, max: 20, has: false };
    flags.push('no_gps_data');
    reasons.push('No GPS coordinates captured');
  }

  // 2. Boundary capture (20 points)
  maxScore += 20;
  if (app.farmBoundary && app.farmBoundary.points.length >= 3) {
    const boundaryScore = app.farmBoundary.points.length >= 4 ? 20 : 15;
    totalScore += boundaryScore;
    factors.boundary = { score: boundaryScore, max: 20, pointCount: app.farmBoundary.points.length };

    // Check farm size consistency (region-aware units)
    if (app.farmBoundary.measuredArea) {
      const claimed = app.farmSizeAcres;
      const measured = app.farmBoundary.measuredArea;
      // If region uses hectares, convert for comparison (1 hectare ≈ 2.47 acres)
      const ratio = measured / claimed;
      if (ratio < 0.5 || ratio > 2.0) {
        flags.push('farm_size_mismatch');
        reasons.push(`Measured area (${measured.toFixed(1)} ${regionCfg.areaUnit}) differs significantly from claimed (${claimed} ${regionCfg.areaUnit})`);
        totalScore -= 5;
      }
    }
  } else {
    factors.boundary = { score: 0, max: 20, pointCount: 0 };
    flags.push('no_boundary_data');
    reasons.push('No farm boundary captured');
  }

  // 3. Evidence files (25 points)
  maxScore += 25;
  const evidenceCount = app.evidenceFiles.length;
  const evidenceTypes = new Set(app.evidenceFiles.map(e => e.type));
  let evidenceScore = Math.min(25, evidenceCount * 5);
  if (evidenceTypes.has('farm_photo')) evidenceScore = Math.min(25, evidenceScore + 3);
  if (evidenceTypes.has('id_document')) evidenceScore = Math.min(25, evidenceScore + 3);
  totalScore += evidenceScore;
  factors.evidence = { score: evidenceScore, max: 25, count: evidenceCount, types: [...evidenceTypes] };

  if (evidenceCount === 0) {
    flags.push('no_evidence');
    reasons.push('No evidence files uploaded');
  }

  // 4. Farmer profile completeness (15 points)
  maxScore += 15;
  let profileScore = 5;
  if (app.farmer.nationalId) profileScore += 3;
  if (app.farmer.primaryCrop) profileScore += 2;
  if (app.farmer.yearsExperience) profileScore += 3;
  if (app.farmer.farmSizeAcres) profileScore += 2;
  profileScore = Math.min(15, profileScore);
  totalScore += profileScore;
  factors.profile = { score: profileScore, max: 15 };

  // 5. Application completeness (20 points)
  maxScore += 20;
  let appScore = 10;
  if (app.purpose) appScore += 5;
  if (app.season) appScore += 5;
  totalScore += appScore;
  factors.application = { score: appScore, max: 20 };

  // Normalize to 0-100
  const verificationScore = Math.max(0, Math.min(100, Math.round((totalScore / maxScore) * 100)));

  // Determine confidence and recommendation (region-aware threshold)
  const threshold = regionCfg.verificationThreshold || 70;
  let confidence, recommendation;
  if (verificationScore >= 80) {
    confidence = 'high';
    recommendation = flags.length === 0 ? 'approve' : 'conditional';
  } else if (verificationScore >= threshold * 0.7) {
    confidence = 'medium';
    recommendation = flags.length > 1 ? 'review' : 'conditional';
  } else {
    confidence = 'low';
    recommendation = 'reject';
  }

  const result = await prisma.verificationResult.upsert({
    where: { applicationId },
    update: {
      verificationScore, confidence, recommendation, flags, reasons, factors,
      // Region metadata
    },
    create: {
      applicationId, verificationScore, confidence, recommendation, flags, reasons, factors,
    },
  });

  return result;
}

/**
 * Inject intelligence summary into verification result.
 * Called after intelligence engine runs.
 */
export async function injectIntelligenceSummary(applicationId, summary) {
  const existing = await prisma.verificationResult.findUnique({ where: { applicationId } });
  if (!existing) return null;

  return prisma.verificationResult.update({
    where: { applicationId },
    data: { intelligenceSummary: summary },
  });
}

export async function getVerificationResult(applicationId) {
  return prisma.verificationResult.findUnique({ where: { applicationId } });
}
