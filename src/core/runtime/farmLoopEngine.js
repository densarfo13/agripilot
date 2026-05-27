/**
 * farmLoopEngine.js — Continuous Farm Loop Engine tick orchestrator.
 *
 *   import { runFarmLoopTick, TRIGGER }
 *     from 'src/core/runtime/farmLoopEngine.js';
 *
 *   const verdict = runFarmLoopTick({
 *     trigger:        TRIGGER.APP_OPEN,
 *     decisionInput:  { scan, weather, cropLifecycle, ... },
 *     riskInput:      { weather, weatherForecast, soil, ... },
 *     farmMemory:     getFarmMemorySnapshot(...),
 *     scoreSnapshot:  computeFarrowayScore(...),
 *     timelineSources:{ scanHistory, scanOutcomes, ... },
 *     mode:           'farm' | 'garden',
 *     locale:         'en' | 'fr' | 'sw' | 'ha' | 'tw' | 'hi',
 *   });
 *
 *   verdict = {
 *     trigger,                         — which event ticked the loop
 *     oneBestAction,                   — from runDecisionEngine
 *     farmHealthState,                 — from classifyFarmState
 *     emergingRisks,                   — from runPredictiveRisk
 *     recommendedTasks:    [...],      — small ordered list of envelopes
 *     suppressedTasks:     [...],      — decision suppression record
 *     followUpRecommendations: [...],
 *     marketplaceTiming:   { ... }|null,
 *     irrigationAdjustment:{ ... }|null,
 *     confidenceTone:      'calm' | 'measured' | 'urgent',
 *     timeline:            { events, bucketsByDay },
 *     engineVersion:       'farm-loop-v1',
 *     generatedAt:         number,
 *   }
 *
 * What this is
 * ────────────
 *   The single function the Continuous Farm Loop calls on every
 *   trigger source (app open, weather refresh, scan complete, task
 *   complete, daily refresh, marketplace change, region update).
 *   It is a pure composer over the four farm engines:
 *
 *     • runDecisionEngine          → oneBestAction + suppressedActions
 *     • runPredictiveRisk          → emergingRisks
 *     • classifyFarmState          → farmHealthState
 *     • buildFarmTimeline          → timeline
 *
 *   Plus three small derived fields:
 *     • recommendedTasks       — the decision winner + medium risks
 *                                folded into a ranked list of three
 *                                copy-ready envelopes.
 *     • marketplaceTiming      — if a marketplace candidate was
 *                                generated, surface its timing hint.
 *     • irrigationAdjustment   — if water-stress fired in the decision
 *                                OR predictive layer, surface the
 *                                "water deeply in cooler hours" copy.
 *     • confidenceTone         — calm / measured / urgent for the UI.
 *
 *   It is NOT a UI component, NOT a network fetcher, NOT a writer
 *   to any store. Callers wire it up with whatever signals they
 *   have; missing inputs degrade to the calm fallback envelope.
 *
 *   Emits the existing `farm_opened` event when triggered by
 *   APP_OPEN so existing analytics keep firing — other triggers
 *   stay silent on the bus.
 *
 * Strict-rule audit
 *   • Pure / never throws / SSR-safe (the bus emit is wrapped in
 *     try/catch and bus is no-op in SSR anyway).
 *   • Every visible string is an envelope.
 *   • Compose-only: no field on any sub-engine is replaced.
 */

import { runDecisionEngine, RANK } from '../intelligence/decisionPriorityEngine.js';
import { runPredictiveRisk } from '../intelligence/predictiveRiskEngine.js';
import { classifyFarmState, STATE } from './farmStateEngine.js';
import { buildFarmTimeline } from '../journal/farmTimelineEngine.js';
import { emit, EVENT } from './eventBus.js';

const ENGINE_VERSION = 'farm-loop-v1';

export const TRIGGER = Object.freeze({
  APP_OPEN:          'app_open',
  WEATHER_REFRESH:   'weather_refresh',
  SCAN_COMPLETE:     'scan_complete',
  TASK_COMPLETE:     'task_complete',
  DAILY_REFRESH:     'daily_refresh',
  MARKETPLACE_CHANGE:'marketplace_change',
  REGION_UPDATE:     'region_update',
});

const _VALID_TRIGGERS = new Set(Object.values(TRIGGER));

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

/**
 * Decide the UI tone band from the state + decision urgency.
 */
function _toneFor(state, urgency, anyHighRisk) {
  if (state === STATE.HIGH_RISK || urgency === 'high' || anyHighRisk) return 'urgent';
  if (state === STATE.NEEDS_ATTENTION || urgency === 'medium') return 'measured';
  return 'calm';
}

