import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateUniqueFarmerUuid } from '../lib/farmerUuid.js';
import { validateFarmProfilePayload } from '../lib/validation.js';
import { farmProfileSchema, farmerTypeSchema, validateWithZod } from '../lib/farmProfileSchema.js';
import { farmStageSchema } from '../lib/farmStageSchema.js';
import { seasonalTimingSchema } from '../lib/seasonalTimingSchema.js';
import { ALL_ACCEPTED_STAGES, CROP_STAGES } from '../lib/cropStages.js';
import { SEASONAL_FIELDS } from '../lib/seasonalTiming.js';
import { writeAuditLog } from '../lib/audit.js';
import { computeLandSizeFields, fromHectares } from '../src/utils/landSize.js';
import { recordCropUsage } from './cropSuggestions.js';

const router = express.Router();

// ─── Helper: parse stored crop value into structured fields ──
function parseCrop(stored) {
  if (!stored) return { cropType: null, cropCategory: null, cropName: null };
  const upper = stored.toUpperCase().trim();
  if (upper.startsWith('OTHER:')) {
    const custom = stored.slice(6).trim();
    return { cropType: stored, cropCategory: 'other', cropName: custom || null };
  }
  if (upper === 'OTHER') {
    return { cropType: 'OTHER', cropCategory: 'other', cropName: null };
  }
  return { cropType: stored, cropCategory: 'standard', cropName: stored };
}

// ─── Helper: map DB row → frontend-friendly object ──────
function mapProfile(profile) {
  if (!profile) return null;
  const crop = parseCrop(profile.crop);
  return {
    id: profile.id,
    farmerUuid: profile.farmerUuid,
    farmerName: profile.farmerName,
    farmName: profile.farmName,
    country: profile.country,
    location: profile.locationName,
    size: profile.landSizeValue ?? profile.farmSizeAcres,
    sizeUnit: profile.landSizeUnit || (profile.farmSizeAcres != null ? 'ACRE' : null),
    cropType: profile.crop,
    cropCategory: crop.cropCategory,
    cropName: crop.cropName,
    gpsLat: profile.latitude,
    gpsLng: profile.longitude,
    locationLabel: profile.locationLabel || null,
    cropStage: profile.stage || 'planning',
    plantedAt: profile.plantedAt || null,
    seasonStartMonth: profile.seasonStartMonth ?? null,
    seasonEndMonth: profile.seasonEndMonth ?? null,
    plantingWindowStartMonth: profile.plantingWindowStartMonth ?? null,
    plantingWindowEndMonth: profile.plantingWindowEndMonth ?? null,
    currentSeasonLabel: profile.currentSeasonLabel || null,
    lastRainySeasonStart: profile.lastRainySeasonStart || null,
    lastDrySeasonStart: profile.lastDrySeasonStart || null,
    status: profile.status || 'active',
    isDefault: profile.isDefault || false,
    experienceLevel: profile.experienceLevel || null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

// ─── Get default/primary farm profile ───────────────────
// Returns the default farm, or the most recent active farm, or any farm
router.get('/', authenticate, async (req, res) => {
  try {
    // Prefer default farm, fall back to most recent active
    let profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, isDefault: true, status: 'active' },
    });
    if (!profile) {
      profile = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
    }

    return res.json({ success: true, profile: mapProfile(profile) });
  } catch (error) {
    console.error('GET /api/v2/farm-profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load farm profile' });
  }
});

// ─── List all farms for this user ───────────────────────
router.get('/list', authenticate, async (req, res) => {
  try {
    const farms = await prisma.farmProfile.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { status: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      farms: farms.map(mapProfile),
    });
  } catch (error) {
    console.error('GET /api/v2/farm-profile/list failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to list farm profiles' });
  }
});

