/**
 * src/runtime/outcomes/index.ts — Outcome Engine barrel +
 * boot install for window.__outcomeHealth().
 *
 *   import {
 *     recordOutcome, listOutcomes, getOutcome, outcomeHealth,
 *     installOutcomeRuntimeGlobal,
 *     OUTCOME_RUNTIME_VERSION,
 *   } from 'src/runtime/outcomes';
 *
 *   installOutcomeRuntimeGlobal();    // pins window.__outcomeHealth
 *   window.__outcomeHealth();         // frozen diagnostic envelope
 *
 * What this is
 * ────────────
 *   Single import surface for the Outcome Engine. Pins exactly one
 *   window global — `__outcomeHealth` — and re-exports the public
 *   facade so consumers never reach into individual modules.
 *
 * Strict-rule audit
 *   • Composition only — barrel + one window global. No engines.
 *   • SSR-safe. Never throws.
 *   • Pins exactly ONE window global.
 *   • Idempotent install.
 */

import {
  OUTCOME_RUNTIME_VERSION, OUTCOME_STATUS, OUTCOME_STATUS_VALUES,
  OUTCOME_LIFECYCLE, OUTCOME_STORAGE_KEY, OUTCOME_STORAGE_CAP,
  OUTCOME_NOTES_MAX,
  type OutcomeRecord, type OutcomeWriteEnvelope,
} from './outcomeContracts';
import {
  appendOutcome, listOutcomes as trackerListOutcomes,
  getOutcome as trackerGetOutcome, readOutcomesRaw,
  deriveOutcomeId, storedOutcomeCount, lastOutcomeAt,
  OUTCOME_TRACKER_VERSION,
} from './OutcomeTracker';
import {
  resolveBeforePhoto, resolveAfterPhoto,
  OUTCOME_EVIDENCE_VERSION,
} from './OutcomeEvidenceService';
import {
  scoreOutcomeStatus, scoreOutcomeEnvelope,
  OUTCOME_SCORING_VERSION,
} from './OutcomeScoringEngine';
import {
  recordOutcome, listOutcomes, getOutcome, outcomeHealth,
  hasIssueDetected, hasRecommendation, hasTaskCompleted,
  hasFollowUpScan, hasOutcomeRecorded,
  OUTCOME_RUNTIME_FACADE_VERSION,
} from './OutcomeRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Pin __outcomeHealth() onto window. Idempotent — if the global
 * is already installed, this is a no-op. The pinned function logs
 * the envelope to the console for QA visibility, exactly mirroring
 * the launchBlockers pattern.
 */
export function installOutcomeRuntimeGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeHealth !== 'function') {
      w.__outcomeHealth = function () {
        const out = outcomeHealth();
        try { console.log('[Farroway · Outcomes]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Contracts
  OUTCOME_RUNTIME_VERSION, OUTCOME_STATUS, OUTCOME_STATUS_VALUES,
  OUTCOME_LIFECYCLE, OUTCOME_STORAGE_KEY, OUTCOME_STORAGE_CAP,
  OUTCOME_NOTES_MAX,
  // Tracker
  appendOutcome, readOutcomesRaw, deriveOutcomeId,
  storedOutcomeCount, lastOutcomeAt, OUTCOME_TRACKER_VERSION,
  // Evidence
  resolveBeforePhoto, resolveAfterPhoto, OUTCOME_EVIDENCE_VERSION,
  // Scoring
  scoreOutcomeStatus, scoreOutcomeEnvelope, OUTCOME_SCORING_VERSION,
  // Facade
  recordOutcome, listOutcomes, getOutcome, outcomeHealth,
  hasIssueDetected, hasRecommendation, hasTaskCompleted,
  hasFollowUpScan, hasOutcomeRecorded,
  OUTCOME_RUNTIME_FACADE_VERSION,
  // Tracker passthroughs (kept distinct names available for callers
  // that imported from this barrel before the facade existed)
  trackerListOutcomes, trackerGetOutcome,
};

export type { OutcomeRecord, OutcomeWriteEnvelope };
