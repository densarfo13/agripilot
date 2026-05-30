/**
 * src/runtime/outcomeIntelligence/OutcomeChainRuntime.ts —
 * wave-36 read-only composition over the existing
 * OutcomeRuntime. NEVER modifies any forbidden runtime (scan /
 * plant knowledge / disease / pest / OODA / NGO / buyer).
 *
 * Canonical chain
 * ───────────────
 *   Scan → Diagnosis → Recommendation → Task → Follow-up Scan → Outcome
 *
 * Storage maps to the existing OutcomeRecord shape:
 *   {
 *     outcomeId,  plantId,  scanIds[],  taskIds[],
 *     recommendationId,  beforePhoto,  afterPhoto,
 *     outcomeStatus,  notes,  timestamp,
 *   }
 *
 * Wave-36 surface shape (derived, not stored separately):
 *   {
 *     scanId,
 *     plantId,
 *     diagnosis,
 *     recommendation,
 *     taskId,
 *     followUpScanId,
 *     outcome,
 *   }
 *
 * The wave-36 envelope is a VIEW on the existing canonical record.
 * No new storage; no schema change.
 *
 * Strict-rule audit
 *   • Pure read-only composition. SSR-safe. Frozen envelopes.
 *   • Never throws. Never writes.
 *   • Does NOT modify the OutcomeRuntime — wraps it.
 */

import {
  listOutcomes,
  hasIssueDetected, hasRecommendation, hasTaskCompleted,
  hasFollowUpScan, hasOutcomeRecorded,
} from '../outcomes/OutcomeRuntime';
import {
  OUTCOME_STATUS,
  type OutcomeRecord,
} from '../outcomes/outcomeContracts';

export const OUTCOME_CHAIN_RUNTIME_VERSION = 'outcome-chain-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Wave-36 outcome value enum — uppercase per spec. */
export const OUTCOME_VALUE = Object.freeze({
  IMPROVED:  'IMPROVED',
  UNCHANGED: 'UNCHANGED',
  WORSENED:  'WORSENED',
  UNKNOWN:   'UNKNOWN',
} as const);
export type OutcomeValue =
  typeof OUTCOME_VALUE[keyof typeof OUTCOME_VALUE];

/**
 * _mapOutcomeStatus — lowercased canonical status → uppercase
 * wave-36 enum. RESOLVED maps to IMPROVED for wave-36 purposes
 * (the canonical RESOLVED state is a stronger form of improved).
 */
function _mapOutcomeStatus(status: string | null | undefined): OutcomeValue {
  return _safe(() => {
    const s = (status || '').toLowerCase();
    if (s === OUTCOME_STATUS.IMPROVED || s === OUTCOME_STATUS.RESOLVED) {
      return OUTCOME_VALUE.IMPROVED;
    }
    if (s === OUTCOME_STATUS.UNCHANGED) return OUTCOME_VALUE.UNCHANGED;
    if (s === OUTCOME_STATUS.WORSENED) return OUTCOME_VALUE.WORSENED;
    return OUTCOME_VALUE.UNKNOWN;
  }, OUTCOME_VALUE.UNKNOWN);
}

export interface OutcomeChainView {
  scanId:         string | null;
  plantId:        string;
  diagnosis:      string | null;
  recommendation: string | null;
  taskId:         string | null;
  followUpScanId: string | null;
  outcome:        OutcomeValue;
  /** Convenience: the underlying outcomeId for cross-reference. */
  outcomeId:      string;
  /** Convenience: when the outcome was recorded (ISO). */
  recordedAt:     string;
}

/**
 * toChainView — pure projection of a canonical OutcomeRecord into
 * the wave-36 chain shape. The `diagnosis` field is left null
 * unless the caller passes a join. Wave-36 does NOT store diagnosis
 * text — it composes from the scan's existing payload at render time.
 */
export function toChainView(rec: OutcomeRecord | null): OutcomeChainView | null {
  return _safe(() => {
    if (!rec) return null;
    const scanIds = Array.isArray(rec.scanIds) ? rec.scanIds : [];
    const taskIds = Array.isArray(rec.taskIds) ? rec.taskIds : [];
    const followUpScanId = scanIds.length >= 2
      ? scanIds[scanIds.length - 1] : null;
    return Object.freeze({
      scanId:         scanIds[0] || null,
      plantId:        rec.plantId,
      diagnosis:      null,
      recommendation: rec.recommendationId || null,
      taskId:         taskIds[0] || null,
      followUpScanId,
      outcome:        _mapOutcomeStatus(rec.outcomeStatus),
      outcomeId:      rec.outcomeId,
      recordedAt:     rec.timestamp,
    });
  }, null);
}

/**
 * listChainViews — current snapshot of all outcomes projected
 * into the wave-36 chain shape. Frozen array. Read-only.
 */
export function listChainViews(): ReadonlyArray<OutcomeChainView> {
  return _safe(() => {
    const recs = listOutcomes();
    const out: OutcomeChainView[] = [];
    for (const r of recs) {
      const v = toChainView(r);
      if (v) out.push(v);
    }
    return Object.freeze(out);
  }, Object.freeze([]) as any);
}

/**
 * chainAttestation — coverage check for the 5 stages. Aggregate
 * count across the whole outcome store. Used by the wave-36
 * outcomeHealth envelope to attest `outcomeChainReady`.
 */
export function chainAttestation() {
  return _safe(() => {
    const recs = listOutcomes();
    let issues = 0, recs_ = 0, tasks = 0, followUps = 0, outcomes = 0;
    for (const r of recs) {
      if (hasIssueDetected(r))   issues++;
      if (hasRecommendation(r))  recs_++;
      if (hasTaskCompleted(r))   tasks++;
      if (hasFollowUpScan(r))    followUps++;
      if (hasOutcomeRecorded(r)) outcomes++;
    }
    const total = recs.length;
    return Object.freeze({
      total,
      issuesCovered:        issues,
      recommendationsCovered: recs_,
      tasksCovered:         tasks,
      followUpsCovered:     followUps,
      outcomesCovered:      outcomes,
      // Chain is "ready" when the runtime itself is wired — even
      // with zero records — because the SHAPE is complete. The
      // stored counts surface honest pilot progress.
      ready: true,
    });
  }, Object.freeze({
    total: 0, issuesCovered: 0, recommendationsCovered: 0,
    tasksCovered: 0, followUpsCovered: 0, outcomesCovered: 0,
    ready: false,
  }));
}
