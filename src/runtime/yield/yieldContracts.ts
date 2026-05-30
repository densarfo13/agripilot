/**
 * src/runtime/yield/yieldContracts.ts — frozen types + enums for
 * the Yield Intelligence runtime.
 *
 * Safe-wording rule (enforced by CI gate):
 *   • USE: 'estimated', 'likely', 'risk', 'forecast range',
 *          'expected band', 'projected', 'monitor'.
 *   • NEVER USE: 'guaranteed yield', 'exact yield',
 *                'will produce', 'certain', 'confirmed yield'.
 *
 * Strict-rule audit
 *   • Pure data declarations.
 *   • Frozen.
 *   • No PII.
 *   • No React or DOM types.
 */

export const YIELD_RUNTIME_VERSION = 'yield-intelligence-v1';

export const YIELD_RISK = Object.freeze({
  LOW:     'low',
  MEDIUM:  'medium',
  HIGH:    'high',
  UNKNOWN: 'unknown',
} as const);

export type YieldRiskValue =
  typeof YIELD_RISK[keyof typeof YIELD_RISK];

export interface YieldForecastBand {
  low?:      number;
  expected?: number;
  high?:     number;
  unit?:     string;     // 'kg' | 'tons' | 'cobs' | 'kg/ha' etc.
}

export interface YieldRiskDriver {
  signal:    string;     // 'disease' | 'pest' | 'weather' | ...
  weight:    number;     // 0-1, how much this drove the risk
  detail:    string;     // safe-wording explanation
}

export interface YieldRecommendedAction {
  id:         string;
  title:      string;
  reason:     string;
  urgency:    'low' | 'medium' | 'high';
  actionType: 'inspect' | 'monitor' | 'follow_up_scan' | 'irrigate' | 'treat';
}

export interface YieldIntelligenceResult {
  plantId:           string;
  scanId?:           string;
  yieldRisk:         YieldRiskValue;
  forecastBand:      YieldForecastBand;
  confidence:        number;        // 0-100
  riskDrivers:       ReadonlyArray<YieldRiskDriver>;
  recommendedActions: ReadonlyArray<YieldRecommendedAction>;
  safeMessage:       string;        // farmer-facing one-liner
  hasEnoughData:     boolean;
  timestamp:         string;
}

export interface YieldIntelligenceHealth {
  runtimeVersion:           string;
  initialized:              boolean;
  yieldRiskReady:           boolean;
  forecastBandReady:        boolean;
  safeWordingReady:         boolean;
  noGuaranteedYieldClaims:  boolean;
}

/** Banned wording — CI-enforced (executable code only). */
export const YIELD_BANNED_WORDING = Object.freeze([
  'guaranteed yield',
  'exact yield',
  'will produce exactly',
  'certain yield',
  'confirmed yield',
] as const);

/** Safe verbs the runtime prefers. */
export const YIELD_SAFE_VERBS = Object.freeze([
  'estimated', 'likely', 'risk', 'forecast range',
  'expected band', 'projected', 'monitor', 'inspect',
] as const);

export const YIELD_STORAGE_KEY = 'farroway.yieldIntelligence.history';
export const YIELD_HISTORY_CAP = 200;
