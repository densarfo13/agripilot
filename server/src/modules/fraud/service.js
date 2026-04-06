import prisma from '../../config/database.js';
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from '../regionConfig/service.js';

/**
 * Fraud Analysis Engine (Region-Aware)
 * Detects:
 * - Duplicate photo hashes across applications
 * - Same-device submissions for different farmers
 * - GPS proximity to other applications (region-configurable radius)
 * - Unusually high loan amounts for region/crop
 * - Missing or inconsistent data patterns
 * - Amount exceeding region max loan
 */
export async function runFraudAnalysis(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      farmLocation: true,
      evidenceFiles: true,
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const regionCfg = getRegionConfig(app.farmer.countryCode || DEFAULT_COUNTRY_CODE);
  const flags = [];
  const reasons = [];
  const matchedRecords = [];
  let riskScore = 0;

  // 1. Check duplicate photo hashes
  const photoHashes = app.evidenceFiles
    .filter(e => e.photoHash)
    .map(e => e.photoHash);

  if (photoHashes.length > 0) {
    const duplicates = await prisma.evidenceFile.findMany({
      where: {
        photoHash: { in: photoHashes },
        applicationId: { not: applicationId },
      },
      select: { id: true, applicationId: true, photoHash: true, type: true },
    });

    if (duplicates.length > 0) {
      riskScore += 30;
      flags.push('duplicate_photos');
      reasons.push(`${duplicates.length} evidence photo(s) found in other applications`);
      matchedRecords.push(...duplicates.map(d => ({
        type: 'duplicate_photo', applicationId: d.applicationId, evidenceId: d.id,
      })));
    }
  }

  // 2. Check device ID reuse across different farmers
  if (app.farmer.deviceId) {
    const sameDevice = await prisma.farmer.findMany({
      where: {
        deviceId: app.farmer.deviceId,
        id: { not: app.farmer.id },
      },
      select: { id: true, fullName: true },
    });

    if (sameDevice.length > 0) {
      riskScore += 20;
      flags.push('shared_device');
      reasons.push(`Device used by ${sameDevice.length} other farmer(s)`);
      matchedRecords.push(...sameDevice.map(f => ({
        type: 'shared_device', farmerId: f.id, farmerName: f.fullName,
      })));
    }
  }

  // 3. GPS proximity check — region-configurable radius
  if (app.farmLocation) {
    const PROXIMITY_DEG = regionCfg.fraudProximityDegrees || 0.001; // ~111m default
    const nearby = await prisma.farmLocation.findMany({
      where: {
        applicationId: { not: applicationId },
        latitude: { gte: app.farmLocation.latitude - PROXIMITY_DEG, lte: app.farmLocation.latitude + PROXIMITY_DEG },
        longitude: { gte: app.farmLocation.longitude - PROXIMITY_DEG, lte: app.farmLocation.longitude + PROXIMITY_DEG },
      },
      include: { application: { select: { id: true, farmerId: true } } },
    });

    const differentFarmerNearby = nearby.filter(n => n.application.farmerId !== app.farmerId);
    if (differentFarmerNearby.length > 0) {
      riskScore += 15;
      flags.push('gps_proximity');
      reasons.push(`${differentFarmerNearby.length} other application(s) from different farmers within ${Math.round(PROXIMITY_DEG * 111000)}m radius`);
      matchedRecords.push(...differentFarmerNearby.map(n => ({
        type: 'gps_proximity', applicationId: n.applicationId,
      })));
    }
  }

  // 4. Amount outlier check — region-aware
  const avgForCrop = await prisma.application.aggregate({
    where: { cropType: app.cropType, id: { not: applicationId } },
    _avg: { requestedAmount: true },
    _count: true,
  });

  if (avgForCrop._count > 2 && avgForCrop._avg.requestedAmount) {
    const ratio = app.requestedAmount / avgForCrop._avg.requestedAmount;
    if (ratio > 3) {
      riskScore += 15;
      flags.push('amount_outlier');
      reasons.push(`Requested amount is ${ratio.toFixed(1)}x the average for ${app.cropType}`);
    }
  }

  // 5. Region max loan check
  if (regionCfg.maxLoanAmount && app.requestedAmount > regionCfg.maxLoanAmount) {
    riskScore += 10;
    flags.push('exceeds_region_max');
    reasons.push(`Requested amount (${app.requestedAmount}) exceeds region maximum (${regionCfg.maxLoanAmount} ${regionCfg.currencyCode})`);
  }

  // 6. Region min loan check (suspiciously low — potential structuring or test fraud)
  if (regionCfg.minLoanAmount && app.requestedAmount < regionCfg.minLoanAmount) {
    riskScore += 5;
    flags.push('below_region_min');
    reasons.push(`Requested amount below region minimum (${regionCfg.minLoanAmount} ${regionCfg.currencyCode})`);
  }

  // 7. Missing critical data
  if (!app.farmLocation) { riskScore += 5; flags.push('no_gps'); reasons.push('No GPS location captured for farm'); }
  if (app.evidenceFiles.length === 0) { riskScore += 10; flags.push('no_evidence'); reasons.push('No evidence files uploaded'); }

  // Normalize risk score to 0-100
  riskScore = Math.min(100, riskScore);

  // Determine risk level and action
  let fraudRiskLevel, action;
  if (riskScore >= 70) {
    fraudRiskLevel = 'critical';
    action = 'block';
  } else if (riskScore >= 50) {
    fraudRiskLevel = 'high';
    action = 'hold';
  } else if (riskScore >= 25) {
    fraudRiskLevel = 'medium';
    action = 'review';
  } else {
    fraudRiskLevel = 'low';
    action = 'clear';
  }

  const result = await prisma.fraudResult.upsert({
    where: { applicationId },
    update: { fraudRiskScore: riskScore, fraudRiskLevel, action, flags, reasons, matchedRecords },
    create: { applicationId, fraudRiskScore: riskScore, fraudRiskLevel, action, flags, reasons, matchedRecords },
  });

  // Auto-hold if critical or high
  if (fraudRiskLevel === 'critical' || fraudRiskLevel === 'high') {
    try {
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: 'fraud_hold' },
      });
    } catch (statusErr) {
      // If status transition fails (e.g., already in a terminal state), log but don't block fraud result
      console.warn(`[FRAUD] Could not auto-hold application ${applicationId}: ${statusErr.message}`);
    }
  }

  return result;
}

/**
 * Inject intelligence summary into fraud result.
 * Called after intelligence engine runs.
 */
export async function injectIntelligenceSummary(applicationId, summary) {
  const existing = await prisma.fraudResult.findUnique({ where: { applicationId } });
  if (!existing) return null;

  return prisma.fraudResult.update({
    where: { applicationId },
    data: { intelligenceSummary: summary },
  });
}

export async function getFraudResult(applicationId) {
  return prisma.fraudResult.findUnique({ where: { applicationId } });
}
