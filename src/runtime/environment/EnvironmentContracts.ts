/**
 * EnvironmentContracts.ts — Environment Provider Orchestrator.
 *
 * The pluggable abstraction over environmental data sources (Soil today;
 * Pollen / Air Quality / Weather / Satellite / scan providers later) so
 * FarmBrain consumes ONE environment signal and never depends on any single
 * provider's availability.
 *
 * Honesty contract: every signal carries a status + confidence; a provider that
 * is unconfigured or failing returns an honest 'unavailable' signal, never a
 * fabricated value. The farmer never sees a provider/API name (RULE: invisible
 * intelligence) — that is enforced by check-environment-no-provider-jargon.
 */
export const ENVIRONMENT_ORCHESTRATOR_VERSION = 'environment-orchestrator-v1';

/** Per-provider readiness — mirrors the scan provider taxonomy for consistency. */
export type ProviderStatus =
  | 'ready' | 'unavailable' | 'not_configured' | 'auth_failed_401'
  | 'forbidden_403' | 'rate_limited_429' | 'timeout' | 'provider_error'
  | 'circuit_open' | 'unsupported_location';

export type EnvironmentDomain =
  | 'soil' | 'pollen' | 'air_quality' | 'weather' | 'satellite';

/** What a single provider returns for one fetch. */
export interface EnvironmentProviderResult {
  provider: EnvironmentDomain;
  providerStatus: ProviderStatus;
  httpStatus: number | null;
  confidence: number;                 // 0..100 (0 when unavailable)
  signal: Record<string, any> | null; // domain payload (normalized, no raw API shape)
  evidence: ReadonlyArray<string>;    // farmer-facing ✓ lines (no jargon)
  failureReason: string | null;
  latencyMs: number | null;
}

/** The orchestrator's merged output — the single thing FarmBrain reads. */
export interface EnvironmentEnvelope {
  version: string;
  ok: true;
  updatedAt: number | null;
  /** Which providers contributed a usable signal this cycle. */
  contributing: ReadonlyArray<EnvironmentDomain>;
  /** Per-domain status (every registered provider, contributing or not). */
  providers: ReadonlyArray<{ provider: EnvironmentDomain; status: ProviderStatus; confidence: number }>;
  // Merged impacts / signals (honest 'estimated'/'unavailable' wording).
  weatherImpact: string | null;
  pollenImpact: string | null;
  airQualityImpact: string | null;
  diseaseRiskImpact: string | null;
  pollinationSignal: string | null;
  irrigationSignal: string | null;
  sprayTimingSignal: string | null;
  farmerRecommendation: string;       // ALWAYS a next step (never blank)
  confidence: number;                 // overall, REDUCED when providers are missing
  evidence: ReadonlyArray<string>;
}

/** Input every provider receives. */
export interface EnvironmentContext {
  lat?: number | null;
  lng?: number | null;
  weather?: any;
  cropStage?: string | null;
  crop?: string | null;
  nowMs?: number;
}

/** A pluggable provider. New domains implement this WITHOUT touching FarmBrain. */
export interface EnvironmentProvider {
  domain: EnvironmentDomain;
  priority: number;                   // lower = tried first (soil=10, weather=20, …)
  enabled: boolean;                   // false → skipped (e.g. pollen stub until keyed)
  fetch(ctx: EnvironmentContext): Promise<EnvironmentProviderResult>;
}

/**
 * Failover / priority order. Soil is the FIRST production provider. Pollen is an
 * optional stub (disabled until an Ambee Pollen key exists). FarmBrain degrades
 * gracefully — confidence drops as providers drop, functionality never blocks.
 */
export const PROVIDER_PRIORITY: ReadonlyArray<EnvironmentDomain> = Object.freeze([
  'weather', 'soil', 'air_quality', 'pollen', 'satellite',
]);

/** Build an honest 'unavailable' result (the only way a no-signal result is made). */
export function unavailableResult(
  provider: EnvironmentDomain, status: ProviderStatus, failureReason: string | null = null,
): EnvironmentProviderResult {
  return Object.freeze({
    provider, providerStatus: status, httpStatus: null, confidence: 0,
    signal: null, evidence: Object.freeze([]), failureReason, latencyMs: null,
  });
}
