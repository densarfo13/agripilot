/**
 * Farroway Intelligence Module — Role-Based Access Guards
 *
 * Express middleware that restricts routes to users with specific roles.
 * Must run after the `authenticate` middleware which sets `req.user`.
 */

import type { Request, Response, NextFunction } from 'express';

const ADMIN_ROLES = ['super_admin', 'institutional_admin'] as const;
const STAFF_ROLES = [...ADMIN_ROLES, 'reviewer', 'field_officer'] as const;

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireStaff(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !STAFF_ROLES.includes(user.role)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}
