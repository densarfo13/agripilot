import prisma from '../../config/database.js';
import { getRegionConfig } from '../regionConfig/service.js';
import { injectIntelligenceSummary as injectVerificationSummary } from '../verification/service.js';
import { injectIntelligenceSummary as injectFraudSummary } from '../fraud/service.js';

/**
 * Invisible Intelligence Engine (Shadow/Secondary Only)
 *
 * CRITICAL RULE: This engine's output is NEVER used to directly approve or reject.
 * It produces shadow signals for institutional review only.
 *
 * Signals (12 total):
 * - ML Shadow Score (simulated predictive model)
 * - Satellite Signal (simulated NDVI/land use)
 * - Yield Signal (regional yield estimates)
 * - Relationship Signal (farmer history and network)
 * - Anomaly Signal (statistical anomalies)
 * - Crop Prediction Signal (season/crop performance forecast)
 * - Weather Signal (weather risk for region)
 * - Market Signal (market price outlook)
 * - Chatbot Signal (placeholder for conversational data)
 * - Analytics Signal (portfolio-level analytics context)
 * - Storage Signal (post-harvest storage risk)
 * - Buyer Signal (buyer demand for crop in region)
 */
export async function runIntelligence(applicationId) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      farmer: true,
      farmLocation: true,
      farmBoundary: { include: { points: true } },
      verificationResult: true,
      fraudResult: true,
    },
  });

  if (!app) {
    const err = new Error('Application not found');
    err.statusCode = 404;
    throw err;
  }

  const regionCfg = getRegionConfig(app.farmer.countryCode || 'KE');

  // ─── ML Shadow Score ────────────────────────────────
  const features = [];
  if (app.verificationResult) features.push(app.verificationResult.verificationScore / 100);
  if (app.fraudResult) features.push(1 - app.fraudResult.fraudRiskScore / 100);
  if (app.farmer.yearsExperience) features.push(Math.min(1, app.farmer.yearsExperience / 20));
  if (app.farmSizeAcres) features.push(Math.min(1, app.farmSizeAcres / 50));

  const mlShadowScore = features.length > 0
    ? Math.round(features.reduce((a, b) => a + b, 0) / features.length * 100) / 100
    : null;
  const mlShadowConfidence = features.length >= 3 ? 0.7 + (features.length * 0.05) : 0.3 + (features.length * 0.1);

  // ─── Satellite Signal ───────────────────────────────
  const satelliteSignal = app.farmLocation ? {
    hasLocation: true,
    ndviEstimate: 0.4 + Math.random() * 0.4,
    landUseClass: 'agricultural',
    vegetationHealth: mlShadowScore > 0.6 ? 'healthy' : 'moderate',
    lastUpdated: new Date().toISOString(),
    note: 'Simulated satellite signal — replace with real API in production',
  } : { hasLocation: false, note: 'No GPS data available for satellite analysis' };

  // ─── Yield Signal ───────────────────────────────────
  const peerApps = await prisma.application.count({
    where: { cropType: app.cropType, farmer: { region: app.farmer.region } },
  });

  const yieldSignal = {
    cropType: app.cropType,
    region: app.farmer.region,
    country: regionCfg.country,
    peerCount: peerApps,
    estimatedYieldPerAcre: getEstimatedYield(app.cropType),
    confidenceLevel: peerApps > 5 ? 'moderate' : 'low',
    note: 'Simulated yield signal — replace with agronomic data in production',
  };

  // ─── Relationship Signal ────────────────────────────
  const farmerAppCount = await prisma.application.count({ where: { farmerId: app.farmerId } });
  const farmerApprovedCount = await prisma.application.count({
    where: { farmerId: app.farmerId, status: 'approved' },
  });

  const relationshipSignal = {
    totalApplications: farmerAppCount,
    approvedApplications: farmerApprovedCount,
    isRepeatBorrower: farmerAppCount > 1,
    trustLevel: farmerApprovedCount > 0 ? 'established' : farmerAppCount > 1 ? 'developing' : 'new',
  };

  // ─── Anomaly Signal ─────────────────────────────────
  const anomalySignal = {
    amountVsRegionAvg: null,
    sizeVsClaimed: null,
    flags: [],
  };

  const regionalAvg = await prisma.application.aggregate({
    where: { farmer: { region: app.farmer.region }, id: { not: applicationId } },
    _avg: { requestedAmount: true },
  });

  if (regionalAvg._avg.requestedAmount) {
    const ratio = app.requestedAmount / regionalAvg._avg.requestedAmount;
    anomalySignal.amountVsRegionAvg = Math.round(ratio * 100) / 100;
    if (ratio > 2.5) anomalySignal.flags.push('amount_significantly_above_regional_average');
  }

  if (app.farmBoundary?.measuredArea && app.farmSizeAcres) {
    const sizeRatio = app.farmBoundary.measuredArea / app.farmSizeAcres;
    anomalySignal.sizeVsClaimed = Math.round(sizeRatio * 100) / 100;
    if (sizeRatio < 0.5 || sizeRatio > 2.0) {
      anomalySignal.flags.push('measured_area_significantly_differs_from_claimed');
    }
  }

  // ─── Crop Prediction Signal (NEW) ───────────────────
  const cropPredictionSignal = {
    cropType: app.cropType,
    region: app.farmer.region,
    country: regionCfg.country,
    seasonOutlook: getSeasonOutlook(app.cropType, app.farmer.region),
    expectedPerformance: mlShadowScore > 0.7 ? 'above_average' : mlShadowScore > 0.4 ? 'average' : 'below_average',
    riskFactors: getCropRiskFactors(app.cropType),
    note: 'Simulated crop prediction — replace with ML model in production',
  };

  // ─── Weather Signal (NEW) ──────────────────────────
  const weatherSignal = {
    region: app.farmer.region,
    country: regionCfg.country,
    currentSeason: getCurrentSeason(),
    rainfallOutlook: 'normal',
    droughtRisk: 'low',
    floodRisk: app.farmLocation ? 'low' : 'unknown',
    temperatureOutlook: 'within_range',
    note: 'Simulated weather signal — replace with weather API in production',
  };

  // ─── Market Signal (NEW) ───────────────────────────
  const marketSignal = {
    cropType: app.cropType,
    country: regionCfg.country,
    currency: regionCfg.currencyCode,
    priceOutlook: 'stable',
    demandLevel: getCropDemandLevel(app.cropType),
    exportPotential: getExportPotential(app.cropType, app.farmer.countryCode),
    note: 'Simulated market signal — replace with market data API in production',
  };

  // ─── Chatbot Signal (NEW) ──────────────────────────
  const chatbotSignal = {
    farmerEngagement: farmerAppCount > 1 ? 'active' : 'new',
    queriesCount: 0,
    lastInteraction: null,
    sentimentScore: null,
    note: 'Placeholder — will be populated when chatbot is integrated',
  };

  // ─── Analytics Signal (NEW) ────────────────────────
  const totalApps = await prisma.application.count();
  const approvedApps = await prisma.application.count({ where: { status: 'approved' } });
  const analyticsSignal = {
    portfolioApprovalRate: totalApps > 0 ? Math.round((approvedApps / totalApps) * 100) : 0,
    cropConcentration: await getCropConcentration(app.cropType),
    regionConcentration: await getRegionConcentration(app.farmer.region),
    note: 'Portfolio-level analytics context for this application',
  };

  // ─── Storage Signal (NEW) ─────────────────────────
  const storageSignal = {
    cropType: app.cropType,
    recommendedStorage: getStorageRecommendation(app.cropType),
    postHarvestLossRisk: getPostHarvestLossRisk(app.cropType),
    storageAvailability: 'unknown',
    note: 'Simulated storage signal — replace with real storage data in production',
  };

  // ─── Buyer Signal (NEW) ───────────────────────────
  const buyerInterestCount = await prisma.buyerInterest.count({
    where: { cropType: app.cropType, status: 'active' },
  });

  const buyerSignal = {
    cropType: app.cropType,
    region: app.farmer.region,
    activeBuyerInterests: buyerInterestCount,
    demandLevel: buyerInterestCount > 5 ? 'high' : buyerInterestCount > 0 ? 'moderate' : 'low',
    note: 'Based on expressed buyer interest in the platform',
  };

  // ─── Upsert result ────────────────────────────────
  const result = await prisma.intelligenceResult.upsert({
    where: { applicationId },
    update: {
      mlShadowScore, mlShadowConfidence,
      satelliteSignal, yieldSignal, relationshipSignal, anomalySignal,
      cropPredictionSignal, weatherSignal, marketSignal,
      chatbotSignal, analyticsSignal, storageSignal, buyerSignal,
    },
    create: {
      applicationId, mlShadowScore, mlShadowConfidence,
      satelliteSignal, yieldSignal, relationshipSignal, anomalySignal,
      cropPredictionSignal, weatherSignal, marketSignal,
      chatbotSignal, analyticsSignal, storageSignal, buyerSignal,
    },
  });

  // ─── Inject intelligence summary into verification & fraud ──
  const summary = {
    mlShadowScore,
    mlShadowConfidence,
    cropOutlook: cropPredictionSignal.expectedPerformance,
    weatherRisk: weatherSignal.droughtRisk,
    marketOutlook: marketSignal.priceOutlook,
    demandLevel: marketSignal.demandLevel,
    trustLevel: relationshipSignal.trustLevel,
    anomalyFlags: anomalySignal.flags,
    storageRisk: storageSignal.postHarvestLossRisk,
    buyerDemand: buyerSignal.demandLevel,
    generatedAt: new Date().toISOString(),
  };

  await Promise.all([
    injectVerificationSummary(applicationId, summary),
    injectFraudSummary(applicationId, summary),
  ]);

  return result;
}

