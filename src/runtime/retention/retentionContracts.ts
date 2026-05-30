/**
 * src/runtime/retention/retentionContracts.ts — Farroway
 * Retention Analytics v1 contracts.
 *
 *   import {
 *     RETENTION_RUNTIME_VERSION, RETENTION_EVENT,
 *     COHORT_BUCKET, RETENTION_STORAGE_KEY,
 *     FIRST_VISIT_STORAGE_KEY, RETENTION_EVENT_CAP,
 *   } from 'src/runtime/retention/retentionContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types for the retention runtime. No
 *   side effects. No engine imports. Frozen at module load
 *   so callers cannot mutate the contract surface.
 *
 * Composition note
 *   This module never reads PostHog / Mixpanel / Sentry. It is
 *   the contract surface for a localStorage-only writer at
 *   farroway.retentionEvents (single-writer invariant —
 *   RetentionRuntime owns the key).
 *
 * Strict-rule audit
 *   • Pure data. No window / localStorage access.
 *   • SSR-safe by virtue of having no side effects.
 *   • Frozen objects + frozen tuple types.
 *   • No PII — these are enum strings + numeric caps only.
 */

export const RETENTION_RUNTIME_VERSION = 'farroway-retention-v1';

/** Canonical event types — only these may be recorded. */
export const RETENTION_EVENT = Object.freeze({
  SCAN:           'scan',
  PLANT_CREATED:  'plant_created',
  TASK_COMPLETED: 'task_completed',
  APP_OPEN:       'app_open',
} as const);
export type RetentionEventType =
  (typeof RETENTION_EVENT)[keyof typeof RETENTION_EVENT];

/** Tuple of legal event strings — handy for runtime validation. */
export const RETENTION_EVENT_TYPES = Object.freeze([
  RETENTION_EVENT.SCAN,
  RETENTION_EVENT.PLANT_CREATED,
  RETENTION_EVENT.TASK_COMPLETED,
  RETENTION_EVENT.APP_OPEN,
] as const);

/** Cohort buckets — Day-1, Day-7, Day-30 retention markers. */
export const COHORT_BUCKET = Object.freeze({
  D1:  'd1',
  D7:  'd7',
  D30: 'd30',
} as const);
export type CohortBucket =
  (typeof COHORT_BUCKET)[keyof typeof COHORT_BUCKET];

export const COHORT_BUCKETS = Object.freeze([
  COHORT_BUCKET.D1,
  COHORT_BUCKET.D7,
  COHORT_BUCKET.D30,
] as const);

/** Days each bucket measures (offset from firstVisit). */
export const COHORT_DAY_OFFSET = Object.freeze({
  [COHORT_BUCKET.D1]:  1,
  [COHORT_BUCKET.D7]:  7,
  [COHORT_BUCKET.D30]: 30,
} as const);

/**
 * Single-writer localStorage key — RetentionRuntime owns this.
 * UI never writes here directly (single-writer invariant).
 * Payload shape: { v: 1, events: Array<{ t: RetentionEventType, iso: string }> }
 * No PII is ever stored: no farmer name, phone, email, coords,
 * device id, or IP. Only event type + ISO timestamp.
 */
export const RETENTION_STORAGE_KEY = 'farroway.retentionEvents';

/**
 * First-visit anchor key — RetentionRuntime READS this but never
 * writes it. Some other onboarding/boot module is the writer.
 * Value is an ISO 8601 string (no PII).
 */
export const FIRST_VISIT_STORAGE_KEY = 'farroway.firstVisit';

/** Rolling FIFO cap — older rows fall off once exceeded. */
export const RETENTION_EVENT_CAP = 1000;

/** Public envelope shape returned by metrics() + the health probe. */
export interface RetentionMetrics {
  /** Day-1 retention marker — any event on the day after firstVisit. */
  d1:  boolean;
  /** Day-7 retention marker. */
  d7:  boolean;
  /** Day-30 retention marker. */
  d30: boolean;
  /** Distinct event-days in last 30d ÷ 30, capped at 1. */
  returnRate: number;
  /** Distinct days with any event in the last 7d (grower mode). */
  weeklyActiveGrowers: number;
  /** Distinct days with any event in the last 7d (gardener mode). */
  weeklyActiveGardeners: number;
}

/** Frozen fallback used by every public function on failure. */
export const FROZEN_FALLBACK_METRICS: Readonly<RetentionMetrics> =
  Object.freeze({
    d1:  false,
    d7:  false,
    d30: false,
    returnRate: 0,
    weeklyActiveGrowers:   0,
    weeklyActiveGardeners: 0,
  });
