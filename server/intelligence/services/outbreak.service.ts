/**
 * Farroway Intelligence — Outbreak Service
 *
 * Regional outbreak detection and district risk scoring.
 * Uses single-linkage clustering on pest reports with GPS data to identify
 * outbreak clusters, and aggregates multi-signal risk scores per district.
 */

// @ts-ignore — JS module
import prisma from '../../lib/prisma.js';
import { computeHotspotScore, computeRegionalOutbreakScore, clamp } from './scoring.service.js';

// ── Constants ──

/** Earth radius in kilometres (WGS-84 mean). */
const EARTH_RADIUS_KM = 6371;

/** Maximum distance in km for two farms to be considered in the same cluster. */
const CLUSTER_RADIUS_KM = 10;

/** Minimum number of farms required to form a valid cluster. */
const MIN_CLUSTER_FARMS = 2;

/** Look-back window for recent reports (days). */
const REPORT_WINDOW_DAYS = 30;

// ── Haversine Distance ──

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
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// ── Clustering Helpers ──

interface GeoReport {
  reportId: string;
  profileId: string;
  lat: number;
  lng: number;
  suspectedIssue: string | null;
  crop: string;
}

/**
 * Single-linkage clustering via BFS. Two reports are linked if any pair in
 * their respective clusters is within `radiusKm`.
 */
function singleLinkageClusters(
  reports: GeoReport[],
  radiusKm: number,
): GeoReport[][] {
  const visited = new Set<number>();
  const clusters: GeoReport[][] = [];

  for (let i = 0; i < reports.length; i++) {
    if (visited.has(i)) continue;

    const cluster: GeoReport[] = [];
    const queue: number[] = [i];
    visited.add(i);

    while (queue.length > 0) {
      const idx = queue.shift()!;
      cluster.push(reports[idx]);

      for (let j = 0; j < reports.length; j++) {
        if (visited.has(j)) continue;
        const dist = haversineDistance(
          reports[idx].lat,
          reports[idx].lng,
          reports[j].lat,
          reports[j].lng,
        );
        if (dist <= radiusKm) {
          visited.add(j);
          queue.push(j);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Compute the centroid and bounding radius of a set of geo-located reports.
 */
function computeClusterGeoJson(
  reports: GeoReport[],
): { centroid: [number, number]; radiusKm: number; geoJson: any } {
  const avgLat = reports.reduce((s, r) => s + r.lat, 0) / reports.length;
  const avgLng = reports.reduce((s, r) => s + r.lng, 0) / reports.length;

  let maxDist = 0;
  for (const r of reports) {
    const d = haversineDistance(avgLat, avgLng, r.lat, r.lng);
    if (d > maxDist) maxDist = d;
  }

  return {
    centroid: [avgLng, avgLat],
    radiusKm: Math.round(maxDist * 100) / 100,
    geoJson: {
      type: 'Feature',
      properties: {
        farmCount: reports.length,
        radiusKm: Math.round(maxDist * 100) / 100,
      },
      geometry: {
        type: 'Point',
        coordinates: [avgLng, avgLat],
      },
    },
  };
}

/**
 * Determine the most common value in an array of strings.
 */
function dominant(values: (string | null)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of values) {
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    }
  }
  return best;
}

// ── Public API ──

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
export async function detectOutbreakClusters(
  regionKey: string,
): Promise<any[]> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REPORT_WINDOW_DAYS);

    // 1. Query confirmed pest reports with GPS data in the region
    const reports = await prisma.v2PestReport.findMany({
      where: {
        status: 'confirmed',
        createdAt: { gte: cutoff },
        profile: {
          locationName: regionKey,
          latitude: { not: null },
          longitude: { not: null },
        },
      },
      include: {
        profile: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            crop: true,
            locationName: true,
          },
        },
      },
    });

    // Map to geo-enabled report objects
    const geoReports: GeoReport[] = reports
      .filter((r: any) => r.profile.latitude != null && r.profile.longitude != null)
      .map((r: any) => ({
        reportId: r.id,
        profileId: r.profile.id,
        lat: r.profile.latitude!,
        lng: r.profile.longitude!,
        suspectedIssue: r.suspectedIssue,
        crop: r.profile.crop,
      }));

    if (geoReports.length < MIN_CLUSTER_FARMS) {
      console.log(
        `[Outbreak] Only ${geoReports.length} geo-located reports in ${regionKey} — no clusters possible`,
      );
      return [];
    }

    // 2. Single-linkage clustering with 10 km radius
    const rawClusters = singleLinkageClusters(geoReports, CLUSTER_RADIUS_KM);
    const validClusters = rawClusters.filter((c) => c.length >= MIN_CLUSTER_FARMS);

    console.log(
      `[Outbreak] Found ${validClusters.length} cluster(s) from ${geoReports.length} reports in ${regionKey}`,
    );

    // 3. Upsert cluster records
    const results: any[] = [];

    for (const cluster of validClusters) {
      const { geoJson } = computeClusterGeoJson(cluster);
      const dominantCrop = dominant(cluster.map((r) => r.crop));
      const likelyIssue = dominant(cluster.map((r) => r.suspectedIssue));

      // Compute cluster score via the hotspot scoring formula
      const uniqueFarms = new Set(cluster.map((r) => r.profileId)).size;
      const scoringResult = computeHotspotScore({
        ndvi_deviation: clamp(uniqueFarms * 20, 0, 100),
        area_ratio: clamp(cluster.length * 10, 0, 100),
        persistence: 60, // stub — would use actual spatial density
        proximity_to_reports: 50,    // stub — would use crop vulnerability lookup
        weather_correlation: clamp(cluster.length * 15, 0, 100),
      });

      const clusterRecord = await prisma.v2OutbreakCluster.create({
        data: {
          regionKey,
          clusterGeoJson: geoJson,
          clusterScore: Math.round(scoringResult.score * 100) / 100,
          dominantCrop,
          likelyIssue,
          confidenceScore: Math.round(scoringResult.score * 0.8 * 100) / 100,
          farmCount: uniqueFarms,
          status: 'active',
        },
      });

      results.push(clusterRecord);
      console.log(
        `[Outbreak] Cluster ${clusterRecord.id} — ${uniqueFarms} farms, score: ${clusterRecord.clusterScore}`,
      );
    }

    return results;
  } catch (error) {
    console.error('[Outbreak] detectOutbreakClusters failed:', error);
    throw error;
  }
}