export async function getIntelligenceResult(applicationId) {
  return prisma.intelligenceResult.findUnique({ where: { applicationId } });
}

// ─── Helper functions ──────────────────────────────────

function getEstimatedYield(cropType) {
  const yields = {
    maize: 2.5, rice: 3.0, wheat: 2.8, cassava: 12.0, sorghum: 1.8,
    millet: 1.5, groundnuts: 1.2, soybeans: 2.0, cotton: 1.0, coffee: 0.8,
    tea: 1.5, sugarcane: 60.0, tobacco: 2.0, beans: 1.5, sunflower: 1.8,
    cashew: 0.5, sisal: 1.0,
  };
  return yields[cropType?.toLowerCase()] || 2.0;
}

function getSeasonOutlook(cropType, region) {
  // Simulated seasonal outlook
  const outlooks = ['favorable', 'normal', 'challenging'];
  const hash = (cropType + region).length % 3;
  return outlooks[hash];
}

function getCropRiskFactors(cropType) {
  const risks = {
    maize: ['fall_armyworm', 'drought_sensitivity', 'post_harvest_loss'],
    wheat: ['rust_disease', 'heat_stress'],
    rice: ['water_availability', 'blast_disease'],
    coffee: ['coffee_berry_disease', 'price_volatility'],
    tea: ['frost_risk', 'labor_availability'],
    cashew: ['powdery_mildew', 'price_volatility'],
    cotton: ['bollworm', 'water_stress'],
  };
  return risks[cropType?.toLowerCase()] || ['general_pest_risk', 'weather_variability'];
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 5) return 'long_rains';
  if (month >= 9 && month <= 11) return 'short_rains';
  return 'dry_season';
}