/**
 * Build a small ranked list of "recommended tasks" envelopes from
 * the decision winner + the predictive risks that didn't suppress
 * but still deserve mention. Cap at 3.
 */
function _buildRecommendedTasks(decision, riskForecast) {
  const out = [];
  if (decision && decision.oneBestAction) {
    out.push(Object.freeze({
      rank:       1,
      source:     'decision',
      urgency:    decision.urgency || 'low',
      title:      decision.oneBestAction,
      reason:     decision.reason || null,
      bestTime:   decision.bestTime || null,
      candidateId: decision.oneBestAction.candidateId || null,
    }));
  }
  const risks = (riskForecast && Array.isArray(riskForecast.risks))
    ? riskForecast.risks : [];
  for (const r of risks) {
    if (!r) continue;
    if (out.length >= 3) break;
    // Skip predicted risks already represented by the decision winner
    if (decision && decision.oneBestAction
        && decision.oneBestAction.candidateId
        && decision.oneBestAction.candidateId.startsWith('crop_survival_')
        && (r.kind === 'wind_damage' || r.kind === 'heat_stress')) {
      continue;
    }
    out.push(Object.freeze({
      rank:       out.length + 1,
      source:     'predictive_risk',
      urgency:    r.severity === 'high' ? 'high'
                : r.severity === 'medium' ? 'medium' : 'low',
      title:      r.label,
      reason:     r.reason,
      bestTime:   null,
      candidateId: 'risk_' + r.kind,
    }));
  }
  return Object.freeze(out);
}

/**
 * Pull a marketplace-timing envelope out of the decision input if
 * the marketplace ladder rank fired (even when suppressed).
 */
function _marketplaceTiming(decision) {
  if (!decision) return null;
  // Check oneBestAction.
  if (decision.oneBestAction && decision.oneBestAction.rank === RANK.MARKETPLACE) {
    return Object.freeze({
      title:    decision.oneBestAction,
      reason:   decision.reason || null,
      bestTime: decision.bestTime || null,
    });
  }
  // Check suppressed actions.
  const suppressed = Array.isArray(decision.suppressedActions)
    ? decision.suppressedActions : [];
  const match = suppressed.find((s) => s && s.rank === RANK.MARKETPLACE);
  if (match) {
    return Object.freeze({
      title:    match.label,
      reason:   null,
      bestTime: null,
      suppressed: true,
    });
  }
  return null;
}

/**
 * Detect a watering / water-stress signal in either layer and emit
 * a single recommendation envelope.
 */
function _irrigationAdjustment(decision, riskForecast) {
  // From decision layer.
  if (decision && decision.oneBestAction
      && _str(decision.oneBestAction.candidateId).startsWith('watering_')) {
    return Object.freeze({
      title:    decision.oneBestAction,
      reason:   decision.reason || null,
      bestTime: decision.bestTime || null,
      severity: decision.urgency || 'medium',
      source:   'decision',
    });
  }
  // From predictive layer.
  const risks = (riskForecast && Array.isArray(riskForecast.risks))
    ? riskForecast.risks : [];
  const water = risks.find((r) => r && r.kind === 'water_stress');
  if (water) {
    return Object.freeze({
      title:    water.suggestedAction || water.label,
      reason:   water.reason,
      bestTime: null,
      severity: water.severity,
      source:   'predictive_risk',
    });
  }
  return null;
}

/**
 * Build a small ordered list of follow-up envelopes from:
 *   • the decision's `followUp` field
 *   • each predictive risk's `suggestedAction`
 */
function _followUps(decision, riskForecast) {
  const out = [];
  if (decision && decision.followUp) {
    out.push(Object.freeze({
      source: 'decision',
      label:  decision.followUp,
    }));
  }
  const risks = (riskForecast && Array.isArray(riskForecast.risks))
    ? riskForecast.risks : [];
  for (const r of risks) {
    if (!r || !r.suggestedAction) continue;
    if (out.length >= 4) break;
    out.push(Object.freeze({
      source: 'risk:' + r.kind,
      label:  r.suggestedAction,
    }));
  }
  return Object.freeze(out);
}

/**
 * Run a single loop tick. Always returns an envelope.
 *
 * @param {object} input
 * @returns {object}
 */
