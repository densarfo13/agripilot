/**
 * retentionLoopEngine.js — Operational Refinement §4.
 *
 *   import { computeRetentionLoop, RETURN_REASON }
 *     from 'src/core/retention/retentionLoopEngine.js';
 *
 *   const v = computeRetentionLoop({
 *     activeFarm, tasksToday, scansRecent, loopEvents,
 *     weather, nowMs, locale,
 *   });
 *
 *   v = {
 *     returnReason,         — RETURN_REASON.*
 *     dailyHook,            — { key, fallback, params }
 *     continuityMessage,    — { key, fallback, params } | null
 *     nextBestMoment,       — { key, fallback, params } | null
 *     suppressed,           — competing reasons we skipped (with cause)
 *     engineVersion:'retention-loop-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   Produces ONE calm reason the farmer should return today. NEVER
 *   creates fake urgency. NEVER spams. Composes — never replaces —
 *   the existing memory + loop infrastructure:
 *
 *     • activeFarm.scanHistory + .taskState   (canonical store)
 *     • confidenceLoopEngine.buildLoopRecord  (pending follow-ups)
 *     • farmLoopEngine output's recommendedTasks (today's task)
 *     • weather signal                         (rain change / heat spike)
 *
 *   Priority ladder (worst-state-wins for SAFETY signals; otherwise
 *   highest-value-wins):
 *     1. PENDING_FOLLOW_UP        — recovery scan due (worst-case wins)
 *     2. MISSED_CRITICAL_TASK     — overdue lifecycle task
 *     3. WEATHER_CHANGE           — rain / heat spike vs yesterday
 *     4. TASK_DUE_TODAY           — operational nudge
 *     5. GROWTH_MILESTONE         — first flower / fruit detected
 *     6. RECOVERY_UPDATE          — recent resolved scan
 *     7. HARVEST_COUNTDOWN        — harvest stage active
 *     8. SELL_READINESS           — produce-listed cue
 *     9. CALM_DEFAULT             — "Have a calm field walk" (low key)
 *
 *   Returns ONE reason — never a list. The other candidates are
 *   surfaced via `suppressed` so the QA dashboard can audit why a
 *   weather-change reason beat a sell-readiness reason on a given day.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Calm wording only — no "URGENT", no exclamations, no scarcity.
 */

const ENGINE_VERSION = 'retention-loop-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const RETURN_REASON = Object.freeze({
  PENDING_FOLLOW_UP:     'pending_follow_up',
  MISSED_CRITICAL_TASK:  'missed_critical_task',
  WEATHER_CHANGE:        'weather_change',
  TASK_DUE_TODAY:        'task_due_today',
  GROWTH_MILESTONE:      'growth_milestone',
  RECOVERY_UPDATE:       'recovery_update',
  HARVEST_COUNTDOWN:     'harvest_countdown',
  SELL_READINESS:        'sell_readiness',
  CALM_DEFAULT:          'calm_default',
});

const _PRIORITY = Object.freeze({
  [RETURN_REASON.PENDING_FOLLOW_UP]:     1,
  [RETURN_REASON.MISSED_CRITICAL_TASK]:  2,
  [RETURN_REASON.WEATHER_CHANGE]:        3,
  [RETURN_REASON.TASK_DUE_TODAY]:        4,
  [RETURN_REASON.GROWTH_MILESTONE]:      5,
  [RETURN_REASON.RECOVERY_UPDATE]:       6,
  [RETURN_REASON.HARVEST_COUNTDOWN]:     7,
  [RETURN_REASON.SELL_READINESS]:        8,
  [RETURN_REASON.CALM_DEFAULT]:          9,
});

// ─── Candidate factories ─────────────────────────────────────

