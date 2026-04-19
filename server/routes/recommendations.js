/**
 * recommendations.js — single POST endpoint that runs the full
 * connected engine:
 *
 *   POST /api/recommendations/crops
 *
 * Input (JSON body):
 *   {
 *     location: { country, state, city? },   // accepts string for legacy
 *     farmType, farmSize, farmSizeUnit,
 *     beginnerLevel, growingStyle, purpose,
 *     currentMonth,
 *     cropCandidates?: string[],              // optional filter
 *   }
 *
 * Output:
 *   {
 *     locationProfile: { country, state, climateSubregion, ... },
 *     bestMatch: Array<shaped crop result>,
 *     alsoConsider: Array,
 *     notRecommendedNow: Array,
 *     meta: { learning: { multipliers, samplesByCrop } },
 *   }
 *
 * Anonymous-safe: no auth required because the scoring engine is
 * pure + doesn't touch the user's data. If a cookie session exists
 * we do enrich with the farmer's past outcomes for learning.
 */
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { scoreAllCrops } from '../src/services/scoring/cropScoringEngine.js';
import { getLearningAdjustments } from '../src/services/feedback/learningEngine.js';
import { resolveRegionProfile } from '../src/services/region/regionProfile.js';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/crops', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const locationInput = body.location && typeof body.location === 'object'
      ? body.location
      : { country: body.country || 'US', state: body.state, city: body.city };

    const region = resolveRegionProfile(locationInput);
    if (!region) {
      return res.status(400).json({ error: 'unresolvable_location' });
    }

    // Learning adjustments — scoped to the resolved region so past
    // Maryland tomato harvests don't influence a Texas query. Errors
    // (including the table not being migrated) degrade to no-op.
    let learning = { multipliers: {}, samplesByCrop: {} };
    try {
      const rows = req.user?.id
        ? await prisma.harvestOutcome.findMany({
            where: {},
            take: 500,
          })
        : [];
      learning = getLearningAdjustments(rows, { stateCode: region.stateCode });
    } catch { /* ignore */ }

    const payload = scoreAllCrops({
      country: region.country,
      state: region.state,
      city: region.city,
      farmType: body.farmType,
      farmSize: body.farmSize,
      farmSizeUnit: body.farmSizeUnit,
      beginnerLevel: body.beginnerLevel,
      growingStyle: body.growingStyle,
      purpose: body.purpose,
      currentMonth: body.currentMonth,
    }, {
      crops: Array.isArray(body.cropCandidates) ? body.cropCandidates : undefined,
      learningMultipliers: learning.multipliers,
    });

    res.json({
      ...payload,
      meta: { learning },
    });
  } catch (err) {
    console.error('[recommendations]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
