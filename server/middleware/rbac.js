/**
 * rbac.js — reusable role-based access control helpers.
 *
 *   requireAuth          — 401 when req.user is absent
 *   requireRole(...roles) — 403 when req.user.role isn't in the list
 *   requireOwnershipOrRole({ resolveOwnerId, allowRoles })
 *                         — 403 unless the authenticated user owns
 *                           the resource or has one of the allow roles
 *
 * Roles in the existing codebase are lowercase strings: 'admin',
 * 'reviewer', 'farmer', and occasionally 'super_admin'. This file
 * normalizes so callers can pass either casing.
 *
 * The middleware assumes upstream `authenticate` has populated
 * req.user. If it hasn't, requireAuth returns 401 first.
 */

const SUPER_ROLES = new Set(['admin', 'super_admin']);

function normalize(role) {
  return String(role || '').toLowerCase();
}

/** 401 when there's no authenticated user on the request. */
export function requireAuth(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  next();
}

/**
 * requireRole('admin', 'reviewer') — returns 403 for anyone else.
 * `admin` and `super_admin` always bypass.
 */
export function requireRole(...roles) {
  const allowed = new Set(roles.map(normalize));
  return (req, res, next) => {
    const actual = normalize(req.user?.role);
    if (SUPER_ROLES.has(actual) || allowed.has(actual)) return next();
    return res.status(403).json({ error: 'forbidden', requiredRoles: roles });
  };
}

/**
 * requireOwnershipOrRole — resolve the owner of the target resource
 * (typically a farm, cycle, or issue) and allow the request through
 * only when the owner matches the authenticated user OR the user
 * carries one of `allowRoles`.
 *
 * Example:
 *   router.get('/cycles/:id',
 *     requireAuth,
 *     requireOwnershipOrRole({
 *       resolveOwnerId: async (req) => {
 *         const c = await prisma.v2CropCycle.findUnique({
 *           where: { id: req.params.id },
 *           select: { profile: { select: { userId: true } } },
 *         });
 *         return c?.profile?.userId || null;
 *       },
 *       allowRoles: ['admin', 'reviewer'],
 *     }),
 *     handler,
 *   );
 */
export function requireOwnershipOrRole({ resolveOwnerId, allowRoles = [] }) {
  const allow = new Set(allowRoles.map(normalize));
  return async (req, res, next) => {
    const actual = normalize(req.user?.role);
    if (SUPER_ROLES.has(actual) || allow.has(actual)) return next();
    try {
      const ownerId = await resolveOwnerId(req);
      if (!ownerId) return res.status(404).json({ error: 'not_found' });
      if (ownerId === req.user?.id) return next();
      return res.status(403).json({ error: 'forbidden' });
    } catch (err) {
      // Ownership lookup failure is an integrity signal, not a user
      // error — surface a 500 rather than a 403 so reviewers notice.
      console.error('[rbac] ownership lookup failed', err);
      return res.status(500).json({ error: 'ownership_check_failed' });
    }
  };
}

/** Convenience: ban specific roles (e.g. mid-feature rollout for BUYER/INVESTOR). */
export function blockRoles(...roles) {
  const blocked = new Set(roles.map(normalize));
  return (req, res, next) => {
    if (blocked.has(normalize(req.user?.role))) {
      return res.status(403).json({ error: 'role_not_enabled' });
    }
    next();
  };
}

export const _normalize = normalize;
