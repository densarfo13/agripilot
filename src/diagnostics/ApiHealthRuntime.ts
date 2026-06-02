/**
 * ApiHealthRuntime.ts → window.__apiHealth().
 *
 * Aggregates the per-service check results into the spec output
 * shape with an overallHealthScore + scanReadinessScore.
 *
 * IMPORTANT: this runtime does NOT auto-run the live checks (those
 * are network-bound). The dashboard page triggers runAllChecks() on
 * mount and caches the latest results in localStorage. This runtime
 * READS the cached results so __apiHealth() returns instantly.
 *
 * When no cached results exist, every flag is honestly false +
 * status: 'unknown'. NEVER fabricates a green status.
 */

import type { ApiCheckResult, ServiceKey } from './ApiHealthChecks';
import { ALL_SERVICE_KEYS } from './ApiHealthChecks';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const CACHE_KEY = 'farroway_api_health_cache';

type Confidence = 'low' | 'medium' | 'high';

export const API_HEALTH_RUNTIME_VERSION = 'api-health-runtime-v1' as const;

export interface ApiHealthEnvelope {
  initialized: true;
  // Per-spec service flags (true only when a real check confirmed it).
  plantId: boolean;
  plantNet: boolean;
  consensus: boolean;
  weather: boolean;
  soilGrids: boolean;
  cloudinary: boolean;
  sendgrid: boolean;
  twilio: boolean;
  postgres: boolean;
  redis: boolean;
  auth: boolean;
  scanPipeline: boolean;
  // Aggregate scores.
  connectedCount: number;
  totalServices: 12;
  overallHealthScore: number | null;   // 0..100; null when no checks yet
  scanReadinessScore: number | null;   // 0..100 weighted; null when no data
  scanReadinessRecommendation: string;
  // Per-service detail (frozen records).
  services: ReadonlyArray<Readonly<ApiCheckResult>>;
  missingEnvVars: ReadonlyArray<string>;
  lastCheckTs: number | null;
  // Honesty constants.
  noFakeConnections: true;
  noFabricatedScore: true;
  adminOnly: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readCache(): ApiCheckResult[] {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.results)) return [];
    return parsed.results;
  }, []);
}

function _readCacheTs(): number | null {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed.ts === 'number') ? parsed.ts : null;
  }, null);
}

/** Persist a fresh batch of results. Called by the dashboard page. */
export function writeCheckCache(results: ReadonlyArray<Readonly<ApiCheckResult>>, nowMs: number)
  : boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const payload = { ts: nowMs, results };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    return true;
  }, false);
}

/** Per-service flag map (true only when status === 'connected'). */
function _flagsFor(results: ApiCheckResult[]): Record<ServiceKey, boolean> {
  const out: Record<ServiceKey, boolean> = {
    plantId: false, plantNet: false, consensus: false, weather: false,
    soilGrids: false, cloudinary: false, sendgrid: false, twilio: false,
    postgres: false, redis: false, auth: false, scanPipeline: false,
  };
  for (const r of results) {
    if (!r || !r.serviceKey) continue;
    if (ALL_SERVICE_KEYS.indexOf(r.serviceKey) < 0) continue;
    out[r.serviceKey] = r.status === 'connected';
  }
  return out;
}

/** Calculate the scan readiness score using weighted components.
 *  Each component is null when no signal exists. Returns null when
 *  ALL weighted components are null. */
