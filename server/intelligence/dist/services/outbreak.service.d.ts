/**
 * Farroway Intelligence — Outbreak Service
 *
 * Regional outbreak detection and district risk scoring.
 * Uses single-linkage clustering on pest reports with GPS data to identify
 * outbreak clusters, and aggregates multi-signal risk scores per district.
 */
/**
 * Compute the great-circle distance between two points on Earth using the
 * Haversine formula.
 *
 * @param lat1 - Latitude of point 1 in degrees.
 * @param lon1 - Longitude of point 1 in degrees.
 * @param lat2 - Latitude of point 2 in degrees.
 * @param lon2 - Longitude of point 2 in degrees.
 * @returns Distance in kilometres.
 */
export declare function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number;
/**
 * Detect outbreak clusters in a region by clustering confirmed pest reports
 * with GPS data using single-linkage clustering (10 km radius).
 *
 * For each valid cluster (>= 2 farms), a `V2OutbreakCluster` record is
 * upserted with computed GeoJSON, dominant crop, likely issue, and score.
 *
 * @param regionKey - The region identifier (e.g. district/county name).
 * @returns Array of created or updated outbreak cluster records.
 */
export declare function detectOutbreakClusters(regionKey: string): Promise<any[]>;
/**
 * Compute a composite district-level risk score by aggregating multiple
 * signal sources: confirmed reports, open signals, satellite anomalies,
 * weather conditions (stubbed), and intervention outcomes.
 *
 * @param regionKey - The region identifier (e.g. district/county name).
 * @returns The upserted V2DistrictRiskScore record.
 */
export declare function computeDistrictRisk(regionKey: string): Promise<any>;
/**
 * Aggregate regional intelligence: latest district risk score, active outbreak
 * clusters, and recent pest reports for a region.
 *
 * @param regionKey - The region identifier.
 * @returns Object with riskScore, clusters, and recentReports arrays.
 */
export declare function getRegionalIntelligence(regionKey: string): Promise<{
    riskScore: any;
    clusters: any[];
    recentReports: any[];
}>;
/**
 * Query active outbreak clusters with optional filters for region and status.
 *
 * @param filters - Optional region key and/or status filter.
 * @returns Array of matching outbreak cluster records.
 */
export declare function getActiveOutbreakClusters(filters?: {
    regionKey?: string;
    status?: string;
}): Promise<any[]>;
//# sourceMappingURL=outbreak.service.d.ts.map