// ─── Create / Update Profile ────────────────────────────
router.post('/', authenticate, async (req, res) => {
  try {
    console.log('[FARM-SAVE] userId:', req.user?.id, 'body keys:', Object.keys(req.body || {}), 'farmerName:', JSON.stringify(req.body?.farmerName), 'farmName:', JSON.stringify(req.body?.farmName));
    const validation = validateFarmProfilePayload(req.body || {});
    if (!validation.isValid) {
      console.log('[FARM-SAVE] Validation failed:', JSON.stringify(validation.errors));
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    // Find target farm: explicit ID, or default, or most recent active
    const targetId = req.body?._farmProfileId || null;
    let existing;
    if (targetId) {
      existing = await prisma.farmProfile.findFirst({
        where: { id: targetId, userId: req.user.id },
        select: { id: true, farmerUuid: true },
      });
    } else {
      existing = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, isDefault: true, status: 'active' },
        select: { id: true, farmerUuid: true },
      });
      if (!existing) {
        existing = await prisma.farmProfile.findFirst({
          where: { userId: req.user.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, farmerUuid: true },
        });
      }
    }

    let farmerUuid = existing?.farmerUuid;
    if (!farmerUuid) {
      farmerUuid = await generateUniqueFarmerUuid(prisma);
    }

    // Compute normalized land size fields (value + unit + hectares)
    const ls = computeLandSizeFields(validation.data.size, validation.data.sizeUnit);
    // Backward compat: also compute farmSizeAcres from hectares
    const farmSizeAcres = ls.landSizeHectares != null
      ? fromHectares(ls.landSizeHectares, 'ACRE')
      : validation.data.size; // fallback: raw value as acres (legacy behavior)

    // Map frontend field names to existing schema field names
    const profileData = {
      farmerName: validation.data.farmerName,
      farmName: validation.data.farmName,
      country: validation.data.country,
      locationName: validation.data.location,
      crop: validation.data.cropType,
      farmSizeAcres,
      landSizeValue: ls.landSizeValue,
      landSizeUnit: ls.landSizeUnit,
      landSizeHectares: ls.landSizeHectares,
      latitude: validation.data.gpsLat,
      longitude: validation.data.gpsLng,
    };

    // Experience level — optional, only set if provided
    if (validation.data.experienceLevel != null) {
      profileData.experienceLevel = validation.data.experienceLevel;
    }

    // U.S. state-aware fields — optional, only set if provided so
    // non-U.S. farms and legacy clients keep the columns NULL.
    if (validation.data.stateCode != null)     profileData.stateCode     = validation.data.stateCode;
    if (validation.data.farmType != null)      profileData.farmType      = validation.data.farmType;
    if (validation.data.beginnerLevel != null) profileData.beginnerLevel = validation.data.beginnerLevel;
    if (validation.data.growingStyle != null)  profileData.growingStyle  = validation.data.growingStyle;
    if (validation.data.farmPurpose != null)   profileData.farmPurpose   = validation.data.farmPurpose;

    // Crop stage — Zod-validated, optional on save
    if (req.body?.cropStage) {
      const stageResult = farmStageSchema.shape.cropStage.safeParse(req.body.cropStage);
      if (stageResult.success) {
        profileData.stage = stageResult.data;
      }
    }
    if (req.body?.plantedAt) {
      profileData.plantedAt = new Date(req.body.plantedAt);
    }

    // Store cached location label if provided by frontend
    if (req.body?.locationLabel != null) {
      profileData.locationLabel = req.body.locationLabel || null;
    }

    let profile;
    if (existing) {
      profile = await prisma.farmProfile.update({
        where: { id: existing.id },
        data: profileData,
      });
    } else {
      // First farm for this user — make it default
      profile = await prisma.farmProfile.create({
        data: {
          userId: req.user.id,
          farmerUuid,
          status: 'active',
          isDefault: true,
          ...profileData,
        },
      });
    }

    // Track onboarding step on user record (non-blocking)
    prisma.user.update({
      where: { id: req.user.id },
      data: {
        onboardingStatus: 'in_progress',
        onboardingLastStep: 'farm_profile',
        ...(!existing ? { onboardingStartedAt: new Date() } : {}),
      },
    }).catch((e) => console.error('Onboarding tracking update failed:', e));

    await writeAuditLog(req, {
      userId: req.user.id,
      action: existing ? 'farm_profile.updated' : 'farm_profile.created',
      entityType: 'FarmProfile',
      entityId: profile.id,
      metadata: { farmerUuid: profile.farmerUuid },
    });

    // Record crop usage for adaptive suggestions (non-blocking)
    recordCropUsage(profile.crop, profile.country, profile.locationName);

    return res.json({ success: true, profile: mapProfile(profile) });
  } catch (error) {
    console.error('POST /api/v2/farm-profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save farm profile' });
  }
});

