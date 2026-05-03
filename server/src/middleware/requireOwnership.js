/**
 * requireOwnership.js — DB-constrained ownership check.
 *
 *   import { requireOwnership } from './middleware/requireOwnership.js';
 *
 *   router.get('/farms/:farmId',
 *     authenticate,
 *     requireOwnership('farm'),     // 404 if missing OR not owned
 *     asyncHandler(handler),
 *   );
 *
 * Why this middleware exists
 * ──────────────────────────
 *   The merged-blocker spec mandates the pattern
 *
 *     where: { id: farmId, userId: req.user.id }
 *
 *   Looking up the row by id alone and checking ownership
 *   in JS afterwards is the wrong shape — it leaks "this id
 *   exists" to a user who shouldn't see it (an anonymous 403
 *   vs 404 disclosure). The DB-constrained query returns the
 *   row only when BOTH id matches AND the caller owns it; a
 *   miss is indistinguishable from "doesn't exist" → return 404.
 *
 *   Existing primitives (`requireFarmerOwnership`,
 *   `requireOwnershipOrRole`) are kept untouched — they remain
 *   the right tool for routes that need their specific shape.
 *   This middleware is the generic one for "scan / task /
 *   garden / upload" paths whose models all expose `userId`.
 *
 * Resource registry
 * ─────────────────
 *   Each entry maps a resource alias → { paramName, prismaModel,
 *   ownerField }. Adding a new resource is a one-line edit.
 *   ownerField is the COLUMN that holds the owner's userId on
 *   the row; some models scope through a relation
 *   (`farmProfile.userId`) — those are spelled out as
 *   `relationOwner: { include }` so the caller can supply the
 *   include path explicitly.
 *
 * Strict-rule audit
 *   • Pure read; never mutates state.
 *   • Returns 404 on miss-or-not-owned per spec ("Do not return
 *     403 for owned-resource lookup failures because it leaks
 *     existence").
 *   • Admin / super_admin / platform_admin bypasses the check
 *     so internal tools still work; logs the bypass via the
 *     existing opsLogger so audits can spot impersonation.
 *   • Never throws — Prisma errors are caught and surfaced as
 *     500 with the existing errorHandler taking over.
 *   • Pure ESM, top-level imports only (Vite/Express ESM rule).
 */

import prisma from '../config/database.js';
import { logPermissionEvent } from '../utils/opsLogger.js';

const ADMIN_ROLES = new Set(['super_admin', 'platform_admin', 'admin']);

/**
 * Resource registry. Every entry describes the shape of an
 * ownership lookup. Each callsite picks the alias it needs.
 *
 *   paramName    — `req.params.<paramName>` carries the row id
 *   prismaModel  — name of the prisma client property
 *   ownerField   — the row column that holds the owner's userId
 *                  (use 'userId' unless the model is named
 *                  differently in your schema)
 *   notFoundMsg  — message to surface on a miss; defaults to
 *                  the spec's neutral "Not found"
 */
export const RESOURCE_REGISTRY = Object.freeze({
  farm: {
    paramName:   'farmId',
    prismaModel: 'farmProfile',
    notFoundMsg: 'Not found',
    // FarmProfile carries BOTH a direct `userId` (cookie-auth flow)
    // AND a nested `farmer.userId` (legacy farmer-record flow). The
    // OR-shaped where matches whichever path was used to provision
    // the farm so an old row migrated from the legacy flow stays
    // accessible to its rightful owner.
    whereBuilder: ({ id, userId }) => ({
      id,
      OR: [
        { userId },
        { farmer: { is: { userId } } },
      ],
    }),
  },
  farmProfile: {
    paramName:   'farmProfileId',
    prismaModel: 'farmProfile',
    notFoundMsg: 'Not found',
    whereBuilder: ({ id, userId }) => ({
      id,
      OR: [
        { userId },
        { farmer: { is: { userId } } },
      ],
    }),
  },
  garden: {
    // Backyard "garden" rows live alongside farms in the
    // farmProfile table with a flag — the same ownership
    // check applies. Kept as a separate alias so callers
    // are explicit about what they're guarding.
    paramName:   'gardenId',
    prismaModel: 'farmProfile',
    ownerField:  'userId',
    notFoundMsg: 'Not found',
  },
  scan: {
    paramName:   'scanId',
    prismaModel: 'scanTrainingEvent',
    ownerField:  'userId',
    notFoundMsg: 'Not found',
  },
  task: {
    paramName:   'taskId',
    prismaModel: 'farmTask',
    ownerField:  'userId',
    notFoundMsg: 'Not found',
  },
  buyerInquiry: {
    paramName:   'inquiryId',
    prismaModel: 'buyerInquiry',
    ownerField:  'buyerId',
    notFoundMsg: 'Not found',
  },
  // Seed scans live on V2SeedScan and link to V2FarmProfile via
  // `profileId`. Ownership is therefore NESTED: the row's
  // profile.userId must match req.user.id. We model this with a
  // `whereBuilder` instead of a flat `ownerField`.
  seedScan: {
    paramName:   'id',
    prismaModel: 'v2SeedScan',
    notFoundMsg: 'Not found',
    whereBuilder: ({ id, userId }) => ({
      id,
      profile: { is: { userId } },
    }),
  },
  // Crop cycles (V2CropCycle) live under farmer profile; same
  // nested-ownership pattern as seedScan.
  cropCycle: {
    paramName:   'id',
    prismaModel: 'v2CropCycle',
    notFoundMsg: 'Not found',
    whereBuilder: ({ id, userId }) => ({
      id,
      profile: { is: { userId } },
    }),
  },
  // V2Task rows are owned via the parent V2Season's userId. The
  // legacy /api/v2/tasks/:taskId/complete route uses :taskId
  // instead of :id; the registry's paramName falls back to :id
  // automatically when the named param is missing.
  v2Task: {
    paramName:   'taskId',
    prismaModel: 'v2Task',
    notFoundMsg: 'Not found',
    whereBuilder: ({ id, userId }) => ({
      id,
      season: { is: { userId } },
    }),
  },
});

