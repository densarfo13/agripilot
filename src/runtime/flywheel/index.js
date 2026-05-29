/**
 * runtime/flywheel/index.js — Phase 14 data-flywheel composite.
 *
 *   import {
 *     dataFlywheel,
 *     installDataFlywheelGlobal,
 *     DATA_FLYWHEEL_VERSION,
 *   } from 'src/runtime/flywheel/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint for the Phase 14 engines. Runs them all
 *   over a caller-injected event log + companion signals, and
 *   returns one frozen envelope so the UI / QA / future server
 *   sync can introspect every flywheel state from one spot:
 *
 *     {
 *       runtimeVersion, generatedAt,
 *       events:          { count, kinds },
 *       farmMemory,      // buildFarmMemory
 *       cropMemory,      // buildCropMemory (optional, cropId scoped)
 *       recommendationFunnel,
 *       outcomes,
 *       regionalInsight, // anonymizeRegionalInsight (1 record)
 *       trust: { farmer, buyer, program },
 *       deferred,
 *     }
 *
 *   The wave-5 single-writer invariant is preserved — engines
 *   take an event log in; they never write to persistence.
 *
 *   Spec note: the user spec lists 5 Intelligence API endpoints:
 *     /api/intelligence/farm  · /crop  · /recommendations
 *     · /trust  · /outcomes
 *   To avoid colliding with the existing wave-9
 *   `/api/intelligence/:applicationId` namespace, the canonical
 *   Phase 14 mount point on the server is `/api/flywheel/*` —
 *   see server/src/modules/flywheel/routes.js.
 */

import {
  EVENT_KIND, EVENT_SCHEMA_VERSION,
  normalizeEvent, validateEvent, eventEquals,
} from './eventEngine.js';
import {
  appendEvent, mergeEventLogs, replayEvents, dedupeEvents,
} from './eventStore.js';
import { buildFarmMemory } from './farmMemoryGraph.js';
import { buildCropMemory } from './cropMemoryGraph.js';
import {
  computeRecommendationFunnel, RECOMMENDATION_LIFECYCLE,
} from './recommendationFeedback.js';
import {
  computeOutcomes, OUTCOME_KIND, OUTCOME_VERDICT,
} from './outcomeEngine.js';
import {
  anonymizeRegionalInsight, REGIONAL_MATERIAL_KINDS,
} from './regionalLearning.js';
import {
  composeFarmerTrust, FARMER_TRUST_INPUTS, FARMER_TRUST_WEIGHTS,
} from './farmerTrustEngine.js';
import {
  computeBuyerTrust,  BUYER_TRUST_INPUTS,  BUYER_TRUST_WEIGHTS,
} from './buyerTrustEngine.js';
import {
  computeProgramTrust, PROGRAM_TRUST_INPUTS, PROGRAM_TRUST_WEIGHTS,
} from './programTrustEngine.js';

export const DATA_FLYWHEEL_VERSION = 'data-flywheel-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now   = () => _safe(() => new Date().toISOString(), '');

function _kindBreakdown(events) {
  const out = {};
  for (const e of _arr(events)) {
    if (!_isObj(e)) continue;
    const k = _str(e.eventType);
    if (!k) continue;
    out[k] = (out[k] || 0) + 1;
  }
  return Object.freeze(out);
}

/**
 * @param {{
 *   events?: Array, farmId?: string, cropId?: string,
 *   taskState?: object, scanHistory?: Array,
 *   outcomeRecords?: Array,
 *   region?: string, crop?: string, season?: string,
 *   weather?: object, sampleSize?: number,
 *   baseTrust?: object|number,
 *   buyerInputs?: object, programInputs?: object,
 *   now?: number,
 * }} ctx
 */
export function dataFlywheel(ctx) {
  const c = _isObj(ctx) ? ctx : {};
  const events = _arr(c.events);

  const farmMemory = _safe(() => buildFarmMemory({
    events, farmId: _str(c.farmId),
  }), null);

  const cropMemory = _str(c.cropId)
    ? _safe(() => buildCropMemory({ events, cropId: c.cropId }), null)
    : null;

  const recommendationFunnel = _safe(() => computeRecommendationFunnel({
    events, outcomeRecords: _arr(c.outcomeRecords),
  }), null);

  const outcomes = _safe(() => computeOutcomes({ events }), null);

  const regionalInsight = _safe(() => anonymizeRegionalInsight({
    events, region: c.region, crop: c.crop, season: c.season,
    weather: c.weather, sampleSize: c.sampleSize,
    outcomes: outcomes && outcomes.perOutcome,
    now: c.now,
  }), null);

  const farmer = _safe(() => composeFarmerTrust({
    events, taskState: c.taskState, scanHistory: c.scanHistory,
    baseTrust: c.baseTrust, now: c.now,
  }), null);
  const buyer  = _safe(() => computeBuyerTrust(_isObj(c.buyerInputs) ? c.buyerInputs : {}), null);
  const program = _safe(() => computeProgramTrust(_isObj(c.programInputs) ? c.programInputs : {}), null);

  return Object.freeze({
    runtimeVersion: DATA_FLYWHEEL_VERSION,
    generatedAt:    _now(),
    events: Object.freeze({
      count: events.length,
      kinds: _kindBreakdown(events),
    }),
    farmMemory,
    cropMemory,
    recommendationFunnel,
    outcomes,
    regionalInsight,
    trust: Object.freeze({ farmer, buyer, program }),
    deferred: Object.freeze({
      networkSync:
        'no backend aggregator yet; regional insight records are '
        + 'LOCAL-ONLY until network sync ships',
      crossFarmAggregation:
        'aggregator backend required for cross-farm regional learning',
      buyerTrustExposure:
        'marketplace gated for RC1 — buyer trust returns null envelope '
        + 'unless ungated by engineering',
      programTrustExposure:
        'NgoDashboardV1 gated — program trust returns null envelope '
        + 'unless ungated by engineering',
      intelligenceApi:
        'server routes mounted at /api/flywheel/* '
        + '(spec name /api/intelligence/* collides with existing '
        + 'wave-9 application-intelligence module)',
    }),
  });
}

/**
 * Pin window.__dataFlywheel(ctx) so QA + the console can
 * introspect the composite at runtime.
 */
export function installDataFlywheelGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__dataFlywheel === 'function') return true;
    window.__dataFlywheel = function (ctx) {
      const out = dataFlywheel(ctx || {});
      try { console.log('[Farroway · Data Flywheel]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports for sub-engine + audit consumers
export {
  EVENT_KIND, EVENT_SCHEMA_VERSION,
  normalizeEvent, validateEvent, eventEquals,
  appendEvent, mergeEventLogs, replayEvents, dedupeEvents,
  buildFarmMemory,
  buildCropMemory,
  computeRecommendationFunnel, RECOMMENDATION_LIFECYCLE,
  computeOutcomes, OUTCOME_KIND, OUTCOME_VERDICT,
  anonymizeRegionalInsight, REGIONAL_MATERIAL_KINDS,
  composeFarmerTrust, FARMER_TRUST_INPUTS, FARMER_TRUST_WEIGHTS,
  computeBuyerTrust,  BUYER_TRUST_INPUTS,  BUYER_TRUST_WEIGHTS,
  computeProgramTrust, PROGRAM_TRUST_INPUTS, PROGRAM_TRUST_WEIGHTS,
};
