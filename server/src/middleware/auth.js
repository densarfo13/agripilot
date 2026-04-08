import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../config/database.js';
import { logAuthEvent, logPermissionEvent } from '../utils/opsLogger.js';

// ─── Lightweight in-memory user cache (auth hot path) ──────
// Avoids hitting the DB on every single API request.
// TTL: 60 seconds. Invalidated explicitly on role/status changes.
const AUTH_CACHE_TTL_MS = 60_000;
const authCache = new Map(); // userId → { user, expiresAt }

function getCachedUser(userId) {
  const entry = authCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(userId);
    return null;
  }
  return entry.user;
}

function setCachedUser(userId, user) {
  authCache.set(userId, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  // Prevent unbounded growth — evict oldest if cache exceeds 500 entries
  if (authCache.size > 500) {
    const firstKey = authCache.keys().next().value;
    authCache.delete(firstKey);
  }
}

/**
 * Bump a user's tokenVersion in the cache so the next request forces a DB re-check.
 * Called after logout, password reset, MFA changes.
 */
export function bumpCachedTokenVersion(userId) {
  const entry = authCache.get(userId);
  if (entry?.user) {
    entry.user.tokenVersion = (entry.user.tokenVersion || 0) + 1;
  }
}

/** Invalidate a specific user from the auth cache (call on role/status change). */
export function invalidateAuthCache(userId) {
  if (userId) authCache.delete(userId);
}

/** Clear entire auth cache (used in tests). */
export function clearAuthCache() {
  authCache.clear();
}

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header, verifies it,
 * checks that the user account is still active in the database,
 * and attaches user to req.user.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch {
    logAuthEvent('token_invalid', { ip: req.ip, path: req.originalUrl || req.path });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check cache first
  const cached = getCachedUser(payload.sub);
  if (cached) {
    if (!cached.active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }
    // tokenVersion check: if cached version is newer than JWT version, token was revoked
    if (cached.tokenVersion !== undefined && payload.tv !== undefined &&
        payload.tv < cached.tokenVersion) {
      logAuthEvent('token_revoked', { userId: payload.sub, ip: req.ip });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = { ...payload, role: cached.role, organizationId: cached.organizationId || null };
    return next();
  }

  // Cache miss — verify user still exists and is active in the database
  prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, active: true, role: true, organizationId: true, tokenVersion: true },
  })
    .then((user) => {
      if (!user) {
        logAuthEvent('account_not_found', { userId: payload.sub, ip: req.ip });
        return res.status(401).json({ error: 'User account no longer exists' });
      }
      setCachedUser(payload.sub, user);
      if (!user.active) {
        logAuthEvent('account_deactivated', { userId: payload.sub, ip: req.ip });
        return res.status(403).json({ error: 'Account deactivated' });
      }
      // tokenVersion: JWT 'tv' claim must match DB version (0 if never set)
      const jwtTv = payload.tv ?? 0;
      const dbTv  = user.tokenVersion ?? 0;
      if (jwtTv < dbTv) {
        logAuthEvent('token_revoked', { userId: payload.sub, ip: req.ip });
        return res.status(401).json({ error: 'Session expired. Please log in again.' });
      }
      // Use DB role (source of truth) rather than JWT role in case it was changed
      req.user = { ...payload, role: user.role, organizationId: user.organizationId || null };
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Authentication check failed' });
    });
}

/**
 * Role-based access control middleware.
 * Pass allowed roles as arguments.
 * Usage: authorize('super_admin', 'institutional_admin')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      logPermissionEvent('role_denied', {
        userId: req.user.sub, role: req.user.role,
        requiredRoles: roles, path: req.originalUrl || req.path, ip: req.ip,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Farmer registration status gate.
 * For farmer-role users, checks that their registration is approved.
 * Non-farmer roles pass through unconditionally.
 * Use AFTER authenticate middleware.
 */
export function requireApprovedFarmer(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Non-farmer roles are not subject to registration approval
  if (req.user.role !== 'farmer') {
    return next();
  }
  // Farmer role — verify registration status from DB
  prisma.farmer.findUnique({
    where: { userId: req.user.sub },
    select: { registrationStatus: true },
  })
    .then((farmer) => {
      if (!farmer) {
        return res.status(403).json({ error: 'Farmer profile not found' });
      }
      if (farmer.registrationStatus !== 'approved') {
        return res.status(403).json({
          error: 'Account pending approval',
          registrationStatus: farmer.registrationStatus,
        });
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Failed to verify farmer status' });
    });
}

/**
 * Farmer ownership middleware.
 * For farmer-role users, verifies that the :farmerId param belongs to them.
 * Staff roles (non-farmer) pass through unconditionally.
 * Use AFTER authenticate middleware on routes with :farmerId param.
 */
export function requireFarmerOwnership(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Staff roles can access any farmer's data
  if (req.user.role !== 'farmer') {
    return next();
  }
  // Farmer role — verify ownership
  const farmerId = req.params.farmerId;
  if (!farmerId) {
    return next(); // No farmerId param on this route — skip
  }
  prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { userId: true },
  })
    .then((farmer) => {
      if (!farmer) {
        return res.status(404).json({ error: 'Farmer not found' });
      }
      if (farmer.userId !== req.user.sub) {
        logPermissionEvent('ownership_denied', {
          userId: req.user.sub, farmerId, path: req.originalUrl || req.path, ip: req.ip,
        });
        return res.status(403).json({ error: 'Access denied — you can only access your own data' });
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Ownership check failed' });
    });
}

/**
 * Application assignment scoping middleware.
 * For field_officer role: verifies the application is assigned to them.
 * For reviewer role: verifies the application is assigned to them.
 * Admin roles pass through.
 * Use AFTER authenticate on routes with :id param referencing an application.
 */
export function requireApplicationAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role = req.user.role;
  // Admin roles can access any application
  if (['super_admin', 'institutional_admin'].includes(role)) {
    return next();
  }
  const applicationId = req.params.id || req.params.applicationId;
  if (!applicationId) {
    return next();
  }
  prisma.application.findUnique({
    where: { id: applicationId },
    select: { assignedFieldOfficerId: true, assignedReviewerId: true },
  })
    .then((app) => {
      if (!app) {
        return res.status(404).json({ error: 'Application not found' });
      }
      if (role === 'field_officer' && app.assignedFieldOfficerId !== req.user.sub) {
        return res.status(403).json({ error: 'You are not assigned to this application' });
      }
      if (role === 'reviewer' && app.assignedReviewerId !== req.user.sub) {
        return res.status(403).json({ error: 'You are not assigned to this application' });
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ error: 'Application access check failed' });
    });
}
