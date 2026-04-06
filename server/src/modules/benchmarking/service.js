import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

/**
 * Benchmarking Engine (Region-Aware)
 * Compares an application against its peer group (same crop type + region).
 * Produces percentile rankings and highlights strengths/concerns.
 * Uses region config for contextual comparisons.
 */
export async function runBenchmark(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      verificationResult: true,
      farmBoundary: true,
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const regionCfg = getRegionConfig(app.farmer.countryCode || DEFAULT_COUNTRY_CODE);

  // Find peer group — same crop type, same region
  const peers = await prisma.application.findMany({
    where: {
      cropType: app.cropType,
      farmer: { region: app.farmer.region },
      id: { not: applicationId },
    },
    include: {
      verificationResult: true,
      farmer: true,
    },
  });

  const peerGroupSize = peers.length;
  const strengths = [];
  const concerns = [];

  // Verification percentile
  let verificationPercentile = null;
  if (app.verificationResult && peerGroupSize > 0) {
    const peerScores = peers
      .filter(p => p.verificationResult)
      .map(p => p.verificationResult.verificationScore)
      .sort((a, b) => a - b);

    if (peerScores.length > 0) {
      const below = peerScores.filter(s => s < app.verificationResult.verificationScore).length;
      verificationPercentile = Math.round((below / peerScores.length) * 100);

      if (verificationPercentile >= 75) {
        strengths.push(`Verification score is in the top ${100 - verificationPercentile}% for ${app.cropType} in ${app.farmer.region}`);
      } else if (verificationPercentile < 25) {
        concerns.push(`Verification score is in the bottom 25% for peer group`);
      }
    }
  }

  // Yield proxy — farm size per requested amount (efficiency)
  let yieldPercentile = null;
  if (peerGroupSize > 0) {
    const peerRatios = peers
      .filter(p => p.farmSizeAcres > 0)
      .map(p => p.requestedAmount / p.farmSizeAcres)
      .sort((a, b) => a - b);

    if (peerRatios.length > 0 && app.farmSizeAcres > 0) {
      const appRatio = app.requestedAmount / app.farmSizeAcres;
      const below = peerRatios.filter(r => r < appRatio).length;
      yieldPercentile = Math.round((below / peerRatios.length) * 100);

      if (yieldPercentile > 90) {
        concerns.push(`Loan-per-${regionCfg.areaUnit} ratio is unusually high compared to peers`);
      } else if (yieldPercentile < 30) {
        strengths.push(`Conservative loan-per-${regionCfg.areaUnit} ratio relative to peer group`);
      }
    }
  }

  // Experience comparison
  let repaymentPercentile = null;
  if (app.farmer.yearsExperience && peerGroupSize > 0) {
    const peerExp = peers
      .filter(p => p.farmer.yearsExperience)
      .map(p => p.farmer.yearsExperience)
      .sort((a, b) => a - b);

    if (peerExp.length > 0) {
      const below = peerExp.filter(e => e < app.farmer.yearsExperience).length;
      repaymentPercentile = Math.round((below / peerExp.length) * 100);

      if (repaymentPercentile >= 70) {
        strengths.push(`Farmer has more experience than ${repaymentPercentile}% of peers`);
      }
    }
  }

  // Additional observations
  if (app.farmSizeAcres > 0 && peerGroupSize > 0) {
    const avgSize = peers.reduce((sum, p) => sum + p.farmSizeAcres, 0) / peerGroupSize;
    if (app.farmSizeAcres > avgSize * 1.5) {
      strengths.push(`Farm size is ${(app.farmSizeAcres / avgSize).toFixed(1)}x the peer average`);
    }
  }

  if (peerGroupSize < 3) {
    concerns.push(`Small peer group (${peerGroupSize}) in ${regionCfg.country} — benchmarks may not be statistically significant`);
  }

  const result = await prisma.benchmarkResult.upsert({
    where: { applicationId },
    update: { peerGroupSize, verificationPercentile, yieldPercentile, repaymentPercentile, strengths, concerns },
    create: { applicationId, peerGroupSize, verificationPercentile, yieldPercentile, repaymentPercentile, strengths, concerns },
  });

  return result;
}

export async function getBenchmarkResult(applicationId) {
  return prisma.benchmarkResult.findUnique({ where: { applicationId } });
}
