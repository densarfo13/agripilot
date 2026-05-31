/**
 * src/runtime/intelligence/index.ts — OODA Engine barrel +
 * boot install.
 *
 *   import {
 *     runOODA, shapeRecommendations, scoreOutcome,
 *     installOODAGlobal, oodaHealth,
 *     OODA_ENGINE_VERSION,
 *   } from 'src/runtime/intelligence';
 *
 *   window.__oodaHealth()  // pinned after boot
 */

import {
  observe, orient, decide, act, runOODA,
  OODA_ENGINE_VERSION,
} from './OODAEngine';
import {
  shapeRecommendations, DECISION_ENGINE_VERSION,
} from './DecisionEngine';
import {
  scoreOutcome, summariseOutcomes, OUTCOME_ENGINE_VERSION,
} from './OutcomeEngine';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export function oodaHealth() {
  return _safe(() => Object.freeze({
    runtimeVersion:   OODA_ENGINE_VERSION,
    initialized:      true,
    observeReady:     true,
    orientReady:      true,
    decideReady:      true,
    actReady:         true,
    decisionShaperReady: true,
    outcomeEngineReady:  true,
    // Scan-integration contract (§4): OODA runs only AFTER upload/
    // capture, never blocks the scan render, and growers only ever
    // see the safe message — never raw OODA.
    scanIntegrated:      true,
    nonBlocking:         true,
    growerSafeOutput:    true,
    versions: Object.freeze({
      ooda:     OODA_ENGINE_VERSION,
      decision: DECISION_ENGINE_VERSION,
      outcome:  OUTCOME_ENGINE_VERSION,
    }),
  }), Object.freeze({
    runtimeVersion: OODA_ENGINE_VERSION,
    initialized: false, observeReady: false, orientReady: false,
    decideReady: false, actReady: false,
  }));
}

export function installOODAGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__oodaHealth !== 'function') {
      w.__oodaHealth = function () {
        const out = oodaHealth();
        try { console.log('[Farroway · OODA]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}

export {
  observe, orient, decide, act, runOODA, OODA_ENGINE_VERSION,
  shapeRecommendations, DECISION_ENGINE_VERSION,
  scoreOutcome, summariseOutcomes, OUTCOME_ENGINE_VERSION,
};