// ─── Create a NEW farm (add another land) ───────────────
// Does NOT deactivate other farms — multiple farms stay active
router.post('/new', authenticate, async (req, res) => {
  try {
    const validation = validateFarmProfilePayload(req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: validation.errors,
      });
    }

    // ─── Duplicate protection: same name + same location + same user ───
    const dupCheck = await prisma.farmProfile.findFirst({
      where: {
        userId: req.user.id,
        farmName: validation.data.farmName?.trim() || null,
        locationName: validation.data.location?.trim() || null,
        status: { not: 'archived' },
      },
      select: { id: true, farmName: true },
    });
    if (dupCheck) {
      return res.status(409).json({
        success: false,
        error: 'A farm with the same name and location already exists.',
        duplicateFarmId: dupCheck.id,
      });
    }

    const farmerUuid = await generateUniqueFarmerUuid(prisma);

    const ls = computeLandSizeFields(validation.data.size, validation.data.sizeUnit);
    const farmSizeAcres = ls.landSizeHectares != null
      ? fromHectares(ls.landSizeHectares, 'ACRE')
      : validation.data.size;

    const profileData = {
      farmerName: validation.data.farmerName,
      farmName: validation.data.farmName,
      country: validation.data.country,
      locationName: validation.data.location,
      crop: validation.data.cropType,
      farmSizeAcres,
      landSizeValue: ls.landSizeValue,
      landSizeUnit: ls.landSizeUnit,
      landSizeHectares: ls.landSizeHectares,
      latitude: validation.data.gpsLat,
      longitude: validation.data.gpsLng,
    };

    // Experience level — optional, only set if provided
    if (validation.data.experienceLevel != null) {
      profileData.experienceLevel = validation.data.experienceLevel;
    }

    // U.S. state-aware fields — optional, symmetric with the POST path above.
    if (validation.data.stateCode != null)     profileData.stateCode     = validation.data.stateCode;
    if (validation.data.farmType != null)      profileData.farmType      = validation.data.farmType;
    if (validation.data.beginnerLevel != null) profileData.beginnerLevel = validation.data.beginnerLevel;
    if (validation.data.growingStyle != null)  profileData.growingStyle  = validation.data.growingStyle;
    if (validation.data.farmPurpose != null)   profileData.farmPurpose   = validation.data.farmPurpose;

    // Crop stage — Zod-validated, optional on new farm
    if (req.body?.cropStage) {
      const stageResult = farmStageSchema.shape.cropStage.safeParse(req.body.cropStage);
      if (stageResult.success) {
        profileData.stage = stageResult.data;
      }
    }
    if (req.body?.plantedAt) {
      profileData.plantedAt = new Date(req.body.plantedAt);
    }

    // Store cached location label if provided by frontend
    if (req.body?.locationLabel != null) {
      profileData.locationLabel = req.body.locationLabel || null;
    }

    // Check if user has any existing farms
    const existingCount = await prisma.farmProfile.count({
      where: { userId: req.user.id, status: 'active' },
    });

    // New farm is active. If no existing farms, also make it default.
    const profile = await prisma.farmProfile.create({
      data: {
        userId: req.user.id,
        farmerUuid,
        status: 'active',
        isDefault: existingCount === 0,
        ...profileData,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.created_new',
      entityType: 'FarmProfile',
      entityId: profile.id,
      metadata: { farmerUuid: profile.farmerUuid },
    });

    // Record crop usage for adaptive suggestions (non-blocking)
    recordCropUsage(profile.crop, profile.country, profile.locationName);

    return res.status(201).json({ success: true, profile: mapProfile(profile) });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/new failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to create new farm profile' });
  }
});

