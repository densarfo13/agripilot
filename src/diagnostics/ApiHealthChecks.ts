/**
 * ApiHealthChecks.ts — per-service health check functions.
 *
 * Honest reporting:
 *   • `configured`  — env var present (when we can detect it client-side)
 *   • `connected`   — reachability verified (when CORS-safe to attempt)
 *   • `NEEDS_SERVER_PROBE` — server-side service the browser can't
 *                            verify directly without an /api/health
 *                            endpoint. Surfaces honestly rather than
 *                            faking green.
 *
 * No fabricated "connected" flags. Every check returns a frozen
 * record the dashboard renders as-is.
 *
 * Self-contained; never throws.
 */

import type { ServiceStatus } from './ApiLatencyMonitor';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const FETCH_TIMEOUT_MS = 6000;

export type ServiceKey =
  | 'plantId' | 'plantNet' | 'consensus' | 'weather' | 'soilGrids'
  | 'cloudinary' | 'sendgrid' | 'twilio' | 'postgres' | 'redis'
  | 'auth' | 'scanPipeline';

export interface ApiCheckResult {
  service: string;
  serviceKey: ServiceKey;
  configured: boolean;
  connected: boolean;
  status: ServiceStatus;
  latencyMs: number | null;
  serverProbeRequired: boolean;
  error: string | null;
  detail: Readonly<Record<string, unknown>>;
}

/** Read a Vite import.meta.env var if present, returning "" on miss. */
function _env(key: string): string {
  return _safe(() => {
    if (typeof import.meta === 'undefined') return '';
    const env = (import.meta as any).env;
    if (!env || typeof env !== 'object') return '';
    const v = env[key];
    return (typeof v === 'string' && v.trim()) ? v.trim() : '';
  }, '');
}

/** Probe a window-pinned health global. */
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

/** Best-effort CORS-safe HEAD/GET fetch with timeout. Returns latency
 *  + ok flag. NEVER throws to the caller. */
async function _timedFetch(url: string): Promise<{ ok: boolean; latencyMs: number; error: string | null }> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') return { ok: false, latencyMs: 0, error: 'no fetch' };
    const start = typeof performance !== 'undefined' ? performance.now() : 0;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl ? ctrl.signal : undefined,
        mode: 'cors',
      });
      clearTimeout(t);
      const end = typeof performance !== 'undefined' ? performance.now() : 0;
      return { ok: res.ok, latencyMs: Math.round(end - start), error: null };
    } catch (e: any) {
      clearTimeout(t);
      const end = typeof performance !== 'undefined' ? performance.now() : 0;
      return { ok: false, latencyMs: Math.round(end - start),
        error: (e && typeof e.message === 'string') ? e.message.slice(0, 120) : 'fetch failed' };
    }
  }, Promise.resolve({ ok: false, latencyMs: 0, error: 'check threw' }) as any);
}

/** §PLANT.ID — verifies env key + base endpoint reachability. */
export async function checkPlantId(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const key = _env('VITE_PLANTID_API_KEY');
    const configured = !!key;
    if (!configured) {
      return Object.freeze<ApiCheckResult>({
        service: 'Plant.id', serviceKey: 'plantId',
        configured: false, connected: false, status: 'unconfigured',
        latencyMs: null, serverProbeRequired: false,
        error: 'VITE_PLANTID_API_KEY not set',
        detail: Object.freeze({ envVar: 'VITE_PLANTID_API_KEY' }),
      });
    }
    // We never expose the key to the browser by calling Plant.id direct;
    // that would leak the key in network logs. Honest: report
    // serverProbeRequired so the dashboard tells the operator a server
    // /api/plant-id-health endpoint is the right verification path.
    return Object.freeze<ApiCheckResult>({
      service: 'Plant.id', serviceKey: 'plantId',
      configured: true, connected: false, status: 'unknown',
      latencyMs: null, serverProbeRequired: true,
      error: null,
      detail: Object.freeze({ note: 'Plant.id is server-side; needs /api/plant-id-health to verify' }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Plant.id', serviceKey: 'plantId',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'Plant.id check threw',
    detail: Object.freeze({}),
  })) as any);
}

/** §PLANTNET — base API is publicly reachable; no key for /v2/identify
 *  preview (real use requires a key). Browser can ping the base URL
 *  to verify connectivity. */
export async function checkPlantNet(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const r = await _timedFetch('https://my-api.plantnet.org/');
    return Object.freeze<ApiCheckResult>({
      service: 'PlantNet', serviceKey: 'plantNet',
      configured: true, connected: r.ok,
      status: r.ok ? 'connected' : 'failed',
      latencyMs: r.latencyMs, serverProbeRequired: false,
      error: r.error,
      detail: Object.freeze({ url: 'https://my-api.plantnet.org/' }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'PlantNet', serviceKey: 'plantNet',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'PlantNet check threw', detail: Object.freeze({}),
  })) as any);
}

