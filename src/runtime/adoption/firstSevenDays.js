/**
 * runtime/adoption/firstSevenDays.js — Phase 13 7-day guided arc.
 *
 *   import { computeFirstSevenDays, DAY_MILESTONES }
 *     from 'src/runtime/adoption/firstSevenDays.js';
 *
 * What this is
 * ────────────
 *   The farmer's first week is the most fragile stretch of their
 *   relationship with Farroway. This engine turns it into a 7-day
 *   guided arc:
 *
 *     Day 1 — Create Farm
 *     Day 2 — Complete First Task
 *     Day 3 — Run First Scan
 *     Day 4 — Review Progress
 *     Day 5 — Weather Intelligence
 *     Day 6 — Farm Health Score
 *     Day 7 — Weekly Summary
 *
 *   It does NOT push notifications — it only emits a snapshot the
 *   UI can render and the notifications runtime can read from. The
 *   wave-5 single-writer invariant is preserved.
 *
 *   Each milestone has 3 states:
 *     • done   — the underlying signal is present
 *     • active — today's milestone (currentDay) and not done
 *     • locked — beyond today and not done
 *
 *   Returns a frozen envelope:
 *     {
 *       anchorDay,         // ISO day-string of farm creation
 *       currentDay,        // 1..7+ (clamped to 7 for display)
 *       milestones:        [{day, kind, state, labelKey, labelDefault}],
 *       nextMilestone,     // first active OR locked
 *       isComplete,        // all 7 done
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes. No fetch.
 *   • Composition-only — reads existing wave-1..wave-12 signals.
 */

export const FIRST_SEVEN_DAYS_VERSION = 'first-seven-days-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const MS_PER_DAY = 86400000;

export const DAY_MILESTONES = Object.freeze({
  day1: 'createFarm',
  day2: 'completeFirstTask',
  day3: 'runFirstScan',
  day4: 'reviewProgress',
  day5: 'weatherIntelligence',
  day6: 'farmHealthScore',
  day7: 'weeklySummary',
});

const MILESTONE_META = Object.freeze([
  { day: 1, kind: 'createFarm',
    labelKey: 'adoption.firstWeek.day1', labelDefault: 'Create your farm' },
  { day: 2, kind: 'completeFirstTask',
    labelKey: 'adoption.firstWeek.day2', labelDefault: 'Complete your first task' },
  { day: 3, kind: 'runFirstScan',
    labelKey: 'adoption.firstWeek.day3', labelDefault: 'Run your first scan' },
  { day: 4, kind: 'reviewProgress',
    labelKey: 'adoption.firstWeek.day4', labelDefault: 'Review your progress' },
  { day: 5, kind: 'weatherIntelligence',
    labelKey: 'adoption.firstWeek.day5', labelDefault: 'See your weather forecast' },
  { day: 6, kind: 'farmHealthScore',
    labelKey: 'adoption.firstWeek.day6', labelDefault: 'Check your farm health score' },
  { day: 7, kind: 'weeklySummary',
    labelKey: 'adoption.firstWeek.day7', labelDefault: 'Read your weekly summary' },
]);

function _farmCreatedAt(farm) {
  if (!_isObj(farm)) return null;
  const t = _safe(() =>
    new Date(_str(farm.createdAt) || _str(farm.created)).getTime(), NaN);
  return Number.isFinite(t) ? t : null;
}

function _hasCompletedTask(taskState) {
  if (!_isObj(taskState)) return false;
  if (_arr(taskState.completed).some((t) => _isObj(t) || _str(t))) return true;
  if (_arr(taskState.tasks).some((t) =>
    _isObj(t) && (t.status === 'done' || t.status === 'completed'
               || t.completedAt))) return true;
  return false;
}

function _hasScan(scanHistory) {
  return _arr(scanHistory).some((s) => _isObj(s));
}

function _hasEventOfKind(events, kinds) {
  return _arr(events).some((e) =>
    _isObj(e) && kinds.indexOf(e.kind) !== -1);
}

export function computeFirstSevenDays(ctx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {};
    const now   = _num(c.now) || Date.now();
    const farm  = c.farm;
    const events = _arr(c.events);

    const anchor = _farmCreatedAt(farm) || now;
    const elapsedDays = Math.max(0,
      Math.floor((now - anchor) / MS_PER_DAY));
    const currentDay  = Math.max(1, Math.min(7, elapsedDays + 1));

    const checks = {
      createFarm:          !!_farmCreatedAt(farm),
      completeFirstTask:   _hasCompletedTask(c.taskState),
      runFirstScan:        _hasScan(c.scanHistory),
      reviewProgress:      _hasEventOfKind(events,
        ['progress_viewed', 'progress_review', 'progress_open']),
      weatherIntelligence: _hasEventOfKind(events,
        ['weather_viewed', 'weather_intelligence_viewed', 'weather_open']),
      farmHealthScore:     _hasEventOfKind(events,
        ['health_score_viewed', 'farm_health_viewed']),
      weeklySummary:       _hasEventOfKind(events,
        ['weekly_summary_viewed', 'weekly_report_viewed']),
    };

    const milestones = MILESTONE_META.map((m) => {
      const done   = !!checks[m.kind];
      let state    = 'locked';
      if (done) state = 'done';
      else if (m.day <= currentDay) state = 'active';
      return Object.freeze({
        day:          m.day,
        kind:         m.kind,
        state,
        labelKey:     m.labelKey,
        labelDefault: m.labelDefault,
      });
    });

    const nextMilestone = milestones.find((m) => m.state === 'active')
                       || milestones.find((m) => m.state === 'locked')
                       || null;
    const isComplete    = milestones.every((m) => m.state === 'done');

    return Object.freeze({
      runtimeVersion: FIRST_SEVEN_DAYS_VERSION,
      anchorDay:      _safe(() => new Date(anchor).toISOString().slice(0, 10), ''),
      currentDay,
      milestones:     Object.freeze(milestones),
      nextMilestone,
      isComplete,
    });
  }, Object.freeze({
    runtimeVersion: FIRST_SEVEN_DAYS_VERSION,
    anchorDay: '',
    currentDay: 1,
    milestones: Object.freeze([]),
    nextMilestone: null,
    isComplete: false,
  }));
}
