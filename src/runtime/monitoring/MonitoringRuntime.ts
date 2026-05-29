// Farroway Monitoring Runtime - Composite + Health
// Pure runtime: no React, no fetch, no localStorage writes.

import {
  MONITORING_RUNTIME_VERSION,
  MONITORED_EVENTS,
  type MonitoringHealth,
} from "./monitoringContracts";
import {
  errorReporterSnapshot,
  errorReporterReady,
  ERROR_REPORTER_VERSION,
} from "./ErrorReporter";
import {
  performanceSnapshot,
  PERFORMANCE_SIGNALS_VERSION,
} from "./PerformanceSignals";

export const MONITORING_COMPOSITE_VERSION =
  "farroway-monitoring-composite-v1";

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

const _hasWindowSentry = (): boolean =>
  _safe(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as { Sentry?: unknown };
    return _isObj(w.Sentry);
  }, false);

const _hasSentryDsnEnv = (): boolean =>
  _safe(() => {
    // typeof import.meta.env guard for SSR / non-Vite environments
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta: any = (globalThis as any).import?.meta;
    if (meta && _isObj(meta.env)) {
      const dsn = _str(meta.env.VITE_SENTRY_DSN);
      if (dsn) return true;
    }
    // Try standard Vite import.meta access pattern (safe wrapped)
    try {
      // @ts-ignore - import.meta may not exist in all environments
      if (typeof import.meta !== "undefined") {
        // @ts-ignore
        const env = (import.meta as { env?: Record<string, unknown> }).env;
        if (_isObj(env)) {
          const dsn = _str((env as Record<string, unknown>).VITE_SENTRY_DSN);
          if (dsn) return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }, false);

export const sentryConfigured = (): boolean =>
  _safe(() => _hasWindowSentry() || _hasSentryDsnEnv(), false);

export const monitoringHealth = (): MonitoringHealth => {
  return _safe(() => {
    const errSnap = errorReporterSnapshot();
    const perfSnap = performanceSnapshot();
    return Object.freeze({
      initialized: true,
      sentryConfigured: sentryConfigured(),
      errorReporterReady: errorReporterReady(),
      scanFailureTrackingReady: true,
      syncFailureTrackingReady: true,
      permissionDeniedTrackingReady: true,
      snapshot: Object.freeze({
        runtimeVersion: MONITORING_RUNTIME_VERSION,
        compositeVersion: MONITORING_COMPOSITE_VERSION,
        errorReporterVersion: ERROR_REPORTER_VERSION,
        performanceSignalsVersion: PERFORMANCE_SIGNALS_VERSION,
        monitoredEvents: MONITORED_EVENTS,
        errorReporter: errSnap,
        performance: perfSnap,
        emptyState: "Not enough data yet",
      }),
    });
  }, Object.freeze({
    initialized: false,
    sentryConfigured: false,
    errorReporterReady: false,
    scanFailureTrackingReady: false,
    syncFailureTrackingReady: false,
    permissionDeniedTrackingReady: false,
    snapshot: Object.freeze({
      runtimeVersion: MONITORING_RUNTIME_VERSION,
      emptyState: "Not enough data yet",
    }),
  }));
};

export const installMonitoringGlobal = (): boolean => {
  return _safe(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      __monitoringHealth?: () => MonitoringHealth;
    };
    w.__monitoringHealth = () => monitoringHealth();
    return true;
  }, false);
};
