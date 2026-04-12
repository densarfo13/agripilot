// ─── Satellite Service ─────────────────────────────────────────────────────
// Satellite scan ingestion, field stress computation, and hotspot generation.
// Remote sensing analysis is stubbed — DB operations are production-ready.

import prisma from '../../lib/prisma.js';
import { computeHotspotScore } from './scoringEngine.js';

/**
 * Clamp a value to 0–100.
 * @param {number} v
 * @returns {number}
 */
function clamp(v) {
  return Math.min(100, Math.max(0, v));
}

/**
 * Ingest a satellite scan, validate inputs, create the DB record, then compute field stress.
 *
 * @param {object} params
 * @param {string} params.profileId - FarmProfile ID
 * @param {Date|string} params.scanDate - Date of the satellite scan
 * @param {string} [params.imagerySource='sentinel2'] - Imagery provider
 * @param {number|null} [params.cloudCover] - Cloud cover percentage (0-100)
 * @param {object|null} [params.rawMetadata] - Raw satellite metadata
 * @returns {Promise<{ scan: object|null, stressScore: object|null, error: string|null }>}
 */
export async function ingestSatelliteScan({ profileId, scanDate, imagerySource = 'sentinel2', cloudCover = null, rawMetadata = null }) {
  try {
    // Validate inputs
    if (!profileId) return { scan: null, stressScore: null, error: 'profileId is required' };
    if (!scanDate) return { scan: null, stressScore: null, error: 'scanDate is required' };

    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId } });
    if (!profile) return { scan: null, stressScore: null, error: 'farm_profile_not_found' };

    const parsedDate = scanDate instanceof Date ? scanDate : new Date(scanDate);
    if (isNaN(parsedDate.getTime())) return { scan: null, stressScore: null, error: 'invalid_scan_date' };

    const validatedCloudCover = cloudCover != null ? clamp(cloudCover) : null;

    // Compute a scan confidence based on cloud cover (less cloud = higher confidence)
    const scanConfidence = validatedCloudCover != null
      ? clamp(100 - validatedCloudCover * 0.8)
      : 75; // default when cloud cover unknown

    // Create scan record
    const scan = await prisma.v2SatelliteScan.create({
      data: {
        profileId,
        scanDate: parsedDate,
        imagerySource,
        cloudCover: validatedCloudCover,
        scanConfidence,
        rawMetadata,
      },
    });

    console.log(`[Intelligence] Satellite scan ingested: id=${scan.id}, profile=${profileId}, source=${imagerySource}`);

    // Compute field stress from this scan
    const stressResult = await computeFieldStress(scan.id);

    return { scan, stressScore: stressResult.stressScore, error: null };
  } catch (error) {
    console.error('[Intelligence] Satellite scan ingestion failed:', error.message);
    return { scan: null, stressScore: null, error: error.message };
  }
}

/**
 * Compute field stress from a satellite scan.
 *
 * STUB: Replace with real remote sensing analysis (NDVI differencing,
 * thermal anomaly detection, etc.). Current implementation generates
 * realistic scores based on cloud cover and random variation.
 * DB operations are production-ready.
 *
 * @param {string} scanId - V2SatelliteScan ID
 * @returns {Promise<{ stressScore: object|null, hotspots: object[], error: string|null }>}
 */