// ─── Set default farm ───────────────────────────────────
// Only one farm can be default at a time
router.post('/:id/set-default', authenticate, async (req, res) => {
  try {
    const target = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (target.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Only active farms can be set as default' });
    }

    // Unset all defaults, then set target — atomic transaction
    await prisma.$transaction([
      prisma.farmProfile.updateMany({
        where: { userId: req.user.id, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.farmProfile.update({
        where: { id: target.id },
        data: { isDefault: true },
      }),
    ]);

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.set_default',
      entityType: 'FarmProfile',
      entityId: target.id,
      metadata: { farmName: target.farmName },
    });

    const updated = await prisma.farmProfile.findUnique({ where: { id: target.id } });
    return res.json({ success: true, profile: mapProfile(updated) });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/:id/set-default failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to set default farm' });
  }
});

// ─── Activate a farm (reactivate from inactive) ─────────
// Does NOT deactivate others — multiple farms can be active
router.post('/:id/activate', authenticate, async (req, res) => {
  try {
    const target = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (target.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Cannot activate an archived farm. Restore it first.' });
    }

    if (target.status === 'active') {
      return res.json({ success: true, profile: mapProfile(target) });
    }

    await prisma.farmProfile.update({
      where: { id: target.id },
      data: { status: 'active' },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.activated',
      entityType: 'FarmProfile',
      entityId: target.id,
      metadata: { farmName: target.farmName },
    });

    const updated = await prisma.farmProfile.findUnique({ where: { id: target.id } });
    return res.json({ success: true, profile: mapProfile(updated) });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/:id/activate failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to activate farm' });
  }
});

// ─── Deactivate a farm ──────────────────────────────────
// Sets to inactive — no new updates/seasons, but history kept
router.post('/:id/deactivate', authenticate, async (req, res) => {
  try {
    const target = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (target.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Farm is not active' });
    }

    const wasDefault = target.isDefault;

    await prisma.farmProfile.update({
      where: { id: target.id },
      data: { status: 'inactive', isDefault: false },
    });

    // If deactivated farm was default, promote next active farm
    if (wasDefault) {
      const next = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, status: 'active', id: { not: target.id } },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await prisma.farmProfile.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.deactivated',
      entityType: 'FarmProfile',
      entityId: target.id,
      metadata: { farmName: target.farmName, wasDefault },
    });

    return res.json({ success: true, deactivated: true });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/:id/deactivate failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to deactivate farm' });
  }
});

// ─── Archive a farm ─────────────────────────────────────
router.post('/:id/archive', authenticate, async (req, res) => {
  try {
    const target = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (target.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Farm is already archived' });
    }

    const wasDefault = target.isDefault;
    const wasActive = target.status === 'active';

    await prisma.farmProfile.update({
      where: { id: target.id },
      data: { status: 'archived', isDefault: false },
    });

    // If archived farm was default, promote next active farm
    if (wasDefault) {
      const next = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, status: 'active', id: { not: target.id } },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await prisma.farmProfile.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.archived',
      entityType: 'FarmProfile',
      entityId: target.id,
      metadata: { farmName: target.farmName, wasActive, wasDefault },
    });

    return res.json({ success: true, archived: true });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/:id/archive failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to archive farm' });
  }
});

