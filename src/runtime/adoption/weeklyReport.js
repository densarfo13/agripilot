/**
 * runtime/adoption/weeklyReport.js — Phase 13 weekly farm report.
 *
 *   import { composeWeeklyReport }
 *     from 'src/runtime/adoption/weeklyReport.js';
 *
 * What this is
 * ────────────
 *   Pure composition of "what happened on this farm in the last
 *   7 days." Pulls from caller-injected signals — wave-5 event
 *   log, wave-1 scanHistory, wave-7 task state, wave-10 health
 *   snapshots, wave-12 risk + weather + yield envelopes.
 *
 *   Returns a frozen envelope:
 *     {
 *       period: { startISO, endISO, days },
 *       tasksCompleted, scansPerformed,
 *       healthScoreChange:  { from, to, delta, direction },
 *       riskAlertCount,
 *       weatherEventCount,
 *       yieldForecastChange: { from, to, delta, direction },
 *       summary:            { headlineKey, headlineDefault, ...bullets },
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads existing engines' outputs.
 *   • No persistence writes. No fetch.
 *   • All copy via tSafe envelopes.
 */

export const WEEKLY_REPORT_VERSION = 'weekly-report-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const MS_PER_DAY = 86400000;
const DEFAULT_DAYS = 7;

function _within(ts, startMs, endMs) {
  const t = _safe(() => new Date(ts).getTime(), NaN);
  if (!Number.isFinite(t)) return false;
  return t >= startMs && t <= endMs;
}

function _countTasksCompleted(taskState, startMs, endMs) {
  if (!_isObj(taskState)) return 0;
  const tasks = _arr(taskState.tasks);
  let n = 0;
  for (const t of tasks) {
    if (!_isObj(t)) continue;
    if (t.status !== 'done' && t.status !== 'completed' && !t.completedAt) continue;
    const ts = _str(t.completedAt) || _str(t.doneAt) || _str(t.updatedAt);
    if (!ts) { n++; continue; } // fall back to count if no timestamp
    if (_within(ts, startMs, endMs)) n++;
  }
  // Also accept a pre-computed completed array
  for (const c of _arr(taskState.completed)) {
    if (!_isObj(c)) continue;
    const ts = _str(c.completedAt) || _str(c.at);
    if (_within(ts, startMs, endMs)) n++;
  }
  return n;
}

function _countScans(scanHistory, startMs, endMs) {
  let n = 0;
  for (const s of _arr(scanHistory)) {
    if (!_isObj(s)) continue;
    const ts = _str(s.scannedAt) || _str(s.createdAt) || _str(s.at);
    if (!ts) { n++; continue; }
    if (_within(ts, startMs, endMs)) n++;
  }
  return n;
}

function _firstAndLast(snapshots, key, startMs, endMs) {
  const inWindow = _arr(snapshots)
    .filter((s) => _isObj(s) && _within(_str(s.date) || _str(s.day), startMs, endMs))
    .map((s) => ({ ts: _str(s.date) || _str(s.day), v: _num(s[key]) }))
    .filter((p) => p.v != null);
  if (inWindow.length === 0) return null;
  inWindow.sort((a, b) =>
    new Date(a.ts).getTime() - new Date(b.ts).getTime());
  return { from: inWindow[0].v, to: inWindow[inWindow.length - 1].v };
}

function _direction(delta) {
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'flat';
}

function _countEventsByKind(events, kinds, startMs, endMs) {
  let n = 0;
  for (const e of _arr(events)) {
    if (!_isObj(e)) continue;
    if (kinds.indexOf(e.kind) === -1) continue;
    const ts = _str(e.at) || _str(e.timestamp) || _str(e.createdAt);
    if (!ts || _within(ts, startMs, endMs)) n++;
  }
  return n;
}

export function composeWeeklyReport(ctx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {};
    const now   = _num(c.now) || Date.now();
    const days  = _num(c.days) || DEFAULT_DAYS;
    const endMs   = now;
    const startMs = now - (days * MS_PER_DAY);

    const tasksCompleted  = _countTasksCompleted(c.taskState, startMs, endMs);
    const scansPerformed  = _countScans(c.scanHistory, startMs, endMs);

    // Health score change — first vs last snapshot in window
    const healthPair = _firstAndLast(c.dailyHealthSnapshots, 'score',
      startMs, endMs);
    const healthScoreChange = healthPair ? Object.freeze({
      from:      healthPair.from,
      to:        healthPair.to,
      delta:     Math.round((healthPair.to - healthPair.from) * 10) / 10,
      direction: _direction(healthPair.to - healthPair.from),
    }) : null;

    // Yield forecast change — first vs last snapshot in window
    const yieldPair = _firstAndLast(c.dailyYieldSnapshots, 'forecast',
      startMs, endMs);
    const yieldForecastChange = yieldPair ? Object.freeze({
      from:      yieldPair.from,
      to:        yieldPair.to,
      delta:     Math.round((yieldPair.to - yieldPair.from) * 10) / 10,
      direction: _direction(yieldPair.to - yieldPair.from),
    }) : null;

    // Risk alerts + weather events in window
    const riskAlertCount    = _countEventsByKind(c.events,
      ['risk_alert', 'high_risk', 'disease_risk', 'drought_alert',
       'heat_alert', 'pest_alert'], startMs, endMs);
    const weatherEventCount = _countEventsByKind(c.events,
      ['weather_event', 'rain_event', 'storm_event', 'heat_event',
       'frost_event'], startMs, endMs);

    // Headline — pick the strongest signal
    const headline = (() => {
      if (tasksCompleted >= 5) {
        return {
          headlineKey: 'adoption.weekly.headline.tasksStrong',
          headlineDefault: 'You completed ' + tasksCompleted + ' tasks this week.',
        };
      }
      if (healthScoreChange && healthScoreChange.direction === 'up') {
        return {
          headlineKey: 'adoption.weekly.headline.healthUp',
          headlineDefault: 'Your farm health improved this week.',
        };
      }
      if (scansPerformed > 0) {
        return {
          headlineKey: 'adoption.weekly.headline.scansLogged',
          headlineDefault: 'You logged ' + scansPerformed + ' scan(s) this week.',
        };
      }
      return {
        headlineKey:     'adoption.weekly.headline.quiet',
        headlineDefault: 'A quiet week on your farm.',
      };
    })();

    return Object.freeze({
      runtimeVersion: WEEKLY_REPORT_VERSION,
      period: Object.freeze({
        startISO: _safe(() => new Date(startMs).toISOString(), ''),
        endISO:   _safe(() => new Date(endMs).toISOString(), ''),
        days,
      }),
      tasksCompleted,
      scansPerformed,
      healthScoreChange,
      riskAlertCount,
      weatherEventCount,
      yieldForecastChange,
      summary: Object.freeze(headline),
    });
  }, Object.freeze({
    runtimeVersion: WEEKLY_REPORT_VERSION,
    period: Object.freeze({ startISO: '', endISO: '', days: DEFAULT_DAYS }),
    tasksCompleted: 0,
    scansPerformed: 0,
    healthScoreChange: null,
    riskAlertCount: 0,
    weatherEventCount: 0,
    yieldForecastChange: null,
    summary: Object.freeze({
      headlineKey: 'adoption.weekly.headline.empty',
      headlineDefault: 'No activity recorded yet this week.',
    }),
  }));
}
