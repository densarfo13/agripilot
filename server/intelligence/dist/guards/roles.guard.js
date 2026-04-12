/**
 * Farroway Intelligence Module — Role-Based Access Guards
 *
 * Express middleware that restricts routes to users with specific roles.
 * Must run after the `authenticate` middleware which sets `req.user`.
 */
const ADMIN_ROLES = ['super_admin', 'institutional_admin'];
const STAFF_ROLES = [...ADMIN_ROLES, 'reviewer', 'field_officer'];
export function requireAdmin(req, res, next) {
    const user = req.user;
    if (!user || !ADMIN_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
export function requireStaff(req, res, next) {
    const user = req.user;
    if (!user || !STAFF_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Staff access required' });
    }
    next();
}
//# sourceMappingURL=roles.guard.js.map