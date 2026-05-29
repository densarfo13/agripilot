/**
 * src/runtime/reports/reportContracts.ts — Frozen contracts.
 */

export const REPORT_RUNTIME_VERSION = 'farroway-report-runtime-v1';

export const REPORT_TYPES = Object.freeze([
  'program_summary',
  'intervention_summary',
  'farmer_activity',
  'plant_health',
  'scan_activity',
  'task_completion',
  'evidence_summary',
] as const);
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_EMPTY_STATE = 'Not enough data yet';