// ─── Edit an existing farm ─────────────────────────────
// PATCH /:id — update farm name, location, size, crop, status
// Ownership enforced: userId must match req.user.id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const target = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!target) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    // Only allow updating specific fields — never userId, farmerUuid
    const allowedFields = [
      'farmerName', 'farmName', 'country', 'location', 'cropType',
      'size', 'sizeUnit', 'gpsLat', 'gpsLng', 'locationLabel', 'experienceLevel',
      'cropStage', 'plantedAt',
      // U.S. state-aware fields (all optional)
      'stateCode', 'farmType', 'beginnerLevel', 'growingStyle', 'farmPurpose',
      ...SEASONAL_FIELDS,
    ];
    const patch = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }

    // If size/sizeUnit changed, recompute normalized fields
    const sizeVal = patch.size ?? target.landSizeValue;
    const sizeUnit = patch.sizeUnit ?? target.landSizeUnit ?? 'ACRE';
    if (patch.size !== undefined || patch.sizeUnit !== undefined) {
      const ls = computeLandSizeFields(sizeVal, sizeUnit);
      patch.landSizeValue = ls.landSizeValue;
      patch.landSizeUnit = ls.landSizeUnit;
      patch.landSizeHectares = ls.landSizeHectares;
      patch.farmSizeAcres = ls.landSizeHectares != null
        ? fromHectares(ls.landSizeHectares, 'ACRE')
        : sizeVal;
    }

    // Map frontend field names to schema columns
    const data = {};
    if (patch.farmerName !== undefined) data.farmerName = patch.farmerName;
    if (patch.farmName !== undefined) data.farmName = patch.farmName;
    if (patch.country !== undefined) data.country = patch.country;
    if (patch.location !== undefined) data.locationName = patch.location;
    if (patch.cropType !== undefined) data.crop = patch.cropType;
    if (patch.gpsLat !== undefined) data.latitude = patch.gpsLat;
    if (patch.gpsLng !== undefined) data.longitude = patch.gpsLng;
    if (patch.locationLabel !== undefined) data.locationLabel = patch.locationLabel || null;
    if (patch.experienceLevel !== undefined) data.experienceLevel = patch.experienceLevel;
    // U.S. state-aware fields — normalize casing where relevant.
    if (patch.stateCode !== undefined)    data.stateCode     = patch.stateCode ? String(patch.stateCode).toUpperCase() : null;
    if (patch.farmType !== undefined)     data.farmType      = patch.farmType ? String(patch.farmType).toLowerCase() : null;
    if (patch.beginnerLevel !== undefined) data.beginnerLevel = patch.beginnerLevel ? String(patch.beginnerLevel).toLowerCase() : null;
    if (patch.growingStyle !== undefined) data.growingStyle  = patch.growingStyle ? String(patch.growingStyle).toLowerCase() : null;
    if (patch.farmPurpose !== undefined)  data.farmPurpose   = patch.farmPurpose ? String(patch.farmPurpose).toLowerCase() : null;
    if (patch.landSizeValue !== undefined) data.landSizeValue = patch.landSizeValue;
    if (patch.landSizeUnit !== undefined) data.landSizeUnit = patch.landSizeUnit;
    if (patch.landSizeHectares !== undefined) data.landSizeHectares = patch.landSizeHectares;
    if (patch.farmSizeAcres !== undefined) data.farmSizeAcres = patch.farmSizeAcres;

    // Crop stage — Zod-validated against known stages
    if (patch.cropStage !== undefined) {
      const stageResult = farmStageSchema.shape.cropStage.safeParse(patch.cropStage);
      if (stageResult.success) {
        data.stage = stageResult.data;
      }
    }
    if (patch.plantedAt !== undefined) {
      data.plantedAt = patch.plantedAt ? new Date(patch.plantedAt) : null;
    }

    // Seasonal timing — Zod-validated
    const seasonalPatch = {};
    for (const f of SEASONAL_FIELDS) {
      if (patch[f] !== undefined) seasonalPatch[f] = patch[f];
    }
    if (Object.keys(seasonalPatch).length > 0) {
      const stResult = seasonalTimingSchema.safeParse(seasonalPatch);
      if (stResult.success) {
        const sd = stResult.data;
        if (sd.seasonStartMonth !== undefined) data.seasonStartMonth = sd.seasonStartMonth;
        if (sd.seasonEndMonth !== undefined) data.seasonEndMonth = sd.seasonEndMonth;
        if (sd.plantingWindowStartMonth !== undefined) data.plantingWindowStartMonth = sd.plantingWindowStartMonth;
        if (sd.plantingWindowEndMonth !== undefined) data.plantingWindowEndMonth = sd.plantingWindowEndMonth;
        if (sd.currentSeasonLabel !== undefined) data.currentSeasonLabel = sd.currentSeasonLabel;
        if (sd.lastRainySeasonStart !== undefined) {
          data.lastRainySeasonStart = sd.lastRainySeasonStart ? new Date(sd.lastRainySeasonStart) : null;
        }
        if (sd.lastDrySeasonStart !== undefined) {
          data.lastDrySeasonStart = sd.lastDrySeasonStart ? new Date(sd.lastDrySeasonStart) : null;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return res.json({ success: true, profile: mapProfile(target) });
    }

    const updated = await prisma.farmProfile.update({
      where: { id: target.id },
      data,
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.edited',
      entityType: 'FarmProfile',
      entityId: target.id,
      metadata: { fields: Object.keys(data) },
    });

    // Record crop usage if crop changed
    if (data.crop) {
      recordCropUsage(data.crop, updated.country, updated.locationName);
    }

    return res.json({ success: true, profile: mapProfile(updated) });
  } catch (error) {
    console.error('PATCH /api/v2/farm-profile/:id failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update farm' });
  }
});

