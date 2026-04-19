/**
 * getGreetingState.js — classifies the farmer's situation into
 * one of six greeting states.
 *
 *   'post_harvest'    — just finished a harvest; show next-cycle cue
 *   'inactive_return' — missed N+ days; welcome-back / catch-up
 *   'first_use'       — new or onboarding not yet producing a cycle
 *   'active_day'      — there's work to do today
 *   'done_for_today'  — everything required is complete
 *   'generic'         — fallback when nothing else applies
 *
 * Priority order (specified explicitly in code, not docs):
 *
 *   1. post_harvest
 *   2. inactive_return
 *   3. first_use
 *   4. active_day
 *   5. done_for_today
 *   6. generic
 *
 * The resolver is a pure function so it can be unit-tested without
 * mounting React or fetching anything.
 */

const DEFAULT_INACTIVE_THRESHOLD_DAYS = 3;

export const GREETING_STATES = Object.freeze({
  POST_HARVEST:    'post_harvest',
  INACTIVE_RETURN: 'inactive_return',
  FIRST_USE:       'first_use',
  ACTIVE_DAY:      'active_day',
  DONE_FOR_TODAY:  'done_for_today',
  GENERIC:         'generic',
});

export const GREETING_PRIORITY = Object.freeze([
  GREETING_STATES.POST_HARVEST,
  GREETING_STATES.INACTIVE_RETURN,
  GREETING_STATES.FIRST_USE,
  GREETING_STATES.ACTIVE_DAY,
  GREETING_STATES.DONE_FOR_TODAY,
  GREETING_STATES.GENERIC,
]);

/**
 * getGreetingState — return the single state that applies.
 *
 * @param {object}  input
 * @param {boolean} [input.hasJustCompletedHarvest]
 * @param {boolean} [input.hasCatchUpState]
 * @param {number}  [input.missedDays]
 * @param {boolean} [input.hasCompletedOnboarding]
 * @param {boolean} [input.hasActiveCropCycle]
 * @param {'active'|'done'} [input.todayState]
 * @param {number}  [input.inactiveThresholdDays=3]
 */
export function getGreetingState(input = {}) {
  const safe = input || {};
  const threshold = Number(safe.inactiveThresholdDays) >= 0
    ? Number(safe.inactiveThresholdDays)
    : DEFAULT_INACTIVE_THRESHOLD_DAYS;
  input = safe;

  // 1. Post-harvest wins over everything — it's the rare moment
  //    when the farmer needs a completely different cue.
  if (input.hasJustCompletedHarvest === true) {
    return GREETING_STATES.POST_HARVEST;
  }

  // 2. Inactive return overrides even "first use" because a farmer
  //    coming back after a week shouldn't see onboarding copy if
  //    they already have a cycle. The catch-up flag also forces it.
  const missedDays = Number(input.missedDays) || 0;
  if (input.hasCatchUpState === true || missedDays >= threshold) {
    return GREETING_STATES.INACTIVE_RETURN;
  }

  // 3. First use — no onboarding yet OR no active crop cycle.
  if (input.hasCompletedOnboarding !== true || input.hasActiveCropCycle !== true) {
    return GREETING_STATES.FIRST_USE;
  }

  // 4 + 5. Active vs done depends on today state.
  if (input.todayState === 'active') return GREETING_STATES.ACTIVE_DAY;
  if (input.todayState === 'done')   return GREETING_STATES.DONE_FOR_TODAY;

  // 6. Fall through.
  return GREETING_STATES.GENERIC;
}

/**
 * getTimeOfDay — morning / afternoon / evening derived from a
 * Date. Keeps the same thresholds everywhere so tests can pin a
 * deterministic clock.
 *
 *   hours < 12       → 'morning'
 *   hours < 17       → 'afternoon'
 *   hours >= 17      → 'evening'
 */
export function getTimeOfDay(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export const _internal = { DEFAULT_INACTIVE_THRESHOLD_DAYS };
