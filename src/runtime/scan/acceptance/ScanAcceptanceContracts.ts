/**
 * ScanAcceptanceContracts.ts — P0 SCAN ACCEPTANCE.
 *
 * The acceptance gate decides whether a scan PROVIDER is production-ready,
 * from REAL signals only (the /api/scan/diagnostics envelope + the scan-mode
 * context). It NEVER hardcodes readiness — an un-keyed provider reports
 * `false`, honestly, until the key is set. There is no "assume green".
 */
export const SCAN_ACCEPTANCE_VERSION = 'scan-acceptance-v1';

/** Plant.id is the canonical identifier; crop.health + insect.id are optional. */
export type ScanProviderId = 'plant_id' | 'crop_health' | 'insect_id';

/** Per-provider acceptance, derived from diagnostics — never fabricated. */
export interface ProviderAcceptance {
  provider: ScanProviderId;
  providerConfigured: boolean;   // key present (from diagnostics)
  httpStatus: number | null;     // last real call, or live ping
  candidateCount: number | null; // plant_id only
  confidence: number | null;     // 0..100, last call
  ready: boolean;                 // computed below, honest
  /** Why not ready (empty when ready). */
  blockers: ReadonlyArray<string>;
  /** Optional providers may be 'disabled gracefully' rather than failed. */
  gracefullyDisabled: boolean;
}

/** The window.__scanAcceptanceHealth() envelope. */
export interface ScanAcceptanceHealth {
  ok: boolean;
  version: string;
  plantIdReady: boolean;
  cropHealthReady: boolean;
  insectIdReady: boolean;
  providerAuthOk: boolean;        // Plant.id auth proven (the gating provider)
  candidateMappingOk: boolean;    // mapping never drops valid candidates
  /** Honest overall verdict for the pilot. */
  verdict: 'BLOCKED' | 'SCAN_READY' | 'FARMBRAIN_READY_FOR_PILOT';
  providers: ReadonlyArray<ProviderAcceptance>;
  /** What a human must still do (e.g. set CROP_HEALTH_API_KEY). */
  pendingActions: ReadonlyArray<string>;
  checkedAt: number | null;
}

/** Confidence floor for a scan to be trusted into FarmBrain (RULE 6 = 0.70). */
export const ACCEPTANCE_CONFIDENCE_MIN_PCT = 70;

export const PROVIDER_LABELS: Readonly<Record<ScanProviderId, string>> = Object.freeze({
  plant_id: 'Plant.id',
  crop_health: 'Crop.health',
  insect_id: 'Insect.id',
});
