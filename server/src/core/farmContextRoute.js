/**
 * farmContextRoute.js — one-stop Express router exposing
 * GET /api/farm/:id/context backed by contextService.
 * Returns the standardized { success, data } envelope.
 *
 *   app.use('/api/farm', createFarmContextRouter({
 *     prisma,
 *     requireAuth, // auth middleware; farmers only see their own farms
 *     weatherFor,  // optional injected weather source
 *   }));
 */

import express from 'express';
import ctxPkg from './contextService.js';
import mwPkg  from './middleware.js';
const { getFarmContext } = ctxPkg;
const { asyncHandler, standardResponse } = mwPkg;

function createFarmContextRouter(opts = {}) {
  const { prisma, requireAuth, weatherFor } = opts;
  const router = express.Router();
  const auth = typeof requireAuth === 'function'
    ? requireAuth
    : (_req, _res, next) => next();

  router.get('/:id/context', auth, asyncHandler(async (req, res) => {
    const farmId = String(req.params?.id || '');
    const r = standardResponse(res);
    if (!farmId) return r.fail('missing_farm_id', 400);

    const ctx = await getFarmContext({ farmId, prisma, weatherFor });
    if (ctx.error === 'missing_farm_id') return r.fail('missing_farm_id', 400);
    return r.ok(ctx);
  }));

  return router;
}

export { createFarmContextRouter };
export default { createFarmContextRouter };
