/**
 * FarmBrainContracts.ts — sprint #208, spec §1.
 *
 * Types for the Farm Brain — the read-only "single source of truth"
 * envelope composed from signals the app already holds. NOT a new
 * datastore: the runtime reads existing per-farm state and shapes it.
 * satelliteHistory is always [] (frozen).
 *
 * Pure types + the readiness-flag shape the health global returns.
 */

export const FARM_BRAIN_CONTRACTS_VERSION = 'farm-brain-contracts-v1';

export interface FarmBrainRecord {
  runtimeVersion:   string;
  farmId:           string | null;
  crop:             string | null;
  variety:          string | null;
  location:         string | null;
  plantingDate:     string | null;
  cropStage:        string | null;
  farmSize:         string | null;
  weatherHistory:   ReadonlyArray<unknown>;
  scanHistory:      ReadonlyArray<unknown>;
  taskHistory:      ReadonlyArray<unknown>;
  outcomeHistory:   ReadonlyArray<unknown>;
  satelliteHistory: ReadonlyArray<never>;   // ALWAYS [] — satellite frozen
  riskHistory:      ReadonlyArray<unknown>;
}

// The 7 readiness flags the spec's __farmBrainHealth() must expose,
// plus the #207 honesty fields kept for backward-compat.
export interface FarmBrainReadiness {
  farmBrainReady:           boolean;
  cropStageReady:           boolean;
  farmHealthReady:          boolean;
  adaptiveTasksReady:       boolean;
  scanMemoryReady:          boolean;
  outcomeLearningReady:     boolean;
  satelliteFoundationReady: boolean;
  // honesty fields (kept from #207)
  satelliteUsed:            false;
  readOnly:                 true;
  neverFabricates:          true;
}
