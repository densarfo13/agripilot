/**
 * src/runtime/security/roleContracts.ts — Frozen role + action
 * constants for the Farroway RBAC layer.
 */

export const RBAC_VERSION = 'farroway-rbac-v1';

export const ROLES = Object.freeze([
  'farmer',
  'gardener',
  'grower',
  'buyer',
  'field_officer',
  'ngo_admin',
  'organization_admin',
  'admin',
] as const);
export type Role = (typeof ROLES)[number];

export const ACTIONS = Object.freeze([
  'scan:create',
  'plant:create',
  'plant:read',
  'plant:update',
  'task:complete',
  'artifact:create',
  'sell:mark_ready',
  'buyer:send_interest',
  'organization:read',
  'organization:write',
  'program:read',
  'program:write',
  'intervention:read',
  'intervention:write',
  'report:read',
  'report:export',
  'internal:read',
  'godmode:read',
] as const);
export type Action = (typeof ACTIONS)[number];
