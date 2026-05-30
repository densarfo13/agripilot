/**
 * src/runtime/retention/index.ts — Farroway Retention Analytics
 * v1 barrel + boot install.
 *
 *   import {
 *     installRetentionRuntimeGlobal,
 *     recordEvent, metrics, retentionHealth,
 *     RETENTION_RUNTIME_VERSION,
 *   } from 'src/runtime/retention';
 *
 *   installRetentionRuntimeGlobal();   // pins window.__retentionHealth
 *
 * What this is
 * ────────────
 *   Single import surface for the retention runtime. Composes
 *   the contracts module + the runtime module. No engine logic
 *   in this file — pure re-export + a wrapper around the global
 *   installer so callers have a one-stop entry point.
 *
 * Strict-rule audit
 *   • Composition over architecture — no engines here.
 *   • SSR-safe. Never throws.
 *   • Frozen envelopes via the underlying runtime.
 *   • Single-writer invariant preserved — only RetentionRuntime
 *     touches the retention localStorage key.
 *   • Single window global (window.__retentionHealth) pinned by
 *     the underlying installer.
 */

import {
  RETENTION_RUNTIME_VERSION,
  RETENTION_EVENT,
  RETENTION_EVENT_TYPES,
  COHORT_BUCKET,
  COHORT_BUCKETS,
  COHORT_DAY_OFFSET,
  RETENTION_STORAGE_KEY,
  FIRST_VISIT_STORAGE_KEY,
  RETENTION_EVENT_CAP,
  FROZEN_FALLBACK_METRICS,
  type RetentionEventType,
  type CohortBucket,
  type RetentionMetrics,
} from './retentionContracts';

import {
  recordEvent,
  metrics,
  readStoredEvents,
  readFirstVisit,
  retentionHealth,
  installRetentionRuntimeGlobal as _installRetentionRuntimeGlobal,
  type MetricsInput,
  type RetentionHealth,
} from './RetentionRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * installRetentionRuntimeGlobal — one-shot boot hook. Idempotent.
 * Fault-isolated: a failure in the underlying installer cannot
 * propagate to the caller (App boot must never throw).
 */
export function installRetentionRuntimeGlobal(): boolean {
  return _safe(() => _installRetentionRuntimeGlobal(), false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Contracts
  RETENTION_RUNTIME_VERSION,
  RETENTION_EVENT,
  RETENTION_EVENT_TYPES,
  COHORT_BUCKET,
  COHORT_BUCKETS,
  COHORT_DAY_OFFSET,
  RETENTION_STORAGE_KEY,
  FIRST_VISIT_STORAGE_KEY,
  RETENTION_EVENT_CAP,
  FROZEN_FALLBACK_METRICS,
  // Runtime
  recordEvent,
  metrics,
  readStoredEvents,
  readFirstVisit,
  retentionHealth,
};

export type {
  RetentionEventType,
  CohortBucket,
  RetentionMetrics,
  MetricsInput,
  RetentionHealth,
};
