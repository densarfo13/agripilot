/**
 * runtime/intelligenceNetwork/index.js — Phase 12 composite.
 *
 *   import {
 *     networkIntelligence, installNetworkIntelligenceGlobal,
 *     NETWORK_INTELLIGENCE_VERSION,
 *   } from 'src/runtime/intelligenceNetwork/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint that runs the wave-12 sub-engines and
 *   returns one frozen envelope:
 *
 *     {
 *       runtimeVersion, generatedAt,
 *       digitalTwin,           // 4 timelines over the local window
 *       trends,                // local trend detector output
 *       peerBenchmarks,        // null until backend ships
 *       recommendations,       // composed from above
 *       anonymizedRecords,     // 0-N records ready for future sync
 *       deferred,              // honest map of network-only features
 *     }
 *
 *   The composite is pure — no fetch, no localStorage. Caller
 *   passes injected data; runtime returns the envelope. The wave-5
 *   single-writer invariant is preserved (engines never write to
 *   persistence; anonymizer produces records the caller may LATER
 *   hand to a sync layer).
 */

import { buildDigitalTwin }         from './digitalTwin.js';
import { detectTrends }             from './trendDetector.js';
import { computePeerBenchmark }     from './peerBenchmark.js';
import { composeNetworkRecommendations } from './recommendationComposer.js';
import {
  anonymizeScanRecord, anonymizeTaskRecord,
  anonymizeOutcomeRecord, anonymizeRecord, auditAnonymity,
} from './anonymizer.js';

export const NETWORK_INTELLIGENCE_VERSION = 'network-intelligence-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * @param {{
 *   now?: number,
 *   windowDays?: number,
 *   events?: Array,
 *   scanHistory?: Array,
 *   dailyHealthSnapshots?: Array,
 *   dailyRiskSnapshots?: Array,
 *   outcomeRecords?: Array,
 *   farmMetrics?: { yield?, health?, tasks?, profit? },
 *   benchmarkData?: { yield?, health?, tasks?, profit? },
 *   regionalSignals?: Array,
 *   pendingScanRecords?: Array,
 *   pendingTaskRecords?: Array,
 *   pendingOutcomeRecords?: Array,
 * }} ctx
 */
export function networkIntelligence(ctx) {
  const c = _isObj(ctx) ? ctx : {};

  const digitalTwin = _safe(() => buildDigitalTwin(c), null);
  const trends      = _safe(() => detectTrends(c), null);

  // Peer benchmarks — one per metric the caller has both a farm
  // value AND a benchmark distribution for. Each entry self-fails
  // gracefully when its inputs are missing (returns ok:false).
  const peerBenchmarks = {};
  const metrics = ['yield', 'health', 'tasks', 'profit'];
  for (const m of metrics) {
    const farmVal = c.farmMetrics && c.farmMetrics[m];
    const bench   = c.benchmarkData && c.benchmarkData[m];
    peerBenchmarks[m] = _safe(() => computePeerBenchmark({
      farmValue: farmVal, benchmark: bench,
    }), null);
  }

  const recommendations = _safe(() => composeNetworkRecommendations({
    trends,
    benchmarks: Object.values(peerBenchmarks),
    regionalSignals: _arr(c.regionalSignals),
  }), Object.freeze([]));

  // Anonymize any caller-supplied pending records so the envelope
  // can show what would be uploaded to the network. The wave-5
  // invariant — no UI writes — is preserved: this runtime does NOT
  // sync, it just produces records.
  const anonymizedRecords = [];
  for (const r of _arr(c.pendingScanRecords)) {
    const a = _safe(() => anonymizeScanRecord(r), null);
    if (a) anonymizedRecords.push(a);
  }
  for (const r of _arr(c.pendingTaskRecords)) {
    const a = _safe(() => anonymizeTaskRecord(r), null);
    if (a) anonymizedRecords.push(a);
  }
  for (const r of _arr(c.pendingOutcomeRecords)) {
    const a = _safe(() => anonymizeOutcomeRecord(r), null);
    if (a) anonymizedRecords.push(a);
  }

  return Object.freeze({
    runtimeVersion: NETWORK_INTELLIGENCE_VERSION,
    generatedAt:    _now(),
    digitalTwin,
    trends,
    peerBenchmarks:  Object.freeze(peerBenchmarks),
    recommendations,
    anonymizedRecords: Object.freeze(anonymizedRecords),
    deferred: Object.freeze({
      networkSync:           'no backend aggregator yet; anonymized '
                            + 'records are LOCAL-ONLY until that ships',
      crossFarmTrends:       'trends are local-only; spec\'d regional '
                            + 'aggregation requires backend',
      crossFarmPeerBenchmarks: 'returns null until peer distribution '
                              + 'data is provided',
      pestOutbreakAlerts:    'local hotspot composer ready; push '
                            + 'notifications via wave-8 notifications '
                            + 'runtime when backend signals arrive',
      marketIntelligence:    'marketplace flag OFF for RC1',
      ngoIntelligence:       'NgoDashboardV1 exists, gated',
      governmentIntelligence: 'aggregation requires backend + partner '
                            + 'agreements',
      buyerIntelligence:     'marketplace gated',
      investorIntelligence:  'MetricsDashboard exists, gated',
    }),
  });
}

/**
 * Pin window.__networkIntelligence(ctx).
 */
export function installNetworkIntelligenceGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__networkIntelligence === 'function') return true;
    window.__networkIntelligence = function (ctx) {
      const out = networkIntelligence(ctx || {});
      try { console.log('[Farroway · Network Intelligence]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports for sub-engine + audit consumers.
export {
  buildDigitalTwin,
  detectTrends,
  computePeerBenchmark,
  composeNetworkRecommendations,
  anonymizeScanRecord, anonymizeTaskRecord, anonymizeOutcomeRecord,
  anonymizeRecord, auditAnonymity,
};
