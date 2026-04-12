/**
 * Farroway Intelligence — Drone Service
 *
 * Drone scan ingestion and hotspot zone validation.
 * Deterministic validation scoring from existing hotspot data.
 * Uses exact hotspot formula component names for re-scoring.
 */
import type { IngestDroneDto } from '../types/index.js';
export declare function ingestDroneScan(data: IngestDroneDto & {
    uploadedBy: string;
}): Promise<{
    scan: any;
    hotspotUpdate?: any;
}>;
export declare function getDroneScans(profileId: string, limit?: number): Promise<any[]>;
//# sourceMappingURL=drone.service.d.ts.map