/**
 * requireOwnership(resourceType, opts?) → express middleware.
 *
 * On success: attaches the resolved row to `req.ownedResource`
 * so downstream handlers can read it without a second query.
 *
 * On miss / not-owned: returns 404 (deliberately — see audit).
 * Logs the denial via opsLogger with the actor + path so the
 * audit dashboard can spot scan-the-id-space attacks.
 *
 * Admin bypass
 * ────────────
 * super_admin / platform_admin / admin roles bypass the
 * ownership constraint but are logged (action: 'ownership_admin_bypass')
 * so the audit log shows when an admin tool reads a tenant
 * row. The bypass can be disabled per-call via `opts.allowAdmin = false`.
 */
export function requireOwnership(resourceType, opts = {}) {
  const cfg = RESOURCE_REGISTRY[resourceType];
  if (!cfg) {
    // Hard fail at boot time, not at request time, so a typo
    // can't silently grant access on a forgotten route.
    throw new Error(
      `requireOwnership: unknown resource type "${resourceType}". ` +
      `Allowed: ${Object.keys(RESOURCE_REGISTRY).join(', ')}`,
    );
  }
  const allowAdmin = opts.allowAdmin !== false;
  const customSelect = opts.select; // optional Prisma select shape
  const paramName = opts.paramName || cfg.paramName;

  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authorized' });
    }

    const userId = req.user.id || req.user.sub;
    const role   = req.user.role;
    // Fallback to req.params.id when the configured param name is
    // missing — many legacy routes use `:id` regardless of resource
    // type (e.g. `/farm-tasks/:id/tasks` carries the farm id under
    // `:id`, not `:farmId`). Try the canonical param first, then
    // fall back to `:id`.
    const id = req.params[paramName] || req.params.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authorized' });
    }
    if (!id) {
      // Param missing — let downstream produce its own 400 with
      // a more specific shape. Don't fail-closed here so callers
      // who use this middleware on routes without the param
      // (e.g. list endpoints) aren't broken.
      return next();
    }

    // Admin bypass — logged for audit visibility.
    if (allowAdmin && ADMIN_ROLES.has(String(role || '').toLowerCase())) {
      try {
        const row = await prisma[cfg.prismaModel].findUnique({
          where: { id },
          ...(customSelect ? { select: customSelect } : {}),
        });
        if (!row) {
          return res.status(404).json({ error: cfg.notFoundMsg });
        }
        logPermissionEvent('ownership_admin_bypass', {
          userId,
          role,
          resourceType,
          resourceId: id,
          path: req.originalUrl || req.path,
          ip:   req.ip,
        });
        req.ownedResource = row;
        return next();
      } catch (err) {
        return next(err);
      }
    }

    // DB-CONSTRAINED OWNERSHIP CHECK — the spec's required pattern.
    // For most resources the where clause is a flat
    //   { id, [ownerField]: userId }
    // For nested-ownership resources (e.g. seedScan whose owner is
    // the parent farmProfile.userId), the registry supplies a
    // `whereBuilder` that returns the full where shape.
    try {
      const where = typeof cfg.whereBuilder === 'function'
        ? cfg.whereBuilder({ id, userId })
        : { id, [cfg.ownerField]: userId };
      const row = await prisma[cfg.prismaModel].findFirst({
        where,
        ...(customSelect ? { select: customSelect } : {}),
      });
      if (!row) {
        // 404, not 403 — never disclose existence to a non-owner.
        logPermissionEvent('ownership_denied', {
          userId,
          role,
          resourceType,
          resourceId: id,
          path: req.originalUrl || req.path,
          ip:   req.ip,
        });
        return res.status(404).json({ error: cfg.notFoundMsg });
      }
      req.ownedResource = row;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export default requireOwnership;
