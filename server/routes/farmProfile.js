import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateUniqueFarmerUuid } from '../lib/farmerUuid.js';
import { validateFarmProfilePayload } from '../lib/validation.js';
import { writeAuditLog } from '../lib/audit.js';

const router = express.Router();

// ─── Get Profile ───────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const profile = await prisma.farmProfile.findUnique({
      where: { userId: req.user.id },
    });

    // Map internal field names to frontend-expected names
    const mapped = profile
      ? {
          id: profile.id,
          farmerUuid: profile.farmerUuid,
          farmerName: profile.farmerName,
          farmName: profile.farmName,
          country: profile.country,
          location: profile.locationName,
          size: profile.farmSizeAcres,
          cropType: profile.crop,
          gpsLat: profile.latitude,
          gpsLng: profile.longitude,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        }
      : null;

    return res.json({ success: true, profile: mapped });
  } catch (error) {
    console.error('GET /api/v2/farm-profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load farm profile' });
  }
});

// ─── Create / Update Profile ───────────────────────────────
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

    const existing = await prisma.farmProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, farmerUuid: true },
    });

    let farmerUuid = existing?.farmerUuid;
    if (!farmerUuid) {
      farmerUuid = await generateUniqueFarmerUuid(prisma);
    }

    // Map frontend field names to existing schema field names
    const profileData = {
      farmerName: validation.data.farmerName,
      farmName: validation.data.farmName,
      country: validation.data.country,
      locationName: validation.data.location,
      crop: validation.data.cropType,
      farmSizeAcres: validation.data.size,
      latitude: validation.data.gpsLat,
      longitude: validation.data.gpsLng,
    };

    const profile = await prisma.farmProfile.upsert({
      where: { userId: req.user.id },
      update: profileData,
      create: {
        userId: req.user.id,
        farmerUuid,
        ...profileData,
      },
    });

    await writeAuditLog(req, {
      userId: req.user.id,
      action: existing ? 'farm_profile.updated' : 'farm_profile.created',
      entityType: 'FarmProfile',
      entityId: profile.id,
      metadata: { farmerUuid: profile.farmerUuid },
    });

    // Return mapped profile
    const mapped = {
      id: profile.id,
      farmerUuid: profile.farmerUuid,
      farmerName: profile.farmerName,
      farmName: profile.farmName,
      country: profile.country,
      location: profile.locationName,
      size: profile.farmSizeAcres,
      cropType: profile.crop,
      gpsLat: profile.latitude,
      gpsLng: profile.longitude,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };

    return res.json({ success: true, profile: mapped });
  } catch (error) {
    console.error('POST /api/v2/farm-profile failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to save farm profile' });
  }
});

export default router;
