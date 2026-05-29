// Farroway Monitoring Runtime - Contracts
// Pure runtime: no React, no fetch, no localStorage writes.

export const MONITORING_RUNTIME_VERSION = "farroway-monitoring-runtime-v1";

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

export const MONITORED_EVENTS: ReadonlyArray<string> = Object.freeze([
  // Spec events (Farroway monitoring runtime v1 spec).
  "app_loaded",
  "route_changed",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "plant_created",
  "task_completed",
  "error_boundary_hit",
  "api_error",
  "rate_limited",
  // Legacy / domain-specific events — retained for back-compat
  // with existing reporters. New code should use the spec
  // identifiers above.
  "scan_failure",
  "camera_fallback",
  "plant_id_api_failure",
  "upload_failure",
  "offline_sync_failure",
  "duplicate_prevented",
  "route_permission_denied",
  "federation_login_failure",
  "report_export_failure",
  "unhandled_runtime_exception",
]);

export const MONITORING_PII_DROP_LIST: ReadonlyArray<string> = Object.freeze([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "phone",
  "email",
  "fullName",
  "fileName",
  "gpsExact",
]);

export type MonitoredEvent = string;

export interface ErrorEnvelope {
  readonly ok: boolean;
  readonly eventId: string;
  readonly event: string;
  readonly capturedAt: string;
}

export interface PerformanceSignal {
  readonly name: string;
  readonly payload: Record<string, unknown>;
  readonly at: string;
}

export interface MonitoringHealth {
  readonly initialized: boolean;
  readonly sentryConfigured: boolean;
  readonly errorReporterReady: boolean;
  readonly scanFailureTrackingReady: boolean;
  readonly syncFailureTrackingReady: boolean;
  readonly permissionDeniedTrackingReady: boolean;
  readonly snapshot: Record<string, unknown>;
}

export const isMonitoredEvent = (event: unknown): boolean =>
  _safe(() => MONITORED_EVENTS.indexOf(_str(event)) !== -1, false);

export const _internals = { _isObj, _arr, _str, _safe };
