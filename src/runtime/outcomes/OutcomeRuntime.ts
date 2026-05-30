/**
 * src/runtime/outcomes/OutcomeRuntime.ts — Top-level facade for
 * the Farroway Outcome Engine.
 *
 *   import {
 *     recordOutcome, listOutcomes, getOutcome, outcomeHealth,
 *     OUTCOME_RUNTIME_FACADE_VERSION,
 *   } from 'src/runtime/outcomes/OutcomeRuntime';
 *
 * What this is
 * ────────────
 *   Composition layer that wires together:
 *     • OutcomeTracker          (append-only localStorage store)
 *     • OutcomeEvidenceService  (before/after photo resolver)
 *     • OutcomeScoringEngine    (pure status derivation)
 *
 *   recordOutcome() is the only WRITE entry point exposed by the
 *   Outcome Engine. It:
 *     1. Resolves before/after photo URLs/keys (never bytes).
 *     2. Derives the canonical outcomeId from plantId + scanIds[0].
 *     3. Auto-scores the outcomeStatus if the caller omits one, else
 *        validates the caller-supplied status against the enum.
 *     4. Appends the row through OutcomeTracker, which dedupes by
 *        outcomeId and caps storage at 200.
 *
 * Strict-rule audit
 *   • Composition only — no engines, no schemas, no server routes,
 *     no Prisma models added here.
 *   • SSR-safe. Pure runtime. Never throws.
 *   • Frozen envelopes everywhere.
 *   • Single-writer invariant — only OutcomeTracker persists.
 *   • Never writes PII; notes sanitised by OutcomeTracker.
 */

import {
  OUTCOME_RUNTIME_VERSION,
  OUTCOME_STATUS, OUTCOME_STATUS_VALUES, OUTCOME_NOTES_MAX,
  type OutcomeRecord, type OutcomeWriteEnvelope,
} from './outcomeContracts';
import {
  appendOutcome, listOutcomes, getOutcome,
  deriveOutcomeId, storedOutcomeCount, lastOutcomeAt,
  OUTCOME_TRACKER_VERSION,
} from './OutcomeTracker';
import {
  resolveBeforePhoto, resolveAfterPhoto,
  OUTCOME_EVIDENCE_VERSION,
} from './OutcomeEvidenceService';
import {
  scoreOutcomeStatus, OUTCOME_SCORING_VERSION,
} from './OutcomeScoringEngine';

export const OUTCOME_RUNTIME_FACADE_VERSION =
  'farroway-outcome-runtime-facade-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';
const _arrStr = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string' && x.length > 0) out.push(x);
  }
  return out;
};

const _validStatus = new Set<string>(OUTCOME_STATUS_VALUES as readonly string[]);

const _failEnvelope = (reason: string): OutcomeWriteEnvelope =>
  Object.freeze({
    runtimeVersion: OUTCOME_RUNTIME_FACADE_VERSION,
    ok:     false,
    reason,
    record: null,
  });

/**
 * recordOutcome — the canonical write entry point.
 *
 * Required input:
 *   plantId      : string
 *   scanIds      : string[]   (at least one id; scanIds[0] = diagnostic;
 *                              scanIds[length - 1] = follow-up)
 *   timestamp    : ISO string supplied by the caller
 *
 * Optional input:
 *   taskIds                : string[]
 *   recommendationId       : string | null
 *   recommendationAccepted : boolean   (used by auto-scoring)
 *   firstScan, followUpScan: scan envelopes for the scoring engine
 *   outcomeStatus          : one of the 5 enum values (skip auto-score)
 *   notes                  : string (<= 400 chars; sanitised)
 *   beforePhoto/afterPhoto : URL or cache key; if omitted, the
 *                            evidence service tries to resolve them
 */
