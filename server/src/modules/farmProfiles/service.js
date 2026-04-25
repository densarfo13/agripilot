import prisma from '../../config/database.js';
import { computeLandSizeFields, isValidUnit, fromHectares } from '../../utils/landSize.js';
import { isFarmProfileComplete, getFarmerLifecycleState } from '../../utils/farmerLifecycle.js';
import { generateUniqueFarmerUuid } from '../../utils/farmerUuid.js';

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

/**
 * Normalize a crop string to uppercase.
 * Resolves legacy aliases. Preserves custom name casing in "OTHER:CustomName".
 */
export function normalizeCrop(crop) {
  if (!crop || typeof crop !== 'string') return crop;
  const trimmed = crop.trim();
  const upper = trimmed.toUpperCase();

  // Known crop code
  if (KNOWN_CROP_CODES.has(upper)) return upper;

  // Legacy alias
  const alias = LEGACY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  // OTHER:CustomName — uppercase prefix, preserve custom name casing
  if (upper.startsWith('OTHER:')) {
    const customName = trimmed.slice(6).trim();
    return customName.length > 0 ? `OTHER:${customName}` : 'OTHER';
  }
  if (upper === 'OTHER') return 'OTHER';

  // Fallback: return uppercased
  return upper;
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

// ─── Validation helper — throw 400 with message ──────
function validationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

// ─── Farm Profile CRUD ─────────────────────────────────

export async function createFarmProfile(data, farmerId) {
  validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  if (!data.farmerName) {
    throw validationError('farmerName is required');
  }
  if (typeof data.farmerName === 'string' && (data.farmerName.trim().length < 2 || data.farmerName.trim().length > 100)) {
    throw validationError('farmerName must be between 2 and 100 characters');
  }

  // Land size is required for a complete farm profile
  const rawSize = data.landSizeValue ?? data.farmSizeAcres;
  if (rawSize == null || rawSize === '') {
    throw validationError('Land size is required (landSizeValue or farmSizeAcres)');
  }
  const numericSize = typeof rawSize === 'string' ? parseFloat(rawSize) : rawSize;
  if (isNaN(numericSize) || numericSize <= 0) {
    throw validationError('Land size must be a positive number');
  }

  // Land size unit must be valid
  const unit = data.landSizeUnit || 'ACRE';
  if (!isValidUnit(unit)) {
    throw validationError('landSizeUnit must be one of: ACRE, HECTARE, SQUARE_METER');
  }

  const normalizedCrop = normalizeCrop(data.crop);

  // Validate coordinates if provided
  if (data.latitude != null || data.longitude != null) {
    if (data.latitude == null || data.longitude == null) {
      throw validationError('Both latitude and longitude are required when providing coordinates');
    }
    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw validationError('Latitude must be between -90 and 90');
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      throw validationError('Longitude must be between -180 and 180');
    }
  }

  // Compute normalized land size fields
  const landSize = computeLandSizeFields(data.landSizeValue ?? data.farmSizeAcres, data.landSizeUnit || 'ACRE');
  // Always compute farmSizeAcres from hectares for backward compat
  const computedAcres = landSize.landSizeHectares != null ? fromHectares(landSize.landSizeHectares, 'ACRE') : null;

  const farmerUuid = await generateUniqueFarmerUuid(prisma);
  return prisma.farmProfile.create({
    data: {
      farmerId,
      farmerUuid,
      farmerName: data.farmerName,
      farmName: data.farmName || null,
      locationName: data.locationName || null,
      latitude: data.latitude != null ? parseFloat(data.latitude) : null,
      longitude: data.longitude != null ? parseFloat(data.longitude) : null,
      crop: normalizedCrop,
      farmSizeAcres: computedAcres,
      landSizeValue: landSize.landSizeValue,
      landSizeUnit: landSize.landSizeUnit,
      landSizeHectares: landSize.landSizeHectares,
      // Persist normalizedAreaSqm at write time (Fix P1.4) so every
      // intelligence engine reads from a single canonical column
      // instead of recomputing on the fly.
      normalizedAreaSqm: landSize.normalizedAreaSqm,
      stage: data.stage || 'planting',
    },
    include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
  });
}

/**
 * Atomic farm setup — validates everything, creates profile + updates farmer in one transaction.
 * Returns { profile, farmProfileComplete, farmerUpdated }.
 * Prevents partial saves: if any step fails, the entire operation rolls back.
 */