export async function computeFieldStress(scanId) {
  try {
    const scan = await prisma.v2SatelliteScan.findUnique({ where: { id: scanId } });
    if (!scan) return { stressScore: null, hotspots: [], error: 'scan_not_found' };

    // STUB: Replace with real remote sensing analysis
    // Real implementation would:
    //   1. Fetch satellite imagery tiles for the farm boundary
    //   2. Compute NDVI, NDWI, thermal indices
    //   3. Compare against baseline / previous scan
    //   4. Detect anomaly clusters

    // Cloud cover degrades quality — higher cloud = more noise, lower confidence
    const cloudPenalty = scan.cloudCover ? scan.cloudCover * 0.4 : 0;
    const baseStress = 15 + Math.random() * 55; // 15-70 base range
    const stressScore = clamp(baseStress + (Math.random() - 0.5) * 20);
    const anomalyScore = clamp(stressScore * 0.8 + Math.random() * 30 - cloudPenalty);
    const temporalChangeScore = clamp(Math.random() * 60 + 10); // 10-70
    const spreadScore = clamp(anomalyScore > 50 ? anomalyScore * 0.6 + Math.random() * 20 : Math.random() * 30);

    // Determine hotspot count from anomaly score
    let hotspotCount = 0;
    if (anomalyScore > 60) hotspotCount = 1 + Math.floor(Math.random() * 3);
    else if (anomalyScore > 40) hotspotCount = Math.random() > 0.5 ? 1 : 0;

    // Create field stress record
    const stressRecord = await prisma.v2FieldStressScore.create({
      data: {
        profileId: scan.profileId,
        satelliteScanId: scanId,
        stressScore: Math.round(stressScore * 100) / 100,
        anomalyScore: Math.round(anomalyScore * 100) / 100,
        temporalChangeScore: Math.round(temporalChangeScore * 100) / 100,
        spreadScore: Math.round(spreadScore * 100) / 100,
        hotspotCount,
      },
    });

    console.log(`[Intelligence] Field stress computed: scan=${scanId}, stress=${stressScore.toFixed(1)}, anomaly=${anomalyScore.toFixed(1)}, hotspots=${hotspotCount}`);

    // Generate hotspot zones if anomaly score warrants it
    const hotspots = [];
    if (hotspotCount > 0) {
      // Fetch farm profile for location
      const profile = await prisma.farmProfile.findUnique({ where: { id: scan.profileId } });
      const baseLat = profile?.latitude || -1.2921;
      const baseLng = profile?.longitude || 36.8219;

      for (let i = 0; i < hotspotCount; i++) {
        // STUB: Replace with real anomaly zone geometry from satellite analysis
        const offsetLat = (Math.random() - 0.5) * 0.005;
        const offsetLng = (Math.random() - 0.5) * 0.005;
        const zoneCenter = [baseLat + offsetLat, baseLng + offsetLng];

        const zoneGeoJson = {
          type: 'Point',
          coordinates: zoneCenter,
          radius_meters: 50 + Math.floor(Math.random() * 150),
        };

        // Compute hotspot score using the scoring engine
        const hotspotComponents = {
          anomaly_intensity: anomalyScore,
          temporal_change: temporalChangeScore,
          cluster_compactness: clamp(60 + Math.random() * 30),
          crop_sensitivity: clamp(50 + Math.random() * 30),
          local_validation_evidence: 0, // no validation yet
        };
        const { score: hotspotScore } = await computeHotspotScore(hotspotComponents);

        const severity = hotspotScore >= 75 ? 'critical' : hotspotScore >= 55 ? 'high' : hotspotScore >= 35 ? 'moderate' : 'low';

        const hotspot = await prisma.v2HotspotZone.create({
          data: {
            profileId: scan.profileId,
            sourceType: 'satellite',
            zoneGeoJson,
            hotspotScore: Math.round(hotspotScore * 100) / 100,
            severity,
            inspectionPriority: hotspotScore >= 65 ? 1 : hotspotScore >= 45 ? 2 : 3,
            status: 'active',
          },
        });

        hotspots.push(hotspot);
        console.log(`[Intelligence] Hotspot zone created: id=${hotspot.id}, score=${hotspotScore.toFixed(1)}, severity=${severity}`);
      }
    }

    return { stressScore: stressRecord, hotspots, error: null };
  } catch (error) {
    console.error('[Intelligence] Field stress computation failed:', error.message);
    return { stressScore: null, hotspots: [], error: error.message };
  }
}

/**
 * Get the most recent field stress score for a farm.
 * @param {string} profileId - FarmProfile ID
 * @returns {Promise<object|null>}
 */
export async function getLatestFieldStress(profileId) {
  try {
    const stress = await prisma.v2FieldStressScore.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      include: { satelliteScan: true },
    });

    console.log(`[Intelligence] Latest field stress for ${profileId}: ${stress ? stress.stressScore : 'none'}`);
    return stress;
  } catch (error) {
    console.error('[Intelligence] Failed to get latest field stress:', error.message);
    return null;
  }
}

/**
 * Get field stress history for trend analysis.
 * @param {string} profileId - FarmProfile ID
 * @param {number} [limit=10] - Number of recent records to return
 * @returns {Promise<object[]>}
 */
export async function getFieldStressHistory(profileId, limit = 10) {
  try {
    const history = await prisma.v2FieldStressScore.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { satelliteScan: true },
    });

    console.log(`[Intelligence] Field stress history for ${profileId}: ${history.length} records`);
    return history;
  } catch (error) {
    console.error('[Intelligence] Failed to get field stress history:', error.message);
    return [];
  }
}
