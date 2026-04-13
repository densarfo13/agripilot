import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateUniqueFarmerUuid } from '../lib/farmerUuid.js';
import { validateFarmProfilePayload } from '../lib/validation.js';
import { writeAuditLog } from '../lib/audit.js';
import { computeLandSizeFields, fromHectares } from '../src/utils/landSize.js';

const router = express.Router();

// ─── Helper: map DB row → frontend-friendly object ──────
function mapProfile(profile) {
  if (!profile) return null;
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
    gpsLat: profile.latitude,
    gpsLng: profile.longitude,
    locationLabel: profile.locationLabel || null,
    status: profile.status || 'active',
    isDefault: profile.isDefault || false,
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
    const validation = validateFarmProfilePayload(req.body || {});
    if (!validation.isValid) {
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

    await writeAuditLog(req, {
      userId: req.user.id,
      action: existing ? 'farm_profile.updated' : 'farm_profile.created',
      entityType: 'FarmProfile',
      entityId: profile.id,
      metadata: { farmerUuid: profile.farmerUuid },
    });

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

export default router;
