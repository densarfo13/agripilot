/**
 * runtime/today/index.js — Phase 11 Today Engine composite.
 *
 *   import {
 *     todayEngine, installTodayEngineGlobal,
 *     TODAY_ENGINE_VERSION,
 *   } from 'src/runtime/today/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint that takes the day's context (active farm,
 *   tasks, weather, field intelligence, scan history, event log)
 *   and returns ONE frozen envelope the UI / voice / diagnostics
 *   subscribe to:
 *
 *     {
 *       runtimeVersion, generatedAt, farmId,
 *       prioritizedTasks,   // ranker output (3 buckets)
 *       weatherActions,     // wave-10 deriveSmartWeatherActions
 *       fieldRisk,          // wave-10 computeFieldRisk
 *       farmHealth,         // wave-10 computeFarmHealthScore
 *       scanRecommendations,// composed from useful recent scans
 *       marketUpdates,      // null in Phase 11 (marketplace OFF)
 *       briefing,           // composeMorningBriefing
 *       streaks,            // computeStreaks (events)
 *       achievements,       // computeAchievements
 *       deferred,           // honest map of what's not shipped
 *     }
 *
 *   Strict rules:
 *     • Pure composition. Never throws. SSR-safe.
 *     • No new persistence writers. No new API calls.
 *     • Reads injected context only. Caller owns data sourcing.
 *     • Offline-first by design — all functions are pure over
 *       data the caller already has cached.
 */

import { rankTasks }              from './priorityRanker.js';
import { composeMorningBriefing,
         composeEndOfDaySummary } from './dailyBriefing.js';
import { computeStreaks }         from './streakTracker.js';
import { computeAchievements }    from './achievementEngine.js';

// Phase 10 farm-intelligence composer is re-used here so the
// today envelope and the farm-intelligence envelope agree on
// field risk / health / weather actions / crop stage.
import {
  computeFieldRisk,
  computeFarmHealthScore,
  deriveSmartWeatherActions,
  deriveCropStage,
} from '../farmIntelligence/index.js';

export const TODAY_ENGINE_VERSION = 'today-engine-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr  = (v) => (Array.isArray(v) ? v : []);
const _str  = (v) => (typeof v === 'string' ? v : '');
const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now = () => _safe(() => new Date().toISOString(), '');

/**
 * Compose scan recommendations from recent scan history. Pure read.
 * Returns up to 3 short suggestions: re-scan needs_review items,
 * follow up on detected issues, scan the field with the oldest scan.
 */
function _scanRecommendations(scanHistory) {
  const hist = _arr(scanHistory).slice(-20);
  const out = [];
  // 1. Most recent needs_review
  const review = hist.slice().reverse()
    .find((s) => s && _str(s.confidence).toLowerCase() === 'low');
  if (review) {
    out.push(Object.freeze({
      kind: 'rescan_needs_review',
      headlineKey: 'today.scanRec.rescan.headline',
      headlineDefault: 'Re-scan unclear photo',
      bodyKey: 'today.scanRec.rescan.body',
      bodyDefault: 'Take another photo of the leaf that was unclear.',
      scanId: review.id || review.scanId || null,
    }));
  }
  // 2. Disease follow-up
  const disease = hist.slice().reverse()
    .find((s) => s && /disease|pest|spot/i.test(_str(s.possibleIssue)));
  if (disease) {
    out.push(Object.freeze({
      kind: 'followup_disease',
      headlineKey: 'today.scanRec.followup.headline',
      headlineDefault: 'Follow up on flagged issue',
      bodyKey: 'today.scanRec.followup.body',
      bodyDefault: 'Re-scan in a few days to confirm the issue is resolving.',
      scanId: disease.id || disease.scanId || null,
    }));
  }
  // 3. Stale field — if no scan in 7+ days, suggest fresh scan
  const lastTs = hist.length > 0
    ? _safe(() => new Date(hist[hist.length - 1].createdAt).getTime(), 0)
    : 0;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (lastTs > 0 && Date.now() - lastTs > sevenDays) {
    out.push(Object.freeze({
      kind: 'stale_scan',
      headlineKey: 'today.scanRec.stale.headline',
      headlineDefault: 'Fresh scan recommended',
      bodyKey: 'today.scanRec.stale.body',
      bodyDefault: 'It has been a while since your last scan.',
      scanId: null,
    }));
  }
  return Object.freeze(out.slice(0, 3));
}