/** §SCAN CONSENSUS — reads __plantConsensusHealth + the 3 source probes. */
export async function checkConsensus(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const consensus = _probe('__plantConsensusHealth');
    const plantId = _probe('__plantIdHealth');
    const plantNet = _probe('__plantNetHealth');
    const cropLib = _probe('__cropMatcherHealth');
    const ready = !!consensus
      && (consensus as any).consensusReady !== false;
    return Object.freeze<ApiCheckResult>({
      service: 'Scan Consensus', serviceKey: 'consensus',
      configured: !!consensus, connected: ready,
      status: ready ? 'connected' : (consensus ? 'unknown' : 'unconfigured'),
      latencyMs: null, serverProbeRequired: false, error: null,
      detail: Object.freeze({
        plantIdSource: !!plantId,
        plantNetSource: !!plantNet,
        cropLibrarySource: !!cropLib,
        fallbackReady: !!cropLib,
      }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Scan Consensus', serviceKey: 'consensus',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'consensus check threw', detail: Object.freeze({}),
  })) as any);
}

/** §OPEN-METEO — free public API, no key required, browser CORS OK. */
export async function checkOpenMeteo(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    // Tiny query — Berlin coordinates, no key needed.
    const r = await _timedFetch(
      'https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m');
    return Object.freeze<ApiCheckResult>({
      service: 'Open-Meteo', serviceKey: 'weather',
      configured: true, connected: r.ok,
      status: r.ok ? 'connected' : 'failed',
      latencyMs: r.latencyMs, serverProbeRequired: false,
      error: r.error,
      detail: Object.freeze({ url: 'https://api.open-meteo.com/v1/forecast' }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Open-Meteo', serviceKey: 'weather',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'weather check threw', detail: Object.freeze({}),
  })) as any);
}

/** §SOILGRIDS — public ISRIC API, no key. */
export async function checkSoilGrids(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const r = await _timedFetch(
      'https://rest.isric.org/soilgrids/v2.0/properties/query?lon=13.41&lat=52.52&property=phh2o&depth=0-5cm&value=mean');
    return Object.freeze<ApiCheckResult>({
      service: 'SoilGrids', serviceKey: 'soilGrids',
      configured: true, connected: r.ok,
      status: r.ok ? 'connected' : 'failed',
      latencyMs: r.latencyMs, serverProbeRequired: false,
      error: r.error,
      detail: Object.freeze({
        url: 'https://rest.isric.org/soilgrids/v2.0/properties/query',
        gpsReady: r.ok, profileReady: r.ok,
      }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'SoilGrids', serviceKey: 'soilGrids',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'soil check threw', detail: Object.freeze({}),
  })) as any);
}

/** §CLOUDINARY — env var presence + (if env name suggests cloud name)
 *  the public res.cloudinary.com is reachable. */
export async function checkCloudinary(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const cloud = _env('VITE_CLOUDINARY_CLOUD_NAME');
    const configured = !!cloud;
    if (!configured) {
      return Object.freeze<ApiCheckResult>({
        service: 'Cloudinary', serviceKey: 'cloudinary',
        configured: false, connected: false, status: 'unconfigured',
        latencyMs: null, serverProbeRequired: false,
        error: 'VITE_CLOUDINARY_CLOUD_NAME not set',
        detail: Object.freeze({ envVar: 'VITE_CLOUDINARY_CLOUD_NAME' }),
      });
    }
    // CORS-safe probe to res.cloudinary.com.
    const r = await _timedFetch('https://res.cloudinary.com/' + encodeURIComponent(cloud) + '/image/upload/v1/sample.jpg');
    return Object.freeze<ApiCheckResult>({
      service: 'Cloudinary', serviceKey: 'cloudinary',
      configured: true,
      connected: r.ok || (r.latencyMs > 0 && !r.error),
      status: (r.ok ? 'connected' : 'failed'),
      latencyMs: r.latencyMs, serverProbeRequired: true,
      error: r.error,
      detail: Object.freeze({
        cloudName: cloud,
        uploadReady: false,
        retrievalReady: r.ok,
        note: 'Upload + delete must verify via server /api/cloudinary-health',
      }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Cloudinary', serviceKey: 'cloudinary',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'cloudinary check threw', detail: Object.freeze({}),
  })) as any);
}

