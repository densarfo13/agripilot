/**
 * Centralized role constants for frontend access control.
 * Keep in sync with backend Role enum in schema.prisma.
 */

export const ALL_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer', 'farmer', 'agent'];

// v3 Field Agent Mode: lightweight role for farmer-onboarding
// agents working in the field (often offline). Distinct from
// `field_officer` because agents are typically contracted /
// volunteer rather than full institutional staff and their
// capabilities are scoped to their own farmers only.
export const AGENT_ROLE = 'agent';

// Staff = anyone who uses the institutional dashboard (not farmer)
// Agents are intentionally NOT in STAFF_ROLES — they have a
// dedicated /agent surface and don't see the wider admin
// dashboard.
export const STAFF_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer'];

// Can run verification/fraud/decision engines and approve/reject
export const REVIEW_ROLES = ['super_admin', 'institutional_admin', 'reviewer'];

// Full administrative access
export const ADMIN_ROLES = ['super_admin', 'institutional_admin'];

// Can create farmers, applications, and manage farmer registrations
export const CREATOR_ROLES = ['super_admin', 'institutional_admin', 'field_officer'];

// Can view/approve/reject farmer registrations
export const REGISTRATION_ROLES = ['super_admin', 'institutional_admin', 'field_officer'];

// Institutional staff roles (visible in user management dropdown, excludes farmer)
export const INSTITUTIONAL_ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer'];

// NGO Onboarding spec \u00a710 \u2014 program-scoped roles.
// Additive to the existing role taxonomy; lets program/NGO
// surfaces gate on a narrower role set than STAFF_ROLES.
//
//   farmer           sees own plan
//   field_agent      sees assigned farmers (scoped by agentId)
//   program_manager  sees program summary (scoped by programId)
//   org_admin        sees organization summary (scoped by orgId)
//
// `field_agent` is the NGO-side alias; the platform-wide
// `agent` role is treated as equivalent.
export const PROGRAM_FARMER_ROLE   = 'farmer';
export const PROGRAM_AGENT_ROLES   = ['field_agent', 'agent'];
export const PROGRAM_MANAGER_ROLES = ['program_manager'];
export const PROGRAM_ORG_ROLES     = ['org_admin'];

// Combined set: anyone allowed on the NGO program dashboard.
// Platform staff also see program dashboards by default so
// an institutional admin can audit any program without being
// separately granted the program-side role.
export const PROGRAM_DASHBOARD_ROLES = [
  ...PROGRAM_ORG_ROLES,
  ...PROGRAM_MANAGER_ROLES,
  ...PROGRAM_AGENT_ROLES,
  'super_admin', 'institutional_admin',
];

/**
 * Check if a role has access to a set of allowed roles.
 */
export function hasRole(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}