/**
 * Main composite.
 *
 * @param {{
 *   now?: number,
 *   farm?: { id, name, crop, region, plantingDate, farmerName },
 *   tasks?: Array,                  // active task list
 *   forecast?: Object,              // smart weather inputs
 *   riskSignals?: Object,           // field-risk inputs
 *   healthSignals?: Object,         // farm-health inputs
 *   scanHistory?: Array,            // wave-1 useScanHistory entries
 *   events?: Array,                 // wave-5 eventRuntime log
 *   counts?: Object,                // achievement counts
 * }} ctx
 */
export function todayEngine(ctx) {
  const c = _isObj(ctx) ? ctx : {};
  const now = _isNum(c.now) ? c.now : Date.now();
  const farm = _isObj(c.farm) ? c.farm : null;

  // Sub-engine outputs (each is null-safe).
  const fieldRisk     = _safe(() => computeFieldRisk(c.riskSignals || {}), null);
  const farmHealth    = _safe(() => computeFarmHealthScore(c.healthSignals || {}), null);
  const weatherActions = _safe(() => deriveSmartWeatherActions(c.forecast || {}),
                              Object.freeze([]));
  const cropStage     = farm && farm.crop && farm.plantingDate
    ? _safe(() => deriveCropStage({
        cropName: farm.crop,
        plantingDate: farm.plantingDate,
        now,
      }), null)
    : null;

  // Rank tasks with field-risk context.
  const prioritizedTasks = _safe(
    () => rankTasks(_arr(c.tasks), { now, fieldRisk }),
    Object.freeze([]),
  );

  // Scan recommendations from history.
  const scanRecommendations = _safe(
    () => _scanRecommendations(c.scanHistory),
    Object.freeze([]),
  );

  // Streaks + achievements from event log.
  const streaks = _safe(
    () => computeStreaks(_arr(c.events), { now }),
    null,
  );
  const achievements = _safe(
    () => computeAchievements({
      counts: _isObj(c.counts) ? c.counts : {},
      streaks,
    }),
    null,
  );

  // Briefing composed AFTER sub-engines so it reads the same data.
  const briefing = _safe(() => composeMorningBriefing({
    now,
    farmerName: farm ? _str(farm.farmerName) : '',
    farmHealth,
    prioritizedTasks,
    weatherActions,
    fieldRisk,
    forecastSummary: c.forecast && c.forecast.summary
      ? _str(c.forecast.summary) : null,
  }), null);

  return Object.freeze({
    runtimeVersion: TODAY_ENGINE_VERSION,
    generatedAt: _now(),
    farmId: farm ? _str(farm.id) : null,
    prioritizedTasks,
    weatherActions,
    fieldRisk,
    farmHealth,
    cropStage,
    scanRecommendations,
    briefing,
    streaks,
    achievements,
    marketUpdates: null,  // Phase 11 — marketplace flag OFF
    deferred: Object.freeze({
      marketUpdates:     'marketplace flag OFF for RC1',
      askFarrowayNlu:    'TTS shipped Phase 9; NLU pending',
      autoTaskCreation:  'engines suggest; UI does not auto-create',
      farmCalendarView:  'UI deferred; data layer ready',
      orgViewAggregates: 'NgoDashboardV1 + MetricsDashboard already exist; gated',
    }),
  });
}

/**
 * End-of-day surfacing helper — caller passes the day's delta.
 */
export function endOfDay(envelope, dayDelta) {
  return _safe(() => composeEndOfDaySummary(envelope, dayDelta), null);
}

/**
 * Pin window.__todayEngine(ctx) so DevTools can introspect.
 */
export function installTodayEngineGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__todayEngine === 'function') return true;
    window.__todayEngine = function (ctx) {
      const out = todayEngine(ctx || {});
      try { console.log('[Farroway · Today Engine]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-export sub-engines so callers can introspect / test.
export { rankTasks, TASK_BUCKET } from './priorityRanker.js';
export { composeMorningBriefing, composeEndOfDaySummary } from './dailyBriefing.js';
export { computeStreaks } from './streakTracker.js';
export { computeAchievements, ACHIEVEMENT } from './achievementEngine.js';
