import express from 'express';

import { fetchNDVI } from '../services/satellite/sentinelHubService.js';

import {
  calculateAverageNDVI,
  classifyNDVI,
} from '../services/satellite/ndviEngine.js';

import { buildVegetationScore }
from '../services/satellite/vegetationScoring.js';

import { calculateDroughtRisk }
from '../services/satellite/droughtEngine.js';

const router = express.Router();

router.get('/farm-health', async (req, res) => {

  try {

    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({
        error: 'latitude and longitude required',
      });
    }

    const ndviResponse = await fetchNDVI({
      latitude,
      longitude,
    });

    const ndviValues =
      ndviResponse?.data?.flat?.() || [];

    const avgNdvi =
      calculateAverageNDVI(ndviValues);

    const vegetation =
      classifyNDVI(avgNdvi);

    const vegetationScore =
      buildVegetationScore({
        ndvi: avgNdvi,
        soilMoisture: 0.25,
        rainChancePct: 35,
      });

    const drought =
      calculateDroughtRisk({
        soilMoisture: 0.25,
        rainMmNext24h: 4,
        temperature: 30,
      });

    return res.json({
      success: true,

      satellite: {
        avgNdvi,
        vegetation,
      },

      vegetationScore,

      drought,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: 'satellite analysis failed',
    });
  }
});

export default router;