/**
 * Centralized role constants for frontend access control.
 * Keep in sync with backend Role enum in schema.prisma.
 */

export const ALL_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer', 'farmer'];

// Staff = anyone who uses the institutional dashboard (not farmer)
export const STAFF_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer'];

// Can run verification/fraud/decision engines and approve/reject
export const REVIEW_ROLES = ['super_admin', 'institutional_admin', 'reviewer'];

// Full administrative access
export const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

// Can create farmers and applications
export const CREATOR_ROLES = ['super_admin', 'institutional_admin', 'field_officer'];

// Institutional staff roles (visible in user management dropdown, excludes farmer)
export const INSTITUTIONAL_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer'];

/**
 * Check if a role has access to a set of allowed roles.
 */
export function hasRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}
