/**
 * funnelConversionService.js — per-step conversion rates across
 * a user population. Answers:
 *
 *   • "Of people who see Welcome, how many finish Location?"
 *   • "Of people who finish Location, how many accept a
 *     recommendation?"
 *   • "Of people who accept a recommendation, how many open Today?"
 *
 * The conversion matrix is the backbone of every onboarding /
 * activation dashboard. Exported as plain numbers + ratios so
 * callers can render it however they want.
 *
 * Two entry points:
 *   computeFunnelConversions(users) → full matrix
 *   computeStepConversion(users, from, to) → single pair
 */

import {
  FUNNEL_EVENT_TYPES,
  FUNNEL_STEPS,
  FUNNEL_STEP_ORDER,
  DECISION_EVENT_TYPES,
} from './decisionEventTypes.js';

function hasStepCompleted(events, step) {
  return events.some((e) =>
    e?.type === FUNNEL_EVENT_TYPES.STEP_COMPLETED && e?.meta?.step === step);
}
function hasStepViewed(events, step) {
  return events.some((e) =>
    e?.type === FUNNEL_EVENT_TYPES.STEP_VIEWED && e?.meta?.step === step);
}

/**
 * Builds the per-step funnel counts.
 *   {
 *     perStep: [
 *       { step, viewed, completed, abandoned,
 *         completionRate, abandonmentRate, dropOff },
 *       ...
 *     ],
 *     overall: {
 *       enteredOnboarding, completedOnboarding, overallConversion,
 *       biggestDropOff: { step, dropOff },
 *     }
 *   }
 */
export function computeFunnelConversions(users = []) {
  const safe = Array.isArray(users) ? users : [];
  const perStep = [];

  for (const step of FUNNEL_STEP_ORDER) {
    let viewed = 0, completed = 0, abandoned = 0;
    for (const u of safe) {
      const events = Array.isArray(u?.events) ? u.events : [];
      if (hasStepViewed(events, step)) viewed += 1;
      if (hasStepCompleted(events, step)) completed += 1;
      if (events.some((e) =>
          e?.type === FUNNEL_EVENT_TYPES.STEP_ABANDONED && e?.meta?.step === step))
        abandoned += 1;
    }
    const completionRate  = viewed > 0 ? +(completed / viewed).toFixed(3) : null;
    const abandonmentRate = viewed > 0 ? +(abandoned / viewed).toFixed(3) : null;
    const dropOff = Math.max(0, viewed - completed);
    perStep.push({ step, viewed, completed, abandoned, completionRate, abandonmentRate, dropOff });
  }

  const enteredOnboarding   = perStep[0]?.viewed ?? 0;
  const completedOnboarding = perStep.find((s) => s.step === FUNNEL_STEPS.ONBOARDING_COMPLETED)?.completed ?? 0;
  const overallConversion = enteredOnboarding > 0
    ? +(completedOnboarding / enteredOnboarding).toFixed(3)
    : null;

  let biggest = null;
  for (const s of perStep) {
    if (biggest == null || s.dropOff > biggest.dropOff) biggest = s;
  }

  return {
    perStep,
    overall: {
      enteredOnboarding,
      completedOnboarding,
      overallConversion,
      biggestDropOff: biggest ? { step: biggest.step, dropOff: biggest.dropOff } : null,
    },
  };
}

/**
 * computeStepConversion — conversion between two arbitrary steps.
 * Useful for questions like "of people who saw recommendations,
 * how many selected a crop?"
 */
export function computeStepConversion(users = [], fromStep, toStep) {
  const safe = Array.isArray(users) ? users : [];
  let from = 0, to = 0;
  for (const u of safe) {
    const events = Array.isArray(u?.events) ? u.events : [];
    if (!hasStepViewed(events, fromStep) && !hasStepCompleted(events, fromStep)) continue;
    from += 1;
    if (hasStepCompleted(events, toStep)) to += 1;
  }
  return {
    fromStep, toStep, fromCount: from, toCount: to,
    rate: from > 0 ? +(to / from).toFixed(3) : null,
  };
}

/**
 * computeDecisionFunnel — the cross-cutting decision funnel on
 * top of the onboarding funnel:
 *   recommendation_viewed → selected → task_completed → harvest_submitted
 *
 * This is the "do our recommendations lead to real outcomes?"
 * question. Returns counts + step conversion rates.
 */
export function computeDecisionFunnel(users = []) {
  const safe = Array.isArray(users) ? users : [];
  let recViewed = 0, recSelected = 0, taskCompleted = 0, harvested = 0;
  for (const u of safe) {
    const events = Array.isArray(u?.events) ? u.events : [];
    const sawRec   = events.some((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_VIEWED);
    const pickedRec = events.some((e) => e?.type === DECISION_EVENT_TYPES.RECOMMENDATION_SELECTED);
    const didTask   = events.some((e) => e?.type === DECISION_EVENT_TYPES.TASK_COMPLETED);
    const harvestedU = events.some((e) => e?.type === DECISION_EVENT_TYPES.HARVEST_SUBMITTED);
    if (sawRec)     recViewed   += 1;
    if (pickedRec)  recSelected += 1;
    if (didTask)    taskCompleted += 1;
    if (harvestedU) harvested   += 1;
  }
  const rate = (a, b) => b > 0 ? +(a / b).toFixed(3) : null;
  return {
    recViewed, recSelected, taskCompleted, harvested,
    rates: {
      viewedToSelected:     rate(recSelected, recViewed),
      selectedToTask:       rate(taskCompleted, recSelected),
      taskToHarvest:        rate(harvested, taskCompleted),
      viewedToHarvest:      rate(harvested, recViewed),
    },
  };
}