/**
 * Compute a composite district-level risk score by aggregating multiple
 * signal sources: confirmed reports, open signals, satellite anomalies,
 * weather conditions (stubbed), and intervention outcomes.
 *
 * @param regionKey - The region identifier (e.g. district/county name).
 * @returns The upserted V2DistrictRiskScore record.
 */
export async function computeDistrictRisk(regionKey: string): Promise<any> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REPORT_WINDOW_DAYS);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Gather signal components

    // Confirmed reports — normalized to 0-100 (10 reports = 100)
    const confirmedCount = await prisma.v2PestReport.count({
      where: {
        status: 'confirmed',
        createdAt: { gte: cutoff },
        profile: { locationName: regionKey },
      },
    });
    const confirmedReports = clamp(confirmedCount * 10, 0, 100);

    // Unconfirmed (open) signals — normalized to 0-100 (20 open = 100)
    const openCount = await prisma.v2PestReport.count({
      where: {
        status: 'open',
        createdAt: { gte: cutoff },
        profile: { locationName: regionKey },
      },
    });
    const unconfirmedSignals = clamp(openCount * 5, 0, 100);

    // Satellite anomalies — average anomaly score from field stress in region
    const stressScores = await prisma.v2FieldStressScore.findMany({
      where: {
        createdAt: { gte: cutoff },
        profile: { locationName: regionKey },
      },
      select: { anomalyScore: true },
    });
    const satelliteAnomalies =
      stressScores.length > 0
        ? stressScores.reduce((s: number, r: any) => s + r.anomalyScore, 0) / stressScores.length
        : 0;

    // Weather favorability — stub (would integrate a real weather API)
    const weatherFavorability = 40 + Math.random() * 20; // 40-60

    // Seasonal baseline match — stub (would compare to historical data)
    const seasonalBaselineMatch = 50;

    // Intervention failure rate — count 'worse' outcomes / total outcomes
    const allOutcomes = await prisma.v2TreatmentOutcome.findMany({
      where: {
        createdAt: { gte: cutoff },
        treatmentAction: {
          profile: { locationName: regionKey },
        },
      },
      select: { outcomeStatus: true },
    });
    const totalOutcomes = allOutcomes.length;
    const worseOutcomes = allOutcomes.filter(
      (o: any) => o.outcomeStatus === 'worse',
    ).length;
    const interventionFailureRate =
      totalOutcomes > 0 ? clamp((worseOutcomes / totalOutcomes) * 100, 0, 100) : 0;

    // 2. Compute the regional outbreak score
    const components = {
      report_density: confirmedReports,
      spread_velocity: unconfirmedSignals,
      severity_average: satelliteAnomalies,
      crop_overlap: weatherFavorability,
      weather_favorability: seasonalBaselineMatch,
      confirmation_rate: interventionFailureRate,
    };

    const scoringResult = computeRegionalOutbreakScore(components);

    // 3. Determine trend by comparing with the previous score
    const previousScore = await prisma.v2DistrictRiskScore.findFirst({
      where: { regionKey },
      orderBy: { date: 'desc' },
    });

    let trendDirection = 'stable';
    if (previousScore) {
      const delta = scoringResult.score - previousScore.overallRiskScore;
      if (delta > 5) trendDirection = 'rising';
      else if (delta < -5) trendDirection = 'declining';
    }

    // 4. Upsert the district risk score (unique on regionKey + date)
    const riskScore = await prisma.v2DistrictRiskScore.upsert({
      where: {
        regionKey_date: {
          regionKey,
          date: today,
        },
      },
      update: {
        overallRiskScore: Math.round(scoringResult.score * 100) / 100,
        outbreakProbability: Math.round(scoringResult.score * 0.85 * 100) / 100,
        dominantRiskType: confirmedReports > satelliteAnomalies ? 'pest_reports' : 'satellite_anomaly',
        trendDirection,
        metadata: {
          components,
          level: scoringResult.level,
          componentBreakdown: scoringResult.components,
          computedAt: new Date().toISOString(),
        },
      },
      create: {
        regionKey,
        date: today,
        overallRiskScore: Math.round(scoringResult.score * 100) / 100,
        outbreakProbability: Math.round(scoringResult.score * 0.85 * 100) / 100,
        dominantRiskType: confirmedReports > satelliteAnomalies ? 'pest_reports' : 'satellite_anomaly',
        trendDirection,
        metadata: {
          components,
          level: scoringResult.level,
          componentBreakdown: scoringResult.components,
          computedAt: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[Outbreak] District risk for ${regionKey}: ${riskScore.overallRiskScore} (${trendDirection})`,
    );

    return riskScore;
  } catch (error) {
    console.error('[Outbreak] computeDistrictRisk failed:', error);
    throw error;
  }
}

/**
 * Aggregate regional intelligence: latest district risk score, active outbreak
 * clusters, and recent pest reports for a region.
 *
 * @param regionKey - The region identifier.
 * @returns Object with riskScore, clusters, and recentReports arrays.
 */
export async function getRegionalIntelligence(
  regionKey: string,
): Promise<{ riskScore: any; clusters: any[]; recentReports: any[] }> {
  try {
    const [riskScore, clusters, recentReports] = await Promise.all([
      // Latest district risk score
      prisma.v2DistrictRiskScore.findFirst({
        where: { regionKey },
        orderBy: { date: 'desc' },
      }),

      // Active outbreak clusters
      prisma.v2OutbreakCluster.findMany({
        where: { regionKey, status: 'active' },
        orderBy: { createdAt: 'desc' },
      }),

      // Recent pest reports in the region
      prisma.v2PestReport.findMany({
        where: {
          profile: { locationName: regionKey },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          profile: {
            select: {
              id: true,
              farmerName: true,
              crop: true,
              locationName: true,
            },
          },
        },
      }),
    ]);

    return {
      riskScore: riskScore ?? null,
      clusters,
      recentReports,
    };
  } catch (error) {
    console.error('[Outbreak] getRegionalIntelligence failed:', error);
    throw error;
  }
}

/**
 * Query active outbreak clusters with optional filters for region and status.
 *
 * @param filters - Optional region key and/or status filter.
 * @returns Array of matching outbreak cluster records.
 */
export async function getActiveOutbreakClusters(
  filters?: { regionKey?: string; status?: string },
): Promise<any[]> {
  try {
    const where: Record<string, any> = {};
    if (filters?.regionKey) where.regionKey = filters.regionKey;
    if (filters?.status) {
      where.status = filters.status;
    } else {
      where.status = 'active';
    }

    const clusters = await prisma.v2OutbreakCluster.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return clusters;
  } catch (error) {
    console.error('[Outbreak] getActiveOutbreakClusters failed:', error);
    throw error;
  }
}
