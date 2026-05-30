/**
 * src/runtime/outcomeIntelligence/index.ts — barrel + single-call
 * installer for the wave-36 outcome intelligence runtimes.
 *
 * Wave-36 contract: NEVER modifies scan / plant knowledge / disease
 * / pest / OODA / NGO / buyer runtimes. Pure composition only.
 */

import {
  listChainViews, toChainView, chainAttestation,
  OUTCOME_VALUE, OUTCOME_CHAIN_RUNTIME_VERSION,
  type OutcomeChainView,
} from './OutcomeChainRuntime';
import {
  pilotAnalyticsSnapshot, installPilotAnalyticsGlobal,
  analyticsReady, improvementTrackingReady,
  PILOT_ANALYTICS_RUNTIME_VERSION,
  type PilotAnalyticsSnapshot,
} from './PilotAnalyticsRuntime';
import {
  fieldOfficerView, fieldOfficerReadyAttestation,
  installFieldOfficerViewGlobal,
  FIELD_OFFICER_VIEW_RUNTIME_VERSION,
  type FieldOfficerView,
} from './FieldOfficerViewRuntime';

export {
  // Chain
  listChainViews, toChainView, chainAttestation,
  OUTCOME_VALUE, OUTCOME_CHAIN_RUNTIME_VERSION,
  // Analytics
  pilotAnalyticsSnapshot, installPilotAnalyticsGlobal,
  analyticsReady, improvementTrackingReady,
  PILOT_ANALYTICS_RUNTIME_VERSION,
  // Field officer
  fieldOfficerView, fieldOfficerReadyAttestation,
  installFieldOfficerViewGlobal,
  FIELD_OFFICER_VIEW_RUNTIME_VERSION,
};
export type { OutcomeChainView, PilotAnalyticsSnapshot, FieldOfficerView };

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * installOutcomeIntelligenceGlobals — pins the wave-36 surface
 * globals. Idempotent. Also pins `__outcomeChainReady` so the
 * canonical __outcomeHealth() can attest from a single source.
 */
export function installOutcomeIntelligenceGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__outcomeChainReady !== 'function') {
      w.__outcomeChainReady = function () {
        return _safe(() => {
          const a = chainAttestation();
          return !!(a && a.ready);
        }, false);
      };
    }
    let ok = true;
    ok = installPilotAnalyticsGlobal()   && ok;
    ok = installFieldOfficerViewGlobal() && ok;
    return ok;
  }, false);
}
