// ─── Outbreak Service ──────────────────────────────────────────────────────
// Regional outbreak clustering, district risk scoring, and intelligence aggregation.

import prisma from '../../lib/prisma.js';
import { computeRegionalOutbreakScore, riskLevelFromScore } from './scoringEngine.js';

/** Radius in km for clustering nearby farms */
const CLUSTER_RADIUS_KM = 10;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Compute the Haversine distance between two lat/lng points.
 * @param {number} lat1 - Latitude of point 1 (degrees)
 * @param {number} lng1 - Longitude of point 1 (degrees)
 * @param {number} lat2 - Latitude of point 2 (degrees)
 * @param {number} lng2 - Longitude of point 2 (degrees)
 * @returns {number} Distance in kilometers
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Clamp a value to 0–100.
 * @param {number} v
 * @returns {number}
 */
function clamp(v) {
  return Math.min(100, Math.max(0, v));
}

/**
 * Simple single-linkage clustering of farms by proximity.
 * @param {{ id: string, lat: number, lng: number }[]} points
 * @param {number} radiusKm
 * @returns {Array<Array<{ id: string, lat: number, lng: number }>>}
 */
function clusterByProximity(points, radiusKm) {
  const visited = new Set();
  const clusters = [];

  for (const point of points) {
    if (visited.has(point.id)) continue;

    // BFS to find all connected points within radius
    const cluster = [];
    const queue = [point];
    visited.add(point.id);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      for (const candidate of points) {
        if (visited.has(candidate.id)) continue;
        const dist = haversineDistance(current.lat, current.lng, candidate.lat, candidate.lng);
        if (dist <= radiusKm) {
          visited.add(candidate.id);
          queue.push(candidate);
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

// ─── Exported Functions ────────────────────────────────────────────────────

/**
 * Compute outbreak clusters for a region by grouping nearby farms with active pest reports
 * or satellite anomalies.
 *
 * @param {string} regionKey - Region identifier (e.g. 'kenya-central')
 * @returns {Promise<{ clusters: object[], error: string|null }>}
 */
export async function computeOutbreakClusters(regionKey) {
  try {
    if (!regionKey) return { clusters: [], error: 'regionKey is required' };

    // Fetch farms in the region with active pest reports
    const reportsWithFarms = await prisma.v2PestReport.findMany({
      where: {
        status: { in: ['open', 'under_review', 'confirmed'] },
        profile: {
          locationName: { contains: regionKey, mode: 'insensitive' },
        },
      },
      include: {
        profile: { select: { id: true, latitude: true, longitude: true, crop: true, farmName: true } },
      },
    });

    // Also fetch farms with high satellite anomaly scores
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const stressedFarms = await prisma.v2FieldStressScore.findMany({
      where: {
        anomalyScore: { gte: 50 },
        createdAt: { gte: thirtyDaysAgo },
        profile: {
          locationName: { contains: regionKey, mode: 'insensitive' },
        },
      },
      include: {
        profile: { select: { id: true, latitude: true, longitude: true, crop: true, farmName: true } },
      },
    });

    // Deduplicate farms and build points list
    const farmMap = new Map();
    for (const report of reportsWithFarms) {
      if (report.profile.latitude != null && report.profile.longitude != null) {
        farmMap.set(report.profile.id, {
          id: report.profile.id,
          lat: report.profile.latitude,
          lng: report.profile.longitude,
          crop: report.profile.crop,
          farmName: report.profile.farmName,
          hasReport: true,
          hasAnomaly: false,
        });
      }
    }
    for (const stress of stressedFarms) {
      if (stress.profile.latitude != null && stress.profile.longitude != null) {
        const existing = farmMap.get(stress.profile.id);
        if (existing) {
          existing.hasAnomaly = true;
        } else {
          farmMap.set(stress.profile.id, {
            id: stress.profile.id,
            lat: stress.profile.latitude,
            lng: stress.profile.longitude,
            crop: stress.profile.crop,
            farmName: stress.profile.farmName,
            hasReport: false,
            hasAnomaly: true,
          });
        }
      }
    }

    const farmPoints = Array.from(farmMap.values());

    if (farmPoints.length === 0) {
      console.log(`[Intelligence] No farms with active issues found in region ${regionKey}`);
      return { clusters: [], error: null };
    }

    // Cluster farms by proximity
    const rawClusters = clusterByProximity(farmPoints, CLUSTER_RADIUS_KM);

    // Filter out single-farm clusters (not really a cluster)
    const significantClusters = rawClusters.filter(c => c.length >= 2);

    // Persist clusters
    const persistedClusters = [];
    for (const farms of significantClusters) {
      // Compute cluster centroid
      const centroidLat = farms.reduce((s, f) => s + f.lat, 0) / farms.length;
      const centroidLng = farms.reduce((s, f) => s + f.lng, 0) / farms.length;

      // Determine dominant crop
      const cropCounts = {};
      for (const f of farms) {
        cropCounts[f.crop] = (cropCounts[f.crop] || 0) + 1;
      }
      const dominantCrop = Object.entries(cropCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      // Determine likely issue from reports
      const confirmedCount = farms.filter(f => f.hasReport).length;
      const anomalyCount = farms.filter(f => f.hasAnomaly).length;

      const clusterScore = clamp((confirmedCount / farms.length) * 60 + (anomalyCount / farms.length) * 40);
      const confidenceScore = clamp(40 + confirmedCount * 10 + anomalyCount * 5);

      const clusterGeoJson = {
        type: 'Point',
        coordinates: [centroidLat, centroidLng],
        farmIds: farms.map(f => f.id),
      };

      const cluster = await prisma.v2OutbreakCluster.create({
        data: {
          regionKey,
          clusterGeoJson,
          clusterScore: Math.round(clusterScore * 100) / 100,
          dominantCrop,
          likelyIssue: confirmedCount > anomalyCount ? 'pest_confirmed' : 'anomaly_detected',
          confidenceScore: Math.round(confidenceScore * 100) / 100,
          farmCount: farms.length,
          status: 'active',
        },
      });

      persistedClusters.push(cluster);
      console.log(`[Intelligence] Outbreak cluster created: id=${cluster.id}, farms=${farms.length}, score=${clusterScore.toFixed(1)}`);
    }

    console.log(`[Intelligence] Outbreak clustering for ${regionKey}: ${persistedClusters.length} clusters from ${farmPoints.length} farms`);
    return { clusters: persistedClusters, error: null };
  } catch (error) {
    console.error('[Intelligence] Outbreak clustering failed:', error.message);
    return { clusters: [], error: error.message };
  }
}

/**
 * Compute district-level risk score using the regional outbreak scoring formula.
 *
 * @param {string} regionKey - Region identifier
 * @returns {Promise<{ districtRisk: object|null, error: string|null }>}
 */
export async function computeDistrictRisk(regionKey) {
  try {
    if (!regionKey) return { districtRisk: null, error: 'regionKey is required' };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Gather signal counts for scoring
    const [confirmedReports, allReports, anomalyScans, activeClusters] = await Promise.all([
      prisma.v2PestReport.count({
        where: {
          status: 'confirmed',
          createdAt: { gte: thirtyDaysAgo },
          profile: { locationName: { contains: regionKey, mode: 'insensitive' } },
        },
      }),
      prisma.v2PestReport.count({
        where: {
          status: { in: ['open', 'under_review'] },
          createdAt: { gte: thirtyDaysAgo },
          profile: { locationName: { contains: regionKey, mode: 'insensitive' } },
        },
      }),
      prisma.v2FieldStressScore.count({
        where: {
          anomalyScore: { gte: 50 },
          createdAt: { gte: thirtyDaysAgo },
          profile: { locationName: { contains: regionKey, mode: 'insensitive' } },
        },
      }),
      prisma.v2OutbreakCluster.count({
        where: { regionKey, status: 'active' },
      }),
    ]);

    // Normalize signal counts to 0-100 scores (cap at reasonable maximums)
    const components = {
      confirmed_reports: clamp((confirmedReports / 10) * 100),
      unconfirmed_signals: clamp((allReports / 20) * 100),
      satellite_anomalies: clamp((anomalyScans / 15) * 100),
      weather_favorability: clamp(40 + Math.random() * 30), // STUB: Replace with real weather API
      seasonal_baseline_match: clamp(30 + Math.random() * 40), // STUB: Replace with historical baseline
      intervention_failure_rate: clamp(Math.random() * 40), // STUB: Replace with real outcome tracking
    };

    const { score: overallRiskScore } = await computeRegionalOutbreakScore(components);

    // Determine outbreak probability and trend
    const outbreakProbability = clamp(overallRiskScore * 0.8 + activeClusters * 5);

    // Determine trend by comparing with previous district risk score
    const previousRisk = await prisma.v2DistrictRiskScore.findFirst({
      where: { regionKey },
      orderBy: { date: 'desc' },
    });

    let trendDirection = 'stable';
    if (previousRisk) {
      const diff = overallRiskScore - previousRisk.overallRiskScore;
      if (diff > 5) trendDirection = 'rising';
      else if (diff < -5) trendDirection = 'declining';
    }

    const dominantRiskType = confirmedReports > anomalyScans ? 'pest_confirmed' : 'satellite_anomaly';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert district risk for today
    const districtRisk = await prisma.v2DistrictRiskScore.upsert({
      where: {
        regionKey_date: { regionKey, date: today },
      },
      update: {
        overallRiskScore: Math.round(overallRiskScore * 100) / 100,
        outbreakProbability: Math.round(outbreakProbability * 100) / 100,
        dominantRiskType,
        trendDirection,
        metadata: { components, signalCounts: { confirmedReports, allReports, anomalyScans, activeClusters } },
      },
      create: {
        regionKey,
        date: today,
        overallRiskScore: Math.round(overallRiskScore * 100) / 100,
        outbreakProbability: Math.round(outbreakProbability * 100) / 100,
        dominantRiskType,
        trendDirection,
        metadata: { components, signalCounts: { confirmedReports, allReports, anomalyScans, activeClusters } },
      },
    });

    console.log(`[Intelligence] District risk computed: region=${regionKey}, score=${overallRiskScore.toFixed(1)}, trend=${trendDirection}`);
    return { districtRisk, error: null };
  } catch (error) {
    console.error('[Intelligence] District risk computation failed:', error.message);
    return { districtRisk: null, error: error.message };
  }
}

/**
 * Get aggregated regional intelligence: clusters, district risk, trends, active farms.
 *
 * @param {string} regionKey - Region identifier
 * @returns {Promise<{ clusters: object[], districtRisk: object|null, trendDirection: string, activeFarms: number, error: string|null }>}
 */
export async function getRegionalIntelligence(regionKey) {
  try {
    if (!regionKey) {
      return { clusters: [], districtRisk: null, trendDirection: 'stable', activeFarms: 0, error: 'regionKey is required' };
    }

    const [clusters, districtRisk, activeFarmCount] = await Promise.all([
      prisma.v2OutbreakCluster.findMany({
        where: { regionKey, status: 'active' },
        orderBy: { clusterScore: 'desc' },
      }),
      prisma.v2DistrictRiskScore.findFirst({
        where: { regionKey },
        orderBy: { date: 'desc' },
      }),
      prisma.v2PestReport.groupBy({
        by: ['profileId'],
        where: {
          status: { in: ['open', 'under_review', 'confirmed'] },
          profile: { locationName: { contains: regionKey, mode: 'insensitive' } },
        },
      }),
    ]);

    const trendDirection = districtRisk?.trendDirection || 'stable';
    const activeFarms = activeFarmCount.length;

    console.log(`[Intelligence] Regional intelligence for ${regionKey}: ${clusters.length} clusters, ${activeFarms} active farms, trend=${trendDirection}`);

    return {
      clusters,
      districtRisk,
      trendDirection,
      activeFarms,
      error: null,
    };
  } catch (error) {
    console.error('[Intelligence] Regional intelligence retrieval failed:', error.message);
    return { clusters: [], districtRisk: null, trendDirection: 'stable', activeFarms: 0, error: error.message };
  }
}
