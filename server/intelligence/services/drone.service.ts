/**
 * Farroway Intelligence — Drone Service
 *
 * Drone scan ingestion and hotspot zone validation.
 * When a drone scan targets an existing hotspot, the service computes a
 * validation score (stubbed) and updates the hotspot status accordingly.
 */

// @ts-ignore — JS module
import prisma from '../../lib/prisma.js';
import type { IngestDroneDto } from '../types/index.js';

// ── Helpers ──

/** Generate a random number in [min, max). */
function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Public API ──

/**
 * Ingest a new drone scan. If the scan targets a hotspot zone, compute a
 * validation score and update the hotspot status based on the result.
 *
 * Validation logic (stubbed — would use real image analysis in production):
 * - validationScore > 70  => hotspot confirmed (status stays 'active', severity may escalate)
 * - validationScore < 40  => hotspot marked as 'false_alarm'
 * - Otherwise             => hotspot marked as 'inspected'
 *
 * @param data - Drone DTO merged with the uploading user's ID.
 * @returns The created scan and optional hotspot update details.
 */
export async function ingestDroneScan(
  data: IngestDroneDto & { uploadedBy: string },
): Promise<{ scan: any; hotspotUpdate?: any }> {
  try {
    // 1. Create the drone scan record
    const scan = await prisma.v2DroneScan.create({
      data: {
        profileId: data.profileId,
        hotspotZoneId: data.hotspotZoneId ?? undefined,
        flightDate: new Date(data.flightDate),
        imageBundleUrl: data.imageBundleUrl ?? undefined,
        metadata: data.metadata ?? undefined,
      },
    });
    console.log(`[Drone] Created scan ${scan.id} for profile ${data.profileId}`);

    // 2. If targeting a hotspot zone, validate it
    let hotspotUpdate: any | undefined;
    if (data.hotspotZoneId) {
      const hotspot = await prisma.v2HotspotZone.findUnique({
        where: { id: data.hotspotZoneId },
      });

      if (!hotspot) {
        console.warn(
          `[Drone] Hotspot zone ${data.hotspotZoneId} not found — skipping validation`,
        );
        return { scan };
      }

      // Stub validation score: base 60 + random(0, 30)
      const validationScore = Math.round((60 + randomInRange(0, 30)) * 100) / 100;
      let newStatus: string;
      let newSeverity: string | undefined;

      if (validationScore > 70) {
        // Confirmed: hotspot is real — keep active, possibly escalate severity
        newStatus = 'active';
        if (validationScore > 85 && hotspot.severity !== 'critical') {
          newSeverity = 'high';
        }
        console.log(
          `[Drone] Hotspot ${hotspot.id} CONFIRMED (score: ${validationScore})`,
        );
      } else if (validationScore < 40) {
        // False alarm: drone evidence contradicts satellite signal
        newStatus = 'false_alarm';
        console.log(
          `[Drone] Hotspot ${hotspot.id} marked FALSE ALARM (score: ${validationScore})`,
        );
      } else {
        // Inconclusive: mark as inspected for follow-up
        newStatus = 'inspected';
        console.log(
          `[Drone] Hotspot ${hotspot.id} marked INSPECTED (score: ${validationScore})`,
        );
      }

      // Update the drone scan with the validation score
      await prisma.v2DroneScan.update({
        where: { id: scan.id },
        data: { validationScore },
      });

      // Update the hotspot zone status (and severity if escalated)
      const updateData: Record<string, any> = { status: newStatus };
      if (newSeverity) {
        updateData.severity = newSeverity;
      }

      hotspotUpdate = await prisma.v2HotspotZone.update({
        where: { id: hotspot.id },
        data: updateData,
      });
    }

    return { scan, hotspotUpdate };
  } catch (error) {
    console.error('[Drone] ingestDroneScan failed:', error);
    throw error;
  }
}

/**
 * Retrieve drone scans for a farm profile, including any linked hotspot zones.
 *
 * @param profileId - The farm profile UUID.
 * @param limit - Maximum records to return (default 10).
 * @returns Array of drone scan records, newest flight date first.
 */
export async function getDroneScans(
  profileId: string,
  limit: number = 10,
): Promise<any[]> {
  try {
    const scans = await prisma.v2DroneScan.findMany({
      where: { profileId },
      orderBy: { flightDate: 'desc' },
      take: limit,
      include: { hotspotZone: true },
    });
    return scans;
  } catch (error) {
    console.error('[Drone] getDroneScans failed:', error);
    throw error;
  }
}
