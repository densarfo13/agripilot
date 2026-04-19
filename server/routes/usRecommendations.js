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
 */
router.post('/', express.json(), (req, res) => {
  const result = recommendCropsForUSFarm(req.body || {});
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

export default router;
