// Farroway Monitoring Runtime - Barrel
// Pure runtime: no React, no fetch, no localStorage writes.

export const MONITORING_INDEX_VERSION = "farroway-monitoring-index-v1";

export {
  MONITORING_RUNTIME_VERSION,
  MONITORED_EVENTS,
  MONITORING_PII_DROP_LIST,
  isMonitoredEvent,
} from "./monitoringContracts";
export type {
  MonitoredEvent,
  ErrorEnvelope,
  PerformanceSignal,
  MonitoringHealth,
} from "./monitoringContracts";

export {
  ERROR_REPORTER_VERSION,
  reportError,
  listErrors,
  errorReporterSnapshot,
  errorReporterReady,
} from "./ErrorReporter";
export type {
  ReportErrorInput,
  ListErrorsOptions,
  ErrorReporterSnapshot,
} from "./ErrorReporter";

export {
  PERFORMANCE_SIGNALS_VERSION,
  markSignal,
  performanceSnapshot,
} from "./PerformanceSignals";
export type { PerformanceSnapshot } from "./PerformanceSignals";

export {
  MONITORING_COMPOSITE_VERSION,
  sentryConfigured,
  monitoringHealth,
  installMonitoringGlobal,
} from "./MonitoringRuntime";
