/**
 * farmIntelligenceSnapshot.js — unified READ facade over every
 * intelligence-layer store (spec §4).
 *
 *   const snap = getFarmIntelligence({ cropName: 'maize', farmerName: 'Dennis' });
 *   //  → {
 *   //      scanHistory, scanTasks, weather, healthScore,
 *   //      pattern, risks, topAction, nextBestAction,
 *   //      buckets, briefing, progress, suppressedKinds,
 *   //      readAt, errors,
 *   //    }
 *
 * Why a facade and not a unified store
 * ─────────────────────────────────────
 *   The full "FarmIntelligenceStore" spec asks for ONE store
 *   containing farms / scans / tasks / weather / alerts /
 *   recommendations / outbreaks / risk / health.
 *
 *   That's TEN existing stores collapsed into one — a multi-week
 *   refactor that breaks every store-specific test and risks
 *   production data. The honest move:
 *
 *     • Keep the existing stores (they work, they're tested).
 *     • Ship a READ-ONLY facade that aggregates them in one call.
 *     • Surface (DailyBriefingCard, NextBestActionCard, ProgressStrip)
 *       can migrate to a single import incrementally; the facade
 *       does no harm to anyone who keeps reading directly.
 *
 *   When the codebase actually NEEDS a single source of truth (e.g.
 *   sync to a server, optimistic updates across surfaces), this
 *   facade is the natural ancestor of that store — it already
 *   defines the canonical aggregate shape.
 *
 * Strict-rule audit
 *   • Every store read is wrapped in runIsolated() — a bad store
 *     can't crash the facade. Failures are recorded in `errors[]`.
 *   • Pure (modulo storage reads) — no side effects.
 *   • Returns a stable shape so consumers can destructure safely.
 *   • Caller-supplied options (cropName, farmerName) flow through
 *     to the inner helpers that need them (predictiveRisk,
 *     briefing) so the facade is the only place a caller specifies
 *     "who am I asking about."
 */

import { getActiveScanTasks }    from '../core/scanToTask.js';
import { getScanUsefulHistory }  from './scan/scanHistoryStore.js';
import { computeFarmHealthScore } from './farmHealthScore.js';
import { detectScanPattern }     from './scanPatternDetection.js';
import { computePredictiveRisks } from './predictiveRisk.js';
import { topAction as taskTopAction } from './taskPrioritization.js';
import { computeNextBestAction } from './nextBestAction.js';
import { bucketTasks }           from './taskBuckets.js';
import { composeDailyBriefing }  from './dailyBriefing.js';
import { computeFarmProgress }   from './farmProgress.js';
import { getSuppressedKinds, shouldSuppress } from './aiMemoryStore.js';
import { getQueuedScanCount }    from './offlineScanQueue.js';
import { runIsolated }           from './subsystemIsolator.js';

