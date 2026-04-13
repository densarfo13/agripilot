/**
 * Farroway Intelligence — Drone Service
 *
 * Drone scan ingestion and hotspot zone validation.
 * Deterministic validation scoring from existing hotspot data.
 * Uses exact hotspot formula component names for re-scoring.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import type { IngestDroneDto } from '../types/index.js';
import { clamp, computeHotspotScore, severityFromHotspotScore } from './scoring.service.js';
import { getStorage, storageKey } from '../infra/storage.js';

export async function ingestDroneScan(
  data: IngestDroneDto & { uploadedBy: string },
): Promise<{ scan: any; hotspotUpdate?: any }> {
  // Store image bundle if provided
  let storedUrl = data.imageBundleUrl;
  if (data.imageBundleUrl && data.imageBundleUrl.startsWith('data:')) {
    // Base64 data URI — store via storage provider
    const storage = getStorage();
    const buf = Buffer.from(data.imageBundleUrl.split(',')[1] || '', 'base64');
    const key = storageKey('drone', `${data.profileId}.zip`);
    storedUrl = await storage.put(key, buf, 'application/zip');
  }

  const scan = await prisma.v2DroneScan.create({
    data: {
      profileId: data.profileId,
      hotspotZoneId: data.hotspotZoneId ?? undefined,
      flightDate: new Date(data.flightDate),
      imageBundleUrl: storedUrl ?? undefined,
      metadata: data.metadata ?? undefined,
    },
  });

  let hotspotUpdate: any | undefined;
  if (data.hotspotZoneId) {
    const hotspot = await prisma.v2HotspotZone.findUnique({
      where: { id: data.hotspotZoneId },
    });

    if (!hotspot) {
      console.warn(`[Drone] Hotspot zone ${data.hotspotZoneId} not found`);
      return { scan };
    }

    // Deterministic validation: drone evidence acts as local_validation_evidence
    // Re-score the hotspot with the new evidence component
    const existingComponents = (hotspot.zoneGeoJson as any)?.properties?.components || {};
    const droneEvidence = clamp(hotspot.hotspotScore * 0.7 +
      (hotspot.severity === 'critical' ? 20 : hotspot.severity === 'high' ? 12 : 5));

    const rescored = computeHotspotScore({
      anomaly_intensity: existingComponents.anomaly_intensity ?? hotspot.hotspotScore,
      temporal_change: existingComponents.temporal_change ?? 30,
      cluster_compactness: existingComponents.cluster_compactness ?? 40,
      crop_sensitivity: existingComponents.crop_sensitivity ?? 50,
      local_validation_evidence: droneEvidence,
    });

    const validationScore = Math.round(rescored.score);

    let newStatus: string;
    let newSeverity: string | undefined;

    if (validationScore > 70) {
      newStatus = 'active';
      newSeverity = severityFromHotspotScore(validationScore);
    } else if (validationScore < 40) {
      newStatus = 'false_alarm';
    } else {
      newStatus = 'inspected';
    }

    await prisma.v2DroneScan.update({
      where: { id: scan.id },
      data: { validationScore },
    });

    const updateData: Record<string, any> = {
      status: newStatus,
      hotspotScore: validationScore,
    };
    if (newSeverity) updateData.severity = newSeverity;

    // Update GeoJSON with drone validation components
    updateData.zoneGeoJson = {
      ...(hotspot.zoneGeoJson as any),
      properties: {
        ...((hotspot.zoneGeoJson as any)?.properties || {}),
        components: rescored.components,
        droneValidated: true,
        droneValidationScore: validationScore,
      },
    };

    hotspotUpdate = await prisma.v2HotspotZone.update({
      where: { id: hotspot.id },
      data: updateData,
    });
  }

  return { scan, hotspotUpdate };
}

export async function getDroneScans(profileId: string, limit: number = 10): Promise<any[]> {
  return prisma.v2DroneScan.findMany({
    where: { profileId },
    orderBy: { flightDate: 'desc' },
    take: limit,
    include: { hotspotZone: true },
  });
}
