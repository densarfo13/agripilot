// ─── Drone Service ─────────────────────────────────────────────────────────
// Drone scan ingestion and hotspot validation.
// Analysis is stubbed — DB operations are production-ready.

import prisma from '../../lib/prisma.js';

/**
 * Clamp a value to 0–100.
 * @param {number} v
 * @returns {number}
 */
function clamp(v) {
  return Math.min(100, Math.max(0, v));
}

/**
 * Ingest a drone scan, create the DB record, and run validation if linked to a hotspot.
 *
 * @param {object} params
 * @param {string} params.profileId - FarmProfile ID
 * @param {string|null} [params.hotspotZoneId] - Optional V2HotspotZone to validate
 * @param {Date|string} params.flightDate - Date of the drone flight
 * @param {string|null} [params.imageBundleUrl] - URL to drone image bundle
 * @param {object|null} [params.metadata] - Flight metadata (altitude, overlap, etc.)
 * @returns {Promise<{ scan: object|null, validation: object|null, error: string|null }>}
 */
export async function ingestDroneScan({ profileId, hotspotZoneId = null, flightDate, imageBundleUrl = null, metadata = null }) {
  try {
    // Validate inputs
    if (!profileId) return { scan: null, validation: null, error: 'profileId is required' };
    if (!flightDate) return { scan: null, validation: null, error: 'flightDate is required' };

    const profile = await prisma.farmProfile.findUnique({ where: { id: profileId } });
    if (!profile) return { scan: null, validation: null, error: 'farm_profile_not_found' };

    const parsedDate = flightDate instanceof Date ? flightDate : new Date(flightDate);
    if (isNaN(parsedDate.getTime())) return { scan: null, validation: null, error: 'invalid_flight_date' };

    // Validate hotspot zone if provided
    if (hotspotZoneId) {
      const hotspot = await prisma.v2HotspotZone.findUnique({ where: { id: hotspotZoneId } });
      if (!hotspot) return { scan: null, validation: null, error: 'hotspot_zone_not_found' };
    }

    // Create drone scan record
    const scan = await prisma.v2DroneScan.create({
      data: {
        profileId,
        hotspotZoneId,
        flightDate: parsedDate,
        imageBundleUrl,
        metadata,
      },
    });

    console.log(`[Intelligence] Drone scan ingested: id=${scan.id}, profile=${profileId}, hotspot=${hotspotZoneId || 'none'}`);

    // Run validation if linked to a hotspot
    let validation = null;
    if (hotspotZoneId) {
      validation = await validateHotspot(scan.id);
    }

    return { scan, validation, error: null };
  } catch (error) {
    console.error('[Intelligence] Drone scan ingestion failed:', error.message);
    return { scan: null, validation: null, error: error.message };
  }
}

/**
 * Validate a hotspot zone using drone scan imagery.
 *
 * STUB: Replace with real drone image analysis (orthomosaic stitching,
 * high-res anomaly detection, plant-level classification).
 * Current implementation generates realistic validation scores.
 * DB updates are production-ready.
 *
 * @param {string} droneScanId - V2DroneScan ID
 * @returns {Promise<{ validationScore: number|null, severityRefinement: string|null, confirmed: boolean, error: string|null }>}
 */
export async function validateHotspot(droneScanId) {
  try {
    const scan = await prisma.v2DroneScan.findUnique({
      where: { id: droneScanId },
      include: { hotspotZone: true },
    });

    if (!scan) return { validationScore: null, severityRefinement: null, confirmed: false, error: 'drone_scan_not_found' };
    if (!scan.hotspotZone) return { validationScore: null, severityRefinement: null, confirmed: false, error: 'no_hotspot_linked' };

    // STUB: Replace with real drone image analysis
    // Real implementation would:
    //   1. Stitch orthomosaic from drone image bundle
    //   2. Run high-res anomaly detection on the hotspot area
    //   3. Compare drone imagery against satellite-detected anomaly
    //   4. Classify plant-level issues at higher resolution
    //   5. Confirm or reject the satellite-flagged hotspot

    const existingScore = scan.hotspotZone.hotspotScore;

    // Drone validation tends to refine the score — sometimes confirming, sometimes reducing
    const refinementFactor = 0.7 + Math.random() * 0.6; // 0.7–1.3
    const validationScore = clamp(existingScore * refinementFactor + (Math.random() - 0.3) * 15);
    const confirmed = validationScore > 45;

    // Determine refined severity
    let severityRefinement;
    if (validationScore >= 75) severityRefinement = 'critical';
    else if (validationScore >= 55) severityRefinement = 'high';
    else if (validationScore >= 35) severityRefinement = 'moderate';
    else severityRefinement = 'low';

    const newStatus = confirmed ? 'inspected' : 'false_alarm';

    // Update the drone scan with validation score
    await prisma.v2DroneScan.update({
      where: { id: droneScanId },
      data: { validationScore: Math.round(validationScore * 100) / 100 },
    });

    // Update the hotspot zone with refined data
    await prisma.v2HotspotZone.update({
      where: { id: scan.hotspotZone.id },
      data: {
        hotspotScore: Math.round(validationScore * 100) / 100,
        severity: severityRefinement,
        status: newStatus,
      },
    });

    console.log(`[Intelligence] Hotspot validated: zone=${scan.hotspotZone.id}, score=${validationScore.toFixed(1)}, confirmed=${confirmed}, severity=${severityRefinement}`);

    return {
      validationScore: Math.round(validationScore * 100) / 100,
      severityRefinement,
      confirmed,
      error: null,
    };
  } catch (error) {
    console.error('[Intelligence] Hotspot validation failed:', error.message);
    return { validationScore: null, severityRefinement: null, confirmed: false, error: error.message };
  }
}

/**
 * List drone scans for a farm profile.
 * @param {string} profileId - FarmProfile ID
 * @returns {Promise<object[]>}
 */
export async function getDroneScans(profileId) {
  try {
    const scans = await prisma.v2DroneScan.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      include: { hotspotZone: true },
    });

    console.log(`[Intelligence] Retrieved ${scans.length} drone scans for profile ${profileId}`);
    return scans;
  } catch (error) {
    console.error('[Intelligence] Failed to get drone scans:', error.message);
    return [];
  }
}
