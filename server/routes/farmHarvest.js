/**
 * Farm Harvest Route — GET /api/v2/farm-harvest/:farmId
 *
 * Returns harvest readiness and post-harvest recommendations for a farm.
 * Ownership enforced: farm must belong to req.user.id.
 * Recommendations computed on-the-fly from rules — no database writes.
 *
 * PROVIDER NOTE: These are rules-based agronomic recommendations,
 * not ML predictions. To upgrade, swap generateHarvestRecommendations()
 * with a real agronomy intelligence provider.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { generateHarvestRecommendations } from '../lib/harvestEngine.js';
import { resolveStage } from '../lib/cropStages.js';
import { getSeasonalContext } from '../lib/seasonalTiming.js';
import { getWeatherForFarm } from '../lib/weatherProvider.js';

const router = express.Router();

/**
 * GET /:farmId
 *
 * Returns generated harvest/post-harvest recommendations for a farm.
 */
router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.farmId, userId: req.user.id },
      select: {
        id: true,
        crop: true,
        stage: true,
        experienceLevel: true,
        status: true,
        latitude: true,
        longitude: true,
        country: true,
        locationName: true,
        seasonStartMonth: true,
        seasonEndMonth: true,
        plantingWindowStartMonth: true,
        plantingWindowEndMonth: true,
        currentSeasonLabel: true,
      },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    if (farm.status === 'archived') {
      return res.json({ success: true, recommendations: [], farmId: farm.id, message: 'Archived farms have no active recommendations' });
    }

    const stage = resolveStage(farm.stage);

    const seasonal = getSeasonalContext({
      seasonStartMonth: farm.seasonStartMonth,
      seasonEndMonth: farm.seasonEndMonth,
      plantingWindowStartMonth: farm.plantingWindowStartMonth,
      plantingWindowEndMonth: farm.plantingWindowEndMonth,
      currentSeasonLabel: farm.currentSeasonLabel,
    });

    let cropName = (farm.crop || '').toLowerCase().trim();
    if (cropName.startsWith('other:')) {
      cropName = cropName.slice(6).trim();
    }

    // Fetch weather (non-blocking)
    let weatherCtx = null;
    try {
      const weatherResult = await getWeatherForFarm(farm);
      if (weatherResult?.weather) {
        weatherCtx = { ...weatherResult.weather, hasWeatherData: true };
      }
    } catch (weatherErr) {
      console.error('Weather fetch failed for harvest recommendations (non-blocking):', weatherErr.message);
    }

    const recommendations = generateHarvestRecommendations({
      farmId: farm.id,
      crop: cropName,
      stage,
      farmerType: farm.experienceLevel || 'new',
      seasonal,
      weather: weatherCtx,
    });

    return res.json({
      success: true,
      recommendations,
      farmId: farm.id,
      crop: cropName,
      stage,
      weather: weatherCtx ? { hasWeatherData: true } : null,
    });
  } catch (error) {
    console.error('GET /api/v2/farm-harvest/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate harvest recommendations' });
  }
});

export default router;
