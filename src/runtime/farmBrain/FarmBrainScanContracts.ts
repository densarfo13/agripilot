/**
 * FarmBrainScanContracts.ts — P0 SAFE FARMBRAIN INGESTION.
 *
 * The contract for the one decision that protects FarmBrain from weak data:
 * may THIS scan update FarmBrain, or must it be held for review? FarmBrain
 * only ever advances on a scan that clears EVERY gate — there is no soft path.
 */
export const FARMBRAIN_INGESTION_VERSION = 'farmbrain-scan-ingestion-v1';

/** RULE 6 — the confidence floor for ingestion (0.70). */
export const FARMBRAIN_INGEST_CONFIDENCE_MIN_PCT = 70;

/** Signals the ingestion gate evaluates — all REAL, none fabricated. */
export interface FarmBrainIngestInput {
  plantKnown?: boolean;          // a real candidate identified
  confidencePct?: number;        // 0..100
  confidence?: number;           // 0..1 or 0..100 (normalized)
  trustPassed?: boolean;         // evaluateScanTrust → allowFarmBrain
  providerAuthOk?: boolean;      // Plant.id auth proven
  photoQualityFailed?: boolean;  // PhotoQuality verdict
  reviewOnly?: boolean;          // routed to review queue
  providerUnavailable?: boolean; // provider error / unconfigured
}

/** The ingestion decision. Frozen, explainable, never throws. */
export interface FarmBrainIngestDecision {
  version: string;
  shouldIngest: boolean;
  confidencePct: number;
  /** Every reason it was blocked (empty when ingested). */
  blockers: ReadonlyArray<string>;
  /** Which FarmBrain fields this scan is cleared to update (RULE 6 list). */
  updates: ReadonlyArray<string>;
}

/** The FarmBrain fields a STRONG scan is allowed to update (RULE 6). */
export const FARMBRAIN_UPDATE_FIELDS: ReadonlyArray<string> = Object.freeze([
  'crop', 'health', 'risk', 'disease', 'pest', 'growthStage',
  'todayTask', 'timeline', 'dataQuality', 'farmBrainConfidence',
]);
