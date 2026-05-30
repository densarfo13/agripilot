/**
 * src/runtime/severity/severityContracts.ts — frozen severity
 * enum + types for the Severity scoring suite.
 *
 * Safe wording — banned: 'emergency', 'guaranteed loss',
 * 'confirmed crop failure'.
 */

export const SEVERITY_RUNTIME_VERSION = 'severity-v1';

export const SEVERITY_LEVEL = Object.freeze({
  LOW:      'low',
  MEDIUM:   'medium',
  HIGH:     'high',
  CRITICAL: 'critical',
  UNKNOWN:  'unknown',
} as const);

export type SeverityLevelValue =
  typeof SEVERITY_LEVEL[keyof typeof SEVERITY_LEVEL];

export interface SeverityResult {
  plantId:           string;
  scanId:            string;
  level:             SeverityLevelValue;
  score:             number;  // 0-100
  affectedAreaPct?:  number;  // 0-100
  damageSigns:       ReadonlyArray<string>;
  recommendedPriority: string;     // safe-wording
  recommendation:    string;       // safe-wording
  repeatScanCount:   number;
  needsReview:       boolean;
  timestamp:         string;
}

export interface SeverityHealth {
  runtimeVersion:        string;
  initialized:           boolean;
  severityReady:         boolean;
  levelsSupported:       number;
}

/** Banned wording for the CI gate. */
export const SEVERITY_BANNED_WORDING = Object.freeze([
  'emergency',
  'guaranteed loss',
  'confirmed crop failure',
] as const);

export const SEVERITY_STORAGE_KEY = 'farroway.severity.history';
export const SEVERITY_HISTORY_CAP = 200;
