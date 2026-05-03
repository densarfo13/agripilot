/**
 * Insights routes — POST /api/insights/batch + GET /api/insights.
 *
 * Auth posture
 * ────────────
 *   • POST /batch — requires `authenticate` so an unauthenticated
 *     attacker can't trivially poison the aggregate space. The
 *     server still strips PII via `insightNormalize.js`; auth is
 *     just abuse mitigation, not access control on the data.
 *   • GET / — requires `authenticate` so query traffic is tied to
 *     a session for rate-limiting + telemetry. The data itself
 *     is non-sensitive (already aggregated).
 *
 * Rate limiting
 * ─────────────
 * Mounted under `/api`, which has the global `apiLimiter`. The
 * batch endpoint additionally caps per-call payload size in the
 * service (MAX_BATCH = 100), so a single call cannot blow up
 * Postgres.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';
import * as insightsService from './service.js';

const router = Router();

/**
 * POST /api/insights/batch
 * Body: { insights: [{region, cropOrPlant, setup?, condition,
 *                     shown, completed, success, failure}, ...] }
 *
 * Returns: { accepted: number, rejected: number }
 *
 * Rejected entries are silent at the DB level — the client gets
 * the count back so it can warn in dev. No 4xx for partial
 * malformed batches; the well-formed entries land. We only return
 * 400 when the envelope itself is shape-broken (missing array).
 */
router.post(
  '/batch',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const list = Array.isArray(body.insights) ? body.insights : null;
    if (!list) {
      return res.status(400).json({
        error: 'invalid_body',
        message: 'Body must be { insights: [...] }',
      });
    }
    const result = await insightsService.upsertBatch(list);
    return res.json(result);
  }),
);

/**
 * GET /api/insights?region=&cropOrPlant=&setup=&condition=&limit=
 *
 * Returns: { insights: [{ ..., completionRate, successRate,
 *                          confidence, score, recommendation }] }
 *
 * Any filter is optional — missing filters wildcard. Limit caps
 * at 50 server-side. Sorted by score desc.
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const insights = await insightsService.query({
      region:      req.query.region,
      cropOrPlant: req.query.cropOrPlant,
      setup:       req.query.setup,
      condition:   req.query.condition,
      limit:       req.query.limit,
    });
    return res.json({ insights });
  }),
);

export default router;
