/**
 * Farroway Intelligence — Satellite Service
 *
 * Satellite scan ingestion and field stress analysis.
 * Handles NDVI-based stress scoring (stubbed) and automatic hotspot generation.
 */

// @ts-ignore — JS module
import prisma from '../../lib/prisma.js';
import type { IngestSatelliteDto } from '../types/index.js';
import { severityFromHotspotScore } from './scoring.service.js';

// ── Helpers ──

/** Clamp a value between min and max. */
function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/** Generate a random number in [min, max). */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Public API ──

/**
 * Ingest a new satellite scan, compute field stress scores, and auto-generate
 * hotspot zones when anomaly thresholds are exceeded.
 *
 * @param data - Satellite DTO merged with the uploading user's ID.
 * @returns The created scan, stress score record, and any generated hotspots.
 * @throws If cloud cover exceeds 80% (scan is unusable).
 */
export async function ingestSatelliteScan(
  data: IngestSatelliteDto & { uploadedBy: string },
): Promise<{ scan: any; stressScore: any; hotspots: any[] }> {
  try {
    // 1. Reject unusable scans
    const cloudCover = data.cloudCover ?? 0;
    if (cloudCover > 80) {
      throw new Error(
        `[Satellite] Cloud cover ${cloudCover}% exceeds 80% threshold — scan rejected`,
      );
    }

    // 2. Create the satellite scan record
    const scan = await prisma.v2SatelliteScan.create({
      data: {
        profileId: data.profileId,
        scanDate: new Date(data.scanDate),
        imagerySource: data.imagerySource ?? 'sentinel2',
        cloudCover,
        rawMetadata: data.rawMetadata ?? undefined,
      },
    });
    console.log(`[Satellite] Created scan ${scan.id} for profile ${data.profileId}`);

    // 3. Compute field stress scores (stubs for real NDVI pipeline)
    const cloudPenalty = cloudCover / 100; // 0-0.8 range since we reject > 80

    // Base stress: random 30-70, penalized by cloud cover (less reliable data = higher uncertainty)
    const stressBase = randomInRange(30, 70);
    const stressScore = clamp(stressBase + cloudPenalty * 15);

    // Base anomaly: random 20-60, boost when stress is elevated
    const anomalyBase = randomInRange(20, 60);
    const anomalyScore = clamp(
      stressScore > 50 ? anomalyBase + (stressScore - 50) * 0.5 : anomalyBase,
    );

    // Temporal change: compare with the most recent scan for this profile
    let temporalChangeScore = 0;
    const previousStress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId: data.profileId },
      orderBy: { createdAt: 'desc' },
    });
    if (previousStress) {
      temporalChangeScore = clamp(
        Math.abs(stressScore - previousStress.stressScore) * 2,
      );
    }

    // Spread score: derived from anomaly and temporal signals
    const spreadScore = clamp(
      anomalyScore * 0.6 + temporalChangeScore * 0.4,
    );

    // 4. Persist the stress score record
    const stressRecord = await prisma.v2FieldStressScore.create({
      data: {
        profileId: data.profileId,
        satelliteScanId: scan.id,
        stressScore: Math.round(stressScore * 100) / 100,
        anomalyScore: Math.round(anomalyScore * 100) / 100,
        temporalChangeScore: Math.round(temporalChangeScore * 100) / 100,
        spreadScore: Math.round(spreadScore * 100) / 100,
        hotspotCount: 0, // updated below if hotspots are generated
      },
    });
    console.log(
      `[Satellite] Stress scores — stress: ${stressRecord.stressScore}, ` +
        `anomaly: ${stressRecord.anomalyScore}, temporal: ${stressRecord.temporalChangeScore}`,
    );

    // 5. Auto-generate hotspot zones when anomaly exceeds threshold
    const hotspots: any[] = [];
    if (anomalyScore > 60) {
      const severity = severityFromHotspotScore(anomalyScore);
      const hotspot = await prisma.v2HotspotZone.create({
        data: {
          profileId: data.profileId,
          sourceType: 'satellite',
          zoneGeoJson: {
            type: 'Feature',
            properties: {
              source: 'satellite',
              scanId: scan.id,
              anomalyScore,
            },
            geometry: {
              type: 'Point',
              coordinates: [0, 0], // Would contain real coordinates from NDVI analysis
            },
          },
          hotspotScore: Math.round(anomalyScore * 100) / 100,
          severity,
          inspectionPriority: anomalyScore > 80 ? 1 : anomalyScore > 70 ? 2 : 3,
          status: 'active',
        },
      });
      hotspots.push(hotspot);

      // Update hotspot count on the stress record
      await prisma.v2FieldStressScore.update({
        where: { id: stressRecord.id },
        data: { hotspotCount: hotspots.length },
      });

      console.log(
        `[Satellite] Auto-generated hotspot ${hotspot.id} — severity: ${severity}`,
      );
    }

    return { scan, stressScore: stressRecord, hotspots };
  } catch (error) {
    console.error('[Satellite] ingestSatelliteScan failed:', error);
    throw error;
  }
}

/**
 * Retrieve the most recent field stress score for a farm profile,
 * including the associated satellite scan.
 *
 * @param profileId - The farm profile UUID.
 * @returns The latest stress score or null if none exist.
 */
export async function getLatestFieldStress(
  profileId: string,
): Promise<any | null> {
  try {
    const stress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      include: { satelliteScan: true },
    });
    return stress;
  } catch (error) {
    console.error('[Satellite] getLatestFieldStress failed:', error);
    throw error;
  }
}

/**
 * Retrieve an ordered history of field stress scores for a farm profile.
 *
 * @param profileId - The farm profile UUID.
 * @param limit - Maximum records to return (default 10).
 * @returns Array of stress score records, newest first.
 */
export async function getFieldStressHistory(
  profileId: string,
  limit: number = 10,
): Promise<any[]> {
  try {
    const history = await prisma.v2FieldStressScore.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { satelliteScan: true },
    });
    return history;
  } catch (error) {
    console.error('[Satellite] getFieldStressHistory failed:', error);
    throw error;
  }
}
