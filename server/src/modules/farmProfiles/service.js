import prisma from '../../config/database.js';
import { computeLandSizeFields, isValidUnit } from '../../utils/landSize.js';

/**
 * Full A-Z crop codes (UPPERCASE). Kept in sync with src/utils/crops.js (frontend).
 * The backend accepts both uppercase codes ("MAIZE") and legacy lowercase ("maize").
 */
const KNOWN_CROP_CODES = new Set([
  // Forage / Tree Crops
  'ALFALFA', 'ALMOND',
  // Fruits A
  'APPLE', 'APRICOT', 'AVOCADO',
  // B
  'BANANA', 'BARLEY', 'BEAN', 'BEETROOT', 'BLACK_PEPPER', 'BLUEBERRY',
  // C
  'CABBAGE', 'CACAO', 'CARROT', 'CASSAVA', 'CAULIFLOWER', 'CHILI', 'COCOA', 'COCONUT', 'COFFEE', 'CORN', 'COTTON', 'COWPEA', 'CUCUMBER',
  // D
  'DATE', 'DRAGON_FRUIT',
  // E
  'EGGPLANT',
  // F
  'FIG',
  // G
  'GARLIC', 'GINGER', 'GRAPE', 'GROUNDNUT',
  // K
  'KALE',
  // L
  'LETTUCE',
  // M
  'MAIZE', 'MANGO', 'MILLET', 'MUSHROOM',
  // O
  'OKRA', 'ONION', 'ORANGE',
  // P
  'PAPAYA', 'PALM_OIL', 'PEA', 'PEACH', 'PEAR', 'PEPPER', 'PINEAPPLE', 'PLANTAIN', 'POTATO',
  // R
  'RICE',
  // S
  'SESAME', 'SORGHUM', 'SOYBEAN', 'SPINACH', 'SUGARCANE', 'SUNFLOWER', 'SWEET_POTATO',
  // T
  'TOMATO', 'TEA',
  // W
  'WATERMELON', 'WHEAT',
  // Y
  'YAM',
]);

/**
 * Legacy lowercase aliases that map to the new uppercase codes.
 * Handles old data like "beans" → accepted as "BEAN", "sweet_potato" → "SWEET_POTATO".
 */
const LEGACY_ALIASES = {
  beans: 'BEAN', chickpeas: 'BEAN', cowpeas: 'COWPEA', green_grams: 'BEAN',
  groundnuts: 'GROUNDNUT', lentils: 'BEAN', pigeon_peas: 'PEA', soybeans: 'SOYBEAN',
  irish_potato: 'POTATO', chilli: 'CHILI', napier_grass: 'ALFALFA',
  corn: 'CORN', peanut: 'GROUNDNUT', sweet_potato: 'SWEET_POTATO',
  palm_oil: 'PALM_OIL', black_pepper: 'BLACK_PEPPER', dragon_fruit: 'DRAGON_FRUIT',
};

const VALID_STAGES = ['planting', 'growing', 'flowering', 'harvest'];
const VALID_REC_STATUSES = ['pending', 'completed', 'skipped'];

// ─── Validation helpers ────────────────────────────────

export function validateCrop(crop) {
  if (!crop || typeof crop !== 'string') {
    const err = new Error('crop is required');
    err.statusCode = 400;
    throw err;
  }
  const trimmed = crop.trim();
  const upper = trimmed.toUpperCase();

  // Accept known crop codes (MAIZE) and legacy lowercase (maize)
  if (KNOWN_CROP_CODES.has(upper)) return;
  if (LEGACY_ALIASES[trimmed.toLowerCase()]) return;

  // Accept OTHER and OTHER:CustomName
  if (upper === 'OTHER') return;
  if (upper.startsWith('OTHER:')) {
    const customName = trimmed.slice(6).trim();
    if (customName.length === 0) return; // "OTHER:" treated as bare "OTHER"
    if (customName.length < 2) {
      const err = new Error('Custom crop name must be at least 2 characters');
      err.statusCode = 400;
      throw err;
    }
    return;
  }

  const err = new Error(`Unknown crop "${crop}". Use a known crop code or "OTHER:YourCropName".`);
  err.statusCode = 400;
  throw err;
}

