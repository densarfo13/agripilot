/**
 * notificationRules.js — v1 rule-based notification triggers.
 *
 * Each rule is:
 *   {
 *     id:          stable string prefix used in the generated notif id
 *     type:        'daily' | 'missed' | 'stage' | 'harvest' | 'inactivity'
 *     priority:    'high' | 'medium' | 'low'
 *     channel:     'in_app' | 'push' | 'sms'       (default 'in_app')
 *     shouldFire(ctx): boolean
 *     build(ctx):  { messageKey, messageVars?, data? }
 *     // dedup: one notification per (rule, day key). The key comes
 *     //        from `keyFor(ctx)` when supplied, else ISO date.
 *     keyFor?(ctx): string
 *   }
 *
 * The context `ctx` is built by notificationGenerator:
 *   {
 *     now:            Date
 *     todayIso:       'YYYY-MM-DD'
 *     yesterdayIso:   'YYYY-MM-DD'
 *     tasks:          [{ id, priority?, dueHint? }]  from engine
 *     completions:    [{ taskId, completed, timestamp }]
 *     loopFacts:      { streak, lastVisit, missedDays }
 *     journey:        { state, crop, farmId, plantedAt, harvestedAt }
 *     weatherSummary: { status, cautions[] } | null
 *   }
 */

function sameIsoDay(ts, iso) {
  if (!ts || !iso) return false;
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === iso;
}

function completedCountOn(completions, iso) {
  if (!Array.isArray(completions)) return 0;
  return completions.filter((c) => c && c.completed !== false
                                && sameIsoDay(c.timestamp, iso)).length;
}

function incompleteToday(tasks, completions, todayIso) {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const doneToday = new Set(
    (completions || [])
      .filter((c) => c && c.completed !== false && sameIsoDay(c.timestamp, todayIso))
      .map((c) => String(c.taskId)),
  );
  return tasks.filter((t) => t && t.id && !doneToday.has(String(t.id))).length;
}

// ─── Rule 1: daily reminder ───────────────────────────────────────
const DAILY_REMINDER = {
  id:       'daily_reminder',
  type:     'daily',
  priority: 'medium',
  channel:  'in_app',
  shouldFire(ctx) {
    return incompleteToday(ctx.tasks, ctx.completions, ctx.todayIso) > 0;
  },
  build(ctx) {
    const n = incompleteToday(ctx.tasks, ctx.completions, ctx.todayIso);
    return {
      messageKey:  'notifications.feed.daily_pending',
      messageVars: { count: n },
      data:        { count: n },
    };
  },
  keyFor(ctx) { return ctx.todayIso; },
};

// ─── Rule 2: missed tasks yesterday ───────────────────────────────
const MISSED_TASKS = {
  id:       'missed_tasks',
  type:     'missed',
  priority: 'high',
  channel:  'in_app',
  shouldFire(ctx) {
    // Only fires when yesterday had NO completions AND the farmer has
    // a history of completions older than yesterday (so we're not
    // nagging someone who just signed up).
    if (completedCountOn(ctx.completions, ctx.yesterdayIso) > 0) return false;
    if (completedCountOn(ctx.completions, ctx.todayIso) > 0)     return false;
    const olderThanYesterday = (ctx.completions || []).some((c) => {
      if (!c || c.completed === false) return false;
      return (c.timestamp || 0) < new Date(ctx.yesterdayIso + 'T00:00:00').getTime();
    });
    return olderThanYesterday;
  },
  build() {
    return {
      messageKey: 'notifications.feed.missed_yesterday',
      data:       { kind: 'missed_day' },
    };
  },
  keyFor(ctx) { return ctx.todayIso; },
};

// ─── Rule 3: stage alert (journey state changes) ──────────────────
const STAGE_ALERT = {
  id:       'stage_alert',
  type:     'stage',
  priority: 'medium',
  channel:  'in_app',
  shouldFire(ctx) {
    const state = ctx.journey && ctx.journey.state;
    // Fire once per state entry — caller's stored journey already
    // carries `enteredAt`, which we dedup on via keyFor.
    return !!state
      && state !== 'onboarding'
      && state !== 'crop_selected';
  },
  build(ctx) {
    const state = ctx.journey.state;
    return {
      messageKey:  'notifications.feed.stage_entered',
      messageVars: { stateKey: `journey.state.${state}` },
      data:        { state },
    };
  },
  keyFor(ctx) {
    const state = ctx.journey && ctx.journey.state;
    const enteredAt = ctx.journey && ctx.journey.enteredAt;
    // One notification per state ENTRY. If `enteredAt` is missing
    // (legacy journey), fall back to the day the state applies.
    if (!state) return ctx.todayIso;
    return `${state}:${enteredAt || ctx.todayIso}`;
  },
};

// ─── Rule 4: harvest approaching ──────────────────────────────────
const HARVEST_APPROACHING = {
  id:       'harvest_approaching',
  type:     'harvest',
  priority: 'high',
  channel:  'in_app',
  shouldFire(ctx) {
    const state = ctx.journey && ctx.journey.state;
    if (state === 'harvest' || state === 'post_harvest') return true;
    // Also fire ~150d after planting so the farmer gets a heads-up
    // before the calendar flips to 'harvest'.
    const plantedAt = ctx.journey && ctx.journey.plantedAt;
    if (!plantedAt) return false;
    const days = Math.floor(((ctx.now?.getTime?.() || Date.now()) - plantedAt) / 86400000);
    return days >= 150 && days < 210;
  },
  build(ctx) {
    return {
      messageKey:  'notifications.feed.harvest_nearing',
      messageVars: { crop: (ctx.journey && ctx.journey.crop) || null },
      data:        { plantedAt: ctx.journey?.plantedAt || null },
    };
  },
  keyFor(ctx) {
    // Weekly dedup (Mon–Sun). Avoid hammering the user with a daily
    // harvest reminder.
    const d = ctx.now instanceof Date ? ctx.now : new Date();
    const monday = new Date(d);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((d.getDay() + 6) % 7));
    const y = monday.getFullYear();
    const m = String(monday.getMonth() + 1).padStart(2, '0');
    const day = String(monday.getDate()).padStart(2, '0');
    return `week:${y}-${m}-${day}`;
  },
};

// ─── Rule 5: inactivity (3+ days since last open) ─────────────────
const INACTIVITY = {
  id:       'inactivity',
  type:     'inactivity',
  priority: 'medium',
  channel:  'in_app',
  shouldFire(ctx) {
    // Rely on the daily-loop's missedDays counter — it already
    // handles the "lastVisit is today because we just touched it"
    // edge case by comparing the PREVIOUS lastVisit against today.
    // See src/lib/loop/dailyLoop.js.
    const loopFacts = ctx.loopFacts;
    if (!loopFacts) return false;
    const missed = Number(loopFacts.missedDays || 0);
    return missed >= 3;
  },
  build(ctx) {
    return {
      messageKey:  'notifications.feed.inactivity',
      messageVars: { days: (ctx.loopFacts && ctx.loopFacts.missedDays) || 3 },
      data:        { days: ctx.loopFacts?.missedDays || null },
    };
  },
  keyFor(ctx) {
    // Once per week — resetting when the farmer returns.
    const d = ctx.now instanceof Date ? ctx.now : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
};

export const RULES = Object.freeze([
  DAILY_REMINDER,
  MISSED_TASKS,
  STAGE_ALERT,
  HARVEST_APPROACHING,
  INACTIVITY,
]);

export const _internal = Object.freeze({
  sameIsoDay, completedCountOn, incompleteToday,
});