/** §SENDGRID / §TWILIO / §POSTGRES / §REDIS — server-side. */
async function _serverSideCheck(
  serviceName: string, serviceKey: ServiceKey, healthPath: string,
): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    if (typeof fetch === 'undefined') {
      return Object.freeze<ApiCheckResult>({
        service: serviceName, serviceKey,
        configured: false, connected: false, status: 'unknown',
        latencyMs: null, serverProbeRequired: true,
        error: 'No fetch available',
        detail: Object.freeze({ healthPath }),
      });
    }
    const r = await _timedFetch(healthPath);
    return Object.freeze<ApiCheckResult>({
      service: serviceName, serviceKey,
      configured: r.ok || (r.latencyMs > 0 && r.error === null),
      connected: r.ok,
      status: r.ok ? 'connected' : (r.error ? 'failed' : 'unknown'),
      latencyMs: r.latencyMs, serverProbeRequired: true,
      error: r.error,
      detail: Object.freeze({ healthPath }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: serviceName, serviceKey,
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: true,
    error: 'server check threw', detail: Object.freeze({ healthPath }),
  })) as any);
}

export function checkSendgrid(): Promise<Readonly<ApiCheckResult>> {
  return _serverSideCheck('SendGrid', 'sendgrid', '/api/health/sendgrid');
}
export function checkTwilio(): Promise<Readonly<ApiCheckResult>> {
  return _serverSideCheck('Twilio', 'twilio', '/api/health/twilio');
}
export function checkPostgres(): Promise<Readonly<ApiCheckResult>> {
  return _serverSideCheck('Postgres', 'postgres', '/api/health/postgres');
}
export function checkRedis(): Promise<Readonly<ApiCheckResult>> {
  return _serverSideCheck('Redis', 'redis', '/api/health/redis');
}

/** §AUTH — composes existing __authStartupHealth probe. */
export async function checkAuth(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const auth = _probe('__authStartupHealth') || _probe('__loginRoutingHealth');
    const ready = !!auth && (auth as any).initialized === true;
    return Object.freeze<ApiCheckResult>({
      service: 'Auth', serviceKey: 'auth',
      configured: !!auth, connected: ready,
      status: ready ? 'connected' : (auth ? 'unknown' : 'unconfigured'),
      latencyMs: null, serverProbeRequired: false,
      error: null,
      detail: Object.freeze({
        loginReady: ready,
        jwtReady: ready,
        sessionReady: ready,
      }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Auth', serviceKey: 'auth',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'auth check threw', detail: Object.freeze({}),
  })) as any);
}

/** §SCAN QUALITY PIPELINE — composes __scanPilotFreezeHealth. */
export async function checkScanPipeline(): Promise<Readonly<ApiCheckResult>> {
  return _safe(async () => {
    const pilot = _probe('__scanPilotFreezeHealth');
    const accuracy = _probe('__scanAccuracyHealth');
    const ready = !!pilot && (pilot as any).noDeadEnds === true;
    return Object.freeze<ApiCheckResult>({
      service: 'Scan Pipeline', serviceKey: 'scanPipeline',
      configured: !!pilot, connected: ready,
      status: ready ? 'connected' : (pilot ? 'unknown' : 'unconfigured'),
      latencyMs: null, serverProbeRequired: false,
      error: null,
      detail: Object.freeze({
        qualityGateReady: !!accuracy && (accuracy as any).qualityGateReady === true,
        identificationReady: !!accuracy && (accuracy as any).consensusReady === true,
        diseaseReady: !!accuracy && (accuracy as any).issueDetectionReady === true,
        taskReady: !!accuracy && (accuracy as any).taskCreationReady === true,
        followUpReady: !!accuracy && (accuracy as any).followUpReady === true,
        outcomeReady: !!accuracy && (accuracy as any).outcomeCaptureReady === true,
      }),
    });
  }, Promise.resolve(Object.freeze<ApiCheckResult>({
    service: 'Scan Pipeline', serviceKey: 'scanPipeline',
    configured: false, connected: false, status: 'failed',
    latencyMs: null, serverProbeRequired: false,
    error: 'scan pipeline check threw', detail: Object.freeze({}),
  })) as any);
}

/** All 12 spec services. */
export const ALL_SERVICE_KEYS: ReadonlyArray<ServiceKey> = Object.freeze([
  'plantId', 'plantNet', 'consensus', 'weather', 'soilGrids',
  'cloudinary', 'sendgrid', 'twilio', 'postgres', 'redis',
  'auth', 'scanPipeline',
]);

/** Run all 12 checks in parallel. */
export async function runAllChecks(): Promise<ReadonlyArray<Readonly<ApiCheckResult>>> {
  return _safe(async () => {
    const results = await Promise.all([
      checkPlantId(), checkPlantNet(), checkConsensus(),
      checkOpenMeteo(), checkSoilGrids(), checkCloudinary(),
      checkSendgrid(), checkTwilio(), checkPostgres(),
      checkRedis(), checkAuth(), checkScanPipeline(),
    ]);
    return Object.freeze(results) as ReadonlyArray<Readonly<ApiCheckResult>>;
  }, Promise.resolve(Object.freeze([])) as any);
}