function _pendingFollowUp(input) {
  const events = Array.isArray(input.loopEvents) ? input.loopEvents : [];
  // Look for any FOLLOWUP_SCAN > 6h old with no IMPROVED/WORSENED/UNCHANGED yet.
  const now = _num(input.nowMs) || Date.now();
  const SIX_H = 6 * 60 * 60 * 1000;
  const grouped = new Map();
  for (const e of events) {
    if (!_isObj(e) || !e.recommendationId) continue;
    if (!grouped.has(e.recommendationId)) grouped.set(e.recommendationId, []);
    grouped.get(e.recommendationId).push(e);
  }
  for (const [, list] of grouped) {
    const has = (ev) => list.some((r) => r.event === ev);
    const followUp = list.find((r) => r.event === 'followup_scan');
    if (!followUp) continue;
    if (has('improved') || has('worsened') || has('unchanged')) continue;
    if (now - followUp.recordedAt < SIX_H) continue;
    return Object.freeze({
      reason: RETURN_REASON.PENDING_FOLLOW_UP,
      hook: Object.freeze({
        key:      'retention.hook.pendingFollowUp',
        fallback: 'A follow-up scan is waiting — share how the plant looks.',
      }),
      continuity: Object.freeze({
        key:      'retention.continuity.pendingFollowUp',
        fallback: 'Capturing the outcome helps tune future guidance.',
      }),
      nextMoment: Object.freeze({
        key:      'retention.moment.pendingFollowUp',
        fallback: 'Open Journal to confirm: improved, the same, or worsening.',
      }),
    });
  }
  return null;
}

function _missedCriticalTask(input) {
  const cl = _isObj(input.activeFarm && input.activeFarm.taskState)
    ? input.activeFarm.taskState : {};
  const overdue = _num(cl.criticalTaskOverdueDays);
  if (overdue == null || overdue < 2) return null;
  return Object.freeze({
    reason: RETURN_REASON.MISSED_CRITICAL_TASK,
    hook: Object.freeze({
      key:      'retention.hook.overdueTask',
      fallback: 'A {days}-day overdue task is waiting on this growth stage.',
      params:   { days: overdue },
    }),
    continuity: Object.freeze({
      key:      'retention.continuity.overdueTask',
      fallback: 'Catching up keeps the lifecycle moving.',
    }),
    nextMoment: Object.freeze({
      key:      'retention.moment.overdueTask',
      fallback: 'Open Tasks to mark it done — it only takes a minute.',
    }),
  });
}

function _weatherChange(input) {
  const w = _isObj(input.weather) ? input.weather : {};
  const yesterday = _isObj(input.weatherYesterday) ? input.weatherYesterday : null;
  if (!yesterday) {
    // Fall back to absolute thresholds when no comparison available.
    const rain = _num(w.rainProbability24hPct);
    const temp = _num(w.temp);
    if (rain != null && rain >= 60) {
      return Object.freeze({
        reason: RETURN_REASON.WEATHER_CHANGE,
        hook: Object.freeze({
          key:      'retention.hook.weather.rainComing',
          fallback: 'Rain is likely soon — quick check before it arrives.',
        }),
        continuity: null,
        nextMoment: null,
      });
    }
    if (temp != null && temp >= 32) {
      return Object.freeze({
        reason: RETURN_REASON.WEATHER_CHANGE,
        hook: Object.freeze({
          key:      'retention.hook.weather.heatToday',
          fallback: 'Warm day ahead — early watering may help.',
        }),
        continuity: null,
        nextMoment: null,
      });
    }
    return null;
  }
  // Comparison case.
  const dTemp = (_num(w.temp) || 0) - (_num(yesterday.temp) || 0);
  if (Math.abs(dTemp) >= 6) {
    return Object.freeze({
      reason: RETURN_REASON.WEATHER_CHANGE,
      hook: Object.freeze({
        key:      'retention.hook.weather.shift',
        fallback: 'Today\'s temperature shifted noticeably from yesterday.',
      }),
      continuity: null,
      nextMoment: null,
    });
  }
  return null;
}

function _taskDueToday(input) {
  const tasks = Array.isArray(input.tasksToday) ? input.tasksToday : [];
  if (tasks.length === 0) return null;
  return Object.freeze({
    reason: RETURN_REASON.TASK_DUE_TODAY,
    hook: Object.freeze({
      key:      'retention.hook.taskToday',
      fallback: 'You have {count} task(s) waiting today.',
      params:   { count: tasks.length },
    }),
    continuity: null,
    nextMoment: Object.freeze({
      key:      'retention.moment.taskToday',
      fallback: 'A short field walk usually covers them.',
    }),
  });
}

function _growthMilestone(input) {
  const scans = Array.isArray(input.scansRecent) ? input.scansRecent : [];
  // Milestone triggers: first scan with a flower/fruit label, or
  // first scan with severity = mild after a moderate / serious scan.
  const labels = scans.map((s) => _str(s && s.label).toLowerCase());
  const flowerSpot = labels.find((l) => l.includes('flower') || l.includes('fruit'));
  if (!flowerSpot) return null;
  return Object.freeze({
    reason: RETURN_REASON.GROWTH_MILESTONE,
    hook: Object.freeze({
      key:      'retention.hook.growthMilestone',
      fallback: 'A new growth milestone is visible — your plant is moving forward.',
    }),
    continuity: Object.freeze({
      key:      'retention.continuity.growthMilestone',
      fallback: 'Milestones land in your Journal automatically.',
    }),
    nextMoment: null,
  });
}

