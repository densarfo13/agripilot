/**
 * src/runtime/outcomes/outcomeContracts.ts — Outcome Engine
 * contracts. Frozen status enums + record shape types consumed
 * by every other module in this folder.
 *
 *   import {
 *     OUTCOME_RUNTIME_VERSION,
 *     OUTCOME_STATUS, OUTCOME_STATUS_VALUES,
 *     OUTCOME_LIFECYCLE, OUTCOME_STORAGE_KEY,
 *     OUTCOME_STORAGE_CAP, OUTCOME_NOTES_MAX,
 *   } from 'src/runtime/outcomes/outcomeContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types. No engines, no side effects, no
 *   imports of runtime modules. Frozen at module load.
 *
 * Strict-rule audit
 *   • Pure data, no side effects.
 *   • SSR-safe. Never throws.
 *   • Composition over architecture — no new persistence schema,
 *     just one locally-owned localStorage key shared by the
 *     OutcomeTracker module.
 */

export const OUTCOME_RUNTIME_VERSION = 'farroway-outcome-runtime-v1';

/**
 * The five canonical outcome statuses. Frozen — these are the
 * ONLY valid values for OutcomeRecord.outcomeStatus.
 */
export const OUTCOME_STATUS = Object.freeze({
  RESOLVED:  'resolved',
  IMPROVED:  'improved',
  UNCHANGED: 'unchanged',
  WORSENED:  'worsened',
  UNKNOWN:   'unknown',
});
export type OutcomeStatus =
  (typeof OUTCOME_STATUS)[keyof typeof OUTCOME_STATUS];

/**
 * Frozen list — used by health envelopes and by the scoring engine
 * when validating an incoming status string.
 */
export const OUTCOME_STATUS_VALUES = Object.freeze([
  OUTCOME_STATUS.RESOLVED,
  OUTCOME_STATUS.IMPROVED,
  OUTCOME_STATUS.UNCHANGED,
  OUTCOME_STATUS.WORSENED,
  OUTCOME_STATUS.UNKNOWN,
] as const);

/**
 * Outcome lifecycle stages — the runtime exposes helpers for each
 * stage but does NOT drive any UI. These are reference labels only.
 */
export const OUTCOME_LIFECYCLE = Object.freeze([
  'issue_detected',
  'recommendation_generated',
  'task_completed',
  'followup_scan',
  'outcome_recorded',
] as const);
export type OutcomeLifecycleStage = (typeof OUTCOME_LIFECYCLE)[number];

/** Single-writer localStorage key — owned exclusively by OutcomeTracker. */
export const OUTCOME_STORAGE_KEY = 'farroway.outcomes';

/** Hard cap on stored outcome rows — oldest dropped on overflow. */
export const OUTCOME_STORAGE_CAP = 200;

/** Maximum allowed length of a notes field (in characters). */
export const OUTCOME_NOTES_MAX = 400;

/**
 * The outcome record envelope shape — frozen at the boundary.
 * Notes:
 *   • timestamp is supplied by the caller (ISO string). The runtime
 *     does NOT mint timestamps on write; this keeps writes pure.
 *   • beforePhoto / afterPhoto store a URL or cache key, NEVER bytes.
 *   • taskIds / scanIds are frozen string[] at write time.
 *   • outcomeId is derived from plantId + scanIds[0].
 *   • PII fields (name, phone, email, exact coords, deviceId, IP)
 *     are NEVER written. Callers are responsible for sanitising
 *     `notes`; the tracker truncates and strips control chars.
 */
export interface OutcomeRecord {
  outcomeId:         string;
  plantId:           string;
  scanIds:           ReadonlyArray<string>;
  taskIds:           ReadonlyArray<string>;
  recommendationId?: string | null;
  beforePhoto?:      string | null;
  afterPhoto?:       string | null;
  outcomeStatus:     string;
  notes:             string;
  timestamp:         string;
}

/** Envelope returned by recordOutcome(). */
export interface OutcomeWriteEnvelope {
  runtimeVersion: string;
  ok:             boolean;
  reason:         string;
  record:         OutcomeRecord | null;
}