export function recordOutcome(input: {
  plantId:                 string;
  scanIds:                 ReadonlyArray<string>;
  timestamp:               string;
  taskIds?:                ReadonlyArray<string>;
  recommendationId?:       string | null;
  recommendationAccepted?: boolean;
  firstScan?:              unknown;
  followUpScan?:           unknown;
  outcomeStatus?:          string;
  notes?:                  string;
  beforePhoto?:            string | null;
  afterPhoto?:             string | null;
}): OutcomeWriteEnvelope {
  return _safe(() => {
    if (!_isObj(input)) return _failEnvelope('invalid_input');
    const plantId = _str(input.plantId).trim();
    if (!plantId) return _failEnvelope('plantId_required');

    const scanIds = _arrStr(input.scanIds);
    if (scanIds.length === 0) return _failEnvelope('scanIds_required');

    const timestamp = _str(input.timestamp).trim();
    if (!timestamp) return _failEnvelope('timestamp_required');

    // Derive canonical outcomeId.
    const outcomeId = deriveOutcomeId(plantId, scanIds[0]);
    if (!outcomeId) return _failEnvelope('outcomeId_derivation_failed');

    // Resolve evidence — caller-supplied wins; otherwise compose.
    const beforePhoto = input.beforePhoto != null
      ? (_str(input.beforePhoto) || null)
      : resolveBeforePhoto(plantId, scanIds[0]);
    const followUpId = scanIds.length > 1
      ? scanIds[scanIds.length - 1] : '';
    const afterPhoto = input.afterPhoto != null
      ? (_str(input.afterPhoto) || null)
      : (followUpId ? resolveAfterPhoto(plantId, followUpId) : null);

    // Resolve status — caller-supplied wins (if valid); otherwise score.
    let outcomeStatus = _str(input.outcomeStatus).trim();
    if (outcomeStatus && !_validStatus.has(outcomeStatus)) {
      return _failEnvelope('invalid_outcomeStatus');
    }
    if (!outcomeStatus) {
      outcomeStatus = scoreOutcomeStatus({
        scanIds,
        recommendationAccepted: !!input.recommendationAccepted,
        firstScan:              input.firstScan,
        followUpScan:           input.followUpScan,
      });
    }

    const taskIds = _arrStr(input.taskIds);

    const notes = _str(input.notes).slice(0, OUTCOME_NOTES_MAX);

    const written = appendOutcome({
      outcomeId,
      plantId,
      scanIds,
      taskIds,
      recommendationId: input.recommendationId != null
        ? _str(input.recommendationId) || null : null,
      beforePhoto,
      afterPhoto,
      outcomeStatus,
      notes,
      timestamp,
    });

    if (!written) return _failEnvelope('write_rejected');

    return Object.freeze({
      runtimeVersion: OUTCOME_RUNTIME_FACADE_VERSION,
      ok:     true,
      reason: '',
      record: written,
    });
  }, _failEnvelope('error'));
}

/**
 * Stage helpers — pure observation utilities for the lifecycle:
 *   Issue Detected → Recommendation Generated → Task Completed →
 *   Follow-Up Scan → Outcome Recorded
 *
 * These return TRUE/FALSE based on what is present on a record.
 * The runtime does NOT drive any UI.
 */
export function hasIssueDetected(rec: OutcomeRecord | null): boolean {
  return _safe(() => !!(rec && rec.scanIds && rec.scanIds.length > 0), false);
}
export function hasRecommendation(rec: OutcomeRecord | null): boolean {
  return _safe(() => !!(rec && rec.recommendationId), false);
}
export function hasTaskCompleted(rec: OutcomeRecord | null): boolean {
  return _safe(() => !!(rec && rec.taskIds && rec.taskIds.length > 0), false);
}
export function hasFollowUpScan(rec: OutcomeRecord | null): boolean {
  return _safe(() => !!(rec && rec.scanIds && rec.scanIds.length >= 2), false);
}
export function hasOutcomeRecorded(rec: OutcomeRecord | null): boolean {
  return _safe(() => !!(rec && rec.outcomeStatus
    && rec.outcomeStatus !== OUTCOME_STATUS.UNKNOWN), false);
}

/**
 * outcomeHealth — frozen diagnostic envelope. Surface mounted on
 * window.__outcomeHealth() by index.ts.
 */
export function outcomeHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:        OUTCOME_RUNTIME_VERSION,
    outcomeTrackingReady:  true,
    statusValues:          OUTCOME_STATUS_VALUES,
    storedOutcomeCount:    storedOutcomeCount(),
    lastOutcomeAt:         lastOutcomeAt(),
    versions: Object.freeze({
      facade:    OUTCOME_RUNTIME_FACADE_VERSION,
      tracker:   OUTCOME_TRACKER_VERSION,
      evidence:  OUTCOME_EVIDENCE_VERSION,
      scoring:   OUTCOME_SCORING_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion:        OUTCOME_RUNTIME_VERSION,
    outcomeTrackingReady:  false,
    statusValues:          OUTCOME_STATUS_VALUES,
    storedOutcomeCount:    0,
    lastOutcomeAt:         null,
  }));
}

// Re-export read APIs at the facade so callers can import from a
// single module without reaching into the tracker.
export { listOutcomes, getOutcome };
