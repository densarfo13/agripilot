/**
 * Farroway Intelligence — Drone Service
 *
 * Drone scan ingestion and hotspot zone validation.
 * When a drone scan targets an existing hotspot, the service computes a
 * validation score (stubbed) and updates the hotspot status accordingly.
 */
import type { IngestDroneDto } from '../types/index.js';
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
export declare function ingestDroneScan(data: IngestDroneDto & {
    uploadedBy: string;
}): Promise<{
    scan: any;
    hotspotUpdate?: any;
}>;
/**
 * Retrieve drone scans for a farm profile, including any linked hotspot zones.
 *
 * @param profileId - The farm profile UUID.
 * @param limit - Maximum records to return (default 10).
 * @returns Array of drone scan records, newest flight date first.
 */
export declare function getDroneScans(profileId: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=drone.service.d.ts.map