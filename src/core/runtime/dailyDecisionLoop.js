/**
 * dailyDecisionLoop.js — the "every app open" orchestration entry.
 *
 *   import { runDailyDecisionLoop }
 *     from 'src/core/runtime/dailyDecisionLoop.js';
 *
 *   // From App.jsx mount / route-to-home navigation:
 *   const { primaryAction, suppressed } = await runDailyDecisionLoop();
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The single function the Home surface calls on mount to
 *   produce the "what should I do today?" answer. Internally:
 *
 *     1. Read the current runtime snapshot (farm / weather /
 *        scan / lifecycle / memory) from `farmRuntimeStore`.
 *     2. Hand it to `intelligenceOrchestrator` to produce a
 *        candidate pool.
 *     3. Run `recommendationSuppression` (rain conflicts,
 *        already-done, repeatedly-ignored, duplicates, stale).
 *     4. Run `recommendationPriorityEngine` to pick the ONE.
 *     5. Persist the result back into the runtime store as
 *        `lastBestAction` + `suppressionHistory`.
 *     6. Emit `farm_opened` so analytics + telemetry can react.
 *
 *   It is NOT a UI component, NOT a route guard, and NOT a
 *   data fetcher (callers are responsible for ensuring the
 *   runtime snapshot is reasonably fresh before invoking).
 *
 * Strict-rule audit
 *   • Pure-ish — reads/writes the runtime store but does no
 *     network I/O. Never throws — every internal failure
 *     degrades to a safe `{ primaryAction: null }` return.
 */

import {
  getRuntimeState, setRuntimeSlice, SLICE,
} from './farmRuntimeStore.js';
import { emit, EVENT } from './eventBus.js';
import { orchestrateIntelligence } from '../intelligence/intelligenceOrchestrator.js';
import { suppressRecommendations } from '../intelligence/recommendationSuppression.js';
import { rankRecommendations } from '../intelligence/recommendationPriorityEngine.js';

function _snapshotFromStore() {
  try {
    return {
      crop:        getRuntimeState(SLICE.CROP),
      lifecycle:   getRuntimeState(SLICE.LIFECYCLE),
      weather:     getRuntimeState(SLICE.WEATHER),
      soil:        getRuntimeState(SLICE.SOIL),
      scanHistory: getRuntimeState(SLICE.SCAN_HISTORY),
      tasks: {
        completed: getRuntimeState(SLICE.COMPLETED_TASKS) || [],
        pending:   getRuntimeState(SLICE.PENDING_TASKS)   || [],
      },
      marketplace: getRuntimeState(SLICE.MARKETPLACE),
      supplier:    getRuntimeState(SLICE.SUPPLIER),
      ngo:         getRuntimeState(SLICE.NGO),
      memory:      getRuntimeState(SLICE.RECOMMENDATION_MEMORY) || {},
      language:    getRuntimeState(SLICE.LANGUAGE),
      network:     getRuntimeState(SLICE.NETWORK),
      flags:       getRuntimeState(SLICE.INTELLIGENCE_FLAGS) || {},
      nowMs:       Date.now(),
    };
  } catch { return { nowMs: Date.now() }; }
}

/**
 * Run the loop once. Synchronous in the happy path — the spec's
 * "every app open" cadence is fast enough that this never
 * touches the network.
 *
 * @param {object} [overrideSnapshot] — bypass the store read; used
 *                  by tests and by ad-hoc callers (e.g. preview).
 * @returns {object} { primaryAction, suppressed, ordered, snapshot }
 */
export function runDailyDecisionLoop(overrideSnapshot) {
  try {
    const snapshot = (overrideSnapshot && typeof overrideSnapshot === 'object')
      ? overrideSnapshot
      : _snapshotFromStore();

    // 1. Orchestrator → candidate pool + supportingInsight.
    const orch = (() => {
      try { return orchestrateIntelligence(snapshot); }
      catch { return { ok: false, candidates: [], primaryAction: null }; }
    })();

    // The orchestrator may already return a single primaryAction.
    // If it does, treat it as the only candidate; otherwise collect
    // whatever it exposed.
    const rawCandidates = Array.isArray(orch.candidates)
      ? orch.candidates
      : (orch.primaryAction ? [orch.primaryAction] : []);

    // 2. Suppression — rain conflicts, already-done, etc.
    const suppressed = (() => {
      try {
        return suppressRecommendations(rawCandidates, {
          signals: {
            rainSkip:       snapshot.weather && snapshot.weather.rainProbability24hPct >= 70,
            lastWateredAt:  snapshot.lastWateredAt,
          },
          ignoreLog:        snapshot.memory.ignoreLog || {},
          nowMs:            snapshot.nowMs,
        });
      } catch { return { kept: rawCandidates, suppressed: [] }; }
    })();

    // 3. Priority ranking → the ONE.
    const ranked = rankRecommendations(suppressed.kept || []);

    // 4. Persist into the store.
    try {
      setRuntimeSlice(SLICE.LAST_BEST_ACTION, ranked.primary, { persist: true });
      setRuntimeSlice(SLICE.SUPPRESSION_HISTORY, suppressed.suppressed || []);
    } catch { /* ignore */ }

    // 5. Emit farm_opened — analytics + ambient hooks listen.
    try {
      emit(EVENT.FARM_OPENED, {
        nowMs: snapshot.nowMs,
        primaryActionType: ranked.primary && ranked.primary.type,
      });
    } catch { /* ignore */ }

    return {
      primaryAction: ranked.primary,
      suppressed:    [...(suppressed.suppressed || []),
                      ...(ranked.suppressed || [])],
      ordered:       ranked.ordered,
      snapshot,
      orchestratorOutput: orch,
    };
  } catch {
    return {
      primaryAction: null,
      suppressed:    [],
      ordered:       [],
      snapshot:      null,
      orchestratorOutput: null,
    };
  }
}

const _module = { runDailyDecisionLoop };
export default _module;