export function validateStage(stage) {
  if (!VALID_STAGES.includes(stage)) {
    const err = new Error(`stage must be one of: ${VALID_STAGES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

export function validateRecStatus(status) {
  if (!VALID_REC_STATUSES.includes(status)) {
    const err = new Error(`status must be one of: ${VALID_REC_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

// ─── Farm Profile CRUD ─────────────────────────────────

export async function createFarmProfile(data, farmerId) {
  validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  if (!data.farmerName) {
    const err = new Error('farmerName is required');
    err.statusCode = 400;
    throw err;
  }

  // Compute normalized land size fields
  const landSize = computeLandSizeFields(data.landSizeValue ?? data.farmSizeAcres, data.landSizeUnit || 'ACRE');

  return prisma.farmProfile.create({
    data: {
      farmerId,
      farmerName: data.farmerName,
      farmName: data.farmName || null,
      locationName: data.locationName || null,
      latitude: data.latitude != null ? parseFloat(data.latitude) : null,
      longitude: data.longitude != null ? parseFloat(data.longitude) : null,
      crop: data.crop,
      farmSizeAcres: data.farmSizeAcres != null ? parseFloat(data.farmSizeAcres) : (landSize.landSizeUnit === 'ACRE' ? landSize.landSizeValue : null),
      landSizeValue: landSize.landSizeValue,
      landSizeUnit: landSize.landSizeUnit,
      landSizeHectares: landSize.landSizeHectares,
      stage: data.stage || 'planting',
    },
    include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
}

export async function getFarmProfile(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    include: { recommendations: { take: 5, orderBy: { createdAt: 'desc' } } },
  });
  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }
  return profile;
}

export async function listFarmProfiles(farmerId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.farmProfile.findMany({
      where: { farmerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { recommendations: { take: 1, orderBy: { createdAt: 'desc' } } },
    }),
    prisma.farmProfile.count({ where: { farmerId } }),
  ]);
  return { items, total, page, limit };
}

export async function updateFarmProfile(farmProfileId, data) {
  if (data.crop) validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  const updateData = {};
  if (data.farmerName !== undefined) updateData.farmerName = data.farmerName;
  if (data.farmName !== undefined) updateData.farmName = data.farmName;
  if (data.locationName !== undefined) updateData.locationName = data.locationName;
  if (data.latitude !== undefined) updateData.latitude = data.latitude != null ? parseFloat(data.latitude) : null;
  if (data.longitude !== undefined) updateData.longitude = data.longitude != null ? parseFloat(data.longitude) : null;
  if (data.crop !== undefined) updateData.crop = data.crop;
  if (data.farmSizeAcres !== undefined) updateData.farmSizeAcres = data.farmSizeAcres != null ? parseFloat(data.farmSizeAcres) : null;
  // Handle land size with unit
  if (data.landSizeValue !== undefined || data.landSizeUnit !== undefined) {
    const val = data.landSizeValue ?? updateData.farmSizeAcres;
    const unit = data.landSizeUnit || 'ACRE';
    const ls = computeLandSizeFields(val, unit);
    updateData.landSizeValue = ls.landSizeValue;
    updateData.landSizeUnit = ls.landSizeUnit;
    updateData.landSizeHectares = ls.landSizeHectares;
    // Keep farmSizeAcres in sync if unit is ACRE
    if (ls.landSizeUnit === 'ACRE' && ls.landSizeValue != null) {
      updateData.farmSizeAcres = ls.landSizeValue;
    }
  }
  if (data.stage !== undefined) updateData.stage = data.stage;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  return prisma.farmProfile.update({
    where: { id: farmProfileId },
    data: updateData,
    include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
}

// ─── Recommendation Records ────────────────────────────

export async function createRecommendation(farmProfileId, data) {
  if (!data.title || !data.action) {
    const err = new Error('title and action are required');
    err.statusCode = 400;
    throw err;
  }
  if (data.status) validateRecStatus(data.status);

  // Verify farm profile exists
  await getFarmProfile(farmProfileId);

  return prisma.recommendationRecord.create({
    data: {
      farmProfileId,
      title: data.title,
      action: data.action,
      urgency: data.urgency || null,
      confidence: data.confidence != null ? parseFloat(data.confidence) : null,
      reason: data.reason || null,
      nextReviewDays: data.nextReviewDays != null ? parseInt(data.nextReviewDays, 10) : null,
      score: data.score != null ? parseFloat(data.score) : null,
      status: data.status || 'pending',
      farmerNote: data.farmerNote || null,
    },
  });
}

export async function listRecommendations(farmProfileId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.recommendationRecord.findMany({
      where: { farmProfileId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.recommendationRecord.count({ where: { farmProfileId } }),
  ]);
  return { items, total, page, limit };
}

export async function updateRecommendation(recommendationId, data) {
  if (data.status) validateRecStatus(data.status);

  const updateData = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.farmerNote !== undefined) updateData.farmerNote = data.farmerNote;

  if (Object.keys(updateData).length === 0) {
    const err = new Error('No valid fields to update (allowed: status, farmerNote)');
    err.statusCode = 400;
    throw err;
  }

  return prisma.recommendationRecord.update({
    where: { id: recommendationId },
    data: updateData,
  });
}

// ─── Dashboard Summary ─────────────────────────────────

export async function getDashboardSummary(farmProfileId) {
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    include: {
      recommendations: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!profile) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }

  const statusCounts = await prisma.recommendationRecord.groupBy({
    by: ['status'],
    where: { farmProfileId },
    _count: true,
  });

  return {
    profile: {
      id: profile.id,
      farmerName: profile.farmerName,
      farmName: profile.farmName,
      crop: profile.crop,
      stage: profile.stage,
      farmSizeAcres: profile.farmSizeAcres,
      locationName: profile.locationName,
    },
    latestRecommendation: profile.recommendations[0] || null,
    recentActivity: profile.recommendations.slice(0, 3),
    recommendationStats: Object.fromEntries(
      statusCounts.map(s => [s.status, s._count])
    ),
  };
}
