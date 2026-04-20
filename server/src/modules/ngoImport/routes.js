/**
 * NGO import + farm-me-context routers.
 *
 *   POST /api/ngo/import            — admin-only; accepts JSON
 *                                     array OR CSV text; creates
 *                                     users + farms atomically per row.
 *   GET  /api/farm/me/context        — returns the logged-in user's
 *                                     farm context (wraps getFarmContext).
 *
 * Every writable row logs a FarmEvent `ngo_import_created` so
 * the NGO admin dashboard can prove imports happened.
 */

import express from 'express';
import {
  parseCsvImport, validateImportBatch,
} from './ngoImportService.js';
import mwPkg from '../../core/middleware.js';
const { requireRole, asyncHandler, standardResponse } = mwPkg;
import { getFarmContext } from '../../core/contextService.js';

export function createNgoImportRouter(opts = {}) {
  const { prisma, requireAuth, requireAdmin, logEvent } = opts;
  const router = express.Router();
  const auth  = typeof requireAuth  === 'function' ? requireAuth  : (_r, _s, n) => n();
  const admin = typeof requireAdmin === 'function' ? requireAdmin : (_r, _s, n) => n();

  router.post('/import',
    auth, admin, requireRole(['admin']),
    asyncHandler(async (req, res) => {
      const r = standardResponse(res);
      if (!prisma?.user?.create) return r.fail('no_prisma', 500);

      // Accept either a JSON array of rows or a CSV string.
      const body = req.body || {};
      let rows = [];
      if (Array.isArray(body.farmers)) rows = body.farmers;
      else if (typeof body.csv === 'string') rows = parseCsvImport(body.csv);
      else if (Array.isArray(body)) rows = body;

      const { valid, invalid } = validateImportBatch(rows);
      if (valid.length === 0) {
        return r.fail('no_valid_rows', 400);
      }

      const created  = [];
      const skipped  = [];

      for (const row of valid) {
        try {
          // Skip on duplicate phone in the DB (safety §9).
          if (row.phone) {
            const existing = await prisma.user.findFirst({
              where: { email: null, lastLoginMethod: row.phone },
            }).catch(() => null);
            if (existing) { skipped.push({ phone: row.phone, reason: 'exists' }); continue; }
          }

          const userData = {
            fullName: row.name || 'NGO Farmer',
            email:    row.email || `ngo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@farroway.local`,
            role:     'field_officer',    // closest to "farmer" in existing enum
            onboardingSource: 'ngo',
            program: row.program || null,
            preferredLanguage: 'en',
          };
          const user = await prisma.user.create({ data: userData });

          const farmData = {
            farmerName: row.name || 'NGO Farmer',
            crop:       row.crop || 'MAIZE',
            country:    row.location || null,
            locationName: row.location || null,
            program:    row.program || null,
            userId:     user.id,
          };
          const farm = await prisma.farmProfile.create({ data: farmData });

          // Audit / NGO visibility — log a farm_event so the admin
          // dashboard sees imports roll in.
          try {
            if (typeof logEvent === 'function') {
              await logEvent(prisma, {
                userId: user.id, farmId: farm.id,
                eventType: 'farm_created',
                payload:   { source: 'ngo_import', program: row.program || null },
                country:   row.location || null,
                region:    row.region   || null,
                crop:      row.crop     || null,
              });
            }
          } catch { /* non-blocking */ }

          created.push({ userId: user.id, farmId: farm.id });
        } catch (err) {
          skipped.push({
            phone: row.phone, reason: 'db_failed', message: err?.message,
          });
        }
      }

      return r.ok({
        createdCount: created.length,
        skippedCount: skipped.length,
        invalidCount: invalid.length,
        created,
        skipped,
        invalid,
      });
    }),
  );

  return router;
}

/**
 * createFarmMeContextRouter — mounts GET /me/context under
 * /api/farm. Uses the injected `resolveUser(req)` to pull the
 * current user, then `getFarmContext(farmId)`.
 */
export function createFarmMeContextRouter(opts = {}) {
  const { prisma, requireAuth, resolveUser } = opts;
  const router = express.Router();
  const auth = typeof requireAuth === 'function' ? requireAuth : (_r, _s, n) => n();
  const pickUser = typeof resolveUser === 'function'
    ? resolveUser
    : (req) => req.user || null;

  router.get('/me/context', auth, asyncHandler(async (req, res) => {
    const r = standardResponse(res);
    const user = pickUser(req);
    if (!user) return r.fail('unauthenticated', 401);

    // Find the first farm owned by this user.
    let farm = null;
    try {
      if (prisma?.farmProfile?.findFirst) {
        farm = await prisma.farmProfile.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch { farm = null; }
    if (!farm) return r.fail('no_farm', 404);

    const ctx = await getFarmContext({ farmId: farm.id, prisma });
    return r.ok(ctx);
  }));

  return router;
}

export default { createNgoImportRouter, createFarmMeContextRouter };
