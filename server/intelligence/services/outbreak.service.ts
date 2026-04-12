/**
 * Farroway Intelligence — Outbreak Service
 *
 * Regional outbreak detection and district risk scoring.
 * Uses single-linkage clustering on pest reports with GPS data to identify
 * outbreak clusters, and aggregates multi-signal risk scores per district.
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import { computeHotspotScore, computeRegionalOutbreakScore, clamp } from './scoring.service.js';

const EARTH_RADIUS_KM = 6371;
const CLUSTER_RADIUS_KM = 10;
const MIN_CLUSTER_FARMS = 2;
const REPORT_WINDOW_DAYS = 30;

export function haversineDistance(
  lat1: number, lon1: number, lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface GeoReport {
  reportId: string;
  profileId: string;
  lat: number;
  lng: number;
  suspectedIssue: string | null;
  crop: string;
}

function singleLinkageClusters(reports: GeoReport[], radiusKm: number): GeoReport[][] {
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
          reports[idx].lat, reports[idx].lng, reports[j].lat, reports[j].lng,
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
      properties: { farmCount: reports.length, radiusKm: Math.round(maxDist * 100) / 100 },
      geometry: { type: 'Point', coordinates: [avgLng, avgLat] },
    },
  };
}

function dominant(values: (string | null)[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of values) {
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

/**
 * Detect outbreak clusters in a region by clustering confirmed pest reports
 * with GPS data using single-linkage clustering (10 km radius).
 */
export async function detectOutbreakClusters(regionKey: string): Promise<any[]> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REPORT_WINDOW_DAYS);

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
          select: { id: true, latitude: true, longitude: true, crop: true, locationName: true },
        },
      },
    });

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
      console.log(`[Outbreak] Only ${geoReports.length} geo-located reports in ${regionKey}`);
      return [];
    }

    const rawClusters = singleLinkageClusters(geoReports, CLUSTER_RADIUS_KM);
    const validClusters = rawClusters.filter((c) => c.length >= MIN_CLUSTER_FARMS);
    console.log(`[Outbreak] Found ${validClusters.length} cluster(s) from ${geoReports.length} reports`);

    const results: any[] = [];

    for (const cluster of validClusters) {
      const { geoJson } = computeClusterGeoJson(cluster);
      const dominantCrop = dominant(cluster.map((r) => r.crop));
      const likelyIssue = dominant(cluster.map((r) => r.suspectedIssue));
      const uniqueFarms = new Set(cluster.map((r) => r.profileId)).size;

      // Deterministic cluster scoring from real data
      const reportsPerFarm = cluster.length / uniqueFarms;
      const scoringResult = computeHotspotScore({
        anomaly_intensity: clamp(uniqueFarms * 20, 0, 100),
        temporal_change: clamp(cluster.length * 10, 0, 100),
        cluster_compactness: clamp(reportsPerFarm * 30),
        crop_sensitivity: clamp(uniqueFarms * 15),
        local_validation_evidence: clamp(cluster.length * 15, 0, 100),
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
      console.log(`[Outbreak] Cluster ${clusterRecord.id} — ${uniqueFarms} farms, score: ${clusterRecord.clusterScore}`);
    }

    return results;
  } catch (error) {
    console.error('[Outbreak] detectOutbreakClusters failed:', error);
    throw error;
  }
}

/**
 * Compute district-level risk by aggregating: confirmed reports, open signals,
 * satellite anomalies, weather conditions, and intervention outcomes.
 */
