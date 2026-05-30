/**
 * src/runtime/farmerSuccess/farmerSuccessContracts.ts —
 * wave-37.5 frozen contracts for the Farmer Success Engine.
 *
 * Strict-rule audit
 *   • Pure data. SSR-safe. Frozen.
 *   • No PII.
 */

export const FARMER_SUCCESS_RUNTIME_VERSION = 'farmer-success-v1';

export const URGENCY = Object.freeze({
  NOW:      'NOW',       // act today
  THIS_WEEK:'THIS_WEEK', // act this week
  WATCH:    'WATCH',     // monitor only
} as const);
export type UrgencyValue = typeof URGENCY[keyof typeof URGENCY];

export const RISK_SEVERITY = Object.freeze({
  HIGH:   'HIGH',
  MEDIUM: 'MEDIUM',
  LOW:    'LOW',
} as const);
export type RiskSeverityValue =
  typeof RISK_SEVERITY[keyof typeof RISK_SEVERITY];

export const SUCCESS_LEVEL = Object.freeze({
  EXCELLENT:        'EXCELLENT',        // 90+
  GOOD:             'GOOD',             // 75-89
  WATCH:            'WATCH',            // 50-74
  NEEDS_ATTENTION:  'NEEDS_ATTENTION',  // <50
} as const);
export type SuccessLevelValue =
  typeof SUCCESS_LEVEL[keyof typeof SUCCESS_LEVEL];

/** Canonical empty-state copy — farmer-friendly. */
export const EMPTY_FRIENDLY = 'Check back later';
/** Overdue copy — farmer-friendly per spec §4. */
export const OVERDUE_COPY = 'Action overdue';
