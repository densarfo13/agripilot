/**
 * buildHomePayload.js — single composer for the Home screen.
 * Takes everything the screen knows and returns ONE structured
 * payload the shell component renders verbatim.
 *
 * Output shape:
 *   {
 *     welcome:    { line1, line2 },
 *     displayMode: 'task_first' | 'state_first',
 *     card: {
 *       label,       // i18n-resolved badge ("TODAY'S TASK" / state name)
 *       title,       // dominant title string
 *       why,         // one short reason (non-empty for strong cards)
 *       nextStep,    // next-step bridge (only for strong states)
 *       cta,         // single primary action label
 *       confidenceLine, // soft "Based on your last update" etc.
 *       intent,      // task intent (so consumers can route)
 *       taskId,      // passthrough
 *       variant,     // 'task' | 'state' | 'stale_safe'
 *     },
 *     progress:   { summary, variant, done, total },
 *     reminder:   boolean,    // true when this is a repeat-day reminder
 *     state:      farmerState reference,
 *     devIssues:  string[],
 *   }
 *
 * Exactly ONE dominant card. Enforced in code.
 */

import { buildWelcomeMessage } from './buildWelcomeMessage.js';
import { resolveHomeDisplayMode } from './resolveHomeDisplayMode.js';
import { buildProgressLine } from './buildProgressLine.js';
import { STATE_TYPES } from '../farmerState/statePriority.js';
import { FRESHNESS } from '../freshnessState.js';
import { isReminderVariant } from '../farmerContinuity.js';
import { runHomeDevAssertions } from './homeDevAssertions.js';

function resolve(t, key, fallback) {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  if (!v || v === key) return fallback;
  return v;
}

function stateLabelKey(state) {
  switch (state?.stateType) {
    case STATE_TYPES.HARVEST_COMPLETE:    return { key: 'home.card.label.harvest',     fallback: 'HARVEST' };
    case STATE_TYPES.POST_HARVEST:        return { key: 'home.card.label.post_harvest', fallback: 'POST-HARVEST' };
    case STATE_TYPES.FIELD_RESET:         return { key: 'home.card.label.field_reset', fallback: 'FIELD RESET' };
    case STATE_TYPES.RETURNING_INACTIVE:  return { key: 'home.card.label.resume',      fallback: 'RESUME' };
    case STATE_TYPES.STALE_OFFLINE:       return { key: 'home.card.label.stale',       fallback: 'BASED ON LAST UPDATE' };
    case STATE_TYPES.FIRST_USE:           return { key: 'home.card.label.setup',       fallback: 'SETUP' };
    case STATE_TYPES.CAMERA_ISSUE:        return { key: 'home.card.label.camera',      fallback: 'CAMERA FINDING' };
    case STATE_TYPES.BLOCKED_BY_LAND:     return { key: 'home.card.label.today_task',  fallback: 'TODAY\u2019S TASK' };
    case STATE_TYPES.WEATHER_SENSITIVE:   return { key: 'home.card.label.today_task',  fallback: 'TODAY\u2019S TASK' };
    case STATE_TYPES.ACTIVE_CYCLE:        return { key: 'home.card.label.today_task',  fallback: 'TODAY\u2019S TASK' };
    case STATE_TYPES.OFF_SEASON:          return { key: 'home.card.label.off_season',  fallback: 'OFF-SEASON' };
    default:                              return { key: 'home.card.label.today',       fallback: 'TODAY' };
  }
}

function cardCtaKey(state, variant, level) {
  // Low confidence on any risky state → "I checked" (softer commit).
  if (level === 'low' && variant === 'task') {
    return { key: 'home.card.i_checked', fallback: 'I checked' };
  }
  switch (state?.stateType) {
    case STATE_TYPES.HARVEST_COMPLETE:
    case STATE_TYPES.POST_HARVEST:
    case STATE_TYPES.FIELD_RESET:
      return { key: 'home.card.continue',    fallback: 'Continue' };
    case STATE_TYPES.STALE_OFFLINE:
      return { key: 'home.card.try_again',   fallback: 'Try again' };
    case STATE_TYPES.RETURNING_INACTIVE:
      return { key: 'home.card.see_today',   fallback: 'See today' };
    case STATE_TYPES.FIRST_USE:
      return { key: 'home.card.get_started', fallback: 'Get started' };
    case STATE_TYPES.CAMERA_ISSUE:
      return { key: 'home.card.open_finding', fallback: 'Open finding' };
    default:
      return { key: 'home.card.mark_done',   fallback: 'Mark as done' };
  }
}

/**
 * Normalize a task object into a uniform { title, why, intent,
 * taskId, level } shape. Missing pieces default to empty strings
 * so the downstream renderer never chokes.
 */
function normalizeTask(task) {
  if (!task || typeof task !== 'object') return null;
  return {
    title:  task.title   || null,
    why:    task.why     || task.detail || null,
    intent: task.intent  || task.code   || null,
    taskId: task.id      || task.taskId || null,
    level:  task.confidence?.level || null,
  };
}

/**
 * buildHomePayload — main entry. Never throws.
 */
