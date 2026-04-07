/**
 * Organization Scoping Middleware
 *
 * Extracts the user's organizationId and attaches it to the request.
 * Provides helpers for building org-scoped queries.
 *
 * Rules:
 * - super_admin: org is null by default (cross-org access). Can filter to a specific org via ?orgId query param.
 * - All other roles: org is enforced from user record. Cannot be overridden.
 * - farmer: org is derived from their farmer profile's organizationId.
 *
 * Usage: Place AFTER authenticate middleware.
 */
import prisma from '../config/database.js';
import { logPermissionEvent } from '../utils/opsLogger.js';

// ─── In-memory org cache (similar to auth cache) ──────
const ORG_CACHE_TTL_MS = 60_000;
const orgCache = new Map();

function getCachedOrg(userId) {
  const entry = orgCache.get(userId);
  if (!entry) return undefined; // distinguish cache miss from null org
  if (Date.now() > entry.expiresAt) {
    orgCache.delete(userId);
    return undefined;
  }
  return entry.organizationId;
}

function setCachedOrg(userId, organizationId) {
  orgCache.set(userId, { organizationId, expiresAt: Date.now() + ORG_CACHE_TTL_MS });
  if (orgCache.size > 500) {
    const firstKey = orgCache.keys().next().value;
    orgCache.delete(firstKey);
  }
}

/** Invalidate org cache for a user (call on org change). */
export function invalidateOrgCache(userId) {
  if (userId) orgCache.delete(userId);
}

/** Clear entire org cache (used in tests). */
export function clearOrgCache() {
  orgCache.clear();
}

/**
 * Middleware: extract organization scope from authenticated user.
 * Attaches req.organizationId (string | null).
 * - null means cross-org access (super_admin only).
 */
export function extractOrganization(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userId = req.user.sub;
  const role = req.user.role;

  // Check cache
  const cached = getCachedOrg(userId);
  if (cached !== undefined) {
    return applyOrgScope(req, res, next, cached, role);
  }

  // Cache miss — look up from DB
  prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  })
    .then((user) => {
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      setCachedOrg(userId, user.organizationId);
      applyOrgScope(req, res, next, user.organizationId, role);
    })
    .catch((err) => {
      logPermissionEvent('org_lookup_failed', {
        userId,
        role,
        path: req.originalUrl || req.path,
        error: err.message,
      });
      res.status(500).json({ error: 'Organization lookup failed' });
    });
}

function applyOrgScope(req, res, next, userOrgId, role) {
  if (role === 'super_admin') {
    // super_admin can optionally scope to a specific org via query param
    const requestedOrg = req.query.orgId || null;
    req.organizationId = requestedOrg;
    req.isCrossOrg = !requestedOrg; // true = unscoped global access
  } else {
    // All other roles are bound to their org
    req.organizationId = userOrgId;
    req.isCrossOrg = false;

    // If user has no org assigned, deny access to org-scoped endpoints
    // (except farmer role which may have org via farmer profile)
    if (!userOrgId && role !== 'farmer') {
      logPermissionEvent('org_not_assigned', {
        userId: req.user.sub,
        role,
        path: req.originalUrl || req.path,
        method: req.method,
      });
      return res.status(403).json({ error: 'No organization assigned. Contact your administrator.' });
    }
  }
  next();
}

/**
 * Build org-scoped where clause for farmer-based queries.
 * Returns { organizationId } filter or {} for super_admin cross-org.
 */
export function orgWhereFarmer(req) {
  if (req.isCrossOrg) return {};
  if (!req.organizationId) return {};
  return { organizationId: req.organizationId };
}

/**
 * Build org-scoped where clause for application queries (via farmer relation).
 * Returns { farmer: { organizationId } } filter or {} for super_admin cross-org.
 */
export function orgWhereApplication(req) {
  if (req.isCrossOrg) return {};
  if (!req.organizationId) return {};
  return { farmer: { organizationId: req.organizationId } };
}

/**
 * Build org-scoped where clause for user queries.
 * Returns { organizationId } filter or {} for super_admin cross-org.
 */
export function orgWhereUser(req) {
  if (req.isCrossOrg) return {};
  if (!req.organizationId) return {};
  return { organizationId: req.organizationId };
}

/**
 * Verify a specific record belongs to the user's organization.
 * For use on single-record lookups (getById, update, delete).
 * Returns true if access is allowed, false if denied.
 */
export function verifyOrgAccess(req, recordOrgId) {
  if (req.isCrossOrg) return true; // super_admin cross-org
  if (!req.organizationId) return true; // no org enforcement (backward compat)
  const allowed = req.organizationId === recordOrgId;
  if (!allowed) {
    logPermissionEvent('cross_org_access_denied', {
      userId: req.user?.sub,
      role: req.user?.role,
      userOrgId: req.organizationId,
      recordOrgId,
      path: req.originalUrl || req.path,
      method: req.method,
    });
  }
  return allowed;
}
