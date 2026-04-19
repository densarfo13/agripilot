/**
 * usRecommendations.js — POST /api/v2/recommend/us and companion
 * GET endpoints for the state selector.
 *
 * This route is a thin wrapper over `recommendCropsForUSFarm` —
 * all scoring logic is pure JS in server/src/domain/us/.
 */
import express from 'express';
import { recommendCropsForUSFarm } from '../src/domain/us/recommend.js';
import { US_STATES, statesByDisplayRegion, resolveLocationProfile } from '../src/domain/us/usStates.js';
import {
  scoreCropSuitability, buildRecommendationBuckets,
} from '../src/domain/us/scoreCropSuitability.js';

const router = express.Router();

/**
 * GET /api/v2/recommend/us/states
 * Returns the 50 states + D.C. grouped by display region so the
 * frontend can render a grouped selector without extra fetches.
 */
router.get('/states', (_req, res) => {
  res.json({
    count: Object.keys(US_STATES).length,
    regions: statesByDisplayRegion(),
  });
});

/**
 * GET /api/v2/recommend/us/location?state=TX
 * Returns the resolved location profile (display region + internal
 * subregion + agronomic bands) for a single state.
 */
router.get('/location', (req, res) => {
  const profile = resolveLocationProfile(req.query.state);
  if (!profile) return res.status(400).json({ error: 'unknown_state' });
  res.json({ location: profile });
});

/**
 * POST /api/v2/recommend/us
 * Body: { country, state, farmType, growingStyle?, purpose?,
 *         beginnerLevel?, currentMonth? }
 * Returns: { location, bestMatch[], alsoConsider[], notRecommendedNow[] }
 *
 * Original rule-based engine. Kept for backward compatibility.
 */
router.post('/', express.json(), (req, res) => {
  const result = recommendCropsForUSFarm(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

/**
 * POST /api/v2/recommend/us/suitability
 * Body: the same as above + optional `crops: string[]` to score a
 *       specific list instead of every known crop profile.
 *
 * Uses the explicit weighted scorer (climateFit / regionFit /
 * seasonFit / farmTypeFit / beginnerFit / marketFit / growingStyleFit)
 * and applies hard guardrails (cassava outside the tropics,
 * commercial crops in container backyards, season misses, weak
 * climate matches). Returns buckets + per-crop explain payloads.
 */
router.post('/suitability', express.json(), (req, res) => {
  const body = req.body || {};
  if (!body.state) return res.status(400).json({ error: 'missing_state' });
  if (!body.farmType) return res.status(400).json({ error: 'missing_farm_type' });
  res.json(buildRecommendationBuckets(body));
});

/**
 * POST /api/v2/recommend/us/suitability/one
 * Score a single crop — handy for "show the warning on this crop"
 * flows on the client.
 */
router.post('/suitability/one', express.json(), (req, res) => {
  const body = req.body || {};
  if (!body.state || !body.crop || !body.farmType) {
    return res.status(400).json({ error: 'missing_required_fields' });
  }
  res.json(scoreCropSuitability(body));
});

export default router;
