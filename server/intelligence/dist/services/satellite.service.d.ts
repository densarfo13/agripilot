/**
 * Farroway Intelligence — Satellite Service
 *
 * Satellite scan ingestion and field stress analysis.
 * Handles NDVI-based stress scoring (stubbed) and automatic hotspot generation.
 */
import type { IngestSatelliteDto } from '../types/index.js';
/**
 * Ingest a new satellite scan, compute field stress scores, and auto-generate
 * hotspot zones when anomaly thresholds are exceeded.
 *
 * @param data - Satellite DTO merged with the uploading user's ID.
 * @returns The created scan, stress score record, and any generated hotspots.
 * @throws If cloud cover exceeds 80% (scan is unusable).
 */
export declare function ingestSatelliteScan(data: IngestSatelliteDto & {
    uploadedBy: string;
}): Promise<{
    scan: any;
    stressScore: any;
    hotspots: any[];
}>;
/**
 * Retrieve the most recent field stress score for a farm profile,
 * including the associated satellite scan.
 *
 * @param profileId - The farm profile UUID.
 * @returns The latest stress score or null if none exist.
 */
export declare function getLatestFieldStress(profileId: string): Promise<any | null>;
/**
 * Retrieve an ordered history of field stress scores for a farm profile.
 *
 * @param profileId - The farm profile UUID.
 * @param limit - Maximum records to return (default 10).
 * @returns Array of stress score records, newest first.
 */
export declare function getFieldStressHistory(profileId: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=satellite.service.d.ts.map