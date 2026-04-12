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
import type { IngestSatelliteDto } from '../types/index.js';
export declare function ingestSatelliteScan(data: IngestSatelliteDto & {
    uploadedBy: string;
}): Promise<{
    scan: any;
    stressScore: any;
    hotspots: any[];
}>;
export declare function getLatestFieldStress(profileId: string): Promise<any | null>;
export declare function getFieldStressHistory(profileId: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=satellite.service.d.ts.map