// ─── Get seasonal timing for a farm ────────────────────
// GET /:id/seasonal-timing
// Ownership enforced: userId must match req.user.id
router.get('/:id/seasonal-timing', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: {
        id: true, farmName: true, status: true,
        seasonStartMonth: true, seasonEndMonth: true,
        plantingWindowStartMonth: true, plantingWindowEndMonth: true,
        currentSeasonLabel: true, lastRainySeasonStart: true, lastDrySeasonStart: true,
      },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    return res.json({
      success: true,
      farmId: farm.id,
      farmName: farm.farmName,
      seasonStartMonth: farm.seasonStartMonth,
      seasonEndMonth: farm.seasonEndMonth,
      plantingWindowStartMonth: farm.plantingWindowStartMonth,
      plantingWindowEndMonth: farm.plantingWindowEndMonth,
      currentSeasonLabel: farm.currentSeasonLabel,
      lastRainySeasonStart: farm.lastRainySeasonStart,
      lastDrySeasonStart: farm.lastDrySeasonStart,
    });
  } catch (error) {
    console.error('GET /api/v2/farm-profile/:id/seasonal-timing failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch seasonal timing' });
  }
});

// ─── Update seasonal timing for a farm ─────────────────
// PATCH /:id/seasonal-timing — Zod-validated
// Ownership enforced: userId must match req.user.id
router.patch('/:id/seasonal-timing', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, status: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (farm.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Cannot update seasonal timing on archived farm' });
    }

    const zodResult = validateWithZod(seasonalTimingSchema, req.body || {});
    if (!zodResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: zodResult.errors,
      });
    }

    const data = {};
    const sd = zodResult.data;
    if (sd.seasonStartMonth !== undefined) data.seasonStartMonth = sd.seasonStartMonth;
    if (sd.seasonEndMonth !== undefined) data.seasonEndMonth = sd.seasonEndMonth;
    if (sd.plantingWindowStartMonth !== undefined) data.plantingWindowStartMonth = sd.plantingWindowStartMonth;
    if (sd.plantingWindowEndMonth !== undefined) data.plantingWindowEndMonth = sd.plantingWindowEndMonth;
    if (sd.currentSeasonLabel !== undefined) data.currentSeasonLabel = sd.currentSeasonLabel;
    if (sd.lastRainySeasonStart !== undefined) {
      data.lastRainySeasonStart = sd.lastRainySeasonStart ? new Date(sd.lastRainySeasonStart) : null;
    }
    if (sd.lastDrySeasonStart !== undefined) {
      data.lastDrySeasonStart = sd.lastDrySeasonStart ? new Date(sd.lastDrySeasonStart) : null;
    }

    if (Object.keys(data).length === 0) {
      return res.json({ success: true, message: 'No changes' });
    }

    const updated = await prisma.farmProfile.update({
      where: { id: farm.id },
      data,
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.seasonal_timing_updated',
      entityType: 'FarmProfile',
      entityId: farm.id,
      metadata: { fields: Object.keys(data) },
    });

    return res.json({
      success: true,
      farmId: updated.id,
      seasonStartMonth: updated.seasonStartMonth,
      seasonEndMonth: updated.seasonEndMonth,
      plantingWindowStartMonth: updated.plantingWindowStartMonth,
      plantingWindowEndMonth: updated.plantingWindowEndMonth,
      currentSeasonLabel: updated.currentSeasonLabel,
      lastRainySeasonStart: updated.lastRainySeasonStart,
      lastDrySeasonStart: updated.lastDrySeasonStart,
    });
  } catch (error) {
    console.error('PATCH /api/v2/farm-profile/:id/seasonal-timing failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update seasonal timing' });
  }
});