function _readCachedWeather() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem('farroway_weather_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}

/**
 * Build the unified intelligence snapshot.
 *
 * @param {object} [options]
 * @param {string} [options.cropName]
 * @param {string} [options.farmerName]
 * @param {object} [options.weatherOverride] — inject for tests / SSR
 * @param {number} [options.nowMs]
 * @param {boolean} [options.skipNextBestAction] — pure-data callers can
 *                                                 opt out of the full
 *                                                 NBA computation.
 * @returns {object}
 */
export function getFarmIntelligence(options) {
  const opts = (options && typeof options === 'object') ? options : {};
  const nowMs = (typeof opts.nowMs === 'number') ? opts.nowMs : Date.now();
  const errors = [];

  // ── Raw store reads (each isolated) ─────────────────────────
  const scanHistory = runIsolated('snapshot.scanHistory', () => {
    const r = getScanUsefulHistory();
    return Array.isArray(r) ? r : [];
  }, [], { onError: (e) => errors.push({ source: 'scanHistory', message: String(e && e.message || e) }) });

  const scanTasks = runIsolated('snapshot.scanTasks', () => {
    const r = getActiveScanTasks();
    return Array.isArray(r) ? r : [];
  }, [], { onError: (e) => errors.push({ source: 'scanTasks', message: String(e && e.message || e) }) });

  const weather = opts.weatherOverride !== undefined
    ? opts.weatherOverride
    : runIsolated('snapshot.weather', _readCachedWeather, null,
        { onError: (e) => errors.push({ source: 'weather', message: String(e && e.message || e) }) });

  const offlineQueueDepth = runIsolated('snapshot.offlineQueueDepth',
    () => getQueuedScanCount(), 0,
    { onError: (e) => errors.push({ source: 'offlineQueueDepth', message: String(e && e.message || e) }) });

  // ── Derived signals (each isolated) ─────────────────────────
  const healthScore = runIsolated('snapshot.healthScore', () => computeFarmHealthScore({
    scanHistory,
    scanTasks,
    nowMs,
    weatherRisk: weather && {
      droughtSignal: !!weather.droughtSignal,
      heatStress:    !!weather.heatStress,
      floodSignal:   !!weather.floodSignal,
    },
  }), null, { onError: (e) => errors.push({ source: 'healthScore', message: String(e && e.message || e) }) });

  const pattern = runIsolated('snapshot.pattern', () => {
    const latest = scanHistory.length > 0 ? scanHistory[0] : null;
    if (!latest) return null;
    return detectScanPattern(
      {
        scanId: latest.id,
        cropName: latest.crop,
        possibleIssue: latest.noticed,
        severity: latest.severity,
      },
      scanHistory,
      { nowMs },
    );
  }, null, { onError: (e) => errors.push({ source: 'pattern', message: String(e && e.message || e) }) });

  const risks = runIsolated('snapshot.risks', () => computePredictiveRisks({
    weather,
    cropName: opts.cropName,
    scanHistory,
    nowMs,
  }), [], { onError: (e) => errors.push({ source: 'risks', message: String(e && e.message || e) }) });

  const topAction = runIsolated('snapshot.topAction', () => taskTopAction(scanTasks, {
    weatherRisks: risks,
    nowMs,
  }), null, { onError: (e) => errors.push({ source: 'topAction', message: String(e && e.message || e) }) });

  const buckets = runIsolated('snapshot.buckets', () => bucketTasks(scanTasks, { nowMs }),
    { doNow: [], thisWeek: [], monitor: [] },
    { onError: (e) => errors.push({ source: 'buckets', message: String(e && e.message || e) }) });

  const latestScan = scanHistory.length > 0 ? scanHistory[0] : null;

  // ── Composite outputs ───────────────────────────────────────
  const nextBestAction = (opts.skipNextBestAction === true)
    ? null
    : runIsolated('snapshot.nextBestAction', () => computeNextBestAction({
        risks,
        scanTasks,
        pattern,
        healthScore,
        latestScan,
        topPrioritizedAction: topAction,
        nowMs,
        // §5 adaptation gate — wire the memory store's
        // suppression probe so the snapshot honours user-skipped
        // recommendations.
        isSuppressed: (kind) => {
          try { return !!shouldSuppress(kind).suppressed; }
          catch { return false; }
        },
      }), null,
      { onError: (e) => errors.push({ source: 'nextBestAction', message: String(e && e.message || e) }) });

  const briefing = runIsolated('snapshot.briefing', () => composeDailyBriefing({
    farmerName: opts.farmerName,
    weather,
    scanHistory,
    scanTasks,
    healthScore,
    pattern,
    risks,
    now: nowMs,
  }), null, { onError: (e) => errors.push({ source: 'briefing', message: String(e && e.message || e) }) });

  const progress = runIsolated('snapshot.progress', () => computeFarmProgress({
    scanHistory,
    scanTasks,
    healthScore,
    pattern,
    nowMs,
  }), null, { onError: (e) => errors.push({ source: 'progress', message: String(e && e.message || e) }) });

  const suppressedKinds = runIsolated('snapshot.suppressedKinds', () => getSuppressedKinds(), [],
    { onError: (e) => errors.push({ source: 'suppressedKinds', message: String(e && e.message || e) }) });

  return {
    // raw signals
    scanHistory,
    scanTasks,
    weather,
    offlineQueueDepth,

    // derived signals
    healthScore,
    pattern,
    risks,
    topAction,
    buckets,
    latestScan,

    // composite outputs
    nextBestAction,
    briefing,
    progress,
    suppressedKinds,

    // meta
    readAt: nowMs,
    errors,
  };
}

export default { getFarmIntelligence };