function getCropDemandLevel(cropType) {
  const highDemand = ['maize', 'rice', 'wheat', 'coffee', 'tea'];
  const medDemand = ['beans', 'sorghum', 'cashew', 'cotton'];
  if (highDemand.includes(cropType?.toLowerCase())) return 'high';
  if (medDemand.includes(cropType?.toLowerCase())) return 'moderate';
  return 'low';
}

function getExportPotential(cropType, countryCode) {
  const exportCrops = {
    KE: ['tea', 'coffee', 'flowers', 'vegetables'],
    TZ: ['cashew', 'coffee', 'tobacco', 'cotton', 'sisal'],
  };
  const crops = exportCrops[countryCode] || exportCrops.KE;
  return crops.includes(cropType?.toLowerCase()) ? 'high' : 'domestic_focus';
}

function getStorageRecommendation(cropType) {
  const recs = {
    maize: 'hermetic_bag', wheat: 'silo', rice: 'hermetic_bag',
    coffee: 'warehouse', tea: 'warehouse', cashew: 'warehouse',
    beans: 'hermetic_bag', sorghum: 'hermetic_bag',
  };
  return recs[cropType?.toLowerCase()] || 'warehouse';
}

function getPostHarvestLossRisk(cropType) {
  const highRisk = ['maize', 'rice', 'cassava', 'vegetables'];
  const medRisk = ['wheat', 'beans', 'sorghum', 'groundnuts'];
  if (highRisk.includes(cropType?.toLowerCase())) return 'high';
  if (medRisk.includes(cropType?.toLowerCase())) return 'medium';
  return 'low';
}

async function getCropConcentration(cropType) {
  const total = await prisma.application.count();
  const cropCount = await prisma.application.count({ where: { cropType } });
  return total > 0 ? Math.round((cropCount / total) * 100) : 0;
}

async function getRegionConcentration(region) {
  const total = await prisma.application.count();
  const regionCount = await prisma.application.count({ where: { farmer: { region } } });
  return total > 0 ? Math.round((regionCount / total) * 100) : 0;
}
