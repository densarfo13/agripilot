/**
 * Farroway Intelligence — Satellite Service
 *
 * Satellite scan ingestion and field stress analysis.
 * Computes deterministic stress scoring from cloud cover and temporal delta.
 * Auto-generates hotspot zones using exact formula component names.
 *
 * IMPORTANT: Satellite must NEVER claim exact pest identity.
 * Outputs are stress/anomaly signals only.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import type { IngestSatelliteDto } from '../types/index.js';
import { severityFromHotspotScore, computeHotspotScore, clamp } from './scoring.service.js';
import { computeCropStageVulnerability } from './scoring.service.js';
import { getStorage, storageKey } from '../infra/storage.js';
import { farmHasValidBoundary } from './boundary-validation.service.js';

export async function ingestSatelliteScan(
  data: IngestSatelliteDto & { uploadedBy: string },
): Promise<{ scan: any; stressScore: any; hotspots: any[] }> {
  // Gate: require valid farm boundary before satellite intelligence
  const boundaryCheck = await farmHasValidBoundary(data.profileId);
  if (!boundaryCheck.valid) {
    throw new Error(`Boundary validation failed: ${boundaryCheck.reason}`);
  }

  const cloudCover = data.cloudCover ?? 0;
  if (cloudCover > 80) {
    throw new Error(`Cloud cover ${cloudCover}% exceeds 80% threshold — scan rejected`);
  }

  const scan = await prisma.v2SatelliteScan.create({
    data: {
      profileId: data.profileId,
      scanDate: new Date(data.scanDate),
      imagerySource: data.imagerySource ?? 'sentinel2',
      cloudCover,
      rawMetadata: data.rawMetadata ?? undefined,
    },
  });

  // Fetch previous stress for temporal comparison
  const previousStress = await prisma.v2FieldStressScore.findFirst({
    where: { profileId: data.profileId },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch farm profile for GPS + crop
  const profile = await prisma.farmProfile.findUnique({
    where: { id: data.profileId },
    select: { latitude: true, longitude: true, crop: true },
  });

  // Fetch crop cycle for vulnerability
  const cropCycle = await prisma.v2CropCycle.findFirst({
    where: { profileId: data.profileId },
    orderBy: { createdAt: 'desc' },
  });

  // ── Deterministic stress scoring ──
  const dataQuality = 100 - cloudCover;

  const stressScore = previousStress
    ? clamp(previousStress.stressScore * 0.6 + dataQuality * 0.4)
    : clamp(dataQuality * 0.55);

  const anomalyScore = previousStress
    ? clamp(Math.abs(stressScore - previousStress.stressScore) * 2.5 + (cloudCover > 40 ? 10 : 0))
    : clamp(dataQuality * 0.4);

  const temporalChangeScore = previousStress
    ? clamp(Math.abs(stressScore - previousStress.stressScore) * 2)
    : 0;

  const spreadScore = clamp(anomalyScore * 0.6 + temporalChangeScore * 0.4);

  const stressRecord = await prisma.v2FieldStressScore.create({
    data: {
      profileId: data.profileId,
      satelliteScanId: scan.id,
      stressScore: Math.round(stressScore * 100) / 100,
      anomalyScore: Math.round(anomalyScore * 100) / 100,
      temporalChangeScore: Math.round(temporalChangeScore * 100) / 100,
      spreadScore: Math.round(spreadScore * 100) / 100,
      hotspotCount: 0,
    },
  });

  // ── Auto-generate hotspot when anomaly exceeds threshold ──
  const hotspots: any[] = [];
  if (anomalyScore > 60) {
    // Compute hotspot score using EXACT formula component names
    const cropType = cropCycle?.cropType || profile?.crop || '';
    const growthStage = cropCycle?.growthStage || 'vegetative';
    const cropSensitivity = computeCropStageVulnerability(cropType, growthStage);

    const hotspotResult = computeHotspotScore({
      anomaly_intensity: anomalyScore,
      temporal_change: temporalChangeScore,
      cluster_compactness: spreadScore,
      crop_sensitivity: cropSensitivity,
      local_validation_evidence: 0, // no drone/farmer validation yet
    });

    const severity = severityFromHotspotScore(hotspotResult.score);
    const hotspot = await prisma.v2HotspotZone.create({
      data: {
        profileId: data.profileId,
        sourceType: 'satellite',
        zoneGeoJson: {
          type: 'Feature',
          properties: {
            source: 'satellite',
            scanId: scan.id,
            components: hotspotResult.components,
          },
          geometry: {
            type: 'Point',
            coordinates: [profile?.longitude ?? 0, profile?.latitude ?? 0],
          },
        },
        hotspotScore: Math.round(hotspotResult.score * 100) / 100,
        severity,
        inspectionPriority: hotspotResult.score > 80 ? 1 : hotspotResult.score > 70 ? 2 : 3,
        status: 'active',
      },
    });
    hotspots.push(hotspot);

    await prisma.v2FieldStressScore.update({
      where: { id: stressRecord.id },
      data: { hotspotCount: hotspots.length },
    });
  }

  return { scan, stressScore: stressRecord, hotspots };
}

export async function getLatestFieldStress(profileId: string): Promise<any | null> {
  return prisma.v2FieldStressScore.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    include: { satelliteScan: true },
  });
}

export async function getFieldStressHistory(profileId: string, limit: number = 10): Promise<any[]> {
  return prisma.v2FieldStressScore.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { satelliteScan: true },
  });
}
