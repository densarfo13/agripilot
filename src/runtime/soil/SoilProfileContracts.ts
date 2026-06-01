/**
 * SoilProfileContracts.ts — types + constants for the SoilGrids
 * integration. Pure type module: no logic, no probes, no globals.
 */

export type SoilStatus =
  | 'NEEDS_LOCATION'
  | 'SOIL_DATA_UNAVAILABLE'
  | 'FETCHING'
  | 'OK'
  | 'STALE_CACHE';

export type DrainageRisk = 'low' | 'medium' | 'high' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';

export interface SoilTexture {
  /** % clay 0..100 (or null if unknown). */
  clayPct: number | null;
  /** % sand 0..100. */
  sandPct: number | null;
  /** % silt 0..100. */
  siltPct: number | null;
  /** Human-readable label (sandy / loamy / clayey / loam / unknown). */
  label: string;
}

export interface SoilProfile {
  farmId: string | null;
  source: 'soilgrids' | 'cache' | 'none';
  coordinatesAvailable: boolean;
  soilDataAvailable: boolean;
  soilTexture: Readonly<SoilTexture>;
  /** pH (h2o) — null when not available. NEVER fabricated. */
  ph: number | null;
  /** Organic carbon proxy (g/kg 0..200) — null when unavailable. */
  organicMatterProxy: number | null;
  /** Drainage risk derived from texture + bulk density. */
  drainageRisk: DrainageRisk;
  /** Human-readable limitations the farmer should know. */
  limitations: string;
  confidence: Confidence;
  /** Unix-ms when the data was fetched, or null when from cache. */
  fetchedAt: number | null;
  status: SoilStatus;
}

export interface SoilRecommendation {
  id: string;
  title: string;
  body: string;
  category: 'drainage' | 'organic_matter' | 'moisture' | 'general';
  /** Severity 'info' | 'watch' | 'act' — actionable but never alarmist. */
  severity: 'info' | 'watch' | 'act';
  /** Why this recommendation applies — references soil data field. */
  rationale: string;
  /** Honesty: always carries 'Decision support, not a guarantee.' */
  limitations: string;
}

export interface SoilGridsHealthEnvelope {
  initialized: true;
  configured: boolean;
  coordinatesRequired: true;
  cacheReady: boolean;
  noFakeSoilData: true;
  nonBlocking: true;
  status: SoilStatus;
  /** Source attribution. */
  source: 'soilgrids' | 'cache' | 'none';
  /** Most recent fetched profile (frozen). */
  lastProfile: Readonly<SoilProfile> | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export const GUIDANCE_TAIL = 'Decision support, not a guarantee.';
export const SOILGRIDS_RUNTIME_VERSION = 'soilgrids-v1' as const;

/** SoilGrids REST API base — public, no auth required. */
export const SOILGRIDS_API_BASE =
  'https://rest.isric.org/soilgrids/v2.0/properties/query' as const;

/** Properties we request from SoilGrids (top 0–30cm depth). */
export const SOILGRIDS_PROPERTIES: ReadonlyArray<string> = Object.freeze([
  'clay', 'sand', 'silt', 'phh2o', 'soc', 'bdod',
]);

/** Cache TTL — 30 days. SoilGrids profiles don't change quickly. */
export const SOILGRIDS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Fetch timeout. Non-blocking means we never wait long. */
export const SOILGRIDS_FETCH_TIMEOUT_MS = 8000;
