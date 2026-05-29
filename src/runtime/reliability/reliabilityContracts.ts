/**
 * src/runtime/reliability/reliabilityContracts.ts —
 * Reliability + incident-signal contracts.
 */

export const RELIABILITY_RUNTIME_VERSION = 'farroway-reliability-v1';

export const INCIDENT_KINDS = Object.freeze([
  'scan_failure',
  'plant_id_unavailable',
  'sync_failure',
  'duplicate_prevented',
  'api_error',
  'permission_denied',
] as const);
export type IncidentKind = (typeof INCIDENT_KINDS)[number];
