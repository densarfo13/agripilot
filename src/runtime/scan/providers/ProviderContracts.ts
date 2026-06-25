/**
 * ProviderContracts.ts — MULTI-PROVIDER SCAN ADAPTERS (client contracts).
 *
 * ARCHITECTURE NOTE (important): the real provider API calls live SERVER-SIDE
 * (server/src/ml/providers/*.js) because the API keys are secrets — calling
 * Kindwise from the browser would leak the key. These client "providers" are
 * typed NORMALIZERS over the server's /api/scan/analyze per-provider response;
 * they never hold a key and never call an external API.
 */
export const PROVIDER_CONTRACTS_VERSION = 'scan-provider-contracts-v1';

/** Status taxonomy shared by every provider. */
export type ProviderStatus =
  | 'READY' | 'NO_RESULT' | 'UNSUPPORTED' | 'AUTH_FAILED'
  | 'CREDITS_EXHAUSTED' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_ERROR';

export const PROVIDER_STATUSES: ReadonlyArray<ProviderStatus> = Object.freeze([
  'READY', 'NO_RESULT', 'UNSUPPORTED', 'AUTH_FAILED',
  'CREDITS_EXHAUSTED', 'RATE_LIMITED', 'TIMEOUT', 'PROVIDER_ERROR',
]);

export interface ProviderResult {
  provider: string;                 // 'crop.health' | 'mushroom.id' | …
  status: ProviderStatus;
  httpStatus: number | null;
  confidence: number;               // 0..100
  candidates: ReadonlyArray<{ name: string; score: number }>;
  findings: Readonly<Record<string, any>>;  // provider-specific (disease, species, …)
  recommendations: ReadonlyArray<string>;
  failureReason: string | null;
  latencyMs: number | null;
}

/** Confidence floor for any provider finding to drive an action (§6). */
export const PROVIDER_CONFIDENCE_MIN = 70;

/** Map a raw server status string into the canonical taxonomy. */
export function normalizeStatus(raw: any): ProviderStatus {
  const s = String(raw || '').toUpperCase();
  if ((PROVIDER_STATUSES as string[]).includes(s)) return s as ProviderStatus;
  // Tolerate server variants.
  if (s === 'AUTH_FAILED_401' || s === 'FORBIDDEN_403') return 'AUTH_FAILED';
  if (s === 'RATE_LIMITED_429') return 'RATE_LIMITED';
  if (s === 'MISSING_ENV' || s === 'NOT_WIRED') return 'UNSUPPORTED';
  if (s === 'PROVIDER_ERROR' || s === 'MAPPING_ERROR') return 'PROVIDER_ERROR';
  return 'NO_RESULT';
}

export function emptyProviderResult(provider: string, status: ProviderStatus = 'UNSUPPORTED'): ProviderResult {
  return Object.freeze({
    provider, status, httpStatus: null, confidence: 0,
    candidates: Object.freeze([]), findings: Object.freeze({}),
    recommendations: Object.freeze([]), failureReason: null, latencyMs: null,
  });
}
