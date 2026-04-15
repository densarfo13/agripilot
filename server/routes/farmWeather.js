/**
 * Farm Weather Route — GET /api/v2/farm-weather/:farmId
 *
 * Returns weather data scoped to a specific farm.
 * Uses farm coordinates (preferred) or country/region fallback.
 * Caches snapshots for 1 hour to reduce upstream calls.
 * Ownership enforced: farm must belong to req.user.id.
 */

import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { getWeatherForFarm } from '../lib/weatherProvider.js';

const router = express.Router();

/**
 * GET /:farmId
 *
 * Fetch weather for a farm. Returns cached data if fresh (<1 hour).
 * Falls back to geocoding from farm location/country if no GPS coordinates.
 */
router.get('/:farmId', authenticate, async (req, res) => {
  try {
    const farm = await prisma.farmProfile.findFirst({
      where: { id: req.params.farmId, userId: req.user.id },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        country: true,
        locationName: true,
        status: true,
      },
    });

    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }

    const result = await getWeatherForFarm(farm);

    if (!result) {
      return res.json({
        success: true,
        weather: null,
        message: 'No location data available for this farm. Add GPS coordinates or a location name to get weather.',
      });
    }

    return res.json({
      success: true,
      weather: result.weather,
      coordinates: result.coordinates,
      geocoded: result.geocoded,
      cached: result.cached,
      farmId: farm.id,
    });
  } catch (error) {
    console.error('GET /api/v2/farm-weather/:farmId failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to load farm weather' });
  }
});

export default router;