export function buildHomePayload(input = {}) {
  const safe = input && typeof input === 'object' ? input : {};
  const {
    farmerState  = null,
    task         = null,
    name         = '',
    weatherNow   = null,
    timeOfDay    = null,
    staleData    = !!farmerState?.staleData,
    freshness    = staleData ? FRESHNESS.STALE : FRESHNESS.FRESH,
    counters     = null,
    tasksTodayTotal = null,
    continuity   = null,
    t            = null,
    now          = Date.now(),
  } = safe;

  // 1. Welcome header
  const welcome = buildWelcomeMessage({
    name, farmerState, weatherNow, timeOfDay, staleData, t, now,
  });

  // 2. Display mode
  const displayMode = resolveHomeDisplayMode(farmerState);

  // 3. Dominant card
  const normalizedTask = normalizeTask(task);
  const confidenceLevel = farmerState?.confidenceLevel || normalizedTask?.level || null;

  const labelEntry = stateLabelKey(farmerState);
  const label = resolve(t, labelEntry.key, labelEntry.fallback);

  let card;
  if (displayMode === 'task_first' && normalizedTask) {
    // TASK-FIRST — task title is the dominant line.
    const cta = cardCtaKey(farmerState, 'task', confidenceLevel);
    card = {
      label,
      title: normalizedTask.title
        || resolve(t, farmerState?.titleKey, farmerState?.titleFallback),
      why: normalizedTask.why
        || resolve(t, farmerState?.whyKey, farmerState?.whyFallback)
        || pickFallbackWhy(farmerState, weatherNow, t),
      nextStep: null,   // task-first states don't render a bridge line
      cta: resolve(t, cta.key, cta.fallback),
      ctaKey: cta.key,
      confidenceLine: farmerState?.staleData
        ? resolve(t, 'closing_gaps.based_on_last_update',
            'Based on your last update')
        : null,
      intent:  normalizedTask.intent,
      taskId:  normalizedTask.taskId,
      variant: 'task',
      level:   confidenceLevel,
    };
  } else if (farmerState?.stateType === STATE_TYPES.STALE_OFFLINE
           || freshness === FRESHNESS.VERY_STALE) {
    // STALE-SAFE — never imperative.
    const cta = { key: 'home.card.try_again', fallback: 'Try again' };
    card = {
      label: resolve(t, 'home.card.label.stale', 'BASED ON LAST UPDATE'),
      title: resolve(t, 'home.card.stale_title', 'Check your field today'),
      why:   resolve(t, 'home.card.stale_why',
        'Your latest data may be out of date'),
      nextStep: resolve(t, 'state.next.reconnect_to_refresh',
        'Reconnect to refresh your guidance'),
      cta: resolve(t, cta.key, cta.fallback),
      ctaKey: cta.key,
      confidenceLine: resolve(t, 'closing_gaps.based_on_last_update',
        'Based on your last update'),
      intent: null, taskId: null,
      variant: 'stale_safe',
      level: 'low',
    };
  } else {
    // STATE-FIRST — state title + next-step bridge.
    const cta = cardCtaKey(farmerState, 'state', confidenceLevel);
    const title = resolve(t, farmerState?.titleKey, farmerState?.titleFallback)
      || welcome.line1;
    const subtitle = resolve(t, farmerState?.subtitleKey, farmerState?.subtitleFallback);
    const nextStep = resolve(t, farmerState?.nextKey, farmerState?.nextFallback);
    card = {
      label,
      title,
      why: subtitle || pickFallbackWhy(farmerState, weatherNow, t),
      nextStep: nextStep || null,
      cta: resolve(t, cta.key, cta.fallback),
      ctaKey: cta.key,
      confidenceLine: farmerState?.staleData
        ? resolve(t, 'closing_gaps.based_on_last_update',
            'Based on your last update')
        : null,
      intent: null,
      taskId: normalizedTask?.taskId || null,
      variant: 'state',
      level: confidenceLevel,
    };
  }

  // 4. Progress line — tasksTodayTotal can come from the engine;
  //    counters.tasks_completed_count is from outcomeTracking.
  const progress = buildProgressLine({
    done:  counters?.tasks_completed_today
        ?? counters?.tasks_completed_count_today
        ?? 0,
    total: tasksTodayTotal,
  }, t);

  // 5. Reminder variant — was the same task shown yesterday
  //    without completion? The shell renders a softer card label.
  const isReminder = card.taskId
    ? isReminderVariant(card.taskId, continuity, now)
    : false;
  if (isReminder) {
    card.label = resolve(t, 'home.card.label.reminder',
      'STILL ON YOUR LIST');
    card.why = resolve(t, 'closing_gaps.reminder.small_nudge',
      'A quick reminder from yesterday');
  }

  const payload = {
    welcome,
    displayMode,
    card,
    progress,
    reminder: isReminder,
    state: farmerState,
    devIssues: [],
  };
  payload.devIssues = runHomeDevAssertions(payload);
  return payload;
}

/**
 * pickFallbackWhy — last-resort reason text so the dominant card
 * is NEVER emitted without a "why" line. Ties wording to the
 * state or weather signal when possible.
 */
function pickFallbackWhy(farmerState, weatherNow, t) {
  if (farmerState?.stateType === STATE_TYPES.BLOCKED_BY_LAND) {
    return resolve(t, 'closing_gaps.conditions_may_not_be_right',
      'Conditions may not be right yet');
  }
  if (farmerState?.stateType === STATE_TYPES.RETURNING_INACTIVE) {
    return resolve(t, 'home.why.missed_days',
      'You missed a few days — start here');
  }
  if (weatherNow?.rainRisk === 'high') {
    return resolve(t, 'closing_gaps.region.monsoon_mixed.rain_note',
      'Rain expected soon');
  }
  // Ultimate fallback — we still return a string, never null.
  return resolve(t, 'home.why.generic', 'Here\u2019s what matters today');
}

export const _internal = { normalizeTask, stateLabelKey, cardCtaKey, pickFallbackWhy };