export async function atomicFarmSetup(data, farmerId, userId) {
  // ── 1. Validate ALL fields upfront before touching the DB ──
  validateCrop(data.crop);
  if (data.stage) validateStage(data.stage);

  if (!data.farmerName || (typeof data.farmerName === 'string' && data.farmerName.trim().length < 2)) {
    throw validationError('farmerName is required (at least 2 characters)');
  }
  if (typeof data.farmerName === 'string' && data.farmerName.trim().length > 100) {
    throw validationError('farmerName must be at most 100 characters');
  }

  // Land size: required
  const rawSize = data.landSizeValue ?? data.farmSizeAcres;
  if (rawSize == null || rawSize === '') {
    throw validationError('Land size is required');
  }
  const numericSize = typeof rawSize === 'string' ? parseFloat(rawSize) : rawSize;
  if (isNaN(numericSize) || numericSize <= 0) {
    throw validationError('Land size must be a positive number');
  }

  // Land size unit: required + valid
  const unit = data.landSizeUnit || 'ACRE';
  if (!isValidUnit(unit)) {
    throw validationError('landSizeUnit must be one of: ACRE, HECTARE, SQUARE_METER');
  }

  // Country: required for farmProfileComplete
  const countryCode = data.countryCode;
  if (!countryCode || typeof countryCode !== 'string' || countryCode.trim().length < 2) {
    throw validationError('Country is required');
  }

  // Coordinates: optional but must be paired
  if (data.latitude != null || data.longitude != null) {
    if (data.latitude == null || data.longitude == null) {
      throw validationError('Both latitude and longitude are required when providing coordinates');
    }
    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw validationError('Latitude must be between -90 and 90');
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      throw validationError('Longitude must be between -180 and 180');
    }
  }

  // ── 2. Compute derived fields ──
  const normalizedCrop = normalizeCrop(data.crop);
  const landSize = computeLandSizeFields(rawSize, unit);
  const computedAcres = landSize.landSizeHectares != null ? fromHectares(landSize.landSizeHectares, 'ACRE') : null;

  // ── 3. Generate collision-safe UUID before transaction ──
  const farmerUuid = await generateUniqueFarmerUuid(prisma);

  // ── 4. Single atomic transaction: create profile + update farmer ──
  const result = await prisma.$transaction(async (tx) => {
    // 4a. Create farm profile (farmerUuid generated once, never changes on update)
    const profile = await tx.farmProfile.create({
      data: {
        farmerId,
        farmerUuid,
        farmerName: typeof data.farmerName === 'string' ? data.farmerName.trim() : data.farmerName,
        farmName: data.farmName || null,
        locationName: data.locationName || null,
        latitude: data.latitude != null ? parseFloat(data.latitude) : null,
        longitude: data.longitude != null ? parseFloat(data.longitude) : null,
        crop: normalizedCrop,
        farmSizeAcres: computedAcres,
        landSizeValue: landSize.landSizeValue,
        landSizeUnit: landSize.landSizeUnit,
        landSizeHectares: landSize.landSizeHectares,
        normalizedAreaSqm: landSize.normalizedAreaSqm,
        stage: data.stage || 'planting',
      },
      include: { recommendations: { take: 3, orderBy: { createdAt: 'desc' } } },
    });

    // 3b. Update farmer record: onboarding flag + gender/country/age in same tx
    const farmerUpdate = {};
    if (countryCode) farmerUpdate.countryCode = countryCode.trim().toUpperCase();
    if (data.gender) farmerUpdate.gender = data.gender;
    if (data.ageGroup) farmerUpdate.ageGroup = data.ageGroup;
    farmerUpdate.onboardingCompletedAt = new Date();

    await tx.farmer.update({
      where: { id: farmerId },
      data: farmerUpdate,
    });

    return profile;
  });

  // ── 4. Compute farmProfileComplete via shared lifecycle ──
  const { complete: farmProfileComplete, missing: missingRequiredFields } = isFarmProfileComplete(result, { countryCode });
  const { state: farmerState } = getFarmerLifecycleState({ farmProfile: result, countryCode });

  // ── 5. Mark onboarding completed on the User record (non-blocking) ──
  if (farmProfileComplete && userId) {
    import('../onboarding/service.js')
      .then(({ completeOnboarding }) => completeOnboarding(userId))
      .catch(err => console.error('[onboarding] Failed to complete onboarding:', err.message));
  }

  return { profile: result, farmProfileComplete, farmerState, missingRequiredFields };
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
  if (data.latitude !== undefined || data.longitude !== undefined) {
    const hasLat = data.latitude != null && data.latitude !== undefined;
    const hasLon = data.longitude != null && data.longitude !== undefined;
    if (hasLat !== hasLon) {
      const err = new Error('Both latitude and longitude are required when updating coordinates');
      err.statusCode = 400;
      throw err;
    }
    if (hasLat) {
      const lat = parseFloat(data.latitude);
      const lon = parseFloat(data.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        const err = new Error('Latitude must be between -90 and 90');
        err.statusCode = 400;
        throw err;
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        const err = new Error('Longitude must be between -180 and 180');
        err.statusCode = 400;
        throw err;
      }
      updateData.latitude = lat;
      updateData.longitude = lon;
    } else {
      updateData.latitude = null;
      updateData.longitude = null;
    }
  }
  if (data.crop !== undefined) updateData.crop = data.crop != null ? normalizeCrop(data.crop) : null;
  if (data.farmSizeAcres !== undefined) updateData.farmSizeAcres = data.farmSizeAcres != null ? parseFloat(data.farmSizeAcres) : null;
  // Handle land size with unit — always recompute hectares and farmSizeAcres
  if (data.landSizeValue !== undefined || data.landSizeUnit !== undefined || data.farmSizeAcres !== undefined) {
    const val = data.landSizeValue ?? data.farmSizeAcres;
    const unit = data.landSizeUnit || 'ACRE';
    const ls = computeLandSizeFields(val, unit);
    updateData.landSizeValue = ls.landSizeValue;
    updateData.landSizeUnit = ls.landSizeUnit;
    updateData.landSizeHectares = ls.landSizeHectares;
    // Persist normalizedAreaSqm at every write (Fix P1.4) so it never
    // drifts out of sync with the displayed size.
    updateData.normalizedAreaSqm = ls.normalizedAreaSqm;
    // Always keep farmSizeAcres in sync for backward compat
    updateData.farmSizeAcres = ls.landSizeHectares != null ? fromHectares(ls.landSizeHectares, 'ACRE') : null;
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
      landSizeValue: profile.landSizeValue,
      landSizeUnit: profile.landSizeUnit,
      landSizeHectares: profile.landSizeHectares,
      locationName: profile.locationName,
    },
    latestRecommendation: profile.recommendations[0] || null,
    recentActivity: profile.recommendations.slice(0, 3),
    recommendationStats: Object.fromEntries(
      statusCounts.map(s => [s.status, s._count])
    ),
  };
}
