import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../config/database.js';

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header, verifies it,
 * and attaches user to req.user.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload; // { sub, email, role }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
