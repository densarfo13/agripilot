/**
 * Farroway Intelligence — Outbreak Service
 *
 * Regional outbreak detection and district risk scoring.
 * Uses single-linkage clustering on pest reports with GPS data to identify
 * outbreak clusters, and aggregates multi-signal risk scores per district.
 */
export declare function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Detect outbreak clusters in a region by clustering confirmed pest reports
 * with GPS data using single-linkage clustering (10 km radius).
 */
export declare function detectOutbreakClusters(regionKey: string): Promise<any[]>;
/**
 * Compute district-level risk by aggregating: confirmed reports, open signals,
 * satellite anomalies, weather conditions, and intervention outcomes.
 */
export declare function computeDistrictRisk(regionKey: string): Promise<any>;
export declare function getRegionalIntelligence(regionKey: string): Promise<{
    riskScore: any;
    clusters: any[];
    recentReports: any[];
}>;
export declare function getActiveOutbreakClusters(filters?: {
    regionKey?: string;
    status?: string;
}): Promise<any[]>;
//# sourceMappingURL=outbreak.service.d.ts.map