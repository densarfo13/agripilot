/**
 * PilotPerformanceMonitoringRuntime.ts — §7 PERFORMANCE MONITORING.
 *
 * Captures render/interaction timing samples and persists them to
 * localStorage 'farroway_pilot_perf_log' (bounded to 100). Each sample
 * is { metric, durationMs, timestamp }. p50 (median) is computed per
 * metric and compared against the per-metric threshold table. Metrics
 * whose p50 exceeds the threshold are surfaced in thresholdsExceeded.
 *
 * Self-contained: timestamps are accepted from callers (no time source
 * in the file body). Never throws. No PII.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _lsWrite(key: string, value: unknown): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }, false);
}

type Confidence = 'low' | 'medium' | 'high';

export const PILOT_PERF_MONITORING_VERSION = 'pilot-perf-monitoring-v1' as const;

const PERF_LOG_KEY = 'farroway_pilot_perf_log' as const;
const PERF_LOG_BOUND = 100 as const;
const HONESTY_TAIL = 'Decision support, not a guarantee.' as const;

export type PilotPerfMetric =
  | 'home_render'
  | 'task_complete'
  | 'scan_result'
  | 'notification_open'
  | 'timeline_load'
  | 'weekly_review_load';

export interface PilotPerfSample {
  metric: PilotPerfMetric;
  durationMs: number;
  timestamp: number;
}

export const PERF_THRESHOLDS_MS: Readonly<Record<PilotPerfMetric, number>> = Object.freeze({
  home_render: 1000,
  task_complete: 300,
  scan_result: 5000,
  notification_open: 300,
  timeline_load: 500,
  weekly_review_load: 1000,
});

const _ALL_METRICS: ReadonlyArray<PilotPerfMetric> = Object.freeze([
  'home_render',
  'task_complete',
  'scan_result',
  'notification_open',
  'timeline_load',
  'weekly_review_load',
]) as ReadonlyArray<PilotPerfMetric>;

function _isMetric(v: unknown): v is PilotPerfMetric {
  return typeof v === 'string' && (_ALL_METRICS as ReadonlyArray<string>).indexOf(v) >= 0;
}

function _isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v);
}

function _readSamples(): PilotPerfSample[] {
  const raw = _ls(PERF_LOG_KEY);
  if (!Array.isArray(raw)) return [];
  const out: PilotPerfSample[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const metric = (r as any).metric;
    const durationMs = (r as any).durationMs;
    const timestamp = (r as any).timestamp;
    if (!_isMetric(metric)) continue;
    if (!_isFiniteNumber(durationMs) || durationMs < 0) continue;
    if (!_isFiniteNumber(timestamp)) continue;
    out.push({ metric, durationMs, timestamp });
  }
  return out;
}

function _median(values: number[]): number | null {
  if (!values || values.length < 3) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid];
  return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
}

export function recordPilotPerfSample(
  metric: PilotPerfMetric,
  durationMs: number,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (!_isMetric(metric)) return false;
    if (!_isFiniteNumber(durationMs) || durationMs < 0) return false;
    if (!_isFiniteNumber(nowMs)) return false;
    const existing = _readSamples();
    const next: PilotPerfSample[] = existing.concat([{
      metric,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: nowMs,
    }]);
    const bounded = next.length > PERF_LOG_BOUND
      ? next.slice(next.length - PERF_LOG_BOUND)
      : next;
    return _lsWrite(PERF_LOG_KEY, bounded);
  }, false);
}

export function listPerfSamples(limit: number = 100): ReadonlyArray<Readonly<PilotPerfSample>> {
  return _safe(() => {
    const samples = _readSamples();
    const lim = _isFiniteNumber(limit) && limit > 0 ? Math.floor(limit) : 100;
    const slice = samples.length > lim ? samples.slice(samples.length - lim) : samples;
    return Object.freeze(slice.map((s) => Object.freeze({
      metric: s.metric,
      durationMs: s.durationMs,
      timestamp: s.timestamp,
    }))) as ReadonlyArray<Readonly<PilotPerfSample>>;
  }, Object.freeze([]) as ReadonlyArray<Readonly<PilotPerfSample>>);
}

export function performanceMonitoringReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

export interface PilotPerfHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  samplesRecorded: number;
  p50ByMetric: Readonly<Record<PilotPerfMetric, number | null>>;
  thresholdsExceeded: ReadonlyArray<PilotPerfMetric>;
  noFakeTiming: true;
  composedFrom: ReadonlyArray<string>;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

function _emptyP50(): Readonly<Record<PilotPerfMetric, number | null>> {
  const out: Record<PilotPerfMetric, number | null> = {
    home_render: null,
    task_complete: null,
    scan_result: null,
    notification_open: null,
    timeline_load: null,
    weekly_review_load: null,
  };
  return Object.freeze(out);
}

export function pilotPerformanceMonitoringHealth(): Readonly<PilotPerfHealthEnvelope> {
  return _safe(() => {
    const samples = _readSamples();
    const storageReady = performanceMonitoringReady();
    const byMetric: Record<PilotPerfMetric, number[]> = {
      home_render: [],
      task_complete: [],
      scan_result: [],
      notification_open: [],
      timeline_load: [],
      weekly_review_load: [],
    };
    for (const s of samples) byMetric[s.metric].push(s.durationMs);

    const p50: Record<PilotPerfMetric, number | null> = {
      home_render: _median(byMetric.home_render),
      task_complete: _median(byMetric.task_complete),
      scan_result: _median(byMetric.scan_result),
      notification_open: _median(byMetric.notification_open),
      timeline_load: _median(byMetric.timeline_load),
      weekly_review_load: _median(byMetric.weekly_review_load),
    };

    const exceeded: PilotPerfMetric[] = [];
    for (const m of _ALL_METRICS) {
      const v = p50[m];
      if (v !== null && v > PERF_THRESHOLDS_MS[m]) exceeded.push(m);
    }

    const samplesRecorded = samples.length;
    const confidence: Confidence =
      samplesRecorded >= 30 ? 'high'
      : samplesRecorded >= 10 ? 'medium'
      : 'low';

    return Object.freeze<PilotPerfHealthEnvelope>({
      initialized: true,
      storageReady,
      samplesRecorded,
      p50ByMetric: Object.freeze(p50),
      thresholdsExceeded: Object.freeze(exceeded.slice()) as ReadonlyArray<PilotPerfMetric>,
      noFakeTiming: true as const,
      composedFrom: Object.freeze([
        'localStorage:farroway_pilot_perf_log',
      ]) as ReadonlyArray<string>,
      confidence,
      explanation:
        'Performance monitoring composite. Persists timing samples to ' +
        "localStorage 'farroway_pilot_perf_log' (bounded 100). Tracks 6 " +
        'metrics: home_render, task_complete, scan_result, ' +
        'notification_open, timeline_load, weekly_review_load. p50 ' +
        '(median) is computed per metric and null when fewer than 3 ' +
        'samples exist. thresholdsExceeded surfaces metrics whose p50 ' +
        'exceeds the per-metric threshold (1000/300/5000/300/500/1000 ms). ' +
        'Timestamps are supplied by callers — no time source in this file.',
      limitations:
        'Samples reflect on-device interactions only; cohort-level ' +
        'timings may differ. p50 requires at least 3 samples per metric. ' +
        HONESTY_TAIL,
    });
  }, Object.freeze<PilotPerfHealthEnvelope>({
    initialized: true,
    storageReady: false,
    samplesRecorded: 0,
    p50ByMetric: _emptyP50(),
    thresholdsExceeded: Object.freeze([]) as ReadonlyArray<PilotPerfMetric>,
    noFakeTiming: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot performance monitoring runtime initialized.',
    limitations: 'Not enough data yet. ' + HONESTY_TAIL,
  }));
}

export function installPilotPerformanceMonitoringGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotPerformanceMonitoringHealth !== 'function') {
      w.__pilotPerformanceMonitoringHealth = function () {
        const out = pilotPerformanceMonitoringHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Performance Monitoring]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
