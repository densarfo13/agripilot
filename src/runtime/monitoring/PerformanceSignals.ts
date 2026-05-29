// Farroway Monitoring Runtime - PerformanceSignals
// Pure runtime: no React, no fetch, no localStorage writes.

import type { PerformanceSignal } from "./monitoringContracts";

export const PERFORMANCE_SIGNALS_VERSION =
  "farroway-monitoring-performance-signals-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T,>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

const MAX_SIGNALS = 100;
const _signals: PerformanceSignal[] = [];

const _now = (): string =>
  _safe(() => new Date().toISOString(), "1970-01-01T00:00:00.000Z");

const _freezePayload = (
  payload: unknown
): Readonly<Record<string, unknown>> => {
  return _safe(() => {
    if (!_isObj(payload)) return Object.freeze({} as Record<string, unknown>);
    const out: Record<string, unknown> = {};
    const keys = Object.keys(payload);
    for (let i = 0; i < keys.length; i++) {
      out[keys[i]] = payload[keys[i]];
    }
    return Object.freeze(out);
  }, Object.freeze({} as Record<string, unknown>));
};

export const markSignal = (
  name: string,
  payload?: Record<string, unknown>
): PerformanceSignal => {
  return _safe(() => {
    const safeName = _str(name);
    if (!safeName) {
      return Object.freeze({
        name: "",
        payload: Object.freeze({}),
        at: _now(),
      });
    }
    const signal: PerformanceSignal = Object.freeze({
      name: safeName,
      payload: _freezePayload(payload),
      at: _now(),
    });
    _signals.push(signal);
    if (_signals.length > MAX_SIGNALS) _signals.shift();
    return signal;
  }, Object.freeze({
    name: _str(name),
    payload: Object.freeze({}),
    at: _now(),
  }));
};

export interface PerformanceSnapshot {
  readonly total: number;
  readonly maxBuffer: number;
  readonly signals: ReadonlyArray<PerformanceSignal>;
  readonly version: string;
}

export const performanceSnapshot = (): PerformanceSnapshot => {
  return _safe(
    () =>
      Object.freeze({
        total: _signals.length,
        maxBuffer: MAX_SIGNALS,
        signals: Object.freeze(_signals.slice()),
        version: PERFORMANCE_SIGNALS_VERSION,
      }),
    Object.freeze({
      total: 0,
      maxBuffer: MAX_SIGNALS,
      signals: Object.freeze([] as PerformanceSignal[]),
      version: PERFORMANCE_SIGNALS_VERSION,
    })
  );
};