export function runFarmLoopTick(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const trigger = _VALID_TRIGGERS.has(_str(safe.trigger))
      ? safe.trigger : TRIGGER.DAILY_REFRESH;
    const mode = _str(safe.mode).toLowerCase() === 'garden' ? 'garden' : 'farm';
    const locale = _str(safe.locale) || null;

    // ── 1. Decision priority verdict
    const decisionInput = _isObj(safe.decisionInput) ? safe.decisionInput : {};
    if (!('mode' in decisionInput)) decisionInput.mode = mode;
    // Allow caller to pass farmMemory directly into the decision input
    if (!('farmMemory' in decisionInput) && safe.farmMemory) {
      decisionInput.farmMemory = safe.farmMemory;
    }
    const decision = _safe(() => runDecisionEngine(decisionInput), null);

    // ── 2. Predictive risk forecast
    const riskInput = _isObj(safe.riskInput) ? safe.riskInput : {};
    if (!('farmMemory' in riskInput) && safe.farmMemory) {
      riskInput.farmMemory = safe.farmMemory;
    }
    const riskForecast = _safe(() => runPredictiveRisk(riskInput), null);

    // ── 3. Farm state classification
    const farmHealthState = _safe(() => classifyFarmState({
      decision,
      riskForecast,
      farmMemory:    safe.farmMemory,
      scoreSnapshot: safe.scoreSnapshot,
    }), null);

    // ── 4. Unified timeline
    const timelineSources = _isObj(safe.timelineSources) ? safe.timelineSources : {};
    const timeline = _safe(() => buildFarmTimeline({
      ...timelineSources,
      // Inject the freshest decision as the most recent timeline event
      // so callers can render "Recommendation" entries in the journal.
      decisions: [
        ...(Array.isArray(timelineSources.decisions) ? timelineSources.decisions : []),
        decision || {},
      ],
      limit: timelineSources.limit || 60,
    }), null);

    // ── 5. Derived fields
    const recommendedTasks  = _buildRecommendedTasks(decision, riskForecast);
    const suppressedTasks   = (decision && Array.isArray(decision.suppressedActions))
      ? decision.suppressedActions : Object.freeze([]);
    const followUpRecommendations = _followUps(decision, riskForecast);
    const marketplaceTiming = _marketplaceTiming(decision);
    const irrigationAdjustment = _irrigationAdjustment(decision, riskForecast);
    const confidenceTone = _toneFor(
      farmHealthState && farmHealthState.state,
      decision && decision.urgency,
      riskForecast && riskForecast.anyHigh,
    );

    // ── 6. Emit telemetry on APP_OPEN ticks (matches existing
    //      dailyDecisionLoop contract). Other triggers stay silent.
    if (trigger === TRIGGER.APP_OPEN) {
      _safe(() => emit(EVENT.FARM_OPENED, {
        nowMs:               Date.now(),
        farmHealthStateName: farmHealthState && farmHealthState.state,
        primaryActionId:     decision && decision.oneBestAction
                              && decision.oneBestAction.candidateId,
        emergingRiskCount:   riskForecast && riskForecast.risks
                              ? riskForecast.risks.length : 0,
      }), null);
    }

    return Object.freeze({
      engineVersion:           ENGINE_VERSION,
      trigger,
      mode,
      locale,
      oneBestAction:           decision && decision.oneBestAction,
      decisionUrgency:         decision && decision.urgency,
      farmHealthState,
      emergingRisks:           riskForecast,
      recommendedTasks,
      suppressedTasks:         Object.freeze(suppressedTasks),
      followUpRecommendations,
      marketplaceTiming,
      irrigationAdjustment,
      confidenceTone,
      timeline,
      generatedAt:             Date.now(),
    });
  }, _emptyTick(input));
}

function _emptyTick(input) {
  const trigger = _VALID_TRIGGERS.has(_str(input && input.trigger))
    ? input.trigger : TRIGGER.DAILY_REFRESH;
  return Object.freeze({
    engineVersion:           ENGINE_VERSION,
    trigger,
    mode:                    'farm',
    locale:                  null,
    oneBestAction:           Object.freeze({
      key:      'decision.action.calm',
      fallback: 'Walk your field and check crop health.',
      rank:     null, candidateId: null,
    }),
    decisionUrgency:         'low',
    farmHealthState:         null,
    emergingRisks:           null,
    recommendedTasks:        Object.freeze([]),
    suppressedTasks:         Object.freeze([]),
    followUpRecommendations: Object.freeze([]),
    marketplaceTiming:       null,
    irrigationAdjustment:    null,
    confidenceTone:          'calm',
    timeline:                null,
    generatedAt:             Date.now(),
  });
}

export const _internal = Object.freeze({
  _toneFor, _buildRecommendedTasks, _marketplaceTiming,
  _irrigationAdjustment, _followUps, ENGINE_VERSION,
});

const _module = { runFarmLoopTick, TRIGGER, _internal };
export default _module;
