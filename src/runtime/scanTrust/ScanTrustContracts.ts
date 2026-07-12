/**
 * ScanTrustContracts.ts — sprint #214 §2.
 *
 * Types for the scan trust gate. Sibling namespace `scanTrust/` —
 * wave-36 locks `src/runtime/scan/`, so the spec's
 * `src/runtime/scan/trust/` would violate the lock; this lives
 * alongside scanMythos/ instead. Functionally identical.
 *
 * Pure data. Frozen at module scope.
 */

export const SCAN_TRUST_CONTRACTS_VERSION = 'scan-trust-contracts-v1';

// Confidence threshold (the spec's 0.70 on a 0-1 scale = 70 on 0-100).
// At or above this we CONFIRM an identification (plant creation, disease
// analysis allowed). This is deliberately NOT lowered — instead the band
// below it is split into a provisional tier (see below).
export const TRUST_CONFIDENCE_THRESHOLD_PCT = 70;

// Provisional tier floor. A candidate in [PROVISIONAL, TRUST) is plausible
// but unconfirmed: we surface the top candidate and ASK the farmer to
// confirm — we do NOT auto-create a plant, and we do NOT generate treatment
// until they confirm. Below PROVISIONAL there is no trustworthy candidate at
// all → low-confidence. 45 aligns with the provider 'medium' band start, so
// the split is: <45 low · [45,70) provisional · ≥70 confirmed.
export const PROVISIONAL_CONFIDENCE_THRESHOLD_PCT = 45;

export type GateStatus = 'trusted' | 'review' | 'blocked';

export interface ScanTrustDecision {
  runtimeVersion:           string;
  allowPlantCreation:       boolean;
  allowTaskCreation:        boolean;
  allowFarmBrainIngestion:  boolean;
  allowTimelineWrite:       boolean;
  allowRecentScanDisplay:   boolean;
  allowReviewSave:          boolean;
  gateStatus:               GateStatus;
  gateReasons:              ReadonlyArray<string>;
}

// plantName values that mean "not identified".
export const UNKNOWN_PLANT_TOKENS = Object.freeze([
  '', 'unknown', 'unknown plant', 'scan unclear', 'needs review',
  'needs_review', 'not identified', '—', '-',
]);

// issue values that mean "no usable diagnosis".
export const UNKNOWN_ISSUE_TOKENS = Object.freeze([
  '', 'unknown', 'no_visible_issue', 'needs_review', 'unclear',
]);

// status values that mean the scan is not trusted.
export const UNCLEAR_STATUS_TOKENS = Object.freeze([
  'needs_review', 'low_confidence', 'uncertain', 'unclear',
]);
