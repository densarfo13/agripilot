/**
 * Farroway Intelligence — Component Score Service
 *
 * Computes all 7 farm pest risk component scores from real database data.
 * Component names match the product formula EXACTLY:
 *   image_score, field_stress_score, crop_stage_vulnerability,
 *   weather_suitability, nearby_outbreak_density, farm_history_score,
 *   verification_response_score
 */

// @ts-ignore — JS module
import prisma from '../lib/prisma.js';
import { computeCropStageVulnerability, computeVerificationSignal, clamp } from './scoring.service.js';
import type { FarmPestRiskComponents } from '../types/index.js';

export async function computeComponentScores(
  profileId: string,
): Promise<FarmPestRiskComponents> {
  // 1. image_score — avg detection confidence from recent pest images
  const recentImages = await prisma.v2PestImage.findMany({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { detections: true },
  });
  const detectionScores = recentImages.flatMap((img: any) =>
    (img.detections || []).map((d: any) => d.confidenceScore || 0),
  );
  const image_score = detectionScores.length > 0
    ? Math.round(detectionScores.reduce((a: number, b: number) => a + b, 0) / detectionScores.length)
    : 0;

  // 2. field_stress_score — latest satellite field stress score
  const latestStress = await prisma.v2FieldStressScore.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
  });
  const field_stress_score = latestStress ? Math.round(latestStress.stressScore) : 0;

  // 3. crop_stage_vulnerability — crop cycle + farm profile
  const [cropCycle, profile] = await Promise.all([
    prisma.v2CropCycle.findFirst({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.farmProfile.findUnique({
      where: { id: profileId },
      select: { crop: true, locationName: true },
    }),
  ]);
  const cropType = cropCycle?.cropType || profile?.crop || '';
  const growthStage = cropCycle?.growthStage || 'vegetative';
  const crop_stage_vulnerability = computeCropStageVulnerability(cropType, growthStage);

  // 4. weather_suitability — pest-favorable conditions from weather snapshot
  const latestWeather = await prisma.weatherSnapshot.findFirst({
    where: { farmProfileId: profileId },
    orderBy: { fetchedAt: 'desc' },
  });
  let weather_suitability = 0;
  if (latestWeather) {
    const humidity = latestWeather.humidityPct ?? 50;
    const temp = latestWeather.temperatureC;
    const rain = latestWeather.rainForecastMm;
    const humidityFactor = clamp((humidity - 40) * 1.5);
    const tempFactor = (temp >= 20 && temp <= 35)
      ? clamp((temp - 20) * 4)
      : clamp(20 - Math.abs(temp - 27) * 3);
    const rainFactor = clamp(rain * 3);
    weather_suitability = Math.round(humidityFactor * 0.4 + tempFactor * 0.3 + rainFactor * 0.3);
  }

  // 5. farm_history_score — past pest report density (90-day window)
  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const pastReportCount = await prisma.v2PestReport.count({
    where: {
      profileId,
      createdAt: { gte: cutoff90 },
      status: { in: ['confirmed', 'open', 'under_review'] },
    },
  });
  const farm_history_score = clamp(pastReportCount * 18);

  // 6. nearby_outbreak_density — avg risk of nearby farms in same region
  let nearby_outbreak_density = 0;
  if (profile?.locationName) {
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const nearbyRisks = await prisma.v2FarmPestRisk.findMany({
      where: {
        profileId: { not: profileId },
        computedAt: { gte: cutoff30 },
        profile: { locationName: profile.locationName },
      },
      select: { overallRiskScore: true },
      orderBy: { computedAt: 'desc' },
      take: 10,
    });
    if (nearbyRisks.length > 0) {
      nearby_outbreak_density = Math.round(
        nearbyRisks.reduce((s: number, r: any) => s + r.overallRiskScore, 0) / nearbyRisks.length,
      );
    }
  }

  // 7. verification_response_score — farmer questionnaire answers
  const latestReport = await prisma.v2PestReport.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    include: { verificationAnswers: true },
  });
  let verification_response_score = 0;
  if (latestReport?.verificationAnswers) {
    const answerMap: Record<string, string> = {};
    for (const a of latestReport.verificationAnswers as any[]) {
      answerMap[a.questionKey] = a.answerValue;
    }
    verification_response_score = computeVerificationSignal(answerMap);
  }

  return {
    image_score,
    field_stress_score,
    crop_stage_vulnerability,
    weather_suitability,
    nearby_outbreak_density,
    farm_history_score,
    verification_response_score,
  };
}

/**
 * PostGIS-powered proximity query (requires 001_add_postgis.sql migration).
 * Falls back to region-based query if PostGIS is not available.
 */
export async function findNearbyFarmRisks(
  profileId: string,
  radiusKm: number = 15,
): Promise<{ profileId: string; riskScore: number; distanceKm: number }[]> {
  try {
    const profile = await prisma.farmProfile.findUnique({
      where: { id: profileId },
      select: { latitude: true, longitude: true },
    });
    if (!profile?.latitude || !profile?.longitude) return [];

    const rows: any[] = await (prisma as any).$queryRaw`
      SELECT f.profile_id, f.overall_risk_score, n.distance_km
      FROM find_farms_within(${profile.longitude}, ${profile.latitude}, ${radiusKm}) n
      JOIN v2_farm_pest_risks f ON f.profile_id = n.profile_id
      WHERE f.profile_id != ${profileId}
        AND f.computed_at > now() - interval '30 days'
      ORDER BY f.computed_at DESC
      LIMIT 10
    `;
    return rows.map((r: any) => ({
      profileId: r.profile_id,
      riskScore: r.overall_risk_score,
      distanceKm: r.distance_km,
    }));
  } catch {
    // PostGIS not available — fallback handled by caller
    return [];
  }
}
