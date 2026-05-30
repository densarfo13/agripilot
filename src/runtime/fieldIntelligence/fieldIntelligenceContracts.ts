/**
 * src/runtime/fieldIntelligence/fieldIntelligenceContracts.ts —
 * wave-37 frozen contracts.
 *
 * Strict-rule audit
 *   • Pure data declarations. No engine imports.
 *   • SSR-safe. Frozen.
 *   • No PII handled.
 */

export const FIELD_INTELLIGENCE_RUNTIME_VERSION = 'field-intelligence-v1';

export const TREND = Object.freeze({
  UP:     'UP',
  DOWN:   'DOWN',
  STABLE: 'STABLE',
} as const);
export type TrendValue = typeof TREND[keyof typeof TREND];

export const YIELD_READINESS = Object.freeze({
  LOW:    'LOW',
  MEDIUM: 'MEDIUM',
  HIGH:   'HIGH',
} as const);
export type YieldReadinessValue =
  typeof YIELD_READINESS[keyof typeof YIELD_READINESS];

export const FARM_HEALTH_BAND = Object.freeze({
  GOOD:     'GOOD',     // 75-100
  WATCH:    'WATCH',    // 50-74
  CRITICAL: 'CRITICAL', // 0-49
} as const);
export type FarmHealthBand =
  typeof FARM_HEALTH_BAND[keyof typeof FARM_HEALTH_BAND];

/** Empty-state copy — shown when there is genuinely no data. */
export const EMPTY_STATE = 'Not enough field data yet';