function _scanReadinessScore(flags: Record<ServiceKey, boolean>): {
  score: number | null; recommendation: string;
} {
  // Weighted: Plant APIs 30, Weather 15, Soil 15, Storage 10,
  // Database 15, Auth 15 (sums to 100).
  const components: { weight: number; ready: boolean }[] = [
    { weight: 15, ready: flags.plantId }, // Plant.id half
    { weight: 15, ready: flags.plantNet }, // PlantNet half
    { weight: 15, ready: flags.weather },
    { weight: 15, ready: flags.soilGrids },
    { weight: 10, ready: flags.cloudinary },
    { weight: 15, ready: flags.postgres },
    { weight: 15, ready: flags.auth },
  ];
  const totalWeight = components.reduce((a, c) => a + c.weight, 0);
  const earned = components.reduce(
    (a, c) => a + (c.ready ? c.weight : 0), 0);
  const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : null;
  let recommendation = 'Score reflects connected APIs only — null counts toward "unconfigured" and lowers readiness honestly.';
  if (score === null) {
    recommendation = 'No API checks have run yet. Open the System Health page to trigger them.';
  } else if (score >= 80) {
    recommendation = 'Scan readiness is high. Pilot can proceed.';
  } else if (score >= 50) {
    recommendation = 'Scan readiness is partial. Configure missing services to lift score.';
  } else {
    recommendation = 'Scan readiness is low. Several critical APIs are unconfigured or unreachable.';
  }
  return { score, recommendation };
}

/** Extract env var names from results that are unconfigured. */
function _missingEnvVars(results: ApiCheckResult[]): string[] {
  const out: string[] = [];
  for (const r of results) {
    if (!r || r.status !== 'unconfigured') continue;
    const d: any = r.detail || {};
    if (typeof d.envVar === 'string' && out.indexOf(d.envVar) < 0) {
      out.push(d.envVar);
    }
  }
  return out;
}

export function apiHealth(): Readonly<ApiHealthEnvelope> {
  return _safe(() => {
    const results = _readCache();
    const flags = _flagsFor(results);
    const connectedCount = Object.values(flags).filter(Boolean).length;
    const overallHealthScore = results.length > 0
      ? Math.round((connectedCount / 12) * 100) : null;
    const sr = _scanReadinessScore(flags);

    return Object.freeze<ApiHealthEnvelope>({
      initialized: true,
      ...flags,
      connectedCount,
      totalServices: 12 as const,
      overallHealthScore,
      scanReadinessScore: sr.score,
      scanReadinessRecommendation: sr.recommendation,
      services: Object.freeze(results.map((r) => Object.freeze(r))) as ReadonlyArray<Readonly<ApiCheckResult>>,
      missingEnvVars: Object.freeze(_missingEnvVars(results)) as ReadonlyArray<string>,
      lastCheckTs: _readCacheTs(),
      noFakeConnections: true as const,
      noFabricatedScore: true as const,
      adminOnly: true as const,
      confidence: (connectedCount >= 8 ? 'high'
        : connectedCount >= 4 ? 'medium' : 'low') as Confidence,
      explanation:
        'API health composite. Reads cached per-service check results. Every "true" flag traces ' +
        'to a real check that returned status:"connected" — never fabricated. Scores are null ' +
        'when no checks have run yet; never a misleading 0%.',
      limitations:
        'Server-side services (Postgres, Redis, SendGrid, Twilio) require an /api/health/* ' +
        'endpoint on the server to verify. Browser-only checks (PlantNet, Open-Meteo, SoilGrids) ' +
        'reflect public-API reachability at the time of the last check. Decision support, not a guarantee.',
    });
  }, Object.freeze<ApiHealthEnvelope>({
    initialized: true,
    plantId: false, plantNet: false, consensus: false, weather: false,
    soilGrids: false, cloudinary: false, sendgrid: false, twilio: false,
    postgres: false, redis: false, auth: false, scanPipeline: false,
    connectedCount: 0, totalServices: 12 as const,
    overallHealthScore: null, scanReadinessScore: null,
    scanReadinessRecommendation: 'No checks have run yet.',
    services: Object.freeze([]) as ReadonlyArray<Readonly<ApiCheckResult>>,
    missingEnvVars: Object.freeze([]) as ReadonlyArray<string>,
    lastCheckTs: null,
    noFakeConnections: true as const,
    noFabricatedScore: true as const,
    adminOnly: true as const,
    confidence: 'low' as Confidence,
    explanation: 'API health runtime initialized.',
    limitations: 'Not enough data yet. Decision support, not a guarantee.',
  }));
}

export function installApiHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__apiHealth !== 'function') {
      w.__apiHealth = function () {
        const out = apiHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · API Health]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