// ─── Get current crop stage for a farm ─────────────────
// GET /:id/stage — returns cropStage, plantedAt, crop
// Ownership enforced: userId must match req.user.id
router.get('/:id/stage', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, stage: true, plantedAt: true, crop: true, farmName: true, status: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    return res.json({
      success: true,
      farmId: farm.id,
      farmName: farm.farmName,
      cropStage: farm.stage || null,
      plantedAt: farm.plantedAt || null,
      crop: farm.crop,
      status: farm.status,
    });
  } catch (error) {
    console.error('GET /api/v2/farm-profile/:id/stage failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch crop stage' });
  }
});

// ─── Update crop stage for a farm ──────────────────────
// PATCH /:id/stage — Zod-validated cropStage + optional plantedAt
// Ownership enforced: userId must match req.user.id
router.patch('/:id/stage', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, stage: true, status: true },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (farm.status === 'archived') {
      return res.status(400).json({ success: false, error: 'Cannot update stage on archived farm' });
    }

    // Zod validation
    const zodResult = validateWithZod(farmStageSchema, req.body || {});
    if (!zodResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: zodResult.errors,
      });
    }

    const data = { stage: zodResult.data.cropStage };
    if (zodResult.data.plantedAt) {
      data.plantedAt = new Date(zodResult.data.plantedAt);
    } else if (zodResult.data.plantedAt === null) {
      data.plantedAt = null;
    }

    const updated = await prisma.farmProfile.update({
      where: { id: farm.id },
      data,
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.stage_updated',
      entityType: 'FarmProfile',
      entityId: farm.id,
      metadata: { from: farm.stage, to: zodResult.data.cropStage },
    });

    return res.json({
      success: true,
      farmId: updated.id,
      cropStage: updated.stage,
      plantedAt: updated.plantedAt,
    });
  } catch (error) {
    console.error('PATCH /api/v2/farm-profile/:id/stage failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to update crop stage' });
  }
});

// ─── Save farmer type (onboarding classification) ─────
// Validates with Zod, updates experienceLevel on the default farm profile
router.post('/farmer-type', authenticate, async (req, res) => {
  try {
    const zodResult = validateWithZod(farmerTypeSchema, req.body || {});
    if (!zodResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        fieldErrors: zodResult.errors,
      });
    }

    const { farmerType } = zodResult.data;

    // Find default or most recent profile
    let profile = await prisma.farmProfile.findFirst({
      where: { userId: req.user.id, isDefault: true, status: 'active' },
    });
    if (!profile) {
      profile = await prisma.farmProfile.findFirst({
        where: { userId: req.user.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'No farm profile found. Complete farm profile setup first.',
      });
    }

    // Atomic: update profile + mark onboarding step on user
    const [updated] = await prisma.$transaction([
      prisma.farmProfile.update({
        where: { id: profile.id },
        data: { experienceLevel: farmerType },
      }),
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          onboardingLastStep: 'farmer_type',
          onboardingStatus: 'completed',
          onboardedAt: new Date(),
        },
      }),
    ]);

    await writeAuditLog(req, {
      userId: req.user.id,
      action: 'farm_profile.farmer_type_set',
      entityType: 'FarmProfile',
      entityId: profile.id,
      metadata: { farmerType },
    });

    console.log(`Farmer type set: userId=${req.user.id}, type=${farmerType}`);
    return res.json({ success: true, profile: mapProfile(updated) });
  } catch (error) {
    console.error('POST /api/v2/farm-profile/farmer-type failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save farmer type' });
  }
});

export default router;
