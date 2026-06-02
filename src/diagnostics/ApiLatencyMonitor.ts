/**
 * ApiLatencyMonitor.ts — per-service latency sample store.
 *
 * Stores samples in localStorage 'farroway_api_latency_log' (bounded
 * 300 samples). Each sample: { service, latencyMs, status, ts }.
 * Caller passes nowMs (from performance.now() or Date — runtime-side
 * since this is a pure module).
 *
 * Self-contained; never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

const STORAGE_KEY = 'farroway_api_latency_log';
const MAX_SAMPLES = 300;

export type ServiceStatus = 'connected' | 'unconfigured' | 'failed' | 'unknown';

export interface ApiLatencySample {
  service: string;
  latencyMs: number;
  status: ServiceStatus;
  ts: number;
}

function _readSamples(): ApiLatencySample[] {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: ApiLatencySample[] = [];
    for (const r of parsed) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.service !== 'string') continue;
      if (typeof r.latencyMs !== 'number' || !isFinite(r.latencyMs)) continue;
      if (typeof r.ts !== 'number') continue;
      if (r.status !== 'connected' && r.status !== 'unconfigured'
          && r.status !== 'failed' && r.status !== 'unknown') continue;
      out.push(r);
    }
    return out;
  }, []);
}

function _writeSamples(list: ApiLatencySample[]): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const bounded = list.length > MAX_SAMPLES
      ? list.slice(list.length - MAX_SAMPLES) : list;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

export function recordLatencySample(
  service: string, latencyMs: number, status: ServiceStatus, nowMs: number,
): boolean {
  return _safe(() => {
    if (!service || typeof service !== 'string') return false;
    if (typeof latencyMs !== 'number' || !isFinite(latencyMs) || latencyMs < 0) return false;
    if (typeof nowMs !== 'number' || !isFinite(nowMs)) return false;
    const list = _readSamples();
    list.push({ service, latencyMs: Math.round(latencyMs), status, ts: nowMs });
    return _writeSamples(list);
  }, false);
}

export function listLatencySamples(service?: string, limit = 50)
  : ReadonlyArray<Readonly<ApiLatencySample>> {
  return _safe(() => {
    const all = _readSamples();
    const filtered = service ? all.filter((s) => s.service === service) : all;
    filtered.sort((a, b) => b.ts - a.ts);
    return Object.freeze(filtered.slice(0, Math.max(1, Math.min(limit, MAX_SAMPLES)))
      .map((s) => Object.freeze(s))) as ReadonlyArray<Readonly<ApiLatencySample>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<ApiLatencySample>>);
}

/** Compute p50 (median) latency for a service across stored samples.
 *  Returns null when fewer than 3 samples exist (honest insufficient
 *  data; never a fabricated 0 ms). */
export function p50LatencyFor(service: string): number | null {
  return _safe(() => {
    const samples = _readSamples().filter((s) => s.service === service
      && s.status === 'connected');
    if (samples.length < 3) return null;
    const sorted = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }, null);
}

export function latencyMonitorReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}