function _recoveryUpdate(input) {
  const events = Array.isArray(input.loopEvents) ? input.loopEvents : [];
  const recent = events.slice(-12);
  const improved = recent.filter((e) => _isObj(e) && e.event === 'improved').length;
  if (improved === 0) return null;
  return Object.freeze({
    reason: RETURN_REASON.RECOVERY_UPDATE,
    hook: Object.freeze({
      key:      'retention.hook.recoveryUpdate',
      fallback: '{count} recent issue(s) have improved — keep going.',
      params:   { count: improved },
    }),
    continuity: null,
    nextMoment: null,
  });
}

function _harvestCountdown(input) {
  const stage = _str(input.activeFarm && input.activeFarm.lifecycleStage).toLowerCase();
  if (stage !== 'harvest' && stage !== 'fruiting') return null;
  return Object.freeze({
    reason: RETURN_REASON.HARVEST_COUNTDOWN,
    hook: Object.freeze({
      key:      'retention.hook.harvestCountdown',
      fallback: 'Harvest window is approaching — plan picking and storage.',
    }),
    continuity: null,
    nextMoment: null,
  });
}

function _sellReadiness(input) {
  const sell = _isObj(input.activeFarm && input.activeFarm.sellState)
    ? input.activeFarm.sellState : {};
  if (!sell.harvestReady && !sell.readyToList) return null;
  return Object.freeze({
    reason: RETURN_REASON.SELL_READINESS,
    hook: Object.freeze({
      key:      'retention.hook.sellReadiness',
      fallback: 'Your crop is ready to list — buyers nearby may be interested.',
    }),
    continuity: null,
    nextMoment: null,
  });
}

function _calmDefault() {
  return Object.freeze({
    reason: RETURN_REASON.CALM_DEFAULT,
    hook: Object.freeze({
      key:      'retention.hook.calmDefault',
      fallback: 'Take a calm walk through your field today.',
    }),
    continuity: null,
    nextMoment: null,
  });
}

const _FACTORIES = Object.freeze([
  _pendingFollowUp, _missedCriticalTask, _weatherChange,
  _taskDueToday, _growthMilestone, _recoveryUpdate,
  _harvestCountdown, _sellReadiness, _calmDefault,
]);

// ─── Public ──────────────────────────────────────────────────

/**
 * Compute one return reason for the farmer's daily hook. Always
 * returns a frozen envelope; never throws.
 */
export function computeRetentionLoop(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const candidates = [];
    for (const fn of _FACTORIES) {
      const c = _safe(() => fn(safe), null);
      if (c) candidates.push(c);
    }
    // Sort by priority ascending — lowest wins.
    candidates.sort((a, b) =>
      (_PRIORITY[a.reason] || 99) - (_PRIORITY[b.reason] || 99));

    const winner = candidates[0] || _calmDefault();
    const suppressed = candidates.slice(1).map((c) => Object.freeze({
      reason: c.reason,
      cause:  'lower_priority',
    }));

    return Object.freeze({
      engineVersion:     ENGINE_VERSION,
      returnReason:      winner.reason,
      dailyHook:         winner.hook,
      continuityMessage: winner.continuity || null,
      nextBestMoment:    winner.nextMoment || null,
      suppressed:        Object.freeze(suppressed),
      locale:            _str(safe.locale) || null,
      generatedAt:       _num(safe.nowMs) || Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  const fallback = _calmDefault();
  return Object.freeze({
    engineVersion:     ENGINE_VERSION,
    returnReason:      fallback.reason,
    dailyHook:         fallback.hook,
    continuityMessage: null,
    nextBestMoment:    null,
    suppressed:        Object.freeze([]),
    locale:            null,
    generatedAt:       Date.now(),
  });
}

export const _internal = Object.freeze({
  _pendingFollowUp, _missedCriticalTask, _weatherChange,
  _taskDueToday, _growthMilestone, _recoveryUpdate,
  _harvestCountdown, _sellReadiness, _calmDefault,
  _PRIORITY, ENGINE_VERSION,
});

const _module = { computeRetentionLoop, RETURN_REASON, _internal };
export default _module;