export async function computeDistrictRisk(regionKey: string): Promise<any> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - REPORT_WINDOW_DAYS);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Confirmed reports — normalized (10 reports = 100)
    const confirmedCount = await prisma.v2PestReport.count({
      where: {
        status: 'confirmed',
        createdAt: { gte: cutoff },
        profile: { locationName: regionKey },
      },
    });
    const confirmedReports = clamp(confirmedCount * 10, 0, 100);

    // Open signals — normalized (20 open = 100)
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

    // Weather favorability — real data from WeatherSnapshots in region
    const weatherSnapshots = await prisma.weatherSnapshot.findMany({
      where: {
        farmProfile: { locationName: regionKey },
        fetchedAt: { gte: cutoff },
      },
      select: { humidityPct: true, temperatureC: true, rainForecastMm: true },
      take: 20,
    });
    let weatherFavorability = 30;
    if (weatherSnapshots.length > 0) {
      const avgHumidity = weatherSnapshots.reduce((s: number, w: any) => s + (w.humidityPct ?? 50), 0) / weatherSnapshots.length;
      const avgTemp = weatherSnapshots.reduce((s: number, w: any) => s + w.temperatureC, 0) / weatherSnapshots.length;
      const avgRain = weatherSnapshots.reduce((s: number, w: any) => s + w.rainForecastMm, 0) / weatherSnapshots.length;
      weatherFavorability = clamp(
        (avgHumidity - 40) * 0.8 + (avgTemp >= 20 && avgTemp <= 35 ? 30 : 10) + avgRain * 2,
      );
    }

    // Historical baseline — compare current density to older data
    const historicalCount = await prisma.v2PestReport.count({
      where: {
        profile: { locationName: regionKey },
        createdAt: { lt: cutoff },
      },
    });
    const seasonalBaseline = historicalCount > 0
      ? clamp((confirmedCount / Math.max(historicalCount / 12, 1)) * 30)
      : 30;

    // Intervention failure rate
    const allOutcomes = await prisma.v2TreatmentOutcome.findMany({
      where: {
        createdAt: { gte: cutoff },
        treatmentAction: { profile: { locationName: regionKey } },
      },
      select: { outcomeStatus: true },
    });
    const totalOutcomes = allOutcomes.length;
    const worseOutcomes = allOutcomes.filter((o: any) => o.outcomeStatus === 'worse').length;
    const interventionFailureRate =
      totalOutcomes > 0 ? clamp((worseOutcomes / totalOutcomes) * 100, 0, 100) : 0;

    const components = {
      confirmed_reports: confirmedReports,
      unconfirmed_signals: unconfirmedSignals,
      satellite_anomalies: satelliteAnomalies,
      weather_favorability: weatherFavorability,
      seasonal_baseline_match: seasonalBaseline,
      intervention_failure_rate: interventionFailureRate,
    };

    const scoringResult = computeRegionalOutbreakScore(components);

    // Regional confidence: compute signal count and data quality
    // Weight signal sources by reliability: confirmed reports are worth more than weather snapshots
    const weightedSignalCount = confirmedCount * 3 + openCount * 1 + stressScores.length * 2 + weatherSnapshots.length * 0.5 + allOutcomes.length * 1;
    const signalCount = confirmedCount + openCount + stressScores.length + weatherSnapshots.length + allOutcomes.length;
    // Count distinct source types contributing data (max 5)
    const sourceTypes = (confirmedCount > 0 ? 1 : 0) + (openCount > 0 ? 1 : 0) +
      (stressScores.length > 0 ? 1 : 0) + (weatherSnapshots.length > 0 ? 1 : 0) + (allOutcomes.length > 0 ? 1 : 0);
    const dataQualityScore = Math.min(100, Math.round(
      (confirmedCount > 0 ? 25 : 0) +
      (stressScores.length > 0 ? 25 : 0) +
      (weatherSnapshots.length > 0 ? 20 : 0) +
      (allOutcomes.length > 0 ? 15 : 0) +
      Math.min(15, sourceTypes * 3),
    ));
    // Classify: "confirmed" requires actual confirmed reports + multiple source types + high data quality.
    // This prevents weather-only or outcome-only data from being labeled "confirmed".
    const confidenceLevel = confirmedCount >= 3 && sourceTypes >= 3 && dataQualityScore >= 60 && weightedSignalCount >= 30
      ? 'confirmed'
      : sourceTypes >= 2 && dataQualityScore >= 40 && weightedSignalCount >= 10
        ? 'probable'
        : 'low_confidence';

    // Determine trend
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

    const sharedData = {
      overallRiskScore: Math.round(scoringResult.score * 100) / 100,
      outbreakProbability: Math.round(scoringResult.score * 0.85 * 100) / 100,
      dominantRiskType: confirmedReports > satelliteAnomalies ? 'pest_reports' : 'satellite_anomaly',
      trendDirection,
      signalCount,
      confidenceLevel,
      dataQualityScore,
      metadata: {
        components,
        level: scoringResult.level,
        componentBreakdown: scoringResult.components,
        confidenceLevel,
        signalCount,
        computedAt: new Date().toISOString(),
      },
    };

    const riskScore = await prisma.v2DistrictRiskScore.upsert({
      where: { regionKey_date: { regionKey, date: today } },
      update: sharedData,
      create: { regionKey, date: today, ...sharedData },
    });

    console.log(`[Outbreak] District risk for ${regionKey}: ${riskScore.overallRiskScore} (${trendDirection})`);
    return riskScore;
  } catch (error) {
    console.error('[Outbreak] computeDistrictRisk failed:', error);
    throw error;
  }
}

export async function getRegionalIntelligence(
  regionKey: string,
): Promise<{ riskScore: any; clusters: any[]; recentReports: any[] }> {
  const [riskScore, clusters, recentReports] = await Promise.all([
    prisma.v2DistrictRiskScore.findFirst({
      where: { regionKey },
      orderBy: { date: 'desc' },
    }),
    prisma.v2OutbreakCluster.findMany({
      where: { regionKey, status: 'active' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.v2PestReport.findMany({
      where: { profile: { locationName: regionKey } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        profile: { select: { id: true, farmerName: true, crop: true, locationName: true } },
      },
    }),
  ]);

  return { riskScore: riskScore ?? null, clusters, recentReports };
}

export async function getActiveOutbreakClusters(
  filters?: { regionKey?: string; status?: string },
): Promise<any[]> {
  const where: Record<string, any> = {};
  if (filters?.regionKey) where.regionKey = filters.regionKey;
  where.status = filters?.status || 'active';

  return prisma.v2OutbreakCluster.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}
