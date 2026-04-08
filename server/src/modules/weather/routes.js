import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import { validateParamUUID, isValidUUID } from '../../middleware/validate.js';
import * as weatherService from './service.js';
import prisma from '../../config/database.js';

const router = Router();
router.use(authenticate);

// ─── Resolve farmerId from authenticated user ──────────
async function resolveFarmerId(req) {
  if (req.user.role === 'farmer') {
    const farmer = await prisma.farmer.findUnique({ where: { userId: req.user.sub }, select: { id: true } });
    if (!farmer) {
      const err = new Error('Farmer profile not found for this user');
      err.statusCode = 404;
      throw err;
    }
    return farmer.id;
  }
  return null;
}

// ─── Ownership guard ───────────────────────────────────
async function verifyFarmProfileOwnership(req, farmProfileId) {
  if (req.user.role !== 'farmer') return;
  const profile = await prisma.farmProfile.findUnique({
    where: { id: farmProfileId },
    select: { farmer: { select: { userId: true } } },
  });
  if (!profile || profile.farmer.userId !== req.user.sub) {
    const err = new Error('Farm profile not found');
    err.statusCode = 404;
    throw err;
  }
}

// ─── GET /api/v1/weather?lat=...&lng=... ───────────────
// Generic weather lookup by coordinates
router.get('/', asyncHandler(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid lat (-90 to 90) and lng (-180 to 180) are required' });
  }

  const { weather, source } = await weatherService.getWeatherByCoords(lat, lng);
  res.json({ ...weather, _source: source });
}));

// ─── GET /api/v1/farms/:farmId/weather ─────────────────
// Weather for a specific farm profile (uses stored coordinates)
router.get('/farms/:farmId/weather', validateParamUUID('farmId'), asyncHandler(async (req, res) => {
  await verifyFarmProfileOwnership(req, req.params.farmId);
  const { weather, source } = await weatherService.getWeatherForFarm(req.params.farmId);
  res.json({ ...weather, _source: source });
}));

// ─── POST /api/v1/insights/recommend ───────────────────
// Weather-enriched recommendation endpoint
router.post('/insights/recommend', asyncHandler(async (req, res) => {
  const { farmProfileId, crop, stage, weather: explicitWeather } = req.body;

  // Validate farmProfileId if provided
  if (farmProfileId) {
    if (!isValidUUID(farmProfileId)) {
      return res.status(400).json({ error: 'farmProfileId must be a valid UUID' });
    }
    await verifyFarmProfileOwnership(req, farmProfileId);
  }

  // If no farmProfileId, require crop at minimum
  if (!farmProfileId && !crop) {
    return res.status(400).json({ error: 'Either farmProfileId or crop is required' });
  }

  // Resolve crop/stage from farm profile if not explicitly provided
  let resolvedCrop = crop;
  let resolvedStage = stage;
  let resolvedFarmProfileId = farmProfileId;

  if (farmProfileId && (!crop || !stage)) {
    const profile = await prisma.farmProfile.findUnique({
      where: { id: farmProfileId },
      select: { crop: true, stage: true },
    });
    if (profile) {
      resolvedCrop = crop || profile.crop;
      resolvedStage = stage || profile.stage;
    }
  }

  const result = await weatherService.getWeatherRecommendations({
    farmProfileId: resolvedFarmProfileId,
    crop: resolvedCrop,
    stage: resolvedStage,
    weather: explicitWeather,
  });

  res.json(result);
}));

export default router;
