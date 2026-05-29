/**
 * src/runtime/intelligenceLoop/index.ts — Intelligence Loop
 * barrel + boot install.
 *
 *   import {
 *     runIntelligenceLoop, fromScan,
 *     recordOutcome, recordFeedback,
 *     recordLearningSignal,
 *     intelligenceLoopHealth,
 *     installIntelligenceLoopGlobal,
 *     INTELLIGENCE_LOOP_VERSION,
 *   } from 'src/runtime/intelligenceLoop';
 *
 *   window.__intelligenceLoopHealth()  // pinned after boot
 *
 * Strict-rule audit
 *   • Pure composition. SSR-safe. Never throws.
 *   • No React. No persistence writes.
 */

import {
  INTELLIGENCE_LOOP_VERSION, LOOP_SOURCES, LOOP_PRIORITY,
  LOOP_OUTCOME_KINDS, FEEDBACK_SIGNAL,
  loopIdempotencyKey, feedbackIdempotencyKey,
  SAFE_WORDS, BANNED_WORDS,
} from './intelligenceLoopContracts';
import {
  observeLoopInputs, OBSERVATION_ENGINE_VERSION,
} from './ObservationEngine';
import {
  orientLoopObservation, ORIENTATION_ENGINE_VERSION,
} from './OrientationEngine';
import {
  decideRecommendation, LOOP_DECISION_ENGINE_VERSION,
} from './DecisionEngine';
import {
  actOnDecision, LOOP_ACTION_ENGINE_VERSION,
} from './ActionEngine';
import {
  recordOutcome, recordFeedback, listOutcomesFor,
  outcomeTrackerSnapshot, OUTCOME_TRACKER_VERSION,
} from './OutcomeTracker';
import {
  recordLearningSignal, listLearningSignals,
  learningSignalSnapshot, LEARNING_SIGNAL_ENGINE_VERSION,
} from './LearningSignalEngine';
import {
  runIntelligenceLoop, fromScan,
  INTELLIGENCE_LOOP_RUNTIME_VERSION,
} from './IntelligenceLoopRuntime';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function intelligenceLoopHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion: INTELLIGENCE_LOOP_VERSION,
    initialized:                  true,
    observeReady:                 true,
    orientReady:                  true,
    decideReady:                  true,
    actReady:                     true,
    outcomeTrackingReady:         true,
    learningSignalsReady:         true,
    scanIntegrationReady:         true,
    dailyBriefingIntegrationReady:true,
    // Engines are fetch-free + idempotency keys live; the
    // offline runtime can wrap our envelopes safely.
    offlineSafe:                  true,
    duplicateGuardReady:          true,
    outcomes: outcomeTrackerSnapshot(),
    learning: learningSignalSnapshot(),
    versions: Object.freeze({
      runtime:      INTELLIGENCE_LOOP_RUNTIME_VERSION,
      observe:      OBSERVATION_ENGINE_VERSION,
      orient:       ORIENTATION_ENGINE_VERSION,
      decide:       LOOP_DECISION_ENGINE_VERSION,
      act:          LOOP_ACTION_ENGINE_VERSION,
      outcome:      OUTCOME_TRACKER_VERSION,
      learning:     LEARNING_SIGNAL_ENGINE_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: INTELLIGENCE_LOOP_VERSION,
    initialized: false,
    observeReady: false, orientReady: false,
    decideReady: false, actReady: false,
    outcomeTrackingReady: false,
    learningSignalsReady: false,
    scanIntegrationReady: false,
    dailyBriefingIntegrationReady: false,
    offlineSafe: false, duplicateGuardReady: false,
  }));
}

export function installIntelligenceLoopGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__intelligenceLoopHealth !== 'function') {
      w.__intelligenceLoopHealth = function () {
        const out = intelligenceLoopHealth();
        try { console.log('[Farroway · Intelligence Loop]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

// ─── Re-exports ────────────────────────────────────────────────
export {
  // Composite
  runIntelligenceLoop, fromScan, INTELLIGENCE_LOOP_RUNTIME_VERSION,
  // Phase engines
  observeLoopInputs, OBSERVATION_ENGINE_VERSION,
  orientLoopObservation, ORIENTATION_ENGINE_VERSION,
  decideRecommendation, LOOP_DECISION_ENGINE_VERSION,
  actOnDecision, LOOP_ACTION_ENGINE_VERSION,
  // Tracking + learning
  recordOutcome, recordFeedback, listOutcomesFor,
  outcomeTrackerSnapshot, OUTCOME_TRACKER_VERSION,
  recordLearningSignal, listLearningSignals,
  learningSignalSnapshot, LEARNING_SIGNAL_ENGINE_VERSION,
  // Contracts
  INTELLIGENCE_LOOP_VERSION, LOOP_SOURCES, LOOP_PRIORITY,
  LOOP_OUTCOME_KINDS, FEEDBACK_SIGNAL,
  loopIdempotencyKey, feedbackIdempotencyKey,
  SAFE_WORDS, BANNED_WORDS,